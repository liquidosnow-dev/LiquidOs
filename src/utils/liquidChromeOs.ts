/**
 * @file Liquid Chrome OS Core Matrix & Plug-and-Play OS Database Engine
 *
 * Bridges the Chromium OS Manifest (full.xml, 297 projects, board overlays,
 * AOSP HALs, third_party drivers, bootloader/EC/cr50 firmware) with the
 * LiquidOS 10-layer agentic execution engine, an_nexus cryptographic substrate,
 * CodexFlow 25-workflow attestation pipeline, and Rule S4 AST-guarded OS database.
 */

import type { ProjectFile } from '../types/index.ts';
import { canonicalize } from './contractRegistry.ts';
import { sha256Hex } from './securityCrypto.ts';
import { validateSqlRuleS4 } from './sovereignSubstrate.ts';
import type { ASTGuardResult } from './sovereignSubstrate.ts';

export type OsBuildProfileId = 'minilayout' | 'firmware' | 'crosvm' | 'bazel' | 'full';

export type OsOperationalPhase =
  | 'Intention Registration'
  | 'Methodological Verification'
  | 'Domain Execution & Runtime'
  | 'Cryptographic Attestation';

export interface OsLayerSpec {
  layerIndex: number;
  layerName: string;
  primaryComponent: string;
  phase: OsOperationalPhase;
  responsibility: string;
  substratePath: string;
}

export interface OsBuildProfileSpec {
  id: OsBuildProfileId;
  name: string;
  repoCount: number;
  includedComponents: string[];
  workflowFocus: string;
}

export interface OsManifestMapping {
  sourcePath: string;
  targetPath: string;
  operation: 'copyfile' | 'linkfile';
  purpose: string;
}

export interface OsManifestRepoRow {
  name: string;
  path: string;
  group: OsBuildProfileId | 'aosp' | 'third_party' | 'platform' | 'infra' | 'chromium';
  subsystem: string;
  revisionPin: string;
  sourceOrigin: 'chromiumos-full.xml' | 'liquidos-substrate' | 'aosp-hal' | 'third_party';
}

export interface OsHardwareSelection {
  kernelGeneration: '5.15' | '6.1' | '6.6-upstream';
  toolchain: 'llvm-clang' | 'gcc' | 'rust' | 'go';
  architecture: 'x86_64' | 'arm64';
  boardOverlay: string;
  securityChip: 'cr50' | 'ti50';
  ecFirmware: 'ec' | 'zephyr';
  bootloader: 'depthcharge' | 'coreboot' | 'u-boot' | 'edk2';
  hypervisor: 'crosvm' | 'borealis-vm' | 'container-guest-tools';
}

export interface CodexFlowWorkflowSpec {
  id: number;
  slug: string;
  category:
    | 'Runtime & Governance'
    | 'Assurance & Evidence'
    | 'Sovereign Memory & Vector'
    | 'Hardware & Interoperability'
    | 'Experience & Telemetry';
  action: string;
  substrate: string;
  policyRule: string;
  requiresAttestation: boolean;
}

export interface OsKnowledgeCatalogEntry {
  id: string;
  category: 'Knowledge' | 'Skills' | 'Methodology' | 'SOPs' | 'Docs' | 'Substrate';
  title: string;
  path: string;
  bytes: number;
  sha256: string;
  vetted: boolean;
}

export interface OsAppBindingRecord {
  bindingId: string;
  projectId: string;
  projectName: string;
  buildProfile: OsBuildProfileId;
  hardwareConfig: OsHardwareSelection;
  boundFilesCount: number;
  boundFilePaths: string[];
  tableBindings: string[];
  treeDigest: string;
  osDbDigest: string;
  attestationDigest: string | null;
  receiptId: string | null;
  keyId: string | null;
  linearizationSeq: number;
  wiredAt: number;
  actor: string;
}

export interface LiquidChromeOsDatabaseState {
  specVersion: string;
  manifestTotalRepos: number;
  activeBuildProfile: OsBuildProfileId;
  hardwareSelection: OsHardwareSelection;
  layers: OsLayerSpec[];
  buildProfiles: OsBuildProfileSpec[];
  manifestMappings: OsManifestMapping[];
  manifestRepos: OsManifestRepoRow[];
  workflows: CodexFlowWorkflowSpec[];
  knowledgeCatalog: OsKnowledgeCatalogEntry[];
  appBindings: OsAppBindingRecord[];
  updatedAt: number;
}

export interface OsDbSqlQueryResult {
  allowed: boolean;
  table: string;
  sql: string;
  astGuard: ASTGuardResult;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  payloadDigest: string;
  executedAt: number;
  reason?: string;
}

export const LIQUID_CHROME_OS_LAYERS: OsLayerSpec[] = [
  {
    layerIndex: 1,
    layerName: 'Team Orchestration',
    primaryComponent: 'LoopForge SOPs',
    phase: 'Intention Registration',
    responsibility:
      'Manages multi-repository repo synchronization, automated package builds, and fleet-wide deployment pipelines.',
    substratePath: 'SOPs/',
  },
  {
    layerIndex: 2,
    layerName: 'Agent ↔ User Protocol',
    primaryComponent: 'AG-UI',
    phase: 'Intention Registration',
    responsibility:
      'Provides structured user-to-agent interface protocols, surfacing system telemetry and interactive status outputs.',
    substratePath: 'src/components/ChatStream.tsx',
  },
  {
    layerIndex: 3,
    layerName: 'Human-in-the-Loop',
    primaryComponent: 'Plannotator',
    phase: 'Intention Registration',
    responsibility:
      'Interfaces design proposals, architectural modifications, and board overlay patches for explicit human sign-off prior to execution.',
    substratePath: 'src/engine/recursiveEngine.ts',
  },
  {
    layerIndex: 4,
    layerName: 'Live Verification',
    primaryComponent: 'Chrome DevTools + BrowserAct',
    phase: 'Domain Execution & Runtime',
    responsibility:
      'Executes automated end-to-end browser testing, UI inspection, and live functional verification across system components.',
    substratePath: 'Skills/browseract/',
  },
  {
    layerIndex: 5,
    layerName: 'Local / Private Runtime',
    primaryComponent: 'ggml / llama.cpp',
    phase: 'Domain Execution & Runtime',
    responsibility:
      'Host-level sovereign LLM execution environment running directly on kernel resources without cloud API dependencies.',
    substratePath: 'dark_gpt/',
  },
  {
    layerIndex: 6,
    layerName: 'Methodology & Guardrails',
    primaryComponent: 'Superpowers + Karpathy Guidelines',
    phase: 'Methodological Verification',
    responsibility:
      'Enforces strict development contracts: intent clarification, surgical changes, test-driven subagents, and goal-driven execution.',
    substratePath: 'Methodology/',
  },
  {
    layerIndex: 7,
    layerName: 'Evaluation & Reliability',
    primaryComponent: 'NVIDIA SkillEvaluator',
    phase: 'Methodological Verification',
    responsibility:
      'Evaluates new domain skills, automation scripts, and ebuild updates against performance and safety benchmarks before adoption.',
    substratePath: 'vitest.config.ts',
  },
  {
    layerIndex: 8,
    layerName: 'Domain Skills Engine',
    primaryComponent: 'Skills/ Directory',
    phase: 'Domain Execution & Runtime',
    responsibility:
      'Houses modular execution skills (browseract, selfhosted-audit, selfhosted-scaffold, selfhosted-discover).',
    substratePath: 'Skills/',
  },
  {
    layerIndex: 9,
    layerName: 'Knowledge Layer Catalogs',
    primaryComponent: 'Knowledge/ Directory',
    phase: 'Domain Execution & Runtime',
    responsibility:
      'Provides structured catalogs (selfhosted, python, scalability, flutter, openclaw-skills, unwind-ai) for system grounding.',
    substratePath: 'Knowledge/',
  },
  {
    layerIndex: 10,
    layerName: 'Cryptographic Core',
    primaryComponent: 'an_nexus',
    phase: 'Cryptographic Attestation',
    responsibility:
      'Root of trust executing Ed25519 signatures, fail-closed NexusBridge checks, and immutable audit ledger logging.',
    substratePath: 'an_nexus/',
  },
];

export const OS_BUILD_PROFILES: OsBuildProfileSpec[] = [
  {
    id: 'minilayout',
    name: 'Minilayout Workspace',
    repoCount: 23,
    includedComponents: ['chromite', 'repohooks', 'crosutils', 'depot_tools', 'core platform libraries'],
    workflowFocus: 'Essential workspace layout for general system utility development and manifest maintenance.',
  },
  {
    id: 'firmware',
    name: 'Firmware & Security Profile',
    repoCount: 69,
    includedComponents: ['depthcharge', 'ec', 'cr50', 'ti50', 'zephyr', 'coreboot', 'board overlays'],
    workflowFocus: 'Low-level firmware engineering, hardware security chip development, and EC driver coding.',
  },
  {
    id: 'crosvm',
    name: 'Crosvm Hypervisor Profile',
    repoCount: 10,
    includedComponents: ['crosvm', 'borealis-vm', 'container-guest-tools', 'platform2 VMM daemons'],
    workflowFocus: 'Hypervisor customization, Linux container integration, and guest VM performance tuning.',
  },
  {
    id: 'bazel',
    name: 'Bazel Build & Toolchain',
    repoCount: 7,
    includedComponents: ['bazel_deps/*', 'src/bazel', 'rules_cc', 'rules_rust', 'rules_pkg'],
    workflowFocus: 'Build system maintenance, Bazel rule optimization, and dependency graph verification.',
  },
  {
    id: 'full',
    name: 'Full Liquid Chrome OS Matrix',
    repoCount: 297,
    includedComponents: [
      '_kernel_upstream.xml',
      '_toolchain.xml',
      'aosp (28 projects)',
      'third_party (130 repos)',
      'chromium',
      'platform & platform2',
      'an_nexus',
    ],
    workflowFocus: 'Complete 297-repository sovereign OS distribution with 10-layer verification stack.',
  },
];

export const MANIFEST_LINK_COPY_MAPPINGS: OsManifestMapping[] = [
  {
    sourcePath: 'chromite/AUTHORS',
    targetPath: 'AUTHORS',
    operation: 'copyfile',
    purpose: 'Copies root authorship metadata to top-level workspace.',
  },
  {
    sourcePath: 'chromite/LICENSE',
    targetPath: 'LICENSE',
    operation: 'copyfile',
    purpose: 'Copies master open-source licensing terms to workspace root.',
  },
  {
    sourcePath: 'src/bazel/workspace_root/general/WORKSPACE',
    targetPath: 'src/WORKSPACE',
    operation: 'linkfile',
    purpose: 'Links central Bazel build workspace file to the src/ directory.',
  },
];

export const DEFAULT_HARDWARE_SELECTION: OsHardwareSelection = {
  kernelGeneration: '6.6-upstream',
  toolchain: 'llvm-clang',
  architecture: 'x86_64',
  boardOverlay: 'src/overlays/board-overlays/amd64-generic',
  securityChip: 'cr50',
  ecFirmware: 'zephyr',
  bootloader: 'depthcharge',
  hypervisor: 'crosvm',
};

export const HARDWARE_MODULE_CHOICES = {
  kernelGeneration: ['5.15', '6.1', '6.6-upstream'] as const,
  toolchain: ['llvm-clang', 'gcc', 'rust', 'go'] as const,
  architecture: ['x86_64', 'arm64'] as const,
  securityChip: ['cr50', 'ti50'] as const,
  ecFirmware: ['ec', 'zephyr'] as const,
  bootloader: ['depthcharge', 'coreboot', 'u-boot', 'edk2'] as const,
  hypervisor: ['crosvm', 'borealis-vm', 'container-guest-tools'] as const,
};

export const MANIFEST_CORE_REPOS: OsManifestRepoRow[] = [
  { name: 'chromiumos/chromite', path: 'chromite', group: 'minilayout', subsystem: 'Build & Admin Tools', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/repohooks', path: 'src/repohooks', group: 'minilayout', subsystem: 'Pre-Upload Hooks', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/scripts', path: 'src/scripts', group: 'minilayout', subsystem: 'crosutils Build Scripts', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromium/tools/depot_tools', path: 'src/chromium/depot_tools', group: 'minilayout', subsystem: 'Developer Toolset', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/cr50', path: 'src/platform/cr50', group: 'firmware', subsystem: 'Google Security Chip (cr50_stab)', revisionPin: 'cr50_stab', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/ti50', path: 'src/platform/ti50', group: 'firmware', subsystem: 'Google Security Chip (ti50)', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/depthcharge', path: 'src/platform/depthcharge', group: 'firmware', subsystem: 'Bootloader Payload', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/ec', path: 'src/platform/ec', group: 'firmware', subsystem: 'Embedded Controller', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/third_party/zephyr', path: 'src/third_party/zephyr', group: 'firmware', subsystem: 'Zephyr RTOS EC Firmware', revisionPin: 'cros-full-297', sourceOrigin: 'third_party' },
  { name: 'chromiumos/third_party/coreboot', path: 'src/third_party/coreboot', group: 'firmware', subsystem: 'System Firmware Engine', revisionPin: 'cros-full-297', sourceOrigin: 'third_party' },
  { name: 'chromiumos/overlays/board-overlays', path: 'src/overlays', group: 'firmware', subsystem: 'Board Overlays & Ebuilds', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/crosvm', path: 'src/platform/crosvm', group: 'crosvm', subsystem: 'VMM Hypervisor', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/borealis-vm', path: 'src/platform/borealis-vm', group: 'crosvm', subsystem: 'Gaming VM Runtime', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform/container-guest-tools', path: 'src/platform/container-guest-tools', group: 'crosvm', subsystem: 'Crostini Linux Guest Tools', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'chromiumos/platform2', path: 'src/platform2', group: 'platform', subsystem: 'Core Platform Daemons', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'bazel/central-registry', path: 'bazel_deps/bazel-central-registry', group: 'bazel', subsystem: 'Bazel Central Registry', revisionPin: 'bcr-pin', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'bazel/rules_cc', path: 'bazel_deps/rules_cc', group: 'bazel', subsystem: 'C++ Build Rules', revisionPin: 'bcr-pin', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'bazel/rules_rust', path: 'bazel_deps/rules_rust', group: 'bazel', subsystem: 'Rust Build Rules', revisionPin: 'bcr-pin', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'bazel/rules_pkg', path: 'bazel_deps/rules_pkg', group: 'bazel', subsystem: 'Packaging Build Rules', revisionPin: 'bcr-pin', sourceOrigin: 'chromiumos-full.xml' },
  { name: 'aosp/platform/hardware', path: 'src/aosp/hardware', group: 'aosp', subsystem: 'AOSP HALs (28 projects)', revisionPin: 'aosp-hal-pin', sourceOrigin: 'aosp-hal' },
  { name: 'chromiumos/third_party/mesa', path: 'src/third_party/Mesa', group: 'third_party', subsystem: 'Graphics Stack (130 third_party repos)', revisionPin: 'cros-full-297', sourceOrigin: 'third_party' },
  { name: 'liquidos/an_nexus', path: 'an_nexus', group: 'platform', subsystem: 'Zero-Trust Cryptographic Core', revisionPin: 'an-evc-001', sourceOrigin: 'liquidos-substrate' },
  { name: 'liquidos/recursive-engine', path: 'src/engine/recursiveEngine.ts', group: 'platform', subsystem: 'NexusBridge & Autonomous Loop Core', revisionPin: 'an-evc-001', sourceOrigin: 'liquidos-substrate' },
  { name: 'liquidos/infra-pipelines', path: 'infra', group: 'infra', subsystem: 'CI/CD, Autotest Drone, Observability', revisionPin: 'cros-full-297', sourceOrigin: 'chromiumos-full.xml' },
];

export const CODEXFLOW_25_WORKFLOWS: CodexFlowWorkflowSpec[] = [
  { id: 1, slug: 'recursive-self-mutation', category: 'Runtime & Governance', action: 'Generate AST/file diffs, run evaluation & Vitest, require Ed25519 d_attest before commit', substrate: 'recursiveEngine.ts, nexusBridge.ts', policyRule: 'IBM-PRAXIS-PPE-01', requiresAttestation: true },
  { id: 2, slug: 'ast-sandbox-execution', category: 'Runtime & Governance', action: 'Parse generated code into AST and execute in isolated sandbox', substrate: 'toolExecutor.ts', policyRule: 'IBM-PRAXIS-PPE-02', requiresAttestation: true },
  { id: 3, slug: 'multi-model-peer-review', category: 'Runtime & Governance', action: 'Route proposed diff to secondary model for security review before Praxis PPE gate', substrate: 'freeLlmClient.ts, nexusBridge.ts', policyRule: 'IBM-PRAXIS-PPE-03', requiresAttestation: true },
  { id: 4, slug: 'rollback-on-invariant-violation', category: 'Runtime & Governance', action: 'Trigger automatic checkpoint rollback if verification suite reports errors', substrate: 'versionControl.ts', policyRule: 'IBM-PRAXIS-PPE-04', requiresAttestation: true },
  { id: 5, slug: 'dependency-graph-pruning', category: 'Runtime & Governance', action: 'Analyze dependency graph and CVE surface before pruning unused packages', substrate: 'toolExecutor.ts, nexusBridge.ts', policyRule: 'IBM-PRAXIS-PPE-05', requiresAttestation: true },
  { id: 6, slug: 'edge-key-rotation', category: 'Assurance & Evidence', action: 'Rotate Ed25519 signing identity and emit dual-signed continuity transition record', substrate: 'an_nexus/keystore.py, serverControlPlane.ts', policyRule: 'AN-EVC-KEY-06', requiresAttestation: true },
  { id: 7, slug: 'signed-audit-log-sync', category: 'Assurance & Evidence', action: 'Flush pending local telemetry sealed with a signed receipt', substrate: 'sentimentStore.ts, nexusBridge.ts', policyRule: 'AN-EVC-LOG-07', requiresAttestation: true },
  { id: 8, slug: 'continuity-anchor-rollup', category: 'Assurance & Evidence', action: 'Roll up audit ledger tip into signed Merkle checkpoint', substrate: 'an_nexus/continuity.py', policyRule: 'AN-EVC-ANCHOR-08', requiresAttestation: true },
  { id: 9, slug: 'policy-ppe-violation-alert', category: 'Assurance & Evidence', action: 'Block unauthorized tool invocation at IBM Praxis PPE and log lockdown alert', substrate: 'ingestionControlPlane.ts, CommandHUD.tsx', policyRule: 'GLOBAL-MODE-001', requiresAttestation: true },
  { id: 10, slug: 'hardware-enclave-attestation', category: 'Assurance & Evidence', action: 'Verify cr50/ti50 enclave signature against trust registry before state transfer', substrate: 'an_nexus/assertions.py, access_state.py', policyRule: 'TPM-CR50-ATTEST-10', requiresAttestation: true },
  { id: 11, slug: 'live-html-to-vector-snapshot', category: 'Sovereign Memory & Vector', action: 'Extract active canvas text, chunk content, and index 1536-dim vectors', substrate: 'snapshotPipeline.ts, vectorStore.ts', policyRule: 'VAULT-VECTOR-11', requiresAttestation: true },
  { id: 12, slug: 'vector-vault-l2-optimization', category: 'Sovereign Memory & Vector', action: 'Recalculate L2 distances across LanceDB embeddings and prune stale chunks', substrate: 'vectorStore.ts, vaultAdapters.ts', policyRule: 'VAULT-L2-12', requiresAttestation: true },
  { id: 13, slug: 'cross-session-memory-transfer', category: 'Sovereign Memory & Vector', action: 'Authorize signed LanceDB snapshot transfer between workspace profiles', substrate: 'an_nexus/access_state.py', policyRule: 'VAULT-XFER-13', requiresAttestation: true },
  { id: 14, slug: 'semantic-cache-invalidation', category: 'Sovereign Memory & Vector', action: 'Purge stale chunk_id entries when underlying workspace source files mutate', substrate: 'vectorStore.ts, snapshotPipeline.ts', policyRule: 'VAULT-CACHE-14', requiresAttestation: true },
  { id: 15, slug: 'duckdb-analytical-export', category: 'Sovereign Memory & Vector', action: 'Run Rule S4 read-only analytical SQL aggregation over workspace & OS DB tables', substrate: 'vaultAdapters.ts, liquidChromeOs.ts', policyRule: 'RULE-S4-SQL-15', requiresAttestation: true },
  { id: 16, slug: 'mcp-device-handshake', category: 'Hardware & Interoperability', action: 'Initiate MCP handshake and verify device SHA-256 fingerprint', substrate: 'nexusBridge.ts, sovereignSubstrate.ts', policyRule: 'MCP-HANDSHAKE-16', requiresAttestation: true },
  { id: 17, slug: 'edge-inference-esp32-sync', category: 'Hardware & Interoperability', action: 'Sign quantized edge model payload before pushing to target hardware', substrate: 'an_nexus/signing.py', policyRule: 'EDGE-SIGN-17', requiresAttestation: true },
  { id: 18, slug: 'actuator-command-escalation', category: 'Hardware & Interoperability', action: 'Require multi-sig authorization before unlocking physical hardware actuators', substrate: 'an_nexus/signature.py', policyRule: 'HW-MULTISIG-18', requiresAttestation: true },
  { id: 19, slug: 'local-network-topology-discovery', category: 'Hardware & Interoperability', action: 'Record discovered local hardware endpoints into tamper-evident ledger', substrate: 'an_nexus/audit_log.py', policyRule: 'NET-DISCO-19', requiresAttestation: true },
  { id: 20, slug: 'firmware-hash-verification', category: 'Hardware & Interoperability', action: 'Verify depthcharge/ec/cr50 firmware SHA-256 against manifest pins before update', substrate: 'an_nexus/digests.py, manifest.py', policyRule: 'FW-PIN-20', requiresAttestation: true },
  { id: 21, slug: 'sentiment-telemetry-flush', category: 'Experience & Telemetry', action: 'Flush session telemetry cleanly on unload using beacon transport', substrate: 'useAssistantSentiment.ts', policyRule: 'TEL-FLUSH-21', requiresAttestation: true },
  { id: 22, slug: 'hud-ledger-latency-probe', category: 'Experience & Telemetry', action: 'Poll audit log head and update HUD with latest cryptographic tip hash', substrate: 'CommandHUD.tsx, nexusBridge.ts', policyRule: 'HUD-PROBE-22', requiresAttestation: true },
  { id: 23, slug: 'ui-state-machine-sync', category: 'Experience & Telemetry', action: 'Synchronize agent HUD execution states across workspace panels', substrate: 'App.tsx, PreviewCanvas.tsx', policyRule: 'UI-SYNC-23', requiresAttestation: true },
  { id: 24, slug: 'zero-latency-hotkeys', category: 'Experience & Telemetry', action: 'Dispatch instant voice/composer trigger without event pooling lag', substrate: 'App.tsx, ChatStream.tsx', policyRule: 'UI-HOTKEY-24', requiresAttestation: true },
  { id: 25, slug: 'global-mode-lockdown-broadcast', category: 'Experience & Telemetry', action: 'Abort in-flight sync/loops and enforce LOCKDOWN across connected surfaces', substrate: 'App.tsx, ingestionControlPlane.ts', policyRule: 'GLOBAL-MODE-001', requiresAttestation: true },
];

export const DEFAULT_KNOWLEDGE_CATALOG: OsKnowledgeCatalogEntry[] = [
  { id: 'kn_selfhosted', category: 'Knowledge', title: 'Awesome-Selfhosted Services Catalog', path: 'Knowledge/selfhosted', bytes: 4096, sha256: sha256Hex('Knowledge/selfhosted'), vetted: true },
  { id: 'kn_python', category: 'Knowledge', title: 'Awesome-Python Sovereign Runtime Catalog', path: 'Knowledge/python', bytes: 4096, sha256: sha256Hex('Knowledge/python'), vetted: true },
  { id: 'kn_scalability', category: 'Knowledge', title: 'Awesome-Scalability Architecture Patterns', path: 'Knowledge/scalability', bytes: 4096, sha256: sha256Hex('Knowledge/scalability'), vetted: true },
  { id: 'kn_flutter', category: 'Knowledge', title: 'Awesome-Flutter Mobile Bridge Catalog', path: 'Knowledge/flutter', bytes: 4096, sha256: sha256Hex('Knowledge/flutter'), vetted: true },
  { id: 'kn_openclaw', category: 'Knowledge', title: 'OpenClaw Curated Skills Index', path: 'Knowledge/openclaw-skills', bytes: 4096, sha256: sha256Hex('Knowledge/openclaw-skills'), vetted: true },
  { id: 'kn_unwind', category: 'Knowledge', title: 'Unwind AI Agent & RAG Intelligence', path: 'Knowledge/unwind-ai', bytes: 4096, sha256: sha256Hex('Knowledge/unwind-ai'), vetted: true },
  { id: 'sk_browseract', category: 'Skills', title: 'BrowserAct Live Verification Skill', path: 'Skills/browseract', bytes: 2048, sha256: sha256Hex('Skills/browseract'), vetted: true },
  { id: 'sk_selfhosted_audit', category: 'Skills', title: 'Selfhosted Security Audit Skill', path: 'Skills/selfhosted-audit', bytes: 2048, sha256: sha256Hex('Skills/selfhosted-audit'), vetted: true },
  { id: 'sk_selfhosted_scaffold', category: 'Skills', title: 'Selfhosted Scaffold Skill', path: 'Skills/selfhosted-scaffold', bytes: 2048, sha256: sha256Hex('Skills/selfhosted-scaffold'), vetted: true },
  { id: 'sk_selfhosted_discover', category: 'Skills', title: 'Selfhosted Discover Skill', path: 'Skills/selfhosted-discover', bytes: 2048, sha256: sha256Hex('Skills/selfhosted-discover'), vetted: true },
  { id: 'meth_karpathy', category: 'Methodology', title: 'Karpathy Behavioral Guardrails', path: 'Methodology/KARPATHY.md', bytes: 2179, sha256: sha256Hex('Methodology/KARPATHY.md'), vetted: true },
  { id: 'meth_superpowers', category: 'Methodology', title: 'Superpowers Multi-Stage TDD Contract', path: 'Methodology/SUPERPOWERS.md', bytes: 1493, sha256: sha256Hex('Methodology/SUPERPOWERS.md'), vetted: true },
];

export function createInitialLiquidChromeOsDb(): LiquidChromeOsDatabaseState {
  return {
    specVersion: 'LiquidChromeOS-v1.0-AN-EVC-001',
    manifestTotalRepos: 297,
    activeBuildProfile: 'full',
    hardwareSelection: { ...DEFAULT_HARDWARE_SELECTION },
    layers: LIQUID_CHROME_OS_LAYERS,
    buildProfiles: OS_BUILD_PROFILES,
    manifestMappings: MANIFEST_LINK_COPY_MAPPINGS,
    manifestRepos: MANIFEST_CORE_REPOS,
    workflows: CODEXFLOW_25_WORKFLOWS,
    knowledgeCatalog: DEFAULT_KNOWLEDGE_CATALOG,
    appBindings: [],
    updatedAt: Date.now(),
  };
}

export function computeOsDbDigest(db: LiquidChromeOsDatabaseState): string {
  return sha256Hex(
    canonicalize({
      specVersion: db.specVersion,
      manifestTotalRepos: db.manifestTotalRepos,
      activeBuildProfile: db.activeBuildProfile,
      hardwareSelection: db.hardwareSelection,
      appBindings: db.appBindings,
      knowledgeCount: db.knowledgeCatalog.length,
      workflowsCount: db.workflows.length,
    })
  );
}

/**
 * Evaluates a read-only Rule S4 AST-guarded SQL query against Liquid Chrome OS Database tables:
 * os_layers, os_build_profiles, os_manifest_repos, os_manifest_mappings,
 * os_codexflow_workflows, os_knowledge_catalog, os_app_bindings, os_hardware_config.
 */
export function queryLiquidChromeOsDb(
  db: LiquidChromeOsDatabaseState,
  sql: string
): OsDbSqlQueryResult {
  const astGuard = validateSqlRuleS4(sql);
  if (!astGuard.allowed) {
    return {
      allowed: false,
      table: 'blocked',
      sql,
      astGuard,
      columns: [],
      rows: [],
      rowCount: 0,
      payloadDigest: sha256Hex(canonicalize({ blocked: true, sql, reason: astGuard.reason })),
      executedAt: Date.now(),
      reason: astGuard.reason,
    };
  }

  const normalized = sql.trim();
  const tableMatch = normalized.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
  const table = (tableMatch ? tableMatch[1] : 'os_layers').toLowerCase();

  let sourceRows: Array<Record<string, unknown>> = [];

  switch (table) {
    case 'os_layers':
      sourceRows = db.layers.map((l) => ({
        layer_index: l.layerIndex,
        layer_name: l.layerName,
        primary_component: l.primaryComponent,
        phase: l.phase,
        substrate_path: l.substratePath,
      }));
      break;
    case 'os_build_profiles':
      sourceRows = db.buildProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        repo_count: p.repoCount,
        components: p.includedComponents.join(', '),
      }));
      break;
    case 'os_manifest_repos':
      sourceRows = db.manifestRepos.map((r) => ({
        name: r.name,
        path: r.path,
        profile_group: r.group,
        subsystem: r.subsystem,
        revision_pin: r.revisionPin,
        origin: r.sourceOrigin,
      }));
      break;
    case 'os_manifest_mappings':
      sourceRows = db.manifestMappings.map((m) => ({
        source_path: m.sourcePath,
        target_path: m.targetPath,
        operation: m.operation,
        purpose: m.purpose,
      }));
      break;
    case 'os_codexflow_workflows':
      sourceRows = db.workflows.map((w) => ({
        id: w.id,
        slug: w.slug,
        category: w.category,
        policy_rule: w.policyRule,
        substrate: w.substrate,
        requires_attestation: w.requiresAttestation,
      }));
      break;
    case 'os_knowledge_catalog':
      sourceRows = db.knowledgeCatalog.map((k) => ({
        id: k.id,
        category: k.category,
        title: k.title,
        path: k.path,
        bytes: k.bytes,
        vetted: k.vetted,
      }));
      break;
    case 'os_app_bindings':
      sourceRows = db.appBindings.map((b) => ({
        binding_id: b.bindingId,
        project_id: b.projectId,
        project_name: b.projectName,
        build_profile: b.buildProfile,
        bound_files_count: b.boundFilesCount,
        tree_digest: b.treeDigest,
        receipt_id: b.receiptId,
        wired_at: b.wiredAt,
      }));
      break;
    case 'os_hardware_config':
      sourceRows = [
        {
          active_build_profile: db.activeBuildProfile,
          kernel_generation: db.hardwareSelection.kernelGeneration,
          toolchain: db.hardwareSelection.toolchain,
          architecture: db.hardwareSelection.architecture,
          board_overlay: db.hardwareSelection.boardOverlay,
          security_chip: db.hardwareSelection.securityChip,
          ec_firmware: db.hardwareSelection.ecFirmware,
          bootloader: db.hardwareSelection.bootloader,
          hypervisor: db.hardwareSelection.hypervisor,
        },
      ];
      break;
    default:
      sourceRows = db.layers.map((l) => ({
        layer_index: l.layerIndex,
        layer_name: l.layerName,
        primary_component: l.primaryComponent,
        phase: l.phase,
        substrate_path: l.substratePath,
      }));
      break;
  }

  // Optional simple WHERE col = 'val' filtering
  const whereMatch = normalized.match(/\bWHERE\s+([a-zA-Z0-9_]+)\s*=\s*'([^']*)'/i);
  if (whereMatch) {
    const col = whereMatch[1].toLowerCase();
    const expectedVal = whereMatch[2].toLowerCase();
    sourceRows = sourceRows.filter((row) => String(row[col] ?? '').toLowerCase() === expectedVal);
  }

  // Optional COUNT(*) projection
  if (/\bSELECT\s+COUNT\s*\(\s*\*\s*\)/i.test(normalized)) {
    const countRows = [{ table_name: table, total_count: sourceRows.length }];
    const columns = ['table_name', 'total_count'];
    return {
      allowed: true,
      table,
      sql,
      astGuard,
      columns,
      rows: countRows,
      rowCount: countRows.length,
      payloadDigest: sha256Hex(canonicalize({ sql, columns, rows: countRows })),
      executedAt: Date.now(),
    };
  }

  const limitMatch = normalized.match(/\bLIMIT\s+(\d+)\b/i);
  const limit = limitMatch ? Math.max(0, Math.min(Number(limitMatch[1]), 10000)) : 100;
  const rows = sourceRows.slice(0, limit);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    allowed: true,
    table,
    sql,
    astGuard,
    columns,
    rows,
    rowCount: rows.length,
    payloadDigest: sha256Hex(canonicalize({ sql, columns, rows })),
    executedAt: Date.now(),
  };
}

export function buildLocalAppBindingRecord(params: {
  db: LiquidChromeOsDatabaseState;
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  buildProfile?: OsBuildProfileId;
  hardwareSelection?: Partial<OsHardwareSelection>;
  actor?: string;
}): {
  nextDb: LiquidChromeOsDatabaseState;
  binding: OsAppBindingRecord;
} {
  const nextProfile = params.buildProfile || params.db.activeBuildProfile;
  const nextHardware: OsHardwareSelection = {
    ...params.db.hardwareSelection,
    ...(params.hardwareSelection || {}),
  };

  const fileHashes: Record<string, string> = {};
  const sortedPaths = params.files.map((f) => f.path).sort();
  for (const f of params.files) {
    fileHashes[f.path] = sha256Hex(f.content);
  }
  const treeDigest = sha256Hex(canonicalize(fileHashes));

  const tableBindings = [
    'os_layers',
    'os_build_profiles',
    'os_manifest_repos',
    'os_codexflow_workflows',
    'os_knowledge_catalog',
    'os_app_bindings',
  ];

  const bindingId = `wire_${sha256Hex(`${params.projectId}:${nextProfile}:${treeDigest}`).slice(0, 12)}`;
  const preliminaryBinding: OsAppBindingRecord = {
    bindingId,
    projectId: params.projectId,
    projectName: params.projectName,
    buildProfile: nextProfile,
    hardwareConfig: nextHardware,
    boundFilesCount: params.files.length,
    boundFilePaths: sortedPaths.slice(0, 40),
    tableBindings,
    treeDigest,
    osDbDigest: '',
    attestationDigest: null,
    receiptId: null,
    keyId: null,
    linearizationSeq: 0,
    wiredAt: Date.now(),
    actor: params.actor || 'human:mercy',
  };

  const remaining = params.db.appBindings.filter((b) => b.projectId !== params.projectId);
  const nextDb: LiquidChromeOsDatabaseState = {
    ...params.db,
    activeBuildProfile: nextProfile,
    hardwareSelection: nextHardware,
    appBindings: [preliminaryBinding, ...remaining],
    updatedAt: Date.now(),
  };
  preliminaryBinding.osDbDigest = computeOsDbDigest(nextDb);

  return { nextDb, binding: preliminaryBinding };
}
