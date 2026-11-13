import { invoke, listen, type UnlistenFn } from '../lib/ipc';
import type { A2AMessage, OutgoingA2AMessage } from '../types/a2a';
import type { PanelKind } from '../types/swarm';

export interface SwarmPeerRegistration {
  id: string;
  name: string;
  role: string | null;
  agentId: string | null;
  sessionId: string;
  kind: PanelKind;
}

export const a2aService = {
  /** Routes a message: recorded, shown in Team Wire and delivered to the recipient's terminal. */
  send(message: OutgoingA2AMessage): Promise<A2AMessage> {
    return invoke<A2AMessage>('send_a2a_message', { message });
  },

  history(swarmId: string, limit = 200): Promise<A2AMessage[]> {
    return invoke<A2AMessage[]>('get_a2a_history', { swarmId, limit });
  },

  /** Tells the router who is in a swarm so agents can address each other. */
  registerPeers(swarmId: string, peers: SwarmPeerRegistration[]): Promise<void> {
    return invoke<void>('register_swarm_peers', { swarmId, peers });
  },

  onMessage(callback: (message: A2AMessage) => void): Promise<UnlistenFn> {
    return listen<A2AMessage>('a2a://message', callback);
  },
};
