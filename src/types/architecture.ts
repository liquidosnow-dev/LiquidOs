/**
 * Total Architectural Upgrade Specification Types
 * Synthesizing all 16 notebook sources: Ingress Shield, Pi Pipeline, Liquid Vault,
 * Handoff State Machine, Enterprise Connectors/MCP, On-Device Inference & Kinetic Monolith.
 */

// 1. Ingress Shield & Entry Point Security
export type DaemonType = 'D-Ingress' | 'D-Peripheral' | 'D-Extension' | 'D-System';
export type IngressAction = 'DROP' | 'HOLD' | 'ALLOW' | 'LOG_ONLY';

export interface EntryPointDefinition {
  id: number;
  name: string;
  daemon: DaemonType;
  category: string;
  defaultAction: IngressAction;
  description: string;
}

export interface IngressEvaluationResult {
  allowed: boolean;
  action: IngressAction;
  entryPoint: EntryPointDefinition;
  daemon: DaemonType;
  holdExpiresAt?: number;
  reason: string;
  timestamp: number;
}

export interface SingleWidthGateSignature {
  signatureId: string;
  publicKey: string;
  signatureHex: string;
  timestamp: number;
  enclaveId: string;
  nonce: string;
  widthEnforced: 1;
}

// 2. Pi Pipeline Hook Router & Execution Barriers
export interface PipelineSocketCredentials {
  uid: number;
  gid: number;
  pid: number;
  peerCredVerified: boolean;
}

export interface BarrierCheckResult {
  securityBarrier: {
    passed: boolean;
    aclChecked: boolean;
    ed25519Verified: boolean;
    notes: string;
  };
  memoryMtuBarrier: {
    passed: boolean;
    packetSizeBytes: number;
    mtuLimitBytes: 1232;
    scanRowsCount: number;
    scanRowThreshold: 10000;
    notes: string;
  };
  vectorIndexBarrier: {
    passed: boolean;
    cosineLatencyMs: number;
    latencyThresholdMs: 5.0;
    graphDepthHops: number;
    maxHops: 64;
    notes: string;
  };
  allPassed: boolean;
  routingTarget: 'sqlite' | 'duckdb' | 'lancedb' | 'audit_ledger';
}

// Multi-Engine Storage Vault
export interface StorageVaultEngines {
  sqlite: {
    name: 'Authenticated Encrypted SQLite';
    mode: 'FTS5 + WAL Mode';
    encrypted: true;
    tables: string[];
  };
  duckdb: {
    name: 'OLAP Columnar Store (DuckDB)';
    mode: 'Zero-Copy Shared Memory';
    throughputRowsPerSec: string;
  };
  lancedb: {
    name: 'LanceDB HNSW Graph Vector Index';
    dimension: 1536;
    metric: 'Cosine Similarity';
    graphDepth: number;
  };
  auditLedger: {
    name: 'Tamper-Evident SHA-256 Ledger';
    algorithm: 'SHA-256 Chained Hash';
    verified: boolean;
  };
}

// 3. Handoff State Machine & Fault Recovery
export type HandoffStage = 'PREPARED' | 'SIGNED' | 'PERSISTED' | 'READ' | 'CONFIRMED' | 'RECOVERY_PENDING' | 'ROLLED_BACK';

export interface WayopenManifestV11 {
  claim_id: string;
  artifact_identifier: string;
  sha256: string;
  size_bytes: number;
  claimant: string;
  method: string;
  observed_result: string;
  evidence_location: string;
  reviewer: string;
  limitations: string;
  timestamp: number;
}

export interface HandoffStateRecord {
  stage: HandoffStage;
  previousStage: HandoffStage | null;
  manifest: WayopenManifestV11;
  signature: SingleWidthGateSignature;
  readVerifiedByTarget: boolean;
  recoveryTriggered?: boolean;
  rollbackAction?: 'ROLLBACK_TO_SOURCE';
  stagedFilesDiscarded: boolean;
  primaryTablesIntact: boolean;
  updatedAt: number;
}

// 4. Enterprise Connectors & Model Context Protocol (MCP)
export interface EnterpriseConnector {
  id: string;
  name: string;
  category: 'google' | 'third_party';
  status: 'CONNECTED' | 'SYNCING' | 'IDLE' | 'ERROR';
  lastSyncTime: number;
  itemCount: number;
  authType: 'OAuth 2.0 / Service Account';
}

export interface McpHandoffSession {
  doorwayProtocol: 'MCP v1.2';
  roomServer: string;
  keyPermissions: string[];
  checkpointId: string;
  transport: 'HTTP/2 + TLS 1.3 Protected';
  status: 'ACTIVE' | 'HANDOFF_COMPLETED' | 'CHECKPOINT_SAVED';
}

// 5. On-Device Inference & Ultra Engine
export interface DualInferenceConfig {
  device: 'iPad A16 (6 GB RAM)';
  maxRamEnvelopeMb: 2800; // ~2.8 GB
  runtime: 'llama.cpp + Metal';
  gpuLayers: 99;
  contextWindow: 4096;
  kvCache: 'Q8_0';
  focusedStream: {
    temperature: 0.1;
    seed: number;
    purpose: 'Deterministic precision, code synthesis, mathematical validation';
  };
  exploratoryStream: {
    temperature: number; // 0.65 - 1.05
    seed: number;
    purpose: 'Creative architecture discovery, diverse hypotheses';
  };
}

export interface DaemonNotepadState {
  id: string;
  name: string;
  daemonType: DaemonType;
  padSizeKb: number;
  maxPadKb: 2048; // Couple-MB pad constraint
  lastWrittenBytes: number;
  memoryUsageMb: number;
}

export interface VerificationDisciplinesState {
  srro2: {
    name: 'SRRO-2 Build-Time Defense';
    sealedFiles: ['PIPELINE.md', 'VERSION_SEAL.md', 'versions.lock', 'seal.sh'];
    keychainHmacValid: boolean;
    attackVectorsClosed: 7;
  };
  aegisHaa: {
    name: 'AEGIS-HAA Decoupled Triad';
    integritySha256: boolean;
    authenticityEd25519: boolean;
    freshnessNonces: boolean;
  };
  threeCu: {
    name: '3CU Founder-Sealed Evaluation Suite';
    boxes: {
      codeExecution: boolean;
      creationHashNovelty: boolean;
      centralizationChecks: boolean;
      utopiaLimitations: boolean;
    };
  };
  sovereignTrinity: {
    name: 'Sovereign Trinity Composition Rule';
    rule: 'Move the checkpoint, not the credentials';
    enforced: boolean;
  };
}

// -------------------------------------------------------------
// 7. LiteRT-LM / Edge Model Allowlist Types (From Attachment)
// -------------------------------------------------------------
export interface EdgeModelConfig {
  topK: number;
  topP: number;
  temperature: number;
  maxTokens: number;
  maxContextLength?: number;
  accelerators: string;
}

export interface EdgeModelDefinition {
  name: string;
  modelId: string;
  modelFile: string;
  description: string;
  sizeInBytes: number;
  minDeviceMemoryInGb: number;
  version: number;
  supportedVersions?: { version: number; modelFile: string }[];
  llmSupportImage?: boolean;
  llmSupportAudio?: boolean;
  updateInfo?: string;
  capabilities?: string[];
  defaultConfig: EdgeModelConfig;
  taskTypes: string[];
  bestForTaskTypes?: string[];
  capabilityToTaskTypes?: Record<string, string[]>;
  modelType?: 'asr' | 'tts' | 'segmentation' | 'llm';
  asrConfig?: { languages: string[] };
  ttsConfig?: { engineModelId: string; defaultVoice?: string; languages: string[] };
  downloadUrl?: string;
  commitHash?: string;
  extraDataFiles?: { name: string; url: string; downloadFileName: string; sizeInBytes: number; targetTaskTypes: string[] }[];
  learnMoreUrl?: string;
}

// -------------------------------------------------------------
// 8. 17 Sources Inventory & Consolidated Repo Tree Types
// -------------------------------------------------------------
export type SourceType = 'Markdown' | 'URL' | 'Image/Schematic' | 'Test Suite';

export interface SourceInventoryItem {
  id: string;
  title: string;
  type: SourceType;
  citation: string;
  status: 'ACTIVE' | 'VERIFIED' | 'CONNECTED';
  description: string;
  keyArtifacts: string[];
  boundaryCoverage?: string;
  urlOrPath?: string;
}

export interface ConsolidatedRepoFile {
  name: string;
  path: string;
  size: string;
  language: 'typescript' | 'swift' | 'python' | 'kotlin' | 'json' | 'yaml' | 'shell' | 'markdown';
  purpose: string;
  citation: string;
  previewSnippet: string;
}

export interface ConsolidatedRepoNode {
  directory: string;
  description: string;
  citation: string;
  files: ConsolidatedRepoFile[];
}

export interface A2ABoundaryTestResult {
  boundaryId: number;
  boundaryName: string;
  testCount: number;
  passed: boolean;
  testNames: string[];
  executionTimeMs: number;
  sourceCitation: string;
}
