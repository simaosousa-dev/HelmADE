export interface SpawnPtyOptions {
  sessionId: string;
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface TerminalDimension {
  cols: number;
  rows: number;
}

export type TerminalStatus = 'idle' | 'running' | 'completed' | 'error';

export interface TerminalSessionInfo {
  id: string;
  title: string;
  status: TerminalStatus;
  dimension: TerminalDimension;
  cwd?: string;
  exitCode?: number | null;
}
