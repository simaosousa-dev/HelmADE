//! Typed error returned by every Tauri command.
//!
//! Raw diagnostics (stack-like text, absolute paths) stay in the private stderr log;
//! the frontend only ever receives a stable `code` and a sanitized, user-facing `message`.

use regex::Regex;
use serde::Serialize;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidInput,
    NotFound,
    Conflict,
    Git,
    Io,
    Database,
    Pty,
    Unavailable,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HelmError {
    pub code: ErrorCode,
    pub message: String,
}

pub type HelmResult<T> = Result<T, HelmError>;

/// Absolute path preceded by a boundary. Bounded so hostile input cannot backtrack.
static ABSOLUTE_PATH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(^|[\s'"(=])(/[^\s'"()]{1,1024})"#).expect("static regex is valid")
});

/// Collapses absolute paths to their last two segments so internal layout never leaks.
pub fn sanitize_message(raw: &str) -> String {
    let masked = ABSOLUTE_PATH.replace_all(raw.trim(), |caps: &regex::Captures| {
        let path = &caps[2];
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let tail = match segments.len() {
            0 => String::from("/"),
            1 => segments[0].to_string(),
            n => format!("{}/{}", segments[n - 2], segments[n - 1]),
        };
        format!("{}…/{}", &caps[1], tail)
    });
    masked.chars().take(600).collect()
}

impl HelmError {
    pub fn new(code: ErrorCode, message: impl AsRef<str>) -> Self {
        Self {
            code,
            message: sanitize_message(message.as_ref()),
        }
    }

    pub fn invalid(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::InvalidInput, message)
    }

    pub fn not_found(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::NotFound, message)
    }

    pub fn conflict(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::Conflict, message)
    }

    pub fn git(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::Git, message)
    }

    pub fn pty(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::Pty, message)
    }

    pub fn unavailable(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::Unavailable, message)
    }

    pub fn internal(message: impl AsRef<str>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }
}

impl std::fmt::Display for HelmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for HelmError {}

impl From<rusqlite::Error> for HelmError {
    fn from(err: rusqlite::Error) -> Self {
        eprintln!("[helmade] sqlite error: {err}");
        Self::new(ErrorCode::Database, "Falha na base de dados local.")
    }
}

impl From<std::io::Error> for HelmError {
    fn from(err: std::io::Error) -> Self {
        eprintln!("[helmade] io error: {err}");
        Self::new(
            ErrorCode::Io,
            format!("Falha de entrada/saída ({:?}).", err.kind()),
        )
    }
}

impl<T> From<std::sync::PoisonError<T>> for HelmError {
    fn from(_: std::sync::PoisonError<T>) -> Self {
        Self::new(ErrorCode::Internal, "Estado interno indisponível.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_absolute_paths_in_messages() {
        let err = HelmError::git(
            "fatal: '/Users/jane/projects/app/.helm/worktrees/abc' already exists at /Users/jane/x.rs:10",
        );
        assert!(!err.message.contains("/Users/jane"));
        assert!(!err.message.contains("at /"));
        assert!(err.message.contains("…/worktrees/abc"));
    }

    #[test]
    fn keeps_relative_text_untouched() {
        let err = HelmError::invalid("Identificador de swarm inválido ou vazio");
        assert_eq!(err.message, "Identificador de swarm inválido ou vazio");
        assert_eq!(err.code, ErrorCode::InvalidInput);
    }

    #[test]
    fn serializes_code_as_snake_case() {
        let json = serde_json::to_string(&HelmError::not_found("x")).expect("serializable");
        assert_eq!(json, r#"{"code":"not_found","message":"x"}"#);
    }

    #[test]
    fn io_errors_never_expose_the_os_message() {
        let io = std::io::Error::new(std::io::ErrorKind::NotFound, "/secret/path/file missing");
        let err: HelmError = io.into();
        assert!(!err.message.contains("/secret"));
    }
}
