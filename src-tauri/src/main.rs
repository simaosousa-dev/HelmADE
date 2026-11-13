// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // `helmade cli …` is the A2A client used by agents inside the panels.
    if args.first().map(String::as_str) == Some("cli") {
        std::process::exit(helmade_lib::cli::run(&args[1..]));
    }
    helmade_lib::run();
}
