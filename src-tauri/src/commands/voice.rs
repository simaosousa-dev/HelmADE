use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::audio::{VoiceEngineStatus, VoiceManager, VoicePermissionState};
use crate::error::{HelmError, HelmResult};

/// Estado gerenciado no Tauri runtime para o subsistema de voz HelmVoice.
pub type VoiceState = Arc<VoiceManager>;

/// Verifica o estado atual de autorizações para microfone e fala do macOS.
#[tauri::command]
pub fn check_voice_permissions(
    state: State<'_, VoiceState>,
) -> HelmResult<VoicePermissionState> {
    Ok(state.check_permissions())
}

/// Pede ao macOS autorização de privacidade para fala e microfone se ainda não concedida.
#[tauri::command]
pub fn request_voice_permissions(
    state: State<'_, VoiceState>,
) -> HelmResult<VoicePermissionState> {
    state.request_permissions().map_err(HelmError::unavailable)
}

/// Inicia o motor de reconhecimento de voz com baixa latência e streaming para o frontend.
#[tauri::command]
pub fn start_voice_transcription(
    app: AppHandle,
    state: State<'_, VoiceState>,
    locale: Option<String>,
    on_device_only: Option<bool>,
) -> HelmResult<VoiceEngineStatus> {
    state
        .start_transcription(app, locale, on_device_only)
        .map_err(HelmError::unavailable)
}

/// Pára a gravação e reconhecimento de voz libertando os recursos de áudio.
#[tauri::command]
pub fn stop_voice_transcription(
    app: AppHandle,
    state: State<'_, VoiceState>,
) -> HelmResult<VoiceEngineStatus> {
    state.stop_transcription(Some(&app)).map_err(HelmError::unavailable)
}

/// Retorna o estado atual do motor de reconhecimento de voz (ouvindo, locale, suporte on-device).
#[tauri::command]
pub fn get_voice_status(state: State<'_, VoiceState>) -> HelmResult<VoiceEngineStatus> {
    Ok(state.get_status())
}

/// Verifica se o Neural Engine / hardware local suporta transcrição 100% offline para o locale especificado.
#[tauri::command]
pub fn is_on_device_speech_supported(
    state: State<'_, VoiceState>,
    locale: Option<String>,
) -> HelmResult<bool> {
    Ok(state.is_on_device_supported(locale.as_deref()))
}
