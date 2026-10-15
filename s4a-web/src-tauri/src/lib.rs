pub mod suto;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("suto_usb".into()),
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .manage(suto::SutoState::new())
        .invoke_handler(tauri::generate_handler![
            suto::suto_list_usb_devices,
            suto::suto_connect_usb,
            suto::suto_disconnect,
            suto::suto_get_channels,
            suto::suto_get_values,
            suto::suto_get_system_info,
            suto::suto_get_logger_status,
            suto::suto_send_command,
            suto::suto_send_raw,
            suto::suto_get_logs,
            suto::suto_clear_logs,
            suto::suto_get_log_file_path,
            suto::suto_log_client_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
