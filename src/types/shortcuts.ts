/**
 * Tipagens estritas para atalhos de teclado e subsistema Push-to-Talk.
 */

export interface PushToTalkState {
  /** Se o atalho está atualmente premido (keydown mantido) */
  isActive: boolean;
  /** Se o motor de voz está gravando/transcrevendo ativamente */
  isListening: boolean;
  /** Nível de volume / amplitude atual (0.0 a 1.0) para visualização em onda */
  audioLevel: number;
  /** Última latência de resposta ao premir/soltar tecla em milissegundos */
  latencyMs: number;
  /** Último erro reportado, se houver */
  error: string | null;
}

export interface PushToTalkOptions {
  /** Se deve aplicar o dicionário fonético de código automaticamente */
  applyPhonetics?: boolean;
  /** Se deve injetar automaticamente o texto no draft prompt do TeamWire */
  autoInjectPrompt?: boolean;
  /** Callback opcional ao receber transcrição processada */
  onTranscription?: (text: string, isFinal: boolean) => void;
  /** Callback opcional ao alterar o estado do push-to-talk */
  onStateChange?: (state: PushToTalkState) => void;
}
