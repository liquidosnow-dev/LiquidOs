import React, { useState, useEffect } from 'react';
import {
  Shield,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Network,
  Box,
  Sparkles,
  Play,
  Copy,
  Check,
  Terminal,
  Lock,
  Smartphone,
  GitBranch,
  ArrowRight,
  FolderTree,
  Plug,
  HardDrive,
  Workflow,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import type { AuditLedgerEntry, Project } from '../types';
import type { ControlPlaneState } from '../utils/ingestionControlPlane';
import { recordControlPlaneAudit } from '../utils/ingestionControlPlane';
import {
  HARDWARE_MODULE_CHOICES,
  createInitialLiquidChromeOsDb,
  queryLiquidChromeOsDb,
  buildLocalAppBindingRecord,
} from '../utils/liquidChromeOs';
import type {
  CodexFlowWorkflowSpec,
  LiquidChromeOsDatabaseState,
  OsAppBindingRecord,
  OsBuildProfileId,
  OsDbSqlQueryResult,
  OsHardwareSelection,
  OsKnowledgeCatalogEntry,
} from '../utils/liquidChromeOs';
import {
  validateSqlRuleS4,
  verifyIngressToken,
  MCP_22_TOOL_CATALOG,
  SOVEREIGN_BARRIERS,
  SOVEREIGN_MONOREPO_TREE,
  FLUTTER_INGRESS_BRIDGE_DART,
  dispatchSubstrateToolLocal,
  SubstratePlane,
  SignalExecutionState,
  McpToolSpec,
  SubstrateLedgerEntry,
} from '../utils/sovereignSubstrate';

interface ArchitectureViewProps {
  project?: Project;
  controlPlaneState?: ControlPlaneState;
  ensureControlPlaneSession?: () => Promise<string | null>;
  buildControlPlaneHeaders?: () => Record<string, string>;
  onOsAuditEvent?: (entry: AuditLedgerEntry) => void;
  onOpenIngressShield?: () => void;
  onOpenManifest?: () => void;
  onOpenEnterpriseMcp?: () => void;
  onOpenKineticMonolith?: () => void;
}

type ArchSubTab = 'os_wire' | 'planes' | 'sql_guard' | 'mcp_hud' | 'monorepo';

const SQL_PRESETS = [
  {
    label: 'Valid SELECT',
    sql: "SELECT id, domain, captured_at FROM pages WHERE domain = 'cloudflare.com' ORDER BY id DESC LIMIT 10",
  },
  {
    label: 'Valid WITH CTE',
    sql: 'WITH recent AS (SELECT id, domain FROM pages LIMIT 20) SELECT * FROM recent',
  },
  {
    label: 'Stacked ; DROP',
    sql: 'SELECT id FROM pages; DROP TABLE pages;',
  },
  {
    label: 'Comment -- UPDATE',
    sql: '/* harmless lookup */ UPDATE pages SET url = \'https://evil.test\' WHERE id = 1',
  },
  {
    label: 'Exfil INTO OUTFILE',
    sql: "SELECT * FROM pages INTO OUTFILE '/tmp/vault_dump.csv'",
  },
];

const SIGNAL_STEPS: SignalExecutionState[] = ['PREPARED', 'SIGNED', 'READ', 'CONFIRMED'];

const OS_DB_SQL_PRESETS = [
  { label: 'Layers (10)', sql: 'SELECT * FROM os_layers LIMIT 10' },
  { label: 'Profiles (5)', sql: 'SELECT * FROM os_build_profiles LIMIT 10' },
  { label: 'Manifest Repos', sql: 'SELECT * FROM os_manifest_repos LIMIT 25' },
  { label: 'Copy/Link Maps', sql: 'SELECT * FROM os_manifest_mappings LIMIT 10' },
  { label: 'CodexFlow (25)', sql: 'SELECT * FROM os_codexflow_workflows LIMIT 25' },
  { label: 'Knowledge/Skills', sql: 'SELECT * FROM os_knowledge_catalog LIMIT 30' },
  { label: 'App Bindings', sql: 'SELECT * FROM os_app_bindings LIMIT 10' },
  { label: 'HW Config', sql: 'SELECT * FROM os_hardware_config LIMIT 5' },
  { label: 'Block ; DROP', sql: 'SELECT * FROM os_layers; DROP TABLE os_layers;' },
];

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  project,
  controlPlaneState,
  ensureControlPlaneSession,
  buildControlPlaneHeaders,
  onOsAuditEvent,
  onOpenIngressShield,
  onOpenManifest,
  onOpenEnterpriseMcp,
  onOpenKineticMonolith,
}) => {
  const [subTab, setSubTab] = useState<ArchSubTab>('os_wire');
  const [selectedDiagram, setSelectedDiagram] = useState<
    'pipeline_infographic' | 'liquid_os_kmp' | 'apollo_settings' | 'agents_toolkit' | 'lovable_ide'
  >('pipeline_infographic');
  const [activeBarrier, setActiveBarrier] = useState<string>('SECURITY_BARRIER');

  // Liquid Chrome OS Plug & Play Database State
  const [localOsDb, setLocalOsDb] = useState<LiquidChromeOsDatabaseState>(() =>
    createInitialLiquidChromeOsDb()
  );
  const [osDbDigest, setOsDbDigest] = useState<string>('');
  const [osSqlInput, setOsSqlInput] = useState<string>(OS_DB_SQL_PRESETS[0].sql);
  const [osSqlResult, setOsSqlResult] = useState<OsDbSqlQueryResult>(() =>
    queryLiquidChromeOsDb(createInitialLiquidChromeOsDb(), OS_DB_SQL_PRESETS[0].sql)
  );
  const [isWiringOs, setIsWiringOs] = useState<boolean>(false);
  const [isSwappingHw, setIsSwappingHw] = useState<boolean>(false);
  const [workflowFilter, setWorkflowFilter] = useState<'ALL' | CodexFlowWorkflowSpec['category']>('ALL');
  const [runningWorkflowSlug, setRunningWorkflowSlug] = useState<string | null>(null);
  const [workflowRunResult, setWorkflowRunResult] = useState<{
    ok: boolean;
    slug: string;
    message: string;
    phases?: Array<{ phase: string; status: string; rule?: string; receiptId?: string; keyId?: string }>;
  } | null>(null);
  const [wireStatusNotice, setWireStatusNotice] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Rule S4 SQL Guard & Constant-Time Token Verification State
  const [sqlInput, setSqlInput] = useState<string>(SQL_PRESETS[0].sql);
  const [clientToken, setClientToken] = useState<string>('los_127_0_0_1_17373_bearer');
  const [expectedToken, setExpectedToken] = useState<string>('los_127_0_0_1_17373_bearer');
  const [sqlEvalResult, setSqlEvalResult] = useState(() => validateSqlRuleS4(SQL_PRESETS[0].sql));
  const tokenMatch = verifyIngressToken(clientToken, expectedToken);
  const [ledgerEntries, setLedgerEntries] = useState<SubstrateLedgerEntry[]>([]);
  const [ledgerValid, setLedgerValid] = useState<boolean>(true);

  // 22-Tool MCP Catalog & 491px Signal Console HUD State
  const [planeFilter, setPlaneFilter] = useState<'ALL' | SubstratePlane>('ALL');
  const [selectedTool, setSelectedTool] = useState<McpToolSpec>(
    MCP_22_TOOL_CATALOG.find((t) => t.name === 'vault_sql') || MCP_22_TOOL_CATALOG[0]
  );
  const [hudParamsText, setHudParamsText] = useState<string>(
    JSON.stringify(
      (MCP_22_TOOL_CATALOG.find((t) => t.name === 'vault_sql') || MCP_22_TOOL_CATALOG[0])
        .sampleParams,
      null,
      2
    )
  );
  const [hudState, setHudState] = useState<SignalExecutionState>('CONFIRMED');
  const [hudResponse, setHudResponse] = useState<string>(
    JSON.stringify(
      dispatchSubstrateToolLocal('vault_sql', {
        sql: 'SELECT id, domain, captured_at FROM pages ORDER BY id DESC LIMIT 5',
      }),
      null,
      2
    )
  );
  const [isDispatchingHud, setIsDispatchingHud] = useState(false);
  const [copiedBridge, setCopiedBridge] = useState(false);

  const refreshOsState = async () => {
    try {
      const r = await fetch('/api/os/state');
      if (!r.ok) return;
      const data = await r.json();
      if (data && Array.isArray(data.layers)) {
        setLocalOsDb((prev) => ({
          ...prev,
          specVersion: data.specVersion || prev.specVersion,
          manifestTotalRepos: data.manifestTotalRepos || prev.manifestTotalRepos,
          activeBuildProfile: data.activeBuildProfile || prev.activeBuildProfile,
          hardwareSelection: data.hardwareSelection || prev.hardwareSelection,
          layers: data.layers,
          buildProfiles: data.buildProfiles || prev.buildProfiles,
          manifestMappings: data.manifestMappings || prev.manifestMappings,
          manifestRepos: data.manifestRepos || prev.manifestRepos,
          workflows: data.workflows || prev.workflows,
          knowledgeCatalog: data.knowledgeCatalog || prev.knowledgeCatalog,
          appBindings: Array.isArray(data.appBindings) ? data.appBindings : prev.appBindings,
          updatedAt: data.updatedAt || Date.now(),
        }));
        if (data.dbDigest) setOsDbDigest(data.dbDigest);
      }
    } catch {
      // Offline fallback uses localOsDb
    }
  };

  useEffect(() => {
    fetch('/api/substrate/ledger')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.entries)) setLedgerEntries(data.entries);
        if (data?.integrity) setLedgerValid(Boolean(data.integrity.valid));
      })
      .catch(() => {});
    refreshOsState();
  }, []);

  const resolveAuthHeaders = async (): Promise<Record<string, string>> => {
    if (ensureControlPlaneSession) {
      await ensureControlPlaneSession();
    } else {
      await fetch('/api/control-plane/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'human:mercy' }),
      }).catch(() => {});
    }
    if (buildControlPlaneHeaders) {
      return buildControlPlaneHeaders();
    }
    return {
      'Content-Type': 'application/json',
      'X-Workspace-Id': 'ws_unified_one',
      'X-Request-Nonce': `n_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    };
  };

  const handleRunOsSqlQuery = async (overrideSql?: string) => {
    const query = overrideSql !== undefined ? overrideSql : osSqlInput;
    if (overrideSql !== undefined) setOsSqlInput(overrideSql);
    try {
      const res = await fetch('/api/os/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: query }),
      });
      const data = await res.json();
      setOsSqlResult({
        allowed: Boolean(data.allowed),
        table: data.table || 'unknown',
        sql: query,
        astGuard: data.astGuard || validateSqlRuleS4(query),
        columns: Array.isArray(data.columns) ? data.columns : [],
        rows: Array.isArray(data.rows) ? data.rows : [],
        rowCount: Number(data.rowCount || 0),
        payloadDigest: data.payloadDigest || '',
        executedAt: data.executedAt || Date.now(),
        reason: data.reason,
      });
      if (data.ledgerEntry) {
        setLedgerEntries((prev) => [data.ledgerEntry, ...prev].slice(0, 15));
      }
    } catch {
      setOsSqlResult(queryLiquidChromeOsDb(localOsDb, query));
    }
  };

  const handleWireAppToOs = async (overrideProfile?: OsBuildProfileId) => {
    setIsWiringOs(true);
    setWireStatusNotice(null);
    const targetProject = project || {
      id: 'proj_liquid_one',
      name: 'LiquidOS Mercury Vault',
      files: [],
    };
    const nextProfile = overrideProfile || localOsDb.activeBuildProfile;
    try {
      const headers = await resolveAuthHeaders();
      const permit = controlPlaneState?.activePermit;
      const res = await fetch('/api/os/wire', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          permitId: permit?.permitId || null,
          projectId: targetProject.id,
          projectName: targetProject.name,
          files: targetProject.files,
          buildProfile: nextProfile,
          hardwareSelection: localOsDb.hardwareSelection,
          expectedEpoch: controlPlaneState?.epoch,
          expectedFencingVersion: permit?.fencingVersion,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.snapshot) {
          setLocalOsDb((prev) => ({
            ...prev,
            activeBuildProfile: data.snapshot.activeBuildProfile || nextProfile,
            hardwareSelection: data.snapshot.hardwareSelection || prev.hardwareSelection,
            appBindings: data.snapshot.appBindings || prev.appBindings,
            updatedAt: data.snapshot.updatedAt || Date.now(),
          }));
        }
        if (data.dbDigest) setOsDbDigest(data.dbDigest);
        setWireStatusNotice({
          ok: true,
          message: `Wired ${targetProject.name} (${targetProject.files.length} files -> ${nextProfile}) · Ed25519 Receipt ${data.receipt?.receiptId}`,
        });
        if (onOsAuditEvent && data.receipt) {
          const fakeLedger = recordControlPlaneAudit(
            [],
            'os_database_wired',
            data.binding?.bindingId || targetProject.id,
            'human:mercy',
            {
              profile: nextProfile,
              boundFiles: targetProject.files.length,
              receiptId: data.receipt.receiptId,
              keyId: data.receipt.keyId,
            }
          );
          if (fakeLedger[0]) onOsAuditEvent(fakeLedger[0]);
        }
        await handleRunOsSqlQuery('SELECT * FROM os_app_bindings LIMIT 10');
      } else {
        setWireStatusNotice({
          ok: false,
          message: data?.error || `Control Plane denied OS DB wire (HTTP ${res.status}).`,
        });
      }
    } catch {
      const localBind = buildLocalAppBindingRecord({
        db: localOsDb,
        projectId: targetProject.id,
        projectName: targetProject.name,
        files: targetProject.files,
        buildProfile: nextProfile,
      });
      setLocalOsDb(localBind.nextDb);
      setWireStatusNotice({
        ok: true,
        message: `Local preview bound ${targetProject.name} (${localBind.binding.bindingId})`,
      });
    } finally {
      setIsWiringOs(false);
    }
  };

  const handleSwapHardware = async (patch: Partial<OsHardwareSelection>) => {
    const nextHw = { ...localOsDb.hardwareSelection, ...patch };
    setLocalOsDb((prev) => ({ ...prev, hardwareSelection: nextHw }));
    setIsSwappingHw(true);
    try {
      const headers = await resolveAuthHeaders();
      const permit = controlPlaneState?.activePermit;
      const res = await fetch('/api/os/hardware', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          permitId: permit?.permitId || null,
          hardwareSelection: nextHw,
          buildProfile: localOsDb.activeBuildProfile,
          expectedEpoch: controlPlaneState?.epoch,
          expectedFencingVersion: permit?.fencingVersion,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.dbDigest) setOsDbDigest(data.dbDigest);
        setWireStatusNotice({
          ok: true,
          message: `Hardware matrix attested (${nextHw.securityChip}/${nextHw.ecFirmware}/${nextHw.bootloader}) · Receipt ${data.receipt?.receiptId}`,
        });
      } else if (data?.error) {
        setWireStatusNotice({ ok: false, message: data.error });
      }
    } catch {
      // Local optimistic update remains visible
    } finally {
      setIsSwappingHw(false);
    }
  };

  const handleRunCodexWorkflow = async (wf: CodexFlowWorkflowSpec) => {
    setRunningWorkflowSlug(wf.slug);
    try {
      const headers = await resolveAuthHeaders();
      const permit = controlPlaneState?.activePermit;
      const res = await fetch('/api/os/workflow/run', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          permitId: permit?.permitId || null,
          workflowSlugOrId: wf.slug,
          targetProjectId: project?.id,
          expectedEpoch: controlPlaneState?.epoch,
          expectedFencingVersion: permit?.fencingVersion,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setWorkflowRunResult({
          ok: true,
          slug: wf.slug,
          message: `CodexFlow #${wf.id} (${wf.slug}) attested via Ed25519 receipt ${data.receipt?.receiptId}`,
          phases: data.phases,
        });
      } else {
        setWorkflowRunResult({
          ok: false,
          slug: wf.slug,
          message: data?.error || `Workflow blocked at Policy First (${wf.policyRule}).`,
        });
      }
    } catch {
      setWorkflowRunResult({
        ok: false,
        slug: wf.slug,
        message: 'Server unreachable for CodexFlow workflow attestation.',
      });
    } finally {
      setRunningWorkflowSlug(null);
    }
  };

  const handleEvaluateRuleS4 = async (overrideSql?: string) => {
    const query = overrideSql !== undefined ? overrideSql : sqlInput;
    if (overrideSql !== undefined) setSqlInput(overrideSql);

    try {
      const res = await fetch('/api/substrate/sql-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: query, clientToken, expectedToken }),
      });
      const data = await res.json();
      setSqlEvalResult({
        allowed: Boolean(data.allowed),
        reason: data.reason,
        normalizedPrefix: data.normalizedPrefix,
        strippedCommentsCount: data.strippedCommentsCount,
      });
      if (data.ledgerEntry) {
        setLedgerEntries((prev) => [data.ledgerEntry, ...prev].slice(0, 15));
      }
      if (data.ledgerIntegrity) {
        setLedgerValid(Boolean(data.ledgerIntegrity.valid));
      }
    } catch {
      setSqlEvalResult(validateSqlRuleS4(query));
    }
  };

  const handleSelectMcpTool = (tool: McpToolSpec) => {
    setSelectedTool(tool);
    setHudParamsText(JSON.stringify(tool.sampleParams, null, 2));
  };

  const handleDispatchHudTool = async () => {
    setIsDispatchingHud(true);
    setHudState('PREPARED');

    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(hudParamsText || '{}');
    } catch {
      setHudState('FAILED');
      setHudResponse(JSON.stringify({ isError: true, error: 'Invalid JSON parameters' }, null, 2));
      setIsDispatchingHud(false);
      return;
    }

    setTimeout(() => setHudState('SIGNED'), 80);
    setTimeout(() => setHudState('READ'), 160);

    try {
      const res = await fetch('/api/substrate/mcp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: selectedTool.name,
          params: parsedParams,
          clientToken,
          expectedToken,
        }),
      });
      const data = await res.json();
      setTimeout(() => {
        setHudState(data.finalState || (data.isError ? 'FAILED' : 'CONFIRMED'));
        setHudResponse(
          JSON.stringify(
            {
              content: data.content,
              isError: data.isError,
              error: data.error,
              meta: data.meta,
              ledgerSeq: data.ledgerEntry?.sequenceId,
            },
            null,
            2
          )
        );
        if (data.ledgerEntry) {
          setLedgerEntries((prev) => [data.ledgerEntry, ...prev].slice(0, 15));
        }
        setIsDispatchingHud(false);
      }, 220);
    } catch {
      const localRes = dispatchSubstrateToolLocal(selectedTool.name, parsedParams, {
        clientToken,
        expectedToken,
      });
      setHudState(localRes.finalState);
      setHudResponse(JSON.stringify(localRes, null, 2));
      setIsDispatchingHud(false);
    }
  };

  const diagrams = [
    {
      id: 'pipeline_infographic',
      title: 'Pi Pipeline Hook Router & Sandbox Architecture',
      subtitle: 'Ingress, Hardware MTU Barriers, Direct Fallback Paths & State Transitions',
      assetPath: '/assets/aistudio/Pipeline_Hook_Router_Sandbox_Architecture_b8f41492.png',
      badge: 'KEY ARCHITECTURE',
    },
    {
      id: 'liquid_os_kmp',
      title: 'Liquid OS Full System Diagram',
      subtitle: 'Pi Hook Router, Mercury Vault, Mobile KMP Core & Kernel Substrate',
      assetPath: '/assets/aistudio/IMG_0031_9de50447.jpeg',
      badge: 'KERNEL & STORAGE',
    },
    {
      id: 'agents_toolkit',
      title: "The Agent's Toolkit Patterns",
      subtitle: 'Tool-Calling, ReAct Loop, RAG, MCP Protocol, Multi-Agent & Computer Use',
      assetPath: '/assets/aistudio/IMG_0018_21016a14.png',
      badge: 'AGENT ENGINE',
    },
    {
      id: 'apollo_settings',
      title: 'Apollo Model Hyperparameters',
      subtitle: 'Temperature, Top P, Seed, Max Output, Min P & Repetition Penalty',
      assetPath: '/assets/aistudio/IMG_0010_22388209.png',
      badge: 'INFERENCE PARAMS',
    },
    {
      id: 'lovable_ide',
      title: 'Lovable LiquidOS Split-Screen IDE',
      subtitle: 'Builder preferences, Chat Stream & Live Responsive Preview',
      assetPath: '/assets/aistudio/IMG_0032_ecfc52d0.png',
      badge: 'WORKSPACE IDE',
    },
  ];

  const currentDiagram = diagrams.find((d) => d.id === selectedDiagram) || diagrams[0];

  const filteredTools =
    planeFilter === 'ALL'
      ? MCP_22_TOOL_CATALOG
      : MCP_22_TOOL_CATALOG.filter((t) => t.plane === planeFilter);

  return (
    <div className="@container flex flex-col h-full w-full bg-transparent text-slate-100 overflow-y-auto p-4 @[640px]:p-6 space-y-5 font-sans">
      {/* Master Sovereign Substrate Header */}
      <div className="p-4 @[640px]:p-5 rounded-2xl glass-surface-2 space-y-4">
        <div className="flex flex-col @[900px]:flex-row @[900px]:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-mono text-cyan-300 flex items-center gap-2 flex-wrap">
              <span>Sovereign Substrate Master Specification</span>
              <span className="text-slate-500">·</span>
              <span>50 Sources</span>
              <span className="text-slate-500">·</span>
              <span>SO_PEERCRED UID 1000</span>
              <span className="text-slate-500">·</span>
              <span>127.0.0.1:17373</span>
            </div>
            <h2 className="text-lg @[640px]:text-xl font-bold tracking-tight text-white mt-1.5 leading-snug">
              Liquid OS · 5-Plane Pi Pipeline, Rule S4 Guard &amp; 22-Tool MCP Substrate
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
              Deterministic local-first substrate decoupling interface surfaces from hardware storage via kernel SO_PEERCRED identity checks, 64-byte SPSC cache alignment (#[repr(align(64))]), Rule S4 lexical AST SQL allowlisting, and 4 runtime barriers across SQLite dbRO, DuckDB OLAP, LanceDB, and SHA-256 audit ledgers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenIngressShield && (
              <button
                type="button"
                onClick={onOpenIngressShield}
                className="px-3 py-1.5 rounded-lg glass-surface-1 hover:border-rose-400/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Ingress 39 Shield</span>
              </button>
            )}
            {onOpenManifest && (
              <button
                type="button"
                onClick={onOpenManifest}
                className="px-3 py-1.5 rounded-lg glass-surface-1 hover:border-violet-400/50 text-violet-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Manifest v1.1</span>
              </button>
            )}
            {onOpenEnterpriseMcp && (
              <button
                type="button"
                onClick={onOpenEnterpriseMcp}
                className="px-3 py-1.5 rounded-lg glass-surface-1 hover:border-amber-400/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Enterprise &amp; MCP</span>
              </button>
            )}
            {onOpenKineticMonolith && (
              <button
                type="button"
                onClick={onOpenKineticMonolith}
                className="px-3 py-1.5 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Box className="w-3.5 h-3.5" />
                <span>Kinetic Monolith</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Substrate Navigation Tabs */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-white/10 overflow-x-auto scrollbar-none">
          {[
            { id: 'os_wire', label: 'Plug & Play OS DB (297 Repos)', icon: Plug },
            { id: 'planes', label: '5-Plane Substrate & Barriers', icon: Cpu },
            { id: 'sql_guard', label: 'Rule S4 AST Guard & Crypto Gate', icon: Lock },
            { id: 'mcp_hud', label: '22-Tool MCP & 491px Signal HUD', icon: Terminal },
            { id: 'monorepo', label: 'Monorepo & KMP/Flutter Bridge', icon: FolderTree },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as ArchSubTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'glass-surface-3 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 0: Plug & Play App <-> Liquid Chrome OS Database Wire-In */}
      {subTab === 'os_wire' && (
        <div className="space-y-4">
          {/* App-to-OS Plug & Play Wire Status + Profile Selector */}
          <div className="p-5 rounded-2xl glass-surface-2 space-y-4">
            <div className="flex flex-col @[840px]:flex-row @[840px]:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[11px] font-mono text-cyan-300 flex items-center gap-2 flex-wrap">
                  <span>LIQUID CHROME OS · CRUX MANIFEST (297 REPOS) + AN_NEXUS</span>
                  <span className="text-slate-500">·</span>
                  <span>MODE: {controlPlaneState?.mode || 'ACTIVE'}</span>
                  {osDbDigest && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span>DB DIGEST: {osDbDigest.slice(0, 14)}…</span>
                    </>
                  )}
                </div>
                <h3 className="text-base font-bold text-white">
                  Plug &amp; Play App ↔ OS Database Wire-In
                </h3>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Binds your live workspace files ({project?.name || 'LiquidOS Mercury Vault'},{' '}
                  {project?.files.length || 0} files) into persistent OS database tables with Control Plane Ed25519 attestation, modular hardware matrix swaps, and Rule S4 SQL queryability.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => refreshOsState()}
                  className="px-3 py-2 rounded-lg glass-surface-1 hover:border-white/25 text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Sync Snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWireAppToOs()}
                  disabled={isWiringOs}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Plug className="w-3.5 h-3.5" />
                  <span>{isWiringOs ? 'Wiring App -> OS DB...' : 'Wire App → OS Database'}</span>
                </button>
              </div>
            </div>

            {wireStatusNotice && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  wireStatusNotice.ok
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                }`}
              >
                {wireStatusNotice.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="truncate">{wireStatusNotice.message}</span>
              </div>
            )}

            {/* 5 Chromium OS Build Profiles */}
            <div className="grid grid-cols-1 @[560px]:grid-cols-2 @[920px]:grid-cols-5 gap-2.5 pt-2 border-t border-white/10">
              {localOsDb.buildProfiles.map((prof) => {
                const isActive = localOsDb.activeBuildProfile === prof.id;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => handleWireAppToOs(prof.id)}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
                      isActive
                        ? 'glass-surface-3 border-cyan-400/50'
                        : 'glass-surface-1 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className={isActive ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                        {prof.id}
                      </span>
                      <span className="text-slate-300 tabular-nums">{prof.repoCount} repos</span>
                    </div>
                    <div className="text-xs font-semibold text-white mt-1 truncate">{prof.name}</div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{prof.workflowFocus}</p>
                  </button>
                );
              })}
            </div>

            {/* Active App Bindings Strip */}
            {localOsDb.appBindings.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="text-[11px] font-mono text-slate-400">
                  ACTIVE APP ↔ OS DATABASE BINDINGS ({localOsDb.appBindings.length})
                </div>
                <div className="grid grid-cols-1 @[760px]:grid-cols-2 gap-2">
                  {localOsDb.appBindings.slice(0, 4).map((b: OsAppBindingRecord) => (
                    <div
                      key={b.bindingId}
                      className="p-2.5 rounded-xl bg-black/35 border border-white/10 text-[11px] font-mono flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-cyan-300 font-semibold truncate">
                          {b.projectName} · profile={b.buildProfile}
                        </div>
                        <div className="text-slate-400 truncate">
                          files={b.boundFilesCount} · seq=#{b.linearizationSeq} · tree={b.treeDigest.slice(0, 12)}…
                        </div>
                      </div>
                      <span className="text-emerald-300 shrink-0">
                        {b.receiptId ? b.receiptId.slice(0, 14) : 'bound'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modular Hardware Selector + Rule S4 OS SQL Console */}
          <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4">
            {/* Left 5 cols: Modular Hardware Matrix */}
            <div className="@[920px]:col-span-5 p-5 rounded-2xl glass-surface-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-white">Modular OS Hardware Matrix</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {isSwappingHw ? 'Attesting...' : 'Hot-Swappable'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {(
                  [
                    { key: 'kernelGeneration', label: 'Kernel', options: HARDWARE_MODULE_CHOICES.kernelGeneration },
                    { key: 'toolchain', label: 'Toolchain', options: HARDWARE_MODULE_CHOICES.toolchain },
                    { key: 'architecture', label: 'Architecture', options: HARDWARE_MODULE_CHOICES.architecture },
                    { key: 'securityChip', label: 'Security Chip', options: HARDWARE_MODULE_CHOICES.securityChip },
                    { key: 'ecFirmware', label: 'EC Firmware', options: HARDWARE_MODULE_CHOICES.ecFirmware },
                    { key: 'bootloader', label: 'Bootloader', options: HARDWARE_MODULE_CHOICES.bootloader },
                    { key: 'hypervisor', label: 'Hypervisor', options: HARDWARE_MODULE_CHOICES.hypervisor },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="block space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{field.label}</span>
                    <select
                      value={localOsDb.hardwareSelection[field.key]}
                      onChange={(e) =>
                        handleSwapHardware({ [field.key]: e.target.value } as Partial<OsHardwareSelection>)
                      }
                      className="w-full rounded-lg bg-black/50 border border-white/10 px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Board Overlay</span>
                  <input
                    type="text"
                    value={localOsDb.hardwareSelection.boardOverlay}
                    onChange={(e) =>
                      setLocalOsDb((prev) => ({
                        ...prev,
                        hardwareSelection: { ...prev.hardwareSelection, boardOverlay: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg bg-black/50 border border-white/10 px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </label>
              </div>

              {/* Copyfile / Linkfile Mappings */}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="text-[10px] font-mono text-slate-400">
                  MANIFEST COPYFILE / LINKFILE MAPPINGS
                </div>
                {localOsDb.manifestMappings.map((m) => (
                  <div
                    key={m.targetPath}
                    className="p-2 rounded-lg bg-black/35 border border-white/10 text-[11px] font-mono"
                  >
                    <div className="flex items-center justify-between text-cyan-300">
                      <span>{m.sourcePath} → {m.targetPath}</span>
                      <span className="text-amber-300">{m.operation}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.purpose}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 7 cols: Rule S4 Live OS Database SQL Console */}
            <div className="@[920px]:col-span-7 p-5 rounded-2xl glass-surface-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-white">
                    OS Database Live SQL Console (/api/os/db/query · Rule S4)
                  </h3>
                </div>
                <span
                  className={`text-[11px] font-mono font-semibold ${
                    osSqlResult.allowed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {osSqlResult.allowed ? `${osSqlResult.rowCount} rows · ${osSqlResult.table}` : 'RULE S4 BLOCKED'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {OS_DB_SQL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleRunOsSqlQuery(p.sql)}
                    className="px-2 py-1 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-[11px] font-mono text-slate-200 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={osSqlInput}
                  onChange={(e) => setOsSqlInput(e.target.value)}
                  spellCheck={false}
                  className="flex-1 rounded-lg bg-black/50 border border-white/10 px-3 py-1.5 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => handleRunOsSqlQuery()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/90 hover:bg-cyan-400 text-xs font-semibold text-slate-950 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Query OS DB</span>
                </button>
              </div>

              {!osSqlResult.allowed ? (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs font-mono text-rose-200">
                  {osSqlResult.reason || 'Query rejected by Rule S4 AST Guard.'}
                </div>
              ) : (
                <div className="border border-white/10 rounded-xl overflow-auto max-h-64 bg-black/35">
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead className="bg-white/5 text-cyan-300 sticky top-0">
                      <tr>
                        {osSqlResult.columns.map((col) => (
                          <th key={col} className="px-2.5 py-2 border-b border-white/10 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {osSqlResult.rows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-slate-500" colSpan={Math.max(1, osSqlResult.columns.length)}>
                            No matching rows returned. Click "Wire App → OS Database" to populate os_app_bindings.
                          </td>
                        </tr>
                      ) : (
                        osSqlResult.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            {osSqlResult.columns.map((col) => (
                              <td key={col} className="px-2.5 py-1.5 max-w-[240px] truncate">
                                {String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {osSqlResult.payloadDigest && (
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  SHA-256 payloadDigest: {osSqlResult.payloadDigest}
                </div>
              )}
            </div>
          </div>

          {/* 10-Layer Execution Engine Matrix */}
          <div className="p-5 rounded-2xl glass-surface-2 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-300" />
                <h3 className="text-sm font-bold text-white">
                  10-Layer Agentic Execution Engine &amp; Operational Phases
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Layer 1 LoopForge → Layer 10 an_nexus
              </span>
            </div>
            <div className="grid grid-cols-1 @[560px]:grid-cols-2 @[920px]:grid-cols-5 gap-2.5">
              {localOsDb.layers.map((layer) => (
                <div key={layer.layerIndex} className="p-3 rounded-xl glass-surface-1 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300">
                    <span>LAYER {layer.layerIndex}</span>
                    <span className="text-slate-400 truncate max-w-[120px]">{layer.substratePath}</span>
                  </div>
                  <div className="text-xs font-bold text-white">{layer.layerName}</div>
                  <div className="text-[11px] font-mono text-emerald-300">{layer.primaryComponent}</div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{layer.responsibility}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CodexFlow 25-Workflow 3-Phase Pipeline + Knowledge Catalog */}
          <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4">
            <div className="@[920px]:col-span-7 p-5 rounded-2xl glass-surface-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-white">
                    CodexFlow 25-Workflow Attestation Pipeline (Policy First → Test Second → Attest Last)
                  </h3>
                </div>
                <select
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value as any)}
                  className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 text-[11px] font-mono text-slate-200"
                >
                  <option value="ALL">All Categories (25)</option>
                  <option value="Runtime & Governance">Runtime &amp; Governance</option>
                  <option value="Assurance & Evidence">Assurance &amp; Evidence</option>
                  <option value="Sovereign Memory & Vector">Sovereign Memory &amp; Vector</option>
                  <option value="Hardware & Interoperability">Hardware &amp; Interoperability</option>
                  <option value="Experience & Telemetry">Experience &amp; Telemetry</option>
                </select>
              </div>

              {workflowRunResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                    workflowRunResult.ok
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div>{workflowRunResult.message}</div>
                  {workflowRunResult.phases && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                      {workflowRunResult.phases.map((ph) => (
                        <div key={ph.phase} className="p-1.5 rounded bg-black/40 border border-white/10">
                          <div className="text-cyan-300 font-semibold">{ph.phase}</div>
                          <div className="text-emerald-300">{ph.status}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="divide-y divide-white/10 border border-white/10 rounded-xl max-h-72 overflow-y-auto bg-black/25">
                {localOsDb.workflows
                  .filter((w) => workflowFilter === 'ALL' || w.category === workflowFilter)
                  .map((wf) => (
                    <div
                      key={wf.id}
                      className="px-3 py-2 flex items-center justify-between gap-3 text-xs hover:bg-white/5"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-cyan-300 font-semibold truncate">
                          #{wf.id} {wf.slug}{' '}
                          <span className="text-slate-500 font-normal">· {wf.policyRule}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{wf.action}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRunCodexWorkflow(wf)}
                        disabled={runningWorkflowSlug === wf.slug}
                        className="px-2.5 py-1 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-[11px] font-mono text-cyan-200 shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {runningWorkflowSlug === wf.slug ? 'Running...' : 'Run 3-Phase'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Right 5 cols: Vetted Knowledge/Skills/Methodology Catalog */}
            <div className="@[920px]:col-span-5 p-5 rounded-2xl glass-surface-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-bold text-white">
                    Vetted OS Knowledge &amp; Skills Catalog ({localOsDb.knowledgeCatalog.length})
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-300">ALL VETTED</span>
              </div>

              <div className="divide-y divide-white/10 border border-white/10 rounded-xl max-h-80 overflow-y-auto bg-black/25">
                {localOsDb.knowledgeCatalog.map((item: OsKnowledgeCatalogEntry) => (
                  <div key={item.id} className="px-3 py-2 text-[11px] font-mono space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-cyan-300 font-semibold truncate">{item.path}</span>
                      <span className="text-slate-400 shrink-0">{item.category}</span>
                    </div>
                    <div className="text-slate-400 flex items-center justify-between text-[10px]">
                      <span>{item.bytes} bytes</span>
                      <span>sha256:{item.sha256.slice(0, 12)}…</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: 5-Plane Substrate, 4 Operational Barriers, & Visual Schematics */}
      {subTab === 'planes' && (
        <>
          {/* 5 Operational Planes */}
          <div className="grid grid-cols-1 @[560px]:grid-cols-2 @[920px]:grid-cols-5 gap-3">
            {[
              {
                num: '01',
                name: 'Ingestion Plane',
                desc: 'Raw page capture, Readability DOM extraction, visible text normalization, temporal deduplication.',
              },
              {
                num: '02',
                name: 'Vault Query Plane',
                desc: 'FTS5 trigram substring search, structural schema extraction, read-only SQL over dbRO.',
              },
              {
                num: '03',
                name: 'Egress Proxy Plane',
                desc: 'Round-robin proxy pool, WebRTC exit-node links via Adrift, ephemeral port hopping listen(0).',
              },
              {
                num: '04',
                name: 'Agent Plane',
                desc: 'Isolated Git worktrees, LiteRT-LM / cloud feedback loops, approval gating via LOS-CAP-REG-001.',
              },
              {
                num: '05',
                name: 'Composite Plane',
                desc: 'Cross-plane workflows fusing Vault ANN retrieval and egress capture into active agent threads.',
              },
            ].map((p) => (
              <div key={p.num} className="p-4 rounded-xl glass-surface-1 space-y-1.5">
                <div className="text-[11px] font-mono tabular-nums text-cyan-300">{p.num}</div>
                <div className="text-xs font-bold text-white">{p.name}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* 4 Hardware & Network Execution Barriers */}
          <div className="grid grid-cols-1 @[560px]:grid-cols-2 @[920px]:grid-cols-4 gap-3">
            {SOVEREIGN_BARRIERS.map((barrier) => {
              const isSelected = activeBarrier === barrier.id;
              return (
                <button
                  key={barrier.id}
                  type="button"
                  onClick={() => setActiveBarrier(barrier.id)}
                  className={`p-4 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected ? 'glass-surface-3' : 'glass-surface-1 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-cyan-300">
                    <span className="truncate font-semibold">{barrier.title}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-xs font-bold text-white mt-1.5">{barrier.subtitle}</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{barrier.detail}</p>
                </button>
              );
            })}
          </div>

          {/* Blueprint Diagram Viewer */}
          <div className="rounded-2xl glass-surface-2 overflow-hidden">
            <div className="p-4 glass-surface-1 border-x-0 border-t-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-cyan-300">{currentDiagram.badge}</span>
                  <span className="text-slate-500">·</span>
                  <h3 className="text-sm font-bold text-white">{currentDiagram.title}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{currentDiagram.subtitle}</p>
              </div>

              <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl border border-white/10">
                {diagrams.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDiagram(d.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      selectedDiagram === d.id
                        ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.title.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-black/30 flex items-center justify-center min-h-[340px] overflow-auto">
              <img
                src={currentDiagram.assetPath}
                alt={currentDiagram.title}
                referrerPolicy="no-referrer"
                className="max-h-[480px] w-auto object-contain rounded-xl border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Rule S4 Lexical AST SQL Guard & Sovereign Crypto Gate */}
      {subTab === 'sql_guard' && (
        <div className="grid grid-cols-1 @[880px]:grid-cols-12 gap-4">
          {/* Left: Live Rule S4 AST Tester + Constant-Time Token Gate */}
          <div className="@[880px]:col-span-7 p-5 rounded-2xl glass-surface-2 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Rule S4 Lexical AST SQL Guard (dbRO Handle)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Strips /* */ &amp; -- comments and literals, rejects chained semicolons, blocks mutation opcodes, allows SELECT / WITH only.
                </p>
              </div>
              <span
                className={`text-xs font-mono font-semibold flex items-center gap-1 shrink-0 ${
                  sqlEvalResult.allowed ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {sqlEvalResult.allowed ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>{sqlEvalResult.allowed ? 'ALLOWED' : 'BLOCKED'}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SQL_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleEvaluateRuleS4(preset.sql)}
                  className="px-2.5 py-1 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-xs font-mono text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <textarea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
            />

            {/* Constant-Time Bearer Verification (127.0.0.1:17373) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Client Bearer Token (127.0.0.1:17373)
                </label>
                <input
                  type="text"
                  value={clientToken}
                  onChange={(e) => setClientToken(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Expected Daemon Token (timingSafeEqual)
                </label>
                <input
                  type="text"
                  value={expectedToken}
                  onChange={(e) => setExpectedToken(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-400">
                Bearer Check:{' '}
                <span className={tokenMatch ? 'text-emerald-400' : 'text-rose-400'}>
                  {tokenMatch ? 'VERIFIED (timingSafeEqual)' : 'REJECTED (401)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleEvaluateRuleS4()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Evaluate Rule S4 &amp; Append Ledger</span>
              </button>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs font-mono ${
                sqlEvalResult.allowed
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
              }`}
            >
              {sqlEvalResult.allowed
                ? `PASS · Root opcode: ${sqlEvalResult.normalizedPrefix} · Comments stripped: ${sqlEvalResult.strippedCommentsCount ?? 0}`
                : sqlEvalResult.reason}
            </div>
          </div>

          {/* Right: Kernel Primitives & Live LOS-CAP-REG-001 Ledger */}
          <div className="@[880px]:col-span-5 p-5 rounded-2xl glass-surface-2 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                Kernel Identity &amp; LOS-CAP-REG-001 Hash Ledger
              </h3>
              <div className="text-[11px] font-mono text-slate-400 mt-1 space-y-1">
                <div>· UNIX Socket: SO_PEERCRED UID 1000 verification</div>
                <div>· SMP Ring Buffer: #[repr(align(64))] 64B cache-line SPSC isolation</div>
                <div>· Entry Frame: sha256(seq || prev_hash || 0x00 || payload_digest)</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
              <span className="text-slate-300">Chain Integrity Sweep</span>
              <span className={ledgerValid ? 'text-emerald-400' : 'text-rose-400'}>
                {ledgerValid ? `VALID · ${ledgerEntries.length} records` : 'HALT · CORRUPTED'}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {ledgerEntries.map((entry) => (
                <div
                  key={`${entry.sequenceId}-${entry.entryDigest}`}
                  className="p-2.5 rounded-xl bg-black/35 border border-white/10 text-[11px] font-mono space-y-0.5"
                >
                  <div className="flex items-center justify-between text-cyan-300">
                    <span>
                      #{entry.sequenceId} · {entry.toolName}
                    </span>
                    <span className="text-slate-400">{entry.plane}</span>
                  </div>
                  <div className="text-slate-400 truncate">
                    digest: {entry.entryDigest.slice(0, 28)}…
                  </div>
                  <div className="text-slate-500 truncate">
                    prev: {entry.previousHash.slice(0, 20)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Master 22-Tool MCP Catalog & 491px Signal Console HUD */}
      {subTab === 'mcp_hud' && (
        <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4 items-start">
          {/* Left: 22-Tool MCP Catalog */}
          <div className="@[920px]:col-span-7 p-4 rounded-2xl glass-surface-2 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Master 22-Tool Model Context Protocol (MCP) Catalog
                </h3>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {filteredTools.length} of 22 tools · Select any tool to dispatch in 491px Signal HUD
                </div>
              </div>

              <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
                {(['ALL', 'Ingestion', 'Vault Query', 'Egress', 'Agent', 'Composite'] as const).map(
                  (plane) => (
                    <button
                      key={plane}
                      type="button"
                      onClick={() => setPlaneFilter(plane)}
                      className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                        planeFilter === plane
                          ? 'bg-cyan-600/80 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {plane}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden bg-black/25 max-h-[460px] overflow-y-auto">
              {filteredTools.map((tool) => {
                const isSelected = selectedTool.name === tool.name;
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => handleSelectMcpTool(tool)}
                    className={`w-full px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-500/15 text-white' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-300">{tool.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {tool.plane} · {tool.targetHandle}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">{tool.purpose}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                      Returns: {tool.returnShape}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Authentic 491px Signal Console HUD */}
          <div className="@[920px]:col-span-5 flex justify-center w-full">
            <div
              className="w-full max-w-[491px] rounded-2xl p-4 space-y-3.5 backdrop-blur-[24px] shadow-2xl"
              style={{
                backgroundColor: '#090A0F',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                boxShadow: '0 0 36px rgba(0, 240, 255, 0.08)',
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <div className="text-xs font-mono font-bold text-[#00F0FF]">
                    SIGNAL CONSOLE · 491px HUD
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    ws://127.0.0.1:17373 · Plane: {selectedTool.plane}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-300 tabular-nums">
                  {selectedTool.name}
                </span>
              </div>

              {/* Monospace State Machine Stepper */}
              <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[10px] space-y-1.5">
                <div className="flex items-center justify-between gap-1 overflow-x-auto">
                  {SIGNAL_STEPS.map((step, idx) => {
                    const currentIdx = SIGNAL_STEPS.indexOf(hudState);
                    const reached =
                      hudState === 'CONFIRMED' ||
                      (currentIdx >= idx && hudState !== 'FAILED') ||
                      (hudState === 'FAILED' && idx <= 2);
                    return (
                      <React.Fragment key={step}>
                        <span
                          className={`px-1.5 py-0.5 rounded whitespace-nowrap ${
                            hudState === step
                              ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-bold'
                              : reached
                              ? 'text-emerald-300'
                              : 'text-slate-600'
                          }`}
                        >
                          [{step}]
                        </span>
                        {idx < SIGNAL_STEPS.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                {hudState === 'FAILED' && (
                  <div className="text-rose-400 pl-1">└─► [FAILED] Terminal Fault / AST Reject</div>
                )}
              </div>

              {/* JSON Draft-07 Parameters */}
              <div>
                <div className="text-[10px] font-mono text-slate-400 mb-1">
                  Tool Parameters (JSON Schema draft-07)
                </div>
                <textarea
                  value={hudParamsText}
                  onChange={(e) => setHudParamsText(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  className="w-full rounded-xl bg-black/60 border border-white/10 p-2.5 text-[11px] font-mono text-cyan-200 focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <button
                type="button"
                onClick={handleDispatchHudTool}
                disabled={isDispatchingHud}
                className="w-full py-2 px-4 rounded-xl font-mono text-xs font-bold text-[#090A0F] bg-[#00F0FF] hover:bg-cyan-300 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {isDispatchingHud ? 'Dispatching via Pi Router...' : `Dispatch ${selectedTool.name}`}
                </span>
              </button>

              {/* Uniform Response Envelope */}
              <div>
                <div className="text-[10px] font-mono text-slate-400 mb-1">
                  Response Envelope (content · isError · meta)
                </div>
                <pre className="p-3 rounded-xl bg-black/70 border border-white/10 text-[11px] font-mono text-slate-200 max-h-48 overflow-auto whitespace-pre-wrap">
                  {hudResponse}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Master Monorepo, Mobile room-vec / Flutter Bridge & 34-Step Forge */}
      {subTab === 'monorepo' && (
        <div className="grid grid-cols-1 @[880px]:grid-cols-12 gap-4">
          <div className="@[880px]:col-span-5 p-5 rounded-2xl glass-surface-2 space-y-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-bold text-white">
                Master Monorepo Layout &amp; 34-Step Test Forge
              </h3>
            </div>
            <pre className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono text-cyan-200 overflow-x-auto leading-relaxed">
              {SOVEREIGN_MONOREPO_TREE}
            </pre>

            <div className="p-3.5 rounded-xl glass-surface-1 space-y-1.5 text-xs">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-violet-300" />
                <span>Mobile Substrate &amp; Dual-Channel Edge Sync</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Kotlin Multiplatform loads native sqlite-vec binaries (.aar for Android, .xcframework for iOS/macOS) via room-vec for offline ANN similarity search. Edge relays (supabase/functions/vault-proxy) connect over Cloudflare Tunnel to the local Rust kernel on 127.0.0.1:17373.
              </p>
            </div>
          </div>

          <div className="@[880px]:col-span-7 p-5 rounded-2xl glass-surface-2 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Flutter Ingress Client Bridge (packages/flutter_client/lib/ingress_bridge.dart)
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  ws://127.0.0.1:17373 · Bearer subprotocol · Prepared → Signed → Read → Confirmed / Failed
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(FLUTTER_INGRESS_BRIDGE_DART);
                  setCopiedBridge(true);
                  setTimeout(() => setCopiedBridge(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedBridge ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Dart</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy Dart Bridge</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 rounded-xl bg-black/45 border border-white/10 text-[11px] font-mono text-slate-200 max-h-[420px] overflow-auto leading-relaxed">
              {FLUTTER_INGRESS_BRIDGE_DART}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
