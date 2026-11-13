import { useState, useEffect, useRef, useCallback } from 'react';
import { errorMessage } from '../lib/ipc';
import { voiceService } from '../services/voiceService';
import { applyCodePhonetics, injectSpeechToPrompt } from '../config/codePhonetics';
import { teamWireStore } from '../stores/useTeamWireStore';
import type { PushToTalkOptions, PushToTalkState } from '../types/shortcuts';

export { injectSpeechToPrompt };

/**
 * Hook de Push-to-Talk: reage ao atalho global do sistema (por omissão ⌥Espaço),
 * controla o motor de fala e injeta o texto em tempo real com correção fonética de código.
 *
 * Quality Gate: Latência de ativação/desativação < 50ms.
 */
export function useGlobalPushToTalk(options: PushToTalkOptions = {}) {
  const {
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
      } catch (err) {
        updateState({ error: errorMessage(err) });
      }
    };

    void setupVoiceListeners();

    return () => {
      if (unlistenTranscription) unlistenTranscription();
      if (unlistenError) unlistenError();
      stopAudioWaveAnimation();
    };
  }, [applyPhonetics, autoInjectPrompt, onTranscription, stopAudioWaveAnimation, updateState]);

  // Atalho global do sistema: o backend regista-o e emite premir/soltar, pelo que a
  // ditado funciona mesmo com outra aplicação em primeiro plano.
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;

    voiceService
      .onPushToTalk(
        () => {
          if (isPressingRef.current) return;
          isPressingRef.current = true;
          void startListening();
        },
        () => {
          if (!isPressingRef.current) return;
          isPressingRef.current = false;
          void stopListening();
        }
      )
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch((err: unknown) => updateState({ error: errorMessage(err) }));

    return () => {
      disposed = true;
      stop?.();
    };
  }, [startListening, stopListening, updateState]);

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
