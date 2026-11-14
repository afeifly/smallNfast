//! Embedded LAN Web Server & Remote Hardware RPC Bridge (Port 9080)
//!
//! Allows the S4A Desktop App (macOS / Windows) to act as a LAN Web Host on port 9080.
//! Any other PC/tablet on the same LAN can open `http://<host-ip>:9080` in a browser
//! with zero installation and access all S4A features (including the Host PC's Direct USB,
//! Ethernet TCP, Modbus TCP/RTU, BLE, Readout, and ProcessScape state).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::Manager;

use super::logger::log_event;
use super::SutoState;

pub const DEFAULT_WEB_SERVER_PORT: u16 = 9080;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebServerStatus {
    pub enabled: bool,
    pub port: u16,
    pub primary_url: String,
    pub urls: Vec<String>,
}

struct ServerController {
    enabled: bool,
    port: u16,
    stop_flag: Option<Arc<AtomicBool>>,
}

static SERVER_CTRL: LazyLock<Mutex<ServerController>> = LazyLock::new(|| {
    Mutex::new(ServerController {
        enabled: false,
        port: DEFAULT_WEB_SERVER_PORT,
        stop_flag: None,
    })
});

static SHARED_STATE_PATH: LazyLock<PathBuf> = LazyLock::new(|| {
    if let Ok(mut p) = std::env::current_exe() {
        p.pop();
        let dir_str = p.to_string_lossy();
        // Do not write inside a signed macOS .app bundle (.app/Contents/MacOS)
        if !dir_str.contains(".app/Contents/MacOS") {
            p.push("s4a_lan_shared_state.json");
            if std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .open(&p)
                .is_ok()
            {
                return p;
            }
        }
    }
    let mut tmp = std::env::temp_dir();
    tmp.push("s4a_lan_shared_state.json");
    tmp
});

fn load_shared_state_from_disk() -> HashMap<String, String> {
    let path = &*SHARED_STATE_PATH;
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&content) {
                return map;
            }
        }
    }
    HashMap::new()
}

fn save_shared_state_to_disk(map: &HashMap<String, String>) {
    let path = &*SHARED_STATE_PATH;
    if let Ok(json) = serde_json::to_string(map) {
        let _ = std::fs::write(path, json.as_bytes());
    }
}

static SHARED_STORAGE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(load_shared_state_from_disk()));

/// Detect the host machine's primary LAN IPv4 address using OS routing table lookup (no packet sent)
pub fn detect_lan_ips(port: u16) -> (String, Vec<String>) {
    let mut ips: Vec<String> = Vec::new();

    for target in ["8.8.8.8:80", "192.168.1.1:80", "10.0.0.1:80"] {
        if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
            if sock.connect(target).is_ok() {
                if let Ok(local_addr) = sock.local_addr() {
                    let ip_str = local_addr.ip().to_string();
                    if !ip_str.starts_with("127.") && ip_str != "0.0.0.0" && !ips.contains(&ip_str) {
                        ips.push(ip_str);
                    }
                }
            }
        }
    }

    let mut urls: Vec<String> = ips
        .iter()
        .map(|ip| format!("http://{}:{}", ip, port))
        .collect();
    let localhost_url = format!("http://localhost:{}", port);
    if !urls.contains(&localhost_url) {
        urls.push(localhost_url.clone());
    }

    let primary_url = urls.first().cloned().unwrap_or(localhost_url);
    (primary_url, urls)
}

#[tauri::command]
pub fn suto_get_webserver_status() -> Result<WebServerStatus, String> {
    let ctrl = SERVER_CTRL.lock().unwrap_or_else(|p| p.into_inner());
    let (primary_url, urls) = detect_lan_ips(ctrl.port);
    Ok(WebServerStatus {
        enabled: ctrl.enabled,
        port: ctrl.port,
        primary_url,
        urls,
    })
}

#[tauri::command]
pub fn suto_sync_shared_state(entries: HashMap<String, String>) -> Result<(), String> {
    let mut store = SHARED_STORAGE.lock().unwrap_or_else(|p| p.into_inner());
    let mut changed = false;
    for (k, v) in entries {
        if k == "__sync_ts__" {
            continue;
        }
        if store.get(&k) != Some(&v) {
            store.insert(k, v);
            changed = true;
        }
    }
    if changed {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis().to_string())
            .unwrap_or_else(|_| "1".to_string());
        store.insert("__sync_ts__".to_string(), now_ms);
        save_shared_state_to_disk(&store);
    }
    Ok(())
}

#[tauri::command]
pub fn suto_get_shared_state() -> Result<HashMap<String, String>, String> {
    let store = SHARED_STORAGE.lock().unwrap_or_else(|p| p.into_inner());
    Ok(store.clone())
}

#[tauri::command]
pub fn suto_set_webserver_enabled(
    enabled: bool,
    port: Option<u16>,
    app: tauri::AppHandle,
) -> Result<WebServerStatus, String> {
    let target_port = port.unwrap_or(DEFAULT_WEB_SERVER_PORT);
    let mut ctrl = SERVER_CTRL.lock().unwrap_or_else(|p| p.into_inner());

    // Stop existing server if running
    if let Some(flag) = ctrl.stop_flag.take() {
        flag.store(true, Ordering::SeqCst);
        // Wake up blocking accept if any
        let _ = TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", ctrl.port).parse().unwrap(),
            Duration::from_millis(100),
        );
    }
    ctrl.enabled = false;
    ctrl.port = target_port;

    if !enabled {
        log_event(
            "INFO",
            "WEB_SERVER",
            &format!("LAN Web Server on port {} stopped.", target_port),
            None,
        );
        let (primary_url, urls) = detect_lan_ips(target_port);
        return Ok(WebServerStatus {
            enabled: false,
            port: target_port,
            primary_url,
            urls,
        });
    }

    // Bind TCP listener on 0.0.0.0:<port>
    let bind_addr = format!("0.0.0.0:{}", target_port);
    let listener = TcpListener::bind(&bind_addr).map_err(|e| {
        format!(
            "Failed to bind LAN Web Server on port {}: {}",
            target_port, e
        )
    })?;
    let _ = listener.set_nonblocking(true);

    let stop_flag = Arc::new(AtomicBool::new(false));
    let thread_stop = stop_flag.clone();
    let app_handle = app.clone();

    std::thread::spawn(move || {
        while !thread_stop.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _peer)) => {
                    if thread_stop.load(Ordering::SeqCst) {
                        break;
                    }
                    // Accepted sockets inherit non-blocking mode from `listener` on Windows/macOS/BSD.
                    // Explicitly restore blocking mode so large asset writes don't abort with WouldBlock.
                    let _ = stream.set_nonblocking(false);
                    let app_clone = app_handle.clone();
                    std::thread::spawn(move || {
                        if let Err(e) = handle_http_connection(stream, app_clone) {
                            log_event("WARN", "WEB_SERVER", &format!("HTTP connection error: {}", e), None);
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(25));
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(50));
                }
            }
        }
    });

    ctrl.enabled = true;
    ctrl.stop_flag = Some(stop_flag);

    let (primary_url, urls) = detect_lan_ips(target_port);
    log_event(
        "INFO",
        "WEB_SERVER",
        &format!(
            "LAN Web Server started on port {} -> {}",
            target_port, primary_url
        ),
        None,
    );

    Ok(WebServerStatus {
        enabled: true,
        port: target_port,
        primary_url,
        urls,
    })
}

fn handle_http_connection(mut stream: TcpStream, app: tauri::AppHandle) -> Result<(), String> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(15)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(60)));
    let _ = stream.set_nodelay(true);

    let mut buf = Vec::with_capacity(8192);
    let mut temp = [0u8; 4096];
    let mut header_end_idx: Option<usize> = None;
    let mut content_length: usize = 0;
    let read_start = std::time::Instant::now();

    // 1. Read HTTP headers
    loop {
        match stream.read(&mut temp) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&temp[..n]);
                if let Some(pos) = find_subsequence(&buf, b"\r\n\r\n") {
                    header_end_idx = Some(pos + 4);
                    let header_str = String::from_utf8_lossy(&buf[..pos]);
                    for line in header_str.lines() {
                        if line.to_ascii_lowercase().starts_with("content-length:") {
                            if let Some(val) = line.split(':').nth(1) {
                                content_length = val.trim().parse::<usize>().unwrap_or(0);
                            }
                        }
                    }
                    break;
                }
                if buf.len() > 65536 {
                    return Err("Header too large".into());
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    && read_start.elapsed() < Duration::from_secs(15) =>
            {
                let _ = stream.set_nonblocking(false);
                std::thread::sleep(Duration::from_millis(5));
                continue;
            }
            Err(_) => break,
        }
    }

    let hdr_end = match header_end_idx {
        Some(idx) => idx,
        None => return Ok(()),
    };

    // 2. Read remaining request body if Content-Length > 0
    while buf.len() < hdr_end + content_length {
        match stream.read(&mut temp) {
            Ok(0) => break,
            Ok(n) => buf.extend_from_slice(&temp[..n]),
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    && read_start.elapsed() < Duration::from_secs(15) =>
            {
                let _ = stream.set_nonblocking(false);
                std::thread::sleep(Duration::from_millis(5));
                continue;
            }
            Err(_) => break,
        }
    }

    let header_text = String::from_utf8_lossy(&buf[..hdr_end]);
    let first_line = header_text.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_uppercase();
    let raw_path = parts.next().unwrap_or("/");
    let path = raw_path.split('?').next().unwrap_or("/");
    let body_bytes = if buf.len() >= hdr_end {
        &buf[hdr_end..buf.len().min(hdr_end + content_length)]
    } else {
        &[]
    };

    // CORS Preflight
    if method == "OPTIONS" {
        return send_response(&mut stream, 200, "text/plain", b"");
    }

    // API Routes
    if path == "/api/status" {
        let resp = json!({
            "ok": true,
            "mode": "lan-bridge",
            "port": DEFAULT_WEB_SERVER_PORT,
        });
        return send_json(&mut stream, 200, &resp);
    }

    if path == "/api/shared-state" {
        if method == "POST" {
            if let Ok(incoming) = serde_json::from_slice::<HashMap<String, String>>(body_bytes) {
                let _ = suto_sync_shared_state(incoming);
            }
            let current = suto_get_shared_state().unwrap_or_default();
            return send_json(&mut stream, 200, &json!({ "ok": true, "data": current }));
        } else {
            let current = suto_get_shared_state().unwrap_or_default();
            return send_json(&mut stream, 200, &json!({ "ok": true, "data": current }));
        }
    }

    if path == "/api/invoke" && method == "POST" {
        let payload: Value = serde_json::from_slice(body_bytes).unwrap_or_else(|_| json!({}));
        let cmd = payload
            .get("cmd")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let args = payload.get("args").cloned().unwrap_or_else(|| json!({}));

        match dispatch_rpc_command(&app, &cmd, &args) {
            Ok(data) => return send_json(&mut stream, 200, &json!({ "ok": true, "data": data })),
            Err(err) => {
                return send_json(&mut stream, 200, &json!({ "ok": false, "error": err }))
            }
        }
    }

    // Static Asset Serving (SPA)
    serve_static_asset(&mut stream, &app, path)
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn write_all_reliable(stream: &mut TcpStream, mut data: &[u8]) -> Result<(), String> {
    let _ = stream.set_nonblocking(false);
    let start = std::time::Instant::now();
    while !data.is_empty() {
        let chunk_len = data.len().min(65536);
        match stream.write(&data[..chunk_len]) {
            Ok(0) => return Err("Socket closed before full response could be written".into()),
            Ok(n) => {
                data = &data[n..];
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(ref e)
                if (e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut)
                    && start.elapsed() < Duration::from_secs(60) =>
            {
                let _ = stream.set_nonblocking(false);
                std::thread::sleep(Duration::from_millis(5));
                continue;
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

fn send_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> Result<(), String> {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    };
    let header = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
        status,
        status_text,
        content_type,
        body.len()
    );
    write_all_reliable(stream, header.as_bytes())?;
    write_all_reliable(stream, body)?;
    let _ = stream.flush();
    // Gracefully half-close write side and briefly drain until client EOF so Winsock/OS
    // never sends a TCP RST while large asset packets are still in flight over LAN.
    let _ = stream.shutdown(std::net::Shutdown::Write);
    let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
    let mut drain = [0u8; 512];
    while let Ok(n) = stream.read(&mut drain) {
        if n == 0 {
            break;
        }
    }
    Ok(())
}

fn send_json(stream: &mut TcpStream, status: u16, val: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(val).unwrap_or_else(|_| b"{}".to_vec());
    send_response(stream, status, "application/json; charset=utf-8", &bytes)
}

fn guess_mime_type(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".html") || lower.ends_with(".htm") {
        "text/html; charset=utf-8"
    } else if lower.ends_with(".js") || lower.ends_with(".mjs") {
        "application/javascript; charset=utf-8"
    } else if lower.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".wasm") {
        "application/wasm"
    } else if lower.ends_with(".json") {
        "application/json; charset=utf-8"
    } else {
        "application/octet-stream"
    }
}

fn inject_lan_bridge_flag(html_bytes: &[u8]) -> Vec<u8> {
    let html = String::from_utf8_lossy(html_bytes);
    let shared_map = suto_get_shared_state().unwrap_or_default();
    let shared_json = serde_json::to_string(&shared_map)
        .unwrap_or_else(|_| "{}".to_string())
        .replace("</", "<\\/");
    let script_tag = format!(
        "<script>window.__S4A_LAN_BRIDGE__ = true;window.__S4A_SHARED_STATE__ = {};(function(){{try{{var s=window.__S4A_SHARED_STATE__||{{}};for(var k in s){{if(Object.prototype.hasOwnProperty.call(s,k)&&typeof s[k]==='string'){{window.localStorage.setItem(k,s[k]);}}}}}}catch(e){{}}}})();</script>",
        shared_json
    );
    if let Some(idx) = html.find("<head>") {
        let insert_at = idx + "<head>".len();
        let mut out = String::with_capacity(html.len() + script_tag.len() + 2);
        out.push_str(&html[..insert_at]);
        out.push_str(&script_tag);
        out.push_str(&html[insert_at..]);
        out.into_bytes()
    } else if let Some(idx) = html.find("</head>") {
        let mut out = String::with_capacity(html.len() + script_tag.len() + 2);
        out.push_str(&html[..idx]);
        out.push_str(&script_tag);
        out.push_str(&html[idx..]);
        out.into_bytes()
    } else {
        format!("{}{}", script_tag, html).into_bytes()
    }
}

fn percent_decode_path(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push(((h << 4) | l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn try_serve_from_disk_dist(clean_path: &str) -> Option<(&'static str, Vec<u8>)> {
    let dist_candidates = [
        PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../dist")),
        PathBuf::from("../dist"),
        PathBuf::from("dist"),
    ];
    for dist_dir in &dist_candidates {
        if dist_dir.exists() {
            let target_file = dist_dir.join(clean_path);
            let file_to_read = if target_file.is_file() {
                Some((target_file, clean_path.ends_with("index.html")))
            } else if !clean_path.contains('.') {
                let idx_file = dist_dir.join("index.html");
                if idx_file.is_file() {
                    Some((idx_file, true))
                } else {
                    None
                }
            } else {
                None
            };

            if let Some((path_buf, is_html)) = file_to_read {
                if let Ok(raw_bytes) = std::fs::read(&path_buf) {
                    let bytes = if is_html {
                        inject_lan_bridge_flag(&raw_bytes)
                    } else {
                        raw_bytes
                    };
                    let mime = if is_html {
                        "text/html; charset=utf-8"
                    } else {
                        guess_mime_type(clean_path)
                    };
                    return Some((mime, bytes));
                }
            }
        }
    }
    None
}

fn try_serve_from_embedded_assets(
    app: &tauri::AppHandle,
    clean_path: &str,
) -> Option<(&'static str, Vec<u8>)> {
    let resolver = app.asset_resolver();
    for candidate in [
        clean_path.to_string(),
        format!("/{}", clean_path),
        "index.html".to_string(),
        "/index.html".to_string(),
    ] {
        // Only fall back to index.html if the requested path has no file extension (SPA route) or is index.html
        if (candidate == "index.html" || candidate == "/index.html")
            && clean_path != "index.html"
            && clean_path.contains('.')
        {
            continue;
        }
        if let Some(asset) = resolver.get(candidate.clone()) {
            let is_html = candidate.ends_with("index.html");
            let bytes = if is_html {
                inject_lan_bridge_flag(asset.bytes())
            } else {
                asset.bytes().to_vec()
            };
            let mime = if is_html {
                "text/html; charset=utf-8"
            } else {
                guess_mime_type(clean_path)
            };
            return Some((mime, bytes));
        }
    }
    None
}

fn serve_static_asset(
    stream: &mut TcpStream,
    app: &tauri::AppHandle,
    req_path: &str,
) -> Result<(), String> {
    let decoded_path = percent_decode_path(req_path);
    let clean_path = if decoded_path == "/" || decoded_path.is_empty() {
        "index.html".to_string()
    } else {
        decoded_path.trim_start_matches('/').replace('\\', "/")
    };

    // In dev builds (`npm run tauri:dev` / `dev-macos.sh`), check `dist/` on disk first.
    // In production release builds (GitHub Actions `.exe` / `.dmg` / `.app`), check embedded Tauri assets first.
    let resolved = if cfg!(debug_assertions) {
        try_serve_from_disk_dist(&clean_path)
            .or_else(|| try_serve_from_embedded_assets(app, &clean_path))
    } else {
        try_serve_from_embedded_assets(app, &clean_path)
            .or_else(|| try_serve_from_disk_dist(&clean_path))
    };

    if let Some((mime, bytes)) = resolved {
        return send_response(stream, 200, mime, &bytes);
    }

    send_response(
        stream,
        404,
        "text/plain; charset=utf-8",
        b"404 Not Found - Build frontend (npm run build) or run packaged Tauri app.",
    )
}

/// Dispatch a Tauri IPC command invoked remotely by a LAN browser via `POST /api/invoke`
fn dispatch_rpc_command(app: &tauri::AppHandle, cmd: &str, args: &Value) -> Result<Value, String> {
    let state: tauri::State<'_, SutoState> = app.state::<SutoState>();

    let get_str = |k1: &str, k2: &str| -> Option<String> {
        args.get(k1)
            .or_else(|| args.get(k2))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    let get_u64 = |k1: &str, k2: &str| -> Option<u64> {
        args.get(k1)
            .or_else(|| args.get(k2))
            .and_then(|v| v.as_u64())
    };
    let get_bool = |k1: &str, k2: &str| -> Option<bool> {
        args.get(k1)
            .or_else(|| args.get(k2))
            .and_then(|v| v.as_bool())
    };
    let get_u8_vec = |k1: &str, k2: &str| -> Option<Vec<u8>> {
        args.get(k1)
            .or_else(|| args.get(k2))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|x| x.as_u64().map(|n| n as u8))
                    .collect()
            })
    };

    match cmd {
        "suto_get_webserver_status" => {
            let res = suto_get_webserver_status()?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_shared_state" => {
            let res = suto_get_shared_state()?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_sync_shared_state" => {
            if let Some(entries_val) = args.get("entries") {
                if let Ok(map) =
                    serde_json::from_value::<HashMap<String, String>>(entries_val.clone())
                {
                    suto_sync_shared_state(map)?;
                }
            }
            Ok(json!(null))
        }
        "suto_list_usb_devices" => {
            let res = super::suto_list_usb_devices()?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_connect_usb" => {
            let path = get_str("path", "path");
            let res = tauri::async_runtime::block_on(super::suto_connect_usb(path, state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_connect_tcp" => {
            let host = get_str("host", "host").unwrap_or_else(|| "192.168.1.100".to_string());
            let port = get_u64("port", "port").unwrap_or(502) as u16;
            let res = tauri::async_runtime::block_on(super::suto_connect_tcp(host, port, state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_discover_ethernet_broadcast" => {
            let timeout_ms = get_u64("timeoutMs", "timeout_ms");
            let subnet_broadcast = get_str("subnetBroadcast", "subnet_broadcast");
            let res = tauri::async_runtime::block_on(super::suto_discover_ethernet_broadcast(
                timeout_ms,
                subnet_broadcast,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_list_ble_devices" => {
            let timeout_ms = get_u64("timeoutMs", "timeout_ms");
            let suto_only = get_bool("sutoOnly", "suto_only");
            let res = tauri::async_runtime::block_on(super::suto_list_ble_devices(
                timeout_ms,
                suto_only,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_connect_ble" => {
            let device_id = get_str("deviceId", "device_id")
                .ok_or_else(|| "Missing deviceId for BLE connection".to_string())?;
            let res = tauri::async_runtime::block_on(super::suto_connect_ble(device_id, state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_disconnect" => {
            super::suto_disconnect(state)?;
            Ok(json!(null))
        }
        "suto_get_channels" => {
            let res = tauri::async_runtime::block_on(super::suto_get_channels(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_values" => {
            let res = tauri::async_runtime::block_on(super::suto_get_values(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_system_info" => {
            let res = tauri::async_runtime::block_on(super::suto_get_system_info(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_logger_status" => {
            let res = tauri::async_runtime::block_on(super::suto_get_logger_status(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_logger_files" => {
            let res = tauri::async_runtime::block_on(super::suto_get_logger_files(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_read_s461_log" => {
            let start_time = get_u64("startTime", "start_time").unwrap_or(0) as u32;
            let stop_time = get_u64("stopTime", "stop_time").unwrap_or(0) as u32;
            let res = tauri::async_runtime::block_on(super::suto_read_s461_log(
                app.clone(),
                state,
                start_time,
                stop_time,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_read_s418_log" => {
            let start_time = get_u64("startTime", "start_time").unwrap_or(0) as u32;
            let stop_time = get_u64("stopTime", "stop_time").unwrap_or(0) as u32;
            let res = tauri::async_runtime::block_on(super::suto_read_s418_log(
                app.clone(),
                state,
                start_time,
                stop_time,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_600_csd_files" => {
            let res = tauri::async_runtime::block_on(super::suto_get_600_csd_files(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_generate_600_report" => {
            let id = get_u64("id", "id").unwrap_or(0) as u32;
            let name = get_str("name", "name").unwrap_or_default();
            let size = get_u64("size", "size").unwrap_or(0) as u32;
            let date = get_u64("date", "date").unwrap_or(0) as u32;
            let res = tauri::async_runtime::block_on(super::suto_generate_600_report(
                id, name, size, date, state,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_screenshots" => {
            let res = tauri::async_runtime::block_on(super::suto_get_screenshots(state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_read_screenshot" => {
            let name = get_str("name", "name").unwrap_or_default();
            let size = get_u64("size", "size").unwrap_or(0) as u32;
            let bytes = super::read_screenshot_bytes(name, size, &state)?;
            serde_json::to_value(bytes).map_err(|e| e.to_string())
        }
        "suto_send_command" => {
            let addr = get_u64("addr", "addr").map(|n| n as u8);
            let cty = get_u64("cty", "cty").unwrap_or(0) as u8;
            let scty = get_u64("scty", "scty").unwrap_or(0) as u8;
            let act = get_u64("act", "act").unwrap_or(0) as u8;
            let data = get_u8_vec("data", "data");
            let res = tauri::async_runtime::block_on(super::suto_send_command(
                addr, cty, scty, act, data, state,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_send_raw" => {
            let addr = get_u64("addr", "addr").unwrap_or(1) as u8;
            let data = get_u8_vec("data", "data").unwrap_or_default();
            let res = tauri::async_runtime::block_on(super::suto_send_raw(addr, data, state))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_read_modbus_registers" => {
            let host = get_str("host", "host").unwrap_or_else(|| "127.0.0.1".to_string());
            let port = get_u64("port", "port").unwrap_or(502) as u16;
            let slave_id = get_u64("slaveId", "slave_id").unwrap_or(1) as u8;
            let func_code = get_u64("funcCode", "func_code").unwrap_or(3) as u8;
            let reg_addr = get_u64("regAddr", "reg_addr").unwrap_or(0) as u16;
            let reg_count = get_u64("regCount", "reg_count").unwrap_or(2) as u16;
            let is_rtu = get_bool("isRtu", "is_rtu");
            let timeout_ms = get_u64("timeoutMs", "timeout_ms");
            let res = tauri::async_runtime::block_on(super::modbus::suto_read_modbus_registers(
                host, port, slave_id, func_code, reg_addr, reg_count, is_rtu, timeout_ms,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_exchange_cs_modbus" => {
            let host = get_str("host", "host").unwrap_or_else(|| "127.0.0.1".to_string());
            let port = get_u64("port", "port").unwrap_or(502) as u16;
            let slave_id = get_u64("slaveId", "slave_id").unwrap_or(1) as u8;
            let cs_packet = get_u8_vec("csPacket", "cs_packet").unwrap_or_default();
            let is_rtu = get_bool("isRtu", "is_rtu");
            let timeout_ms = get_u64("timeoutMs", "timeout_ms");
            let res = tauri::async_runtime::block_on(super::modbus::suto_exchange_cs_modbus(
                host, port, slave_id, cs_packet, is_rtu, timeout_ms,
            ))?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_logs" => {
            let since_id = get_u64("sinceId", "since_id");
            let res = super::suto_get_logs(since_id)?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_clear_logs" => {
            super::suto_clear_logs()?;
            Ok(json!(null))
        }
        "suto_get_log_file_path" => {
            let res = super::suto_get_log_file_path()?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_log_client_event" => {
            let level = get_str("level", "level").unwrap_or_else(|| "INFO".to_string());
            let tag = get_str("tag", "tag").unwrap_or_else(|| "LAN".to_string());
            let message = get_str("message", "message").unwrap_or_default();
            super::suto_log_client_event(level, tag, message)?;
            Ok(json!(null))
        }
        "suto_get_recent_files" => {
            let res = super::files::suto_get_recent_files()?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_add_recent_file" => {
            let path = get_str("path", "path").unwrap_or_default();
            let res = super::files::suto_add_recent_file(path)?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_remove_recent_file" => {
            let path = get_str("path", "path").unwrap_or_default();
            let res = super::files::suto_remove_recent_file(path)?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_get_file_stats" => {
            let path = get_str("path", "path").unwrap_or_default();
            let res = super::files::suto_get_file_stats(path)?;
            serde_json::to_value(res).map_err(|e| e.to_string())
        }
        "suto_read_file" => {
            let path = get_str("path", "path").unwrap_or_default();
            let bytes = super::files::read_file_bytes(path)?;
            serde_json::to_value(bytes).map_err(|e| e.to_string())
        }
        "suto_read_file_slice" => {
            let path = get_str("path", "path").unwrap_or_default();
            let offset = get_u64("offset", "offset").unwrap_or(0);
            let length = get_u64("length", "length").unwrap_or(0);
            let bytes = super::files::read_file_slice_bytes(path, offset, length)?;
            serde_json::to_value(bytes).map_err(|e| e.to_string())
        }
        _ => Err(format!("Unsupported remote RPC command: {}", cmd)),
    }
}
