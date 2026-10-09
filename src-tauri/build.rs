fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/audio/speech_bridge.m")
            .flag("-fobjc-arc")
            .compile("helmvoice_bridge");

        println!("cargo:rustc-link-lib=framework=Speech");
        println!("cargo:rustc-link-lib=framework=AVFoundation");
        println!("cargo:rerun-if-changed=src/audio/speech_bridge.m");
        println!("cargo:rerun-if-changed=src/audio/speech_bridge.h");
    }
    tauri_build::build()
}

