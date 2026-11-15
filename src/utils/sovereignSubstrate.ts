import { sha256Hex } from './securityCrypto';

/**
 * Sovereign Security Primitives, Rule S4 Lexical AST SQL Guard,
 * 5-Plane Pi Pipeline & Master 22-Tool MCP Catalog.
 */

export interface ASTGuardResult {
  allowed: boolean;
  reason?: string;
  normalizedPrefix?: string;
  strippedCommentsCount?: number;
}

const FORBIDDEN_RULE_S4_OPCODES = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'INTO OUTFILE',
  'FOR UPDATE',
] as const;

export function validateSqlRuleS4(sql: string): ASTGuardResult {
  if (!sql || typeof sql !== 'string') {
    return { allowed: false, reason: 'Invalid payload: SQL string required.' };
  }

  const blockComments = sql.match(/\/\*[\s\S]*?\*\//g) || [];
  const lineComments = sql.match(/--.*$/gm) || [];

  // Strip block comments, line comments, and string literals
  const cleanSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .replace(/'(?:''|[^'])*'/g, "''")
    .trim();

  if (!cleanSql) {
    return {
      allowed: false,
      reason: 'RULE_S4_REJECTION: Empty query after comment and literal normalization.',
      strippedCommentsCount: blockComments.length + lineComments.length,
    };
  }

  // Block statement chaining
  if (cleanSql.includes(';')) {
    return {
      allowed: false,
      reason: 'CHAINED_STATEMENTS: Multi-statement execution blocked.',
      strippedCommentsCount: blockComments.length + lineComments.length,
    };
  }

  const normalized = cleanSql.toUpperCase();

  // Enforce mutation opcode block
  for (const keyword of FORBIDDEN_RULE_S4_OPCODES) {
    if (new RegExp(`\\b${keyword}\\b`).test(normalized)) {
      return {
        allowed: false,
        reason: `RULE_S4_REJECTION: Mutation keyword '${keyword}' disallowed on dbRO handle.`,
        strippedCommentsCount: blockComments.length + lineComments.length,
      };
    }
  }

  // Allow only bare SELECT or WITH...SELECT queries
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return {
      allowed: false,
      reason: 'RULE_S4_REJECTION: Only SELECT and WITH queries permitted.',
      strippedCommentsCount: blockComments.length + lineComments.length,
    };
  }

  return {
    allowed: true,
    normalizedPrefix: normalized.startsWith('WITH') ? 'WITH' : 'SELECT',
    strippedCommentsCount: blockComments.length + lineComments.length,
  };
}

/**
 * Constant-time Bearer token verification (matches crypto.timingSafeEqual pattern
 * safely across both Node.js and browser runtimes).
 */
export function verifyIngressToken(clientToken: string, expectedToken: string): boolean {
  if (!clientToken || !expectedToken) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(clientToken);
  const b = encoder.encode(expectedToken);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export interface SubstrateLedgerEntry {
  sequenceId: number;
  previousHash: string;
  payloadDigest: string;
  entryDigest: string;
  toolName: string;
  plane: SubstratePlane;
  timestamp: number;
}

export function computeLedgerEntryDigest(
  sequenceId: number,
  previousHash: string,
  payloadDigest: string
): string {
  // Domain-separated entry digest: sequence_id || previous_hash || 0x00 || payload_digest
  const frame = `${sequenceId}|${previousHash}\x00${payloadDigest}`;
  return sha256Hex(frame);
}

export function appendSubstrateLedger(
  ledger: SubstrateLedgerEntry[],
  toolName: string,
  plane: SubstratePlane,
  payload: unknown
): { ledger: SubstrateLedgerEntry[]; entry: SubstrateLedgerEntry } {
  const sequenceId = ledger.length;
  const previousHash =
    ledger.length > 0 ? ledger[ledger.length - 1].entryDigest : '0'.repeat(64);
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const payloadDigest = sha256Hex(serialized);
  const entryDigest = computeLedgerEntryDigest(sequenceId, previousHash, payloadDigest);

  const entry: SubstrateLedgerEntry = {
    sequenceId,
    previousHash,
    payloadDigest,
    entryDigest,
    toolName,
    plane,
    timestamp: Date.now(),
  };

  return {
    ledger: [...ledger, entry],
    entry,
  };
}

export function verifySubstrateLedger(ledger: SubstrateLedgerEntry[]): {
  valid: boolean;
  failedAtSequence?: number;
} {
  for (let i = 0; i < ledger.length; i++) {
    const entry = ledger[i];
    const expectedPrev = i === 0 ? '0'.repeat(64) : ledger[i - 1].entryDigest;
    if (entry.sequenceId !== i || entry.previousHash !== expectedPrev) {
      return { valid: false, failedAtSequence: i };
    }
    const recomputed = computeLedgerEntryDigest(
      entry.sequenceId,
      entry.previousHash,
      entry.payloadDigest
    );
    if (recomputed !== entry.entryDigest) {
      return { valid: false, failedAtSequence: i };
    }
  }
  return { valid: true };
}

export type SubstratePlane =
  | 'Ingestion'
  | 'Vault Query'
  | 'Egress'
  | 'Agent'
  | 'Composite';

export type SignalExecutionState =
  | 'IDLE'
  | 'PREPARED'
  | 'SIGNED'
  | 'READ'
  | 'CONFIRMED'
  | 'FAILED';

export interface McpToolSpec {
  name: string;
  plane: SubstratePlane;
  purpose: string;
  returnShape: string;
  targetHandle: string;
  barriers: string[];
  sampleParams: Record<string, unknown>;
}

export const MCP_22_TOOL_CATALOG: McpToolSpec[] = [
  // Ingestion Plane (3)
  {
    name: 'snapshot_capture',
    plane: 'Ingestion',
    purpose: 'Ingest captured page text, DOM, and metadata',
    returnShape: '{ page_id, snapshot_id, deduped, canonical_url }',
    targetHandle: 'SQLite RW Staging',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { url: 'https://docs.cloudflare.com/d1/', title: 'Cloudflare D1 Edge SQL' },
  },
  {
    name: 'snapshot_dedupe',
    plane: 'Ingestion',
    purpose: 'Check SHA-256 hash against deduplication window',
    returnShape: '{ seen: boolean, page_id?: number }',
    targetHandle: 'SHA-256 Audit Ledger',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { content_sha256: 'e3b0c44298fc1c149afbf4c8996fb924', window_sec: 300 },
  },
  {
    name: 'snapshot_list',
    plane: 'Ingestion',
    purpose: 'List recent snapshot records with domain filter',
    returnShape: '{ snapshots: [...], total: number }',
    targetHandle: 'SQLite dbRO',
    barriers: ['SECURITY_BARRIER', 'MEMORY_MTU_BARRIER'],
    sampleParams: { domain: 'cloudflare.com', limit: 10 },
  },

  // Vault Query Plane (5)
  {
    name: 'vault_search',
    plane: 'Vault Query',
    purpose: 'Execute FTS5 trigram full-text substring search',
    returnShape: '{ hits: [{ page_id, title, url, snippet, rank }], total }',
    targetHandle: 'SQLite dbRO (FTS5 Trigram)',
    barriers: ['SECURITY_BARRIER', 'SQLITE_BUSY_BARRIER'],
    sampleParams: { query: 'SO_PEERCRED OR Rule S4', limit: 5 },
  },
  {
    name: 'vault_get_page',
    plane: 'Vault Query',
    purpose: 'Fetch page record and raw snapshot body',
    returnShape: '{ page: {...}, snapshot?: {...} }',
    targetHandle: 'SQLite dbRO',
    barriers: ['SECURITY_BARRIER', 'SQLITE_BUSY_BARRIER'],
    sampleParams: { page_id: 42, include_raw: false },
  },
  {
    name: 'vault_schema',
    plane: 'Vault Query',
    purpose: 'Return compact database schema for LLM context',
    returnShape: '{ tables: [{ name, sql }], fts_tables: [...] }',
    targetHandle: 'SQLite dbRO',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { include_fts: true },
  },
  {
    name: 'vault_sql',
    plane: 'Vault Query',
    purpose: 'Execute Rule S4 allowlisted SQL on dbRO handle',
    returnShape: '{ rows: [...], columns: [...] }',
    targetHandle: 'SQLite dbRO / DuckDB (>10k rows)',
    barriers: ['SECURITY_BARRIER', 'MEMORY_MTU_BARRIER', 'SQLITE_BUSY_BARRIER'],
    sampleParams: { sql: 'SELECT id, domain, captured_at FROM pages ORDER BY id DESC LIMIT 5' },
  },
  {
    name: 'vault_stats',
    plane: 'Vault Query',
    purpose: 'Retrieve global and per-domain vault statistics',
    returnShape: '{ global: {...}, groups: [...] }',
    targetHandle: 'DuckDB Columnar OLAP',
    barriers: ['MEMORY_MTU_BARRIER'],
    sampleParams: { group_by: 'domain' },
  },

  // Egress Plane (6)
  {
    name: 'proxy_rotate',
    plane: 'Egress',
    purpose: 'Cycle active proxy endpoint in proxy pool',
    returnShape: '{ active_proxy: { endpoint, protocol }, handle_url }',
    targetHandle: 'Adrift / SOCKS5 Pool',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { strategy: 'round_robin' },
  },
  {
    name: 'proxy_hop',
    plane: 'Egress',
    purpose: 'Force random ephemeral port hop via listen(0)',
    returnShape: '{ old_port, new_port, handle_url }',
    targetHandle: 'Loopback Daemon (127.0.0.1:17373)',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { bind_interface: '127.0.0.1' },
  },
  {
    name: 'proxy_health',
    plane: 'Egress',
    purpose: 'Issue HEAD probe to evaluate proxy pool health',
    returnShape: '{ healthy: boolean, latency_ms, exit_ip }',
    targetHandle: 'Adrift / SOCKS5 Pool',
    barriers: ['MEMORY_MTU_BARRIER'],
    sampleParams: { timeout_ms: 1500 },
  },
  {
    name: 'proxy_egress',
    plane: 'Egress',
    purpose: 'Route HTTP request through SOCKS5 or Adrift exit',
    returnShape: '{ status, headers, body, via: {...} }',
    targetHandle: 'Adrift / SOCKS5 Exit',
    barriers: ['SECURITY_BARRIER', 'MEMORY_MTU_BARRIER'],
    sampleParams: { method: 'GET', url: 'https://api.github.com/zen' },
  },
  {
    name: 'proxy_pool_list',
    plane: 'Egress',
    purpose: 'List configured proxy pool endpoints',
    returnShape: '{ pools: [...] }',
    targetHandle: 'Encrypted Config Vault',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: {},
  },
  {
    name: 'proxy_pool_add',
    plane: 'Egress',
    purpose: 'Register new proxy pool entry with encrypted auth',
    returnShape: '{ pool_id, label }',
    targetHandle: 'Encrypted Config Vault',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { label: 'edge-adrift-us-west', protocol: 'socks5' },
  },

  // Agent Plane (6)
  {
    name: 'agent_spawn',
    plane: 'Agent',
    purpose: 'Launch agent thread in isolated Git worktree',
    returnShape: '{ thread_id, backend, model, worktree_path }',
    targetHandle: 'Git Worktree Isolation',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { model: 'gemma-4-e2b-it', branch: 'feat/substrate-audit' },
  },
  {
    name: 'agent_send',
    plane: 'Agent',
    purpose: 'Send prompt to agent thread and stream events',
    returnShape: '{ turn_id, stream_url, status }',
    targetHandle: 'LiteRT-LM / Local Runtime',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { thread_id: 'thr_liquid_01', prompt: 'Audit Rule S4 AST parser' },
  },
  {
    name: 'agent_await_approval',
    plane: 'Agent',
    purpose: 'Pause thread for command/patch approval decision',
    returnShape: '{ approved: boolean, approval_id, reason }',
    targetHandle: 'LOS-CAP-REG-001 Gate',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { approval_id: 'apr_9481', action: 'apply_patch' },
  },
  {
    name: 'agent_cancel',
    plane: 'Agent',
    purpose: 'Terminate agent thread and clean up worktree',
    returnShape: '{ cancelled: boolean, thread_id }',
    targetHandle: 'Git Worktree Isolation',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { thread_id: 'thr_liquid_01' },
  },
  {
    name: 'agent_list_threads',
    plane: 'Agent',
    purpose: 'List active and historical agent threads',
    returnShape: '{ threads: [...] }',
    targetHandle: 'SQLite dbRO',
    barriers: ['SQLITE_BUSY_BARRIER'],
    sampleParams: { status: 'active' },
  },
  {
    name: 'agent_route_explain',
    plane: 'Agent',
    purpose: 'Fetch single-line routing receipt for a turn',
    returnShape: '{ model, reasoning_effort, receipt }',
    targetHandle: 'SHA-256 Audit Ledger',
    barriers: ['SECURITY_BARRIER'],
    sampleParams: { turn_id: 'turn_01_jcs' },
  },

  // Composite Plane (2)
  {
    name: 'vault_agent_search',
    plane: 'Composite',
    purpose: 'Search Vault and inject top-K hits into agent prompt',
    returnShape: '{ thread_id, injected_hits: number, status }',
    targetHandle: 'LanceDB Vector ANN + Agent Thread',
    barriers: ['VECTOR_INDEX_BARRIER', 'SECURITY_BARRIER'],
    sampleParams: { thread_id: 'thr_liquid_01', query: '1232B MTU barrier', top_k: 4 },
  },
  {
    name: 'egress_and_capture',
    plane: 'Composite',
    purpose: 'Fetch URL via proxy egress and snapshot into Vault',
    returnShape: '{ page_id, status_code, bytes_saved }',
    targetHandle: 'Adrift Egress + SQLite/LanceDB',
    barriers: ['SECURITY_BARRIER', 'MEMORY_MTU_BARRIER', 'VECTOR_INDEX_BARRIER'],
    sampleParams: { url: 'https://modelcontextprotocol.io/specification' },
  },
];

export const SOVEREIGN_BARRIERS = [
  {
    id: 'SECURITY_BARRIER',
    title: 'SECURITY_BARRIER',
    subtitle: 'SO_PEERCRED (UID 1000) & Rule S4 AST',
    detail:
      'Intercepts dbRO handle queries and UNIX socket frames, rejecting non-SELECT/WITH statements and logging violations to LOS-CAP-REG-001.',
  },
  {
    id: 'VECTOR_INDEX_BARRIER',
    title: 'VECTOR_INDEX_BARRIER',
    subtitle: 'LanceDB Disk ANN / room-vec',
    detail:
      'Routes high-dimensional embedding lookups to LanceDB zero-copy disk ANN search or sqlite-vec via room-vec on Android (.aar) and iOS (.xcframework).',
  },
  {
    id: 'MEMORY_MTU_BARRIER',
    title: 'MEMORY_MTU_BARRIER',
    subtitle: '1,232 B Frame · >10k DuckDB Offload',
    detail:
      'Monitors analytical row counts and offloads scans exceeding 10,000 rows to DuckDB columnar OLAP while enforcing 1,232 B network MTU framing caps.',
  },
  {
    id: 'SQLITE_BUSY_BARRIER',
    title: 'SQLITE_BUSY_BARRIER',
    subtitle: 'Lock Contention Disk Fallback',
    detail:
      'Catches SQLite WAL write-lock contention and falls back deterministically to immutable SHA-256 audit ledger records on disk.',
  },
] as const;

export const SOVEREIGN_MONOREPO_TREE = `liquid-os/
├── apps/
│   └── lovable-client/                  # Signal Console HUD & Frontend Builder
│       ├── src/
│       │   ├── components/SignalConsoleHUD.tsx
│       │   ├── pages/Builder.tsx
│       │   ├── lib/vault.ts
│       │   └── test/vault.test.ts
├── supabase/
│   └── functions/
│       └── vault-proxy/
│           ├── index.ts                 # Deno Edge Function proxy
│           └── sql-guard.ts             # Rule S4 AST SQL allowlist parser
├── crates/
│   └── liquid-kernel/                   # Local Rust Core Engine (#[repr(align(64))] SPSC)
│       └── src/
│           ├── main.rs                  # Loopback IPC server (127.0.0.1:17373)
│           ├── security.rs              # Linux SO_PEERCRED socket authentication
│           ├── audit.rs                 # SHA-256 hash-chained audit ledger
│           └── router.rs                # Pi Pipeline Hook Router
├── packages/
│   └── flutter_client/                  # Mobile Flutter Ingress Bridge
│       ├── lib/ingress_bridge.dart
│       └── test/ingress_bridge_test.dart
├── scripts/
│   └── aegis/
│       └── run_all_tests.py             # 34-Step Master Test Forge suite
└── .env.example`;

export const FLUTTER_INGRESS_BRIDGE_DART = `// packages/flutter_client/lib/ingress_bridge.dart
import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

enum VaultExecutionState { prepared, signed, read, confirmed, failed }

class VaultResponse {
  final dynamic data;
  final bool isError;
  final String? error;
  final String? plane;
  final int? latencyMs;

  VaultResponse({
    this.data,
    required this.isError,
    this.error,
    this.plane,
    this.latencyMs,
  });

  factory VaultResponse.fromJson(Map<String, dynamic> json) {
    return VaultResponse(
      data: json['content'],
      isError: json['isError'] ?? false,
      error: json['error'],
      plane: json['meta']?['plane'],
      latencyMs: json['meta']?['latency_ms'],
    );
  }
}

class FlutterIngressBridge {
  final String endpoint;
  final String authToken;
  WebSocketChannel? _channel;

  FlutterIngressBridge({
    this.endpoint = 'ws://127.0.0.1:17373',
    required this.authToken,
  });

  Future<VaultResponse> dispatchTool({
    required String action,
    Map<String, dynamic>? params,
    void Function(VaultExecutionState state)? onState,
  }) async {
    final completer = Completer<VaultResponse>();
    onState?.call(VaultExecutionState.prepared);

    try {
      _channel = WebSocketChannel.connect(
        Uri.parse(endpoint),
        protocols: ['Bearer', authToken],
      );

      onState?.call(VaultExecutionState.signed);

      final payload = jsonEncode({
        'action': action,
        'params': params ?? {},
        'client': 'Flutter-CrossPlatform',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });

      _channel!.sink.add(payload);
      onState?.call(VaultExecutionState.read);

      _channel!.stream.listen(
        (message) {
          final Map<String, dynamic> responseJson = jsonDecode(message);
          final response = VaultResponse.fromJson(responseJson);
          onState?.call(
            response.isError ? VaultExecutionState.failed : VaultExecutionState.confirmed,
          );
          if (!completer.isCompleted) completer.complete(response);
        },
        onError: (error) {
          onState?.call(VaultExecutionState.failed);
          if (!completer.isCompleted) {
            completer.complete(VaultResponse(isError: true, error: 'Connection Fault: $error'));
          }
        },
      );
    } catch (e) {
      onState?.call(VaultExecutionState.failed);
      completer.complete(VaultResponse(isError: true, error: 'Daemon Unreachable: $e'));
    }

    return completer.future;
  }

  void dispose() {
    _channel?.sink.close();
  }
}`;

export function dispatchSubstrateToolLocal(
  toolName: string,
  params: Record<string, unknown> = {},
  options: { clientToken?: string; expectedToken?: string } = {}
): {
  content: unknown;
  isError: boolean;
  error?: string;
  finalState: SignalExecutionState;
  transitions: SignalExecutionState[];
  meta: {
    plane: SubstratePlane;
    latency_ms: number;
    handle: string;
    barriers_passed: string[];
  };
} {
  const spec = MCP_22_TOOL_CATALOG.find((t) => t.name === toolName);
  const transitions: SignalExecutionState[] = ['PREPARED'];

  if (!spec) {
    return {
      content: null,
      isError: true,
      error: `UNKNOWN_MCP_TOOL: '${toolName}' is not registered in the 22-Tool MCP Catalog.`,
      finalState: 'FAILED',
      transitions: ['PREPARED', 'FAILED'],
      meta: {
        plane: 'Vault Query',
        latency_ms: 1,
        handle: 'LOS-CAP-REG-001',
        barriers_passed: [],
      },
    };
  }

  if (options.expectedToken !== undefined) {
    const ok = verifyIngressToken(options.clientToken || '', options.expectedToken);
    if (!ok) {
      return {
        content: null,
        isError: true,
        error: 'AUTH_FAULT: Constant-time Bearer verification rejected on 127.0.0.1:17373.',
        finalState: 'FAILED',
        transitions: ['PREPARED', 'FAILED'],
        meta: {
          plane: spec.plane,
          latency_ms: 2,
          handle: spec.targetHandle,
          barriers_passed: [],
        },
      };
    }
  }

  transitions.push('SIGNED', 'READ');

  if (toolName === 'vault_sql') {
    const sql = typeof params.sql === 'string' ? params.sql : '';
    const guard = validateSqlRuleS4(sql);
    if (!guard.allowed) {
      return {
        content: null,
        isError: true,
        error: guard.reason,
        finalState: 'FAILED',
        transitions: [...transitions, 'FAILED'],
        meta: {
          plane: spec.plane,
          latency_ms: 3,
          handle: spec.targetHandle,
          barriers_passed: [],
        },
      };
    }

    transitions.push('CONFIRMED');
    return {
      content: {
        columns: ['id', 'domain', 'captured_at', 'engine'],
        rows: [
          [104, 'developers.cloudflare.com', '2026-11-14T15:40:12Z', 'SQLite dbRO'],
          [103, 'modelcontextprotocol.io', '2026-11-14T15:31:08Z', 'SQLite dbRO'],
          [102, 'sqlite.org/fts5.html', '2026-11-14T15:19:44Z', 'DuckDB >10k'],
        ],
        astPrefix: guard.normalizedPrefix,
      },
      isError: false,
      finalState: 'CONFIRMED',
      transitions,
      meta: {
        plane: spec.plane,
        latency_ms: 6,
        handle: spec.targetHandle,
        barriers_passed: spec.barriers,
      },
    };
  }

  const simulatedPayloads: Record<string, unknown> = {
    snapshot_capture: { page_id: 105, snapshot_id: 'snp_88a41f', deduped: false, canonical_url: params.url || 'https://docs.cloudflare.com/d1/' },
    snapshot_dedupe: { seen: false, page_id: null },
    snapshot_list: { snapshots: [{ page_id: 104, domain: 'cloudflare.com' }, { page_id: 103, domain: 'modelcontextprotocol.io' }], total: 2 },
    vault_search: { hits: [{ page_id: 104, title: 'SO_PEERCRED & Rule S4 Spec', url: 'local://vault/104', snippet: '...SO_PEERCRED UID 1000...', rank: 0.98 }], total: 1 },
    vault_get_page: { page: { page_id: params.page_id ?? 42, title: 'Sovereign Substrate', url: 'local://vault/42' } },
    vault_schema: { tables: [{ name: 'pages', sql: 'CREATE TABLE pages(id INTEGER PRIMARY KEY, url TEXT, domain TEXT)' }], fts_tables: ['pages_fts_trigram'] },
    vault_stats: { global: { pages: 1420, chunks: 18420, db_size_mb: 44.2 }, groups: [{ domain: 'cloudflare.com', count: 312 }] },
    proxy_rotate: { active_proxy: { endpoint: 'socks5://127.0.0.1:49210', protocol: 'socks5' }, handle_url: 'http://127.0.0.1:17373/egress' },
    proxy_hop: { old_port: 49210, new_port: 51842, handle_url: 'http://127.0.0.1:51842' },
    proxy_health: { healthy: true, latency_ms: 18, exit_ip: '198.51.100.42' },
    proxy_egress: { status: 200, headers: { 'content-type': 'text/plain' }, body: 'Design for failure.', via: { protocol: 'adrift-webrtc', mtu: 1232 } },
    proxy_pool_list: { pools: [{ pool_id: 'pool_us_west', label: 'edge-adrift-us-west', healthy: true }] },
    proxy_pool_add: { pool_id: 'pool_custom_02', label: params.label || 'edge-adrift-us-west' },
    agent_spawn: { thread_id: 'thr_liquid_01', backend: 'litert-lm', model: params.model || 'gemma-4-e2b-it', worktree_path: '/tmp/wt/feat-substrate-audit' },
    agent_send: { turn_id: 'turn_02_s4', stream_url: '/api/agent/stream/turn_02_s4', status: 'STREAMING' },
    agent_await_approval: { approved: true, approval_id: params.approval_id || 'apr_9481', reason: 'Verified via LOS-CAP-REG-001' },
    agent_cancel: { cancelled: true, thread_id: params.thread_id || 'thr_liquid_01' },
    agent_list_threads: { threads: [{ thread_id: 'thr_liquid_01', status: 'active', model: 'gemma-4-e2b-it' }] },
    agent_route_explain: { model: 'gemma-4-e2b-it', reasoning_effort: 'high', receipt: 'route:litert-lm|cache:Q8_0|ram:2.1GB' },
    vault_agent_search: { thread_id: params.thread_id || 'thr_liquid_01', injected_hits: 4, status: 'CONTEXT_INJECTED' },
    egress_and_capture: { page_id: 106, status_code: 200, bytes_saved: 14820 },
  };

  transitions.push('CONFIRMED');
  return {
    content: simulatedPayloads[toolName] ?? { ok: true },
    isError: false,
    finalState: 'CONFIRMED',
    transitions,
    meta: {
      plane: spec.plane,
      latency_ms: 4 + (toolName.length % 7),
      handle: spec.targetHandle,
      barriers_passed: spec.barriers,
    },
  };
}
