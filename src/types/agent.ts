export type AgentSource = 'global' | 'project';

export interface AgentMetadata {
  name: string;
  description: string;
  role?: string | null;
  enable_write_tools: boolean;
  enable_mcp_tools: boolean;
  tools: string[];
  skills: string[];
  default_model?: string | null;
}

export interface AgentDefinition {
  id: string;
  metadata: AgentMetadata;
  system_prompt: string;
  file_path: string;
  source: AgentSource;
}
