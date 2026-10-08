export type A2AMessageType =
  | 'TaskDelegation'
  | 'StatusUpdate'
  | 'ToolResult'
  | 'PromptInjection'
  | 'Broadcast';

export interface A2AMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  conversation_id?: string | null;
  message_type: A2AMessageType;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SendA2AMessageOptions {
  senderId: string;
  recipientId: string;
  messageType: A2AMessageType;
  content: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
  mirrorToPty?: boolean;
}
