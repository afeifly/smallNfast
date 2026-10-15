// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // If the user launches with --console, --debug, or env SUTO_DEBUG=1,
        // attach or allocate a live console window for direct CLI stdout/stderr viewing.
        if std::env::args().any(|a| a == "--console" || a == "--debug")
            || std::env::var("SUTO_DEBUG").map(|v| v == "1").unwrap_or(false)
        {
            unsafe {
                windows_sys::Win32::System::Console::AllocConsole();
            }
        }
    }

    app_lib::run();
}
