export type A2AMessageType = 'task' | 'report' | 'query' | 'response' | 'error' | 'broadcast';

export interface A2AMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  recipientId: string; // 'all' para broadcast ou ID de painel/agente específico
  recipientName: string;
  content: string;
  messageType: A2AMessageType;
  timestamp: number;
  metadata?: Record<string, unknown>;
  mirroredToPty?: boolean;
}

export interface A2APeer {
  id: string;
  name: string;
  role?: string;
  status?: 'idle' | 'running' | 'waiting' | 'completed' | 'error' | 'active';
  sessionId?: string;
}
