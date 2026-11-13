//! Módulo de integração de notificações nativas do macOS para o HelmADE.
//! Utiliza `osascript` em thread não-bloqueante para emitir alertas com sons do sistema.

/// Formata o script AppleScript com escape estrito de aspas e barras invertidas.
pub fn build_applescript_command(
    title: &str,
    subtitle: Option<&str>,
    message: &str,
    sound: bool,
) -> String {
    let safe_title = title.replace('\\', "\\\\").replace('"', "\\\"");
    let safe_message = message.replace('\\', "\\\\").replace('"', "\\\"");

    let mut script = format!(
        r#"display notification "{}" with title "{}""#,
        safe_message, safe_title
    );

    if let Some(sub) = subtitle {
        let safe_sub = sub.replace('\\', "\\\\").replace('"', "\\\"");
        script.push_str(&format!(r#" subtitle "{}""#, safe_sub));
    }

    if sound {
        script.push_str(r#" sound name "Subtle""#);
    }

    script
}

/// Envia uma notificação nativa macOS em segundo plano de forma não-bloqueante.
pub fn send_macos_notification(
    title: &str,
    subtitle: Option<&str>,
    message: &str,
    sound: bool,
) -> Result<(), String> {
    let script = build_applescript_command(title, subtitle, message, sound);

    #[cfg(target_os = "macos")]
    {
        std::thread::spawn(move || {
            let _ = std::process::Command::new("osascript")
                .arg("-e")
                .arg(&script)
                .output();
        });
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Fallback gracioso em ambientes Linux/Windows/CI
        let _ = script;
        eprintln!("[Notification fallback] {}: {}", title, message);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_applescript_basic() {
        let script = build_applescript_command("HelmADE", None, "Prompt à espera", false);
        assert_eq!(
            script,
            r#"display notification "Prompt à espera" with title "HelmADE""#
        );
    }

    #[test]
    fn test_build_applescript_with_subtitle_and_sound() {
        let script = build_applescript_command(
            "HelmADE",
            Some("Terminal 1"),
            "Deseja continuar? [y/N]",
            true,
        );
        assert_eq!(
            script,
            r#"display notification "Deseja continuar? [y/N]" with title "HelmADE" subtitle "Terminal 1" sound name "Subtle""#
        );
    }

    #[test]
    fn test_build_applescript_escaping() {
        let script = build_applescript_command(
            r#"Helm "ADE""#,
            Some(r#"Sub\Title"#),
            r#"Value is "test\data""#,
            false,
        );
        assert!(script.contains(r#"\"ADE\""#));
        assert!(script.contains(r#"Sub\\Title"#));
        assert!(script.contains(r#"\"test\\data\""#));
    }

    #[test]
    fn test_send_notification_smoke() {
        // Garante que a chamada não entra em pânico
        let res = send_macos_notification("HelmADE Test", Some("Smoke"), "Teste de notificação", false);
        assert!(res.is_ok());
    }
}
