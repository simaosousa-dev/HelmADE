import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { A2AMessage, SendA2AMessageOptions } from '../types/message';

/**
 * Serviço de comunicação Inter-Agentes A2A (Agent-to-Agent).
 * Fornece métodos para envio, consulta de histórico e escuta em tempo real de mensagens.
 */
class A2AProtocolService {
  /**
   * Envia uma mensagem A2A através do router Rust do HelmADE.
   */
  async sendMessage(options: SendA2AMessageOptions): Promise<A2AMessage> {
    const payload: A2AMessage = {
      id: `a2a-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
      sender_id: options.senderId,
      recipient_id: options.recipientId,
      conversation_id: options.conversationId || null,
      message_type: options.messageType,
      content: options.content,
      timestamp: Date.now(),
      metadata: options.metadata || {},
    };

    return invoke<A2AMessage>('send_a2a_message', {
      payload,
      mirrorToPty: options.mirrorToPty ?? false,
    });
  }

  /**
   * Obtém o histórico de mensagens A2A armazenadas em memória pelo router Rust.
   */
  async getHistory(conversationId?: string, limit?: number): Promise<A2AMessage[]> {
    return invoke<A2AMessage[]>('get_a2a_history', {
      conversationId: conversationId || null,
      limit: limit || null,
    });
  }

  /**
   * Mapeia um agentId para uma sessão de terminal PTY para espelhamento visual das mensagens recebidas.
   */
  async registerPtyMirror(agentId: string, ptySessionId: string): Promise<void> {
    return invoke<void>('register_a2a_pty_mirror', {
      agentId,
      ptySessionId,
    });
  }

  /**
   * Remove o espelhamento visual de um agentId.
   */
  async unregisterPtyMirror(agentId: string): Promise<void> {
    return invoke<void>('unregister_a2a_pty_mirror', {
      agentId,
    });
  }

  /**
   * Escuta mensagens A2A transmitidas via eventos Tauri ("a2a://message").
   */
  async onMessage(callback: (message: A2AMessage) => void): Promise<UnlistenFn> {
    return listen<A2AMessage>('a2a://message', (event) => {
      callback(event.payload);
    });
  }
}

export const a2aProtocol = new A2AProtocolService();
export const sendA2AMessage = (options: SendA2AMessageOptions) => a2aProtocol.sendMessage(options);
export const getA2AHistory = (conversationId?: string, limit?: number) => a2aProtocol.getHistory(conversationId, limit);
export const onA2AMessage = (callback: (message: A2AMessage) => void) => a2aProtocol.onMessage(callback);
export const registerA2APtyMirror = (agentId: string, ptySessionId: string) => a2aProtocol.registerPtyMirror(agentId, ptySessionId);
export const unregisterA2APtyMirror = (agentId: string) => a2aProtocol.unregisterPtyMirror(agentId);
