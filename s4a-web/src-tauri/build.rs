fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let plist_path = std::path::Path::new(&manifest_dir).join("Info.plist");
            if plist_path.exists() {
                println!(
                    "cargo:rustc-link-arg-bins=-Wl,-sectcreate,__TEXT,__info_plist,{}",
                    plist_path.display()
                );
                println!("cargo:rerun-if-changed=Info.plist");
            }
        }
    }
    tauri_build::build()
}
