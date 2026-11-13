import { useState, useEffect, useRef, useCallback } from 'react';
import { errorMessage } from '../lib/ipc';
import { voiceService } from '../services/voiceService';
import { applyCodePhonetics, injectSpeechToPrompt } from '../config/codePhonetics';
import { teamWireStore } from '../stores/useTeamWireStore';
import type { PushToTalkOptions, PushToTalkState } from '../types/shortcuts';

export { injectSpeechToPrompt };

/**
 * Hook global para interceção de atalho Push-to-Talk (Option+Space / Alt+Space),
 * controlo do motor de fala e injeção em tempo real com correção fonética de código.
 *
 * Quality Gate: Latência de ativação/desativação < 50ms.
 */
export function useGlobalPushToTalk(options: PushToTalkOptions = {}) {
  const {
    shortcut = 'Option+Space',
    applyPhonetics = true,
    autoInjectPrompt = true,
    onTranscription,
    onStateChange,
  } = options;

  const [state, setState] = useState<PushToTalkState>({
    isActive: false,
    isListening: false,
    audioLevel: 0,
    latencyMs: 0,
    error: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const basePromptPrefixRef = useRef<string>('');
  const animFrameRef = useRef<number | null>(null);
  const isPressingRef = useRef<boolean>(false);

  const updateState = useCallback(
    (patch: Partial<PushToTalkState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        if (onStateChange) {
          onStateChange(next);
        }
        return next;
      });
    },
    [onStateChange]
  );

  // Simulação suave de energia de áudio para animação da forma de onda
  const startAudioWaveAnimation = useCallback(() => {
    let phase = 0;
    const animate = () => {
      phase += 0.15;
      const wave = Math.abs(Math.sin(phase) * 0.5 + Math.sin(phase * 2.3) * 0.3) + 0.2;
      const clamped = Math.min(1.0, Math.max(0.1, wave));
      setState((prev) => (prev.isListening ? { ...prev, audioLevel: clamped } : prev));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const stopAudioWaveAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setState((prev) => ({ ...prev, audioLevel: 0 }));
  }, []);

  // Iniciar escuta Push-to-Talk
  const startListening = useCallback(async () => {
    const startTime = performance.now();
    try {
      // Guardar o texto atual do prompt para não o apagar ao ditar
      const currentDraft = teamWireStore.getState().draftPrompt.trim();
      basePromptPrefixRef.current = currentDraft ? `${currentDraft} ` : '';

      updateState({
        isActive: true,
        error: null,
      });

      await voiceService.startTranscription();
      const latency = Math.round(performance.now() - startTime);

      updateState({
        isListening: true,
        latencyMs: latency,
      });
      startAudioWaveAnimation();
    } catch (err: unknown) {
      const errorMsg = errorMessage(err);
      updateState({
        isActive: false,
        isListening: false,
        error: errorMsg,
      });
      stopAudioWaveAnimation();
    }
  }, [startAudioWaveAnimation, stopAudioWaveAnimation, updateState]);

  // Parar escuta Push-to-Talk
  const stopListening = useCallback(async () => {
    const startTime = performance.now();
    try {
      updateState({ isActive: false });
      await voiceService.stopTranscription();
      const latency = Math.round(performance.now() - startTime);

      updateState({
        isListening: false,
        latencyMs: latency,
      });
    } catch (err: unknown) {
      const errorMsg = errorMessage(err);
      updateState({
        isListening: false,
        error: errorMsg,
      });
    } finally {
      stopAudioWaveAnimation();
    }
  }, [stopAudioWaveAnimation, updateState]);

  // Alternador manual para clique em botão
  const toggleListening = useCallback(() => {
    if (stateRef.current.isListening) {
      void stopListening();
    } else {
      void startListening();
    }
  }, [startListening, stopListening]);

  // Subscrição dos eventos de streaming de fala
  useEffect(() => {
    let unlistenTranscription: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setupVoiceListeners = async () => {
      try {
        unlistenTranscription = await voiceService.onTranscription((evt) => {
          let processedText = evt.text;
          if (applyPhonetics) {
            processedText = applyCodePhonetics(processedText);
          }

          if (autoInjectPrompt) {
            const prefix = basePromptPrefixRef.current;
            teamWireStore.setDraftPrompt(`${prefix}${processedText}`);
          }

          if (onTranscription) {
            onTranscription(processedText, evt.isFinal);
          }
        });

        unlistenError = await voiceService.onError((err) => {
          updateState({ error: err.message, isListening: false, isActive: false });
          stopAudioWaveAnimation();
        });
      } catch {
        // Ignora silenciosamente se o backend Tauri não estiver no modo desktop nativo
      }
    };

    void setupVoiceListeners();

    return () => {
      if (unlistenTranscription) unlistenTranscription();
      if (unlistenError) unlistenError();
      stopAudioWaveAnimation();
    };
  }, [applyPhonetics, autoInjectPrompt, onTranscription, stopAudioWaveAnimation, updateState]);

  // Interceção de atalhos de teclado (Option+Space / Alt+Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora repetição automática da tecla
      if (e.repeat) return;

      const isOptionOrAlt = e.altKey;
      const isSpace = e.code === 'Space';

      if (isOptionOrAlt && isSpace) {
        e.preventDefault();
        if (!isPressingRef.current) {
          isPressingRef.current = true;
          void startListening();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isPressingRef.current) {
        const isSpace = e.code === 'Space';
        const isAlt = e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight';

        if (isSpace || isAlt || !e.altKey) {
          e.preventDefault();
          isPressingRef.current = false;
          void stopListening();
        }
      }
    };

    // Salvaguarda: se a janela perder o foco (blur), parar escuta imediatamente
    const handleWindowBlur = () => {
      if (isPressingRef.current || stateRef.current.isListening) {
        isPressingRef.current = false;
        void stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [shortcut, startListening, stopListening]);

  return {
    state,
    isActive: state.isActive,
    isListening: state.isListening,
    audioLevel: state.audioLevel,
    latencyMs: state.latencyMs,
    error: state.error,
    startListening,
    stopListening,
    toggleListening,
  };
}
