//! SUTO Desktop File I/O & Recent Files Manager
//!
//! Provides native file dialogs, file slicing/reading, and persistent
//! recent files storage (`recent_files.json`) beside the application.

use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_opened: u64,
}

static RECENT_CONFIG_PATH: LazyLock<PathBuf> = LazyLock::new(|| {
    // 1. Attempt next to executable or working directory
    if let Ok(mut p) = std::env::current_exe() {
        p.pop();
        p.push("recent_files.json");
        return p;
    }
    let candidate = PathBuf::from("recent_files.json");
    if candidate.exists() {
        return candidate;
    }
    let mut tmp = std::env::temp_dir();
    tmp.push("suto_recent_files.json");
    tmp
});

fn load_recent_from_disk() -> Vec<RecentFileEntry> {
    let path = &*RECENT_CONFIG_PATH;
    if !path.exists() {
        return Vec::new();
    }
    if let Ok(content) = std::fs::read_to_string(path) {
        if let Ok(entries) = serde_json::from_str::<Vec<RecentFileEntry>>(&content) {
            return entries;
        }
    }
    Vec::new()
}

fn save_recent_to_disk(entries: &[RecentFileEntry]) -> Result<(), String> {
    let path = &*RECENT_CONFIG_PATH;
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    let mut f = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn suto_get_recent_files() -> Result<Vec<RecentFileEntry>, String> {
    Ok(load_recent_from_disk())
}

#[tauri::command]
pub fn suto_add_recent_file(path: String) -> Result<Vec<RecentFileEntry>, String> {
    let p = PathBuf::from(&path);
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let size = match std::fs::metadata(&p) {
        Ok(m) => m.len(),
        Err(_) => 0,
    };

    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut entries = load_recent_from_disk();
    entries.retain(|e| e.path != path && e.name != name);
    entries.insert(
        0,
        RecentFileEntry {
            name,
            path: path.clone(),
            size,
            last_opened: now,
        },
    );
    if entries.len() > 10 {
        entries.truncate(10);
    }

    let _ = save_recent_to_disk(&entries);
    Ok(entries)
}

#[tauri::command]
pub fn suto_remove_recent_file(path: String) -> Result<Vec<RecentFileEntry>, String> {
    let mut entries = load_recent_from_disk();
    entries.retain(|e| e.path != path && e.name != path);
    let _ = save_recent_to_disk(&entries);
    Ok(entries)
}

#[tauri::command]
pub fn suto_pick_file() -> Result<Option<String>, String> {
    let res = rfd::FileDialog::new()
        .add_filter("CSD / CSV Data Files", &["csd", "csv"])
        .set_title("Open SUTO Data File (.csd, .csv)")
        .pick_file();

    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn suto_read_file(path: String) -> Result<tauri::ipc::Response, String> {
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command]
pub fn suto_read_file_slice(path: String, offset: u64, length: u64) -> Result<tauri::ipc::Response, String> {
    let mut f = File::open(&path).map_err(|e| format!("Failed to open file '{}': {}", path, e))?;
    f.seek(SeekFrom::Start(offset))
        .map_err(|e| format!("Seek failed: {}", e))?;
    let mut buf = vec![0u8; length as usize];
    let n = f.read(&mut buf).map_err(|e| format!("Read failed: {}", e))?;
    buf.truncate(n);
    Ok(tauri::ipc::Response::new(buf))
}

#[tauri::command]
pub fn suto_get_file_stats(path: String) -> Result<RecentFileEntry, String> {
    let p = PathBuf::from(&path);
    let metadata = std::fs::metadata(&p)
        .map_err(|e| format!("File not found or inaccessible '{}': {}", path, e))?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(RecentFileEntry {
        name,
        path,
        size: metadata.len(),
        last_opened: now,
    })
}

#[tauri::command]
pub fn suto_save_binary_file(filename: String, data: Vec<u8>) -> Result<Option<String>, String> {
    let mut clean = filename.replace(':', "_");
    if clean.to_lowercase().ends_with(".png.bmp") {
        clean.truncate(clean.len() - 4);
    }
    let ext = std::path::Path::new(&clean)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png");

    let res = rfd::FileDialog::new()
        .set_file_name(&clean)
        .add_filter(&format!("Image (.{})", ext), &[ext])
        .set_title("Save Screenshot Image")
        .save_file();

    if let Some(path) = res {
        std::fs::write(&path, &data).map_err(|e| format!("Failed to write file '{}': {}", path.display(), e))?;
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn suto_pick_folder() -> Result<Option<String>, String> {
    let res = rfd::FileDialog::new()
        .set_title("Select Folder to Save Screenshots")
        .pick_folder();

    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn suto_save_file_to_path(folder: String, filename: String, data: Vec<u8>) -> Result<String, String> {
    let mut clean = filename.replace(':', "_");
    if clean.to_lowercase().ends_with(".png.bmp") {
        clean.truncate(clean.len() - 4);
    }
    let mut p = PathBuf::from(&folder);
    p.push(&clean);

    let mut counter = 1;
    let base_name = clean.clone();
    let (stem, ext) = match base_name.rfind('.') {
        Some(idx) => (&base_name[..idx], &base_name[idx..]),
        None => (base_name.as_str(), ""),
    };

    while p.exists() {
        let new_name = format!("{}_{}{}", stem, counter, ext);
        p = PathBuf::from(&folder);
        p.push(new_name);
        counter += 1;
    }

    std::fs::write(&p, &data).map_err(|e| format!("Failed to write file '{}': {}", p.display(), e))?;
    Ok(p.to_string_lossy().to_string())
}
