import { useMemo } from 'react';
import { useA2AStore } from '../stores/useA2AStore';
import { BROADCAST_RECIPIENT_ID } from '../types/a2a';

/** Team Wire feed of the active swarm with the store's filters applied. */
export function useA2AMessages() {
  const {
    messages,
    peers,
    activeFilter,
    isWireOpen,
    highlightedMessageId,
    activeExchangeAgentIds,
    toggleWire,
    setFilter,
    setHighlightedMessage,
  } = useA2AStore();

  const filteredMessages = useMemo(() => {
    const query = activeFilter.searchQuery?.toLowerCase();
    return messages.filter((msg) => {
      if (activeFilter.peerId) {
        const isParticipant =
          msg.senderId === activeFilter.peerId ||
          msg.recipientId === activeFilter.peerId ||
          msg.recipientId === BROADCAST_RECIPIENT_ID;
        if (!isParticipant) return false;
      }
      if (activeFilter.senderId && msg.senderId !== activeFilter.senderId) return false;
      if (activeFilter.recipientId && msg.recipientId !== activeFilter.recipientId) return false;
      if (!query) return true;
      return (
        msg.content.toLowerCase().includes(query) ||
        msg.senderName.toLowerCase().includes(query) ||
        msg.recipientName.toLowerCase().includes(query)
      );
    });
  }, [messages, activeFilter]);

  return {
    messages: filteredMessages,
    allMessages: messages,
    peers,
    isWireOpen,
    highlightedMessageId,
    activeExchangeAgentIds,
    toggleWire,
    setFilter,
    setHighlightedMessage,
  };
}
