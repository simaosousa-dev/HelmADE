//! Locations of HelmADE's own files. `HELMADE_HOME` overrides the default so tests
//! and development builds never touch the user's real state.

use std::path::PathBuf;

pub fn helm_home() -> PathBuf {
    if let Some(custom) = std::env::var_os("HELMADE_HOME").filter(|v| !v.is_empty()) {
        return PathBuf::from(custom);
    }
    match std::env::var_os("HOME") {
        Some(home) => PathBuf::from(home).join(".helmade"),
        None => PathBuf::from(".helmade"),
    }
}

pub fn db_path() -> PathBuf {
    helm_home().join("helmade.db")
}

/// Directory holding the `helm` CLI shim that every panel gets on its `PATH`.
pub fn bin_dir() -> PathBuf {
    helm_home().join("bin")
}

/// Directory holding runtime sockets.
pub fn run_dir() -> PathBuf {
    helm_home().join("run")
}

pub fn user_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}
