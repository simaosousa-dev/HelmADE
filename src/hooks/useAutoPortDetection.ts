import { useEffect } from 'react';
import { previewService } from '../services/previewService';
import { previewStore, usePreviewStore } from '../stores/usePreviewStore';
import type { DetectedDevServer } from '../types/preview';

/**
 * Hook reativo que escuta automaticamente eventos IPC de servidores de desenvolvimento
 * detetados pelo sniffer Rust e sincroniza com a preview store.
 */
export function useAutoPortDetection() {
  const preview = usePreviewStore();

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let isMounted = true;

    // 1. Recupera servidores já detetados no backend Rust ao inicializar
    previewService
      .getDetectedServers()
      .then((initialServers) => {
        if (!isMounted || !Array.isArray(initialServers)) return;
        for (const s of initialServers) {
          previewStore.addServer(s);
        }
      })
      .catch((err) => {
        console.warn('Falha ao obter servidores de dev iniciais:', err);
      });

    // 2. Subscreve ao evento em tempo real "devserver-detected"
    previewService
      .onDevServerDetected((detected: DetectedDevServer) => {
        if (!isMounted) return;
        previewStore.addServer(detected);
      })
      .then((fn) => {
        if (!isMounted) {
          fn();
        } else {
          unlistenFn = fn;
        }
      })
      .catch((err) => {
        console.warn('Falha ao registar listener de devserver-detected:', err);
      });

    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const openInExternal = async (url?: string) => {
    const targetUrl = url || preview.currentUrl;
    if (!targetUrl) return;
    try {
      await previewService.openInExternalBrowser(targetUrl);
    } catch (err) {
      console.error('Erro ao abrir navegador externo:', err);
    }
  };

  return {
    ...preview,
    openInExternal,
  };
}
