import type { TerminalStatus } from './terminal.ts';

export type A2AMessageType = 'task' | 'report' | 'query' | 'response' | 'error' | 'broadcast';

/** Sender id of prompts typed by the human. */
export const HUMAN_SENDER_ID = 'user';
/** Recipient id of a broadcast. */
export const BROADCAST_RECIPIENT_ID = 'all';

/** A Team Wire message. Mirrors the backend `A2AMessage`. */
export interface A2AMessage {
  id: string;
  swarmId: string;
  /** Panel key of the sender, or `user`. */
  senderId: string;
  senderName: string;
  senderRole?: string | null;
  /** Panel key of the recipient, or `all`. */
  recipientId: string;
  recipientName: string;
  content: string;
  messageType: A2AMessageType;
  timestamp: number;
}

export interface OutgoingA2AMessage {
  swarmId: string;
  senderId: string;
  /** Panel key, persona id, panel title, `orchestrator` or `all`. */
  recipient: string;
  content: string;
  messageType?: A2AMessageType;
}

/** A member of the active swarm as Team Wire shows it. */
export interface A2APeer {
  /** Panel key. */
  id: string;
  name: string;
  role?: string;
  status?: TerminalStatus;
  sessionId: string;
}
