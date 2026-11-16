pub mod suto;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("app_log".into()),
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
            suto::suto_connect_tcp,
            suto::suto_discover_ethernet_broadcast,
            suto::suto_list_ble_devices,
            suto::suto_connect_ble,
            suto::suto_disconnect,
            suto::suto_get_channels,
            suto::suto_get_values,
            suto::suto_get_system_info,
            suto::suto_get_logger_status,
            suto::suto_get_logger_files,
            suto::suto_read_s461_log,
            suto::suto_read_s403_log,
            suto::suto_read_s418_log,
            suto::suto_get_600_csd_files,
            suto::suto_generate_600_report,
            suto::suto_get_screenshots,
            suto::suto_read_screenshot,
            suto::suto_send_command,
            suto::suto_send_raw,
            suto::modbus::suto_read_modbus_registers,
            suto::modbus::suto_exchange_cs_modbus,
            suto::suto_get_logs,
            suto::suto_clear_logs,
            suto::suto_get_log_file_path,
            suto::suto_log_client_event,
            suto::files::suto_get_recent_files,
            suto::files::suto_add_recent_file,
            suto::files::suto_remove_recent_file,
            suto::files::suto_pick_file,
            suto::files::suto_read_file,
            suto::files::suto_read_file_slice,
            suto::files::suto_get_file_stats,
            suto::files::suto_save_binary_file,
            suto::files::suto_pick_folder,
            suto::files::suto_save_file_to_path,
            suto::webserver::suto_get_webserver_status,
            suto::webserver::suto_set_webserver_enabled,
            suto::webserver::suto_sync_shared_state,
            suto::webserver::suto_get_shared_state,
            suto::tray_service::suto_get_service_status,
            suto::tray_service::suto_set_background_mode,
            suto::tray_service::suto_enter_headless_mode,
            suto::tray_service::suto_show_main_window,
            suto::tray_service::suto_update_service_snapshot,
            suto::tray_service::suto_get_service_snapshot,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                let icon = tauri::include_image!("icons/128x128@2x.png");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(icon);
                }
                if let Err(e) = suto::tray_service::init_tray_and_service(app.handle()) {
                    suto::logger::log_event(
                        "ERROR",
                        "SERVICE",
                        &format!("Tray service init error: {}", e),
                        None,
                    );
                }
            }
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(desktop)]
            suto::tray_service::handle_run_event(app_handle, &event);
            #[cfg(not(desktop))]
            let _ = (app_handle, event);
        });
}
