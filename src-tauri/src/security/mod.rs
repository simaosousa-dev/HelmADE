pub mod redactor;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Runtime switches of the Streamer Shield, shared by the terminal sink and the A2A router.
pub struct ShieldState {
    mask_secrets: AtomicBool,
    streamer_mode: AtomicBool,
    home: Option<String>,
}

pub type ShieldHandle = Arc<ShieldState>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShieldConfig {
    /// Mask API keys, tokens and passwords in every stream (on by default).
    pub mask_secrets: bool,
    /// Presentation mode: additionally hide the home directory in paths.
    pub streamer_mode: bool,
}

impl Default for ShieldConfig {
    fn default() -> Self {
        Self {
            mask_secrets: true,
            streamer_mode: false,
        }
    }
}

impl ShieldState {
    pub fn new(config: ShieldConfig, home: Option<String>) -> Self {
        Self {
            mask_secrets: AtomicBool::new(config.mask_secrets),
            streamer_mode: AtomicBool::new(config.streamer_mode),
            home,
        }
    }

    pub fn config(&self) -> ShieldConfig {
        ShieldConfig {
            mask_secrets: self.mask_secrets.load(Ordering::Relaxed),
            streamer_mode: self.streamer_mode.load(Ordering::Relaxed),
        }
    }

    pub fn set_config(&self, config: ShieldConfig) {
        self.mask_secrets.store(config.mask_secrets, Ordering::Relaxed);
        self.streamer_mode.store(config.streamer_mode, Ordering::Relaxed);
    }

    pub fn masks_secrets(&self) -> bool {
        self.mask_secrets.load(Ordering::Relaxed)
    }

    /// Applies presentation-mode path hiding to already redacted text.
    pub fn hide_paths(&self, text: String) -> String {
        if !self.streamer_mode.load(Ordering::Relaxed) {
            return text;
        }
        match &self.home {
            Some(home) => redactor::hide_home_path(&text, home),
            None => text,
        }
    }

    /// Applies the whole shield to a complete piece of text.
    pub fn apply(&self, text: &str) -> String {
        let masked = if self.masks_secrets() {
            redactor::redact_text(text)
        } else {
            text.to_string()
        };
        self.hide_paths(masked)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shield_masks_by_default_and_hides_paths_only_in_streamer_mode() {
        let shield = ShieldState::new(ShieldConfig::default(), Some("/Users/jane".to_string()));
        let secret = format!("ghp_{}", "a1B2".repeat(9));
        let text = format!("cd /Users/jane/app && echo {secret}");

        let masked = shield.apply(&text);
        assert!(!masked.contains(&secret));
        assert!(masked.contains("/Users/jane/app"));

        shield.set_config(ShieldConfig {
            mask_secrets: true,
            streamer_mode: true,
        });
        let presented = shield.apply(&text);
        assert!(presented.starts_with("cd ~/app"));

        shield.set_config(ShieldConfig {
            mask_secrets: false,
            streamer_mode: false,
        });
        assert_eq!(shield.apply(&text), text);
    }
}
