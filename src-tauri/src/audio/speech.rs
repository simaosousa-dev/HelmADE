use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

/// Status de permissão de privacidade para microfone ou reconhecimento de fala.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionStatus {
    NotDetermined,
    Restricted,
    Denied,
    Authorized,
}

impl Default for PermissionStatus {
    fn default() -> Self {
        Self::NotDetermined
    }
}

/// Estado agregado de permissões para o subsistema HelmVoice.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoicePermissionState {
    pub speech: PermissionStatus,
    pub microphone: PermissionStatus,
    pub can_transcribe: bool,
}

/// Evento de transcrição emitido via Tauri IPC em streaming de baixa latência.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionEvent {
    pub text: String,
    pub is_final: bool,
    pub latency_ms: Option<u64>,
    pub timestamp: u64,
}

/// Estado do motor de fala e metadados de execução.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceEngineStatus {
    pub is_listening: bool,
    pub locale: String,
    pub on_device_supported: bool,
    pub on_device_only: bool,
    pub last_latency_ms: Option<u64>,
}

/// Erros tipados do subsistema de voz HelmVoice.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceErrorPayload {
    pub code: String,
    pub message: String,
}

#[cfg(target_os = "macos")]
mod ffi {
    use std::os::raw::{c_char, c_void};

    #[repr(C)]
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    #[allow(dead_code)]
    pub enum HelmVoicePermissionStatus {
        NotDetermined = 0,
        Denied = 1,
        Restricted = 2,
        Authorized = 3,
    }

    pub type HelmVoicePermissionCallback =
        extern "C" fn(status: HelmVoicePermissionStatus, user_data: *mut c_void);
    pub type HelmVoiceTranscriptionCallback =
        extern "C" fn(text: *const c_char, is_final: bool, user_data: *mut c_void);
    pub type HelmVoiceErrorCallback =
        extern "C" fn(error_code: i32, error_message: *const c_char, user_data: *mut c_void);

    extern "C" {
        pub fn helmvoice_check_speech_permission() -> HelmVoicePermissionStatus;
        pub fn helmvoice_check_microphone_permission() -> HelmVoicePermissionStatus;
        pub fn helmvoice_request_speech_permission(
            callback: HelmVoicePermissionCallback,
            user_data: *mut c_void,
        );
        pub fn helmvoice_request_microphone_permission(
            callback: HelmVoicePermissionCallback,
            user_data: *mut c_void,
        );
        pub fn helmvoice_is_on_device_supported(locale_identifier: *const c_char) -> bool;
        pub fn helmvoice_start_recognition(
            locale_identifier: *const c_char,
            on_device_only: bool,
            on_transcription: HelmVoiceTranscriptionCallback,
            on_error: HelmVoiceErrorCallback,
            user_data: *mut c_void,
        ) -> i32;
        pub fn helmvoice_stop_recognition() -> i32;
        pub fn helmvoice_is_recognizing() -> bool;
    }
}

/// Contexto partilhado para despachar callbacks C/Objective-C para a App Tauri.
struct DispatchContext {
    app_handle: AppHandle,
    start_time: Instant,
    last_transcription_time: Mutex<Option<Instant>>,
}

// Ponteiro global protegido para encaminhamento estático de callbacks C
static GLOBAL_CONTEXT: Mutex<Option<Arc<DispatchContext>>> = Mutex::new(None);

#[cfg(target_os = "macos")]
extern "C" fn on_transcription_c(
    text_ptr: *const std::os::raw::c_char,
    is_final: bool,
    _user_data: *mut std::os::raw::c_void,
) {
    if text_ptr.is_null() {
        return;
    }
    let text = unsafe { std::ffi::CStr::from_ptr(text_ptr) }
        .to_string_lossy()
        .into_owned();

    let ctx_opt = GLOBAL_CONTEXT.lock().unwrap().clone();
    if let Some(ctx) = ctx_opt {
        let now = Instant::now();
        let latency_ms = {
            let mut last_time = ctx.last_transcription_time.lock().unwrap();
            let dur = match *last_time {
                Some(prev) => now.duration_since(prev),
                None => now.duration_since(ctx.start_time),
            };
            *last_time = Some(now);
            dur.as_millis() as u64
        };

        let now_unix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let event = TranscriptionEvent {
            text,
            is_final,
            latency_ms: Some(latency_ms),
            timestamp: now_unix,
        };

        let _ = ctx.app_handle.emit("helmvoice://transcription", &event);
    }
}

#[cfg(target_os = "macos")]
extern "C" fn on_error_c(
    error_code: i32,
    error_msg_ptr: *const std::os::raw::c_char,
    _user_data: *mut std::os::raw::c_void,
) {
    let msg = if !error_msg_ptr.is_null() {
        unsafe { std::ffi::CStr::from_ptr(error_msg_ptr) }
            .to_string_lossy()
            .into_owned()
    } else {
        format!("Native speech recognition error {}", error_code)
    };

    let ctx_opt = GLOBAL_CONTEXT.lock().unwrap().clone();
    if let Some(ctx) = ctx_opt {
        let payload = VoiceErrorPayload {
            code: format!("ERR_MAC_SPEECH_{}", error_code),
            message: msg,
        };
        let _ = ctx.app_handle.emit("helmvoice://error", &payload);
    }
}

/// Gestor principal do subsistema de fala nativo HelmVoice.
pub struct VoiceManager {
    current_locale: Mutex<String>,
    on_device_only: Mutex<bool>,
    last_latency_ms: Mutex<Option<u64>>,
}

impl Default for VoiceManager {
    fn default() -> Self {
        Self::new()
    }
}

impl VoiceManager {
    pub fn new() -> Self {
        Self {
            current_locale: Mutex::new("en-US".to_string()),
            on_device_only: Mutex::new(true),
            last_latency_ms: Mutex::new(None),
        }
    }

    /// Verifica o estado atual de permissões de fala e microfone sem abrir diálogos.
    pub fn check_permissions(&self) -> VoicePermissionState {
        #[cfg(target_os = "macos")]
        {
            let speech_raw = unsafe { ffi::helmvoice_check_speech_permission() };
            let mic_raw = unsafe { ffi::helmvoice_check_microphone_permission() };

            let speech = match speech_raw {
                ffi::HelmVoicePermissionStatus::NotDetermined => PermissionStatus::NotDetermined,
                ffi::HelmVoicePermissionStatus::Denied => PermissionStatus::Denied,
                ffi::HelmVoicePermissionStatus::Restricted => PermissionStatus::Restricted,
                ffi::HelmVoicePermissionStatus::Authorized => PermissionStatus::Authorized,
            };

            let microphone = match mic_raw {
                ffi::HelmVoicePermissionStatus::NotDetermined => PermissionStatus::NotDetermined,
                ffi::HelmVoicePermissionStatus::Denied => PermissionStatus::Denied,
                ffi::HelmVoicePermissionStatus::Restricted => PermissionStatus::Restricted,
                ffi::HelmVoicePermissionStatus::Authorized => PermissionStatus::Authorized,
            };

            let can_transcribe = speech == PermissionStatus::Authorized && microphone == PermissionStatus::Authorized;
            VoicePermissionState { speech, microphone, can_transcribe }
        }

        #[cfg(not(target_os = "macos"))]
        {
            VoicePermissionState {
                speech: PermissionStatus::Denied,
                microphone: PermissionStatus::Denied,
                can_transcribe: false,
            }
        }
    }

    /// Pede interativamente ao sistema operacional a autorização para microfone e fala.
    pub fn request_permissions(&self) -> Result<VoicePermissionState, String> {
        #[cfg(target_os = "macos")]
        {
            use std::sync::mpsc::channel;
            use std::time::Duration;

            // 1. Pede permissão de reconhecimento de fala
            let (tx_speech, rx_speech) = channel::<ffi::HelmVoicePermissionStatus>();
            extern "C" fn speech_cb(status: ffi::HelmVoicePermissionStatus, user_data: *mut std::os::raw::c_void) {
                let sender = unsafe { &*(user_data as *const std::sync::mpsc::Sender<ffi::HelmVoicePermissionStatus>) };
                let _ = sender.send(status);
            }

            unsafe {
                ffi::helmvoice_request_speech_permission(speech_cb, &tx_speech as *const _ as *mut _);
            }
            let _ = rx_speech.recv_timeout(Duration::from_secs(10));

            // 2. Pede permissão de microfone
            let (tx_mic, rx_mic) = channel::<ffi::HelmVoicePermissionStatus>();
            extern "C" fn mic_cb(status: ffi::HelmVoicePermissionStatus, user_data: *mut std::os::raw::c_void) {
                let sender = unsafe { &*(user_data as *const std::sync::mpsc::Sender<ffi::HelmVoicePermissionStatus>) };
                let _ = sender.send(status);
            }

            unsafe {
                ffi::helmvoice_request_microphone_permission(mic_cb, &tx_mic as *const _ as *mut _);
            }
            let _ = rx_mic.recv_timeout(Duration::from_secs(10));

            Ok(self.check_permissions())
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("HelmVoice native Apple speech bindings only supported on macOS".to_string())
        }
    }

    /// Verifica se a transcrição offline/on-device é suportada para um dado locale.
    pub fn is_on_device_supported(&self, locale: Option<&str>) -> bool {
        #[cfg(target_os = "macos")]
        {
            let loc_str = locale.unwrap_or("en-US");
            let c_loc = std::ffi::CString::new(loc_str).unwrap_or_default();
            unsafe { ffi::helmvoice_is_on_device_supported(c_loc.as_ptr()) }
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = locale;
            false
        }
    }

    /// Inicia a captura de áudio com baixa latência e streaming de transcrição.
    pub fn start_transcription(
        &self,
        app_handle: AppHandle,
        locale: Option<String>,
        on_device_only: Option<bool>,
    ) -> Result<VoiceEngineStatus, String> {
        let perms = self.check_permissions();
        if !perms.can_transcribe {
            return Err(format!(
                "Permissões insuficientes para iniciar transcrição (Speech: {:?}, Mic: {:?})",
                perms.speech, perms.microphone
            ));
        }

        let loc = locale.unwrap_or_else(|| "en-US".to_string());
        let on_device = on_device_only.unwrap_or(true);

        if let Ok(mut l) = self.current_locale.lock() {
            *l = loc.clone();
        }
        if let Ok(mut o) = self.on_device_only.lock() {
            *o = on_device;
        }

        #[cfg(target_os = "macos")]
        {
            let context = Arc::new(DispatchContext {
                app_handle: app_handle.clone(),
                start_time: Instant::now(),
                last_transcription_time: Mutex::new(None),
            });

            {
                let mut global = GLOBAL_CONTEXT.lock().unwrap();
                *global = Some(context);
            }

            let c_loc = std::ffi::CString::new(loc.as_str())
                .map_err(|e| format!("Locale inválido: {}", e))?;

            let res = unsafe {
                ffi::helmvoice_start_recognition(
                    c_loc.as_ptr(),
                    on_device,
                    on_transcription_c,
                    on_error_c,
                    std::ptr::null_mut(),
                )
            };

            match res {
                0 => {
                    let status = self.get_status();
                    let _ = app_handle.emit("helmvoice://status", &status);
                    Ok(status)
                }
                1 => Err("A transcrição HelmVoice já se encontra em execução".to_string()),
                4 => Err(format!("Reconhecedor de fala indisponível para o locale '{}'", loc)),
                5 => Err("Falha ao inicializar motor de áudio AVFoundation ou microfone".to_string()),
                7 => Err(format!(
                    "O locale '{}' não suporta transcrição 100% on-device no Neural Engine",
                    loc
                )),
                code => Err(format!("Erro nativo desconhecido ao iniciar fala: {}", code)),
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = app_handle;
            Err("HelmVoice is only supported natively on macOS".to_string())
        }
    }

    /// Pára a captura de áudio e finaliza a sessão de transcrição de forma limpa.
    pub fn stop_transcription(&self, app_handle: Option<&AppHandle>) -> Result<VoiceEngineStatus, String> {
        #[cfg(target_os = "macos")]
        {
            let res = unsafe { ffi::helmvoice_stop_recognition() };
            {
                let mut global = GLOBAL_CONTEXT.lock().unwrap();
                *global = None;
            }

            let status = self.get_status();
            if let Some(handle) = app_handle {
                let _ = handle.emit("helmvoice://status", &status);
            }

            if res == 0 || res == 6 {
                Ok(status)
            } else {
                Err(format!("Falha ao parar captura de voz (código {})", res))
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = app_handle;
            Ok(self.get_status())
        }
    }

    /// Retorna o estado atual do motor de reconhecimento.
    pub fn get_status(&self) -> VoiceEngineStatus {
        let is_listening = {
            #[cfg(target_os = "macos")]
            unsafe {
                ffi::helmvoice_is_recognizing()
            }
            #[cfg(not(target_os = "macos"))]
            false
        };

        let locale = self
            .current_locale
            .lock()
            .map(|l| l.clone())
            .unwrap_or_else(|_| "en-US".to_string());
        let on_device_only = self.on_device_only.lock().map(|o| *o).unwrap_or(true);
        let on_device_supported = self.is_on_device_supported(Some(&locale));
        let last_latency_ms = self.last_latency_ms.lock().ok().and_then(|l| *l);

        VoiceEngineStatus {
            is_listening,
            locale,
            on_device_supported,
            on_device_only,
            last_latency_ms,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_voice_manager_initial_state() {
        let manager = VoiceManager::new();
        let status = manager.get_status();
        assert!(!status.is_listening);
        assert_eq!(status.locale, "en-US");
        assert!(status.on_device_only);
    }

    #[test]
    fn test_voice_permissions_check() {
        let manager = VoiceManager::new();
        let perms = manager.check_permissions();
        // Permission check shouldn't panic
        println!("Checked permissions: {:?}", perms);
    }

    #[test]
    fn test_on_device_supported_check() {
        let manager = VoiceManager::new();
        let supported = manager.is_on_device_supported(Some("en-US"));
        println!("en-US on device supported: {}", supported);
    }
}
