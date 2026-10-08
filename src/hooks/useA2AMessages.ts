import { useMemo, useCallback } from 'react';
import { useA2AStore } from '../stores/useA2AStore';
import type { A2AMessageType } from '../types/a2a';

export interface UseA2AMessagesOptions {
  peerId?: string;
  senderId?: string;
  recipientId?: string;
}

export function useA2AMessages(options: UseA2AMessagesOptions = {}) {
  const {
    messages,
    peers,
    activeFilter,
    isWireOpen,
    isMirroringEnabled,
    highlightedMessageId,
    activeExchangeAgentIds,
    toggleWire,
    setMirroringEnabled,
    setFilter,
    setHighlightedMessage,
    sendMessage,
    clearMessages,
  } = useA2AStore();

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Filtros diretos do hook
      if (options.peerId) {
        const isParticipant =
          msg.senderId === options.peerId ||
          msg.recipientId === options.peerId ||
          msg.recipientId === 'all';
        if (!isParticipant) return false;
      }
      if (options.senderId && msg.senderId !== options.senderId) return false;
      if (options.recipientId && msg.recipientId !== options.recipientId) return false;

      // Filtros globais do store
      if (activeFilter.peerId) {
        const isParticipant =
          msg.senderId === activeFilter.peerId ||
          msg.recipientId === activeFilter.peerId ||
          msg.recipientId === 'all';
        if (!isParticipant) return false;
      }
      if (activeFilter.senderId && msg.senderId !== activeFilter.senderId) return false;
      if (activeFilter.recipientId && msg.recipientId !== activeFilter.recipientId) return false;
      if (activeFilter.searchQuery) {
        const q = activeFilter.searchQuery.toLowerCase();
        const matchesText =
          msg.content.toLowerCase().includes(q) ||
          msg.senderName.toLowerCase().includes(q) ||
          msg.recipientName.toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      return true;
    });
  }, [messages, options.peerId, options.senderId, options.recipientId, activeFilter]);

  const sendDirectMessage = useCallback(
    (
      senderId: string,
      senderName: string,
      recipientId: string,
      recipientName: string,
      content: string,
      messageType: A2AMessageType = 'task',
      senderRole?: string,
      metadata?: Record<string, unknown>
    ) => {
      return sendMessage({
        senderId,
        senderName,
        recipientId,
        recipientName,
        content,
        messageType,
        senderRole,
        metadata,
      });
    },
    [sendMessage]
  );

  const broadcastMessage = useCallback(
    (
      senderId: string,
      senderName: string,
      content: string,
      senderRole?: string,
      metadata?: Record<string, unknown>
    ) => {
      return sendMessage({
        senderId,
        senderName,
        recipientId: 'all',
        recipientName: 'Todos os Agentes (Broadcast)',
        content,
        messageType: 'broadcast',
        senderRole,
        metadata,
      });
    },
    [sendMessage]
  );

  const isPeerActive = useCallback(
    (peerId: string) => {
      return activeExchangeAgentIds.has(peerId);
    },
    [activeExchangeAgentIds]
  );

  return {
    messages: filteredMessages,
    allMessages: messages,
    peers,
    isWireOpen,
    isMirroringEnabled,
    highlightedMessageId,
    activeExchangeAgentIds,
    toggleWire,
    setMirroringEnabled,
    setFilter,
    setHighlightedMessage,
    sendMessage,
    sendDirectMessage,
    broadcastMessage,
    isPeerActive,
    clearMessages,
  };
}
