import { invoke, listen, type UnlistenFn } from '../lib/ipc';
import type {
  TranscriptionEvent,
  VoiceEngineStatus,
  VoiceErrorPayload,
  VoicePermissionState,
} from '../types/voice';

export const voiceService = {
  /**
   * Verifica o estado de autorizações para microfone e reconhecimento de fala.
   */
  async checkPermissions(): Promise<VoicePermissionState> {
    return invoke<VoicePermissionState>('check_voice_permissions');
  },

  /**
   * Pede ao macOS autorização para microfone e reconhecimento de fala.
   */
  async requestPermissions(): Promise<VoicePermissionState> {
    return invoke<VoicePermissionState>('request_voice_permissions');
  },

  /**
   * Inicia o motor de reconhecimento de voz com baixa latência e streaming contínuo.
   */
  async startTranscription(
    locale?: string,
    onDeviceOnly?: boolean
  ): Promise<VoiceEngineStatus> {
    return invoke<VoiceEngineStatus>('start_voice_transcription', {
      locale: locale ?? null,
      onDeviceOnly: onDeviceOnly ?? null,
    });
  },

  /**
   * Pára o motor de reconhecimento de fala e liberta os nós de áudio nativos.
   */
  async stopTranscription(): Promise<VoiceEngineStatus> {
    return invoke<VoiceEngineStatus>('stop_voice_transcription');
  },

  /**
   * Obtém o estado atual do motor de reconhecimento HelmVoice.
   */
  async getStatus(): Promise<VoiceEngineStatus> {
    return invoke<VoiceEngineStatus>('get_voice_status');
  },

  /**
   * Verifica se o hardware local (Neural Engine) suporta transcrição 100% offline para o locale.
   */
  async isOnDeviceSupported(locale?: string): Promise<boolean> {
    return invoke<boolean>('is_on_device_speech_supported', {
      locale: locale ?? null,
    });
  },

  /**
   * Subscreve eventos de transcrição em tempo real (parciais e finais).
   */
  async onTranscription(
    callback: (event: TranscriptionEvent) => void
  ): Promise<UnlistenFn> {
    return listen<TranscriptionEvent>('helmvoice://transcription', callback);
  },

  /**
   * Subscreve atualizações de estado do motor de voz.
   */
  async onStatusChange(
    callback: (status: VoiceEngineStatus) => void
  ): Promise<UnlistenFn> {
    return listen<VoiceEngineStatus>('helmvoice://status', callback);
  },

  /**
   * Subscreve eventos de erro emitidos pelo subsistema de áudio.
   */
  async onError(
    callback: (error: VoiceErrorPayload) => void
  ): Promise<UnlistenFn> {
    return listen<VoiceErrorPayload>('helmvoice://error', callback);
  },

  /**
   * Subscreve o atalho global de push-to-talk (premir e soltar), emitido pelo backend
   * mesmo quando o HelmADE não é a aplicação em primeiro plano.
   */
  async onPushToTalk(onPressed: () => void, onReleased: () => void): Promise<UnlistenFn> {
    const [stopPressed, stopReleased] = await Promise.all([
      listen<null>('ptt://pressed', onPressed),
      listen<null>('ptt://released', onReleased),
    ]);
    return () => {
      stopPressed();
      stopReleased();
    };
  },
};
