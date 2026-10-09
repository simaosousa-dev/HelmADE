/**
 * Status de permissão de privacidade para microfone ou reconhecimento de fala.
 */
export type PermissionStatus = 'notDetermined' | 'restricted' | 'denied' | 'authorized';

/**
 * Estado agregado de permissões para o subsistema HelmVoice.
 */
export interface VoicePermissionState {
  speech: PermissionStatus;
  microphone: PermissionStatus;
  canTranscribe: boolean;
}

/**
 * Evento emitido em streaming de tempo real com transcrição parcial ou final.
 */
export interface TranscriptionEvent {
  text: string;
  isFinal: boolean;
  latencyMs?: number;
  timestamp: number;
}

/**
 * Estado operacional do motor de voz e metadados de execução nativa.
 */
export interface VoiceEngineStatus {
  isListening: boolean;
  locale: string;
  onDeviceSupported: boolean;
  onDeviceOnly: boolean;
  lastLatencyMs?: number;
}

/**
 * Carga útil de erro tipado emitido pelo subsistema de voz nativo.
 */
export interface VoiceErrorPayload {
  code: string;
  message: string;
}
