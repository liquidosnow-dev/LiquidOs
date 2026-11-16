export interface ProjectFile {
  name: string;
  path: string;
  language: 'html' | 'javascript' | 'typescript' | 'python' | 'css' | 'json' | 'markdown';
  content: string;
  lastModified: number;
}

export type VerificationClaimLevel =
  | 'untested'
  | 'syntax_checked'
  | 'policy_checked'
  | 'tests_passed'
  | 'independently_verified'
  | 'signed';

export interface CommitProvenance {
  source: 'workspace_edit' | 'external_drop' | 'device_pull' | 'device_import' | 'blueprint' | 'codex';
  claimStatus: 'untested' | 'tested';
  claimLevel?: VerificationClaimLevel;
  authorizationPermitId?: string;
  epoch?: number;
  fencingVersion?: number;
}

export interface Commit {
  id: string;
  message: string;
  author: string;
  timestamp: number;
  files: ProjectFile[];
  hash: string;
  parentHash: string | null;
  fileHashes?: Record<string, string>;
  treeDigest?: string;
  provenance?: CommitProvenance;
}

export interface Branch {
  name: string;
  currentCommitId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  currentBranch: string;
  branches: Record<string, Branch>;
  commits: Commit[];
  files: ProjectFile[];
  createdAt: number;
  updatedAt: number;
}

export interface ToolCall {
  id: string;
  toolName:
    | 'execute_code'
    | 'web_fetch'
    | 'math_eval'
    | 'create_file'
    | 'patch_file'
    | 'search_grounding'
    | 'generate_image'
    | 'vector_search'
    | 'duckdb_query'
    | 'lancedb_search'
    | 'file_eval'
    | 'control_plane_attest'
    | 'recursive_task';
  status: 'executing' | 'success' | 'failed';
  arguments: Record<string, any>;
  result?: any;
  error?: string;
  executionTimeMs?: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  persona?: string;
  toolCalls?: ToolCall[];
  appliedToProject?: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: 'Puter' | 'Google' | 'Anthropic' | 'OpenAI' | 'DeepSeek' | 'LiteRT-LM';
  badges: string[];
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  supportsThinkingHigh: boolean;
  description: string;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  status: 'online' | 'idle' | 'offline';
  activeFile?: string;
  cursorPosition?: { line: number; ch: number };
}

export interface ModelHyperparameters {
  temperature: number;
  topP: number;
  seed: number;
  maxOutput: number;
  minP: number;
  repetitionPenalty: number;
  buildQuality: 'fast' | 'thorough';
  quickEdits: boolean;
  mtpSpeculativeDecoding?: boolean;
  kvCacheQuant?: 'Q8_0' | 'FP16';
  targetAccelerator?: 'gpu,cpu' | 'gpu' | 'cpu';
  peakRamCeilingMb?: number;
}

export interface DeploymentRecord {
  id: string;
  projectName: string;
  domain: string;
  url: string;
  status: 'DEPLOYING' | 'ACTIVE' | 'ERROR';
  deployedAt: string;
  security: {
    encryptionAtRest: string;
    sslStatus: string;
    mfaEnforced: boolean;
    ddosProtection: string;
  };
  metrics: {
    bundleSize: string;
    edgeLatency: string;
    regions: string[];
  };
}

export interface AuditLedgerEntry {
  index: number;
  action: string;
  entityId: string;
  author: string;
  timestamp: number;
  data: any;
  previousHash: string;
  hash: string;
}
