import { CODEX_PUTER_TOOLS } from './codexToolEngine';
import type { Project, ProjectFile } from '../types';
import type { AppTemplate } from '../services/templates';

export type SpatialDirection = 'HOME' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
export type CardinalDirection = Exclude<SpatialDirection, 'HOME'>;

export interface SpatialNavigationState {
  activeDirection: SpatialDirection;
  previousDirection: SpatialDirection | null;
  history: SpatialDirection[];
  isTransitioning: boolean;
  lastTransitionAt: number;
}

export const SPATIAL_TRANSITION_DURATION_MS = 280;

export function createInitialSpatialState(): SpatialNavigationState {
  return {
    activeDirection: 'HOME',
    previousDirection: null,
    history: ['HOME'],
    isTransitioning: false,
    lastTransitionAt: 0,
  };
}

/**
 * Computes the offscreen CSS transform intent when a cardinal panel is resting off-stage.
 * Active panels resolve to translate3d(0, 0, 0).
 */
export function getDirectionalOffscreenTransform(direction: CardinalDirection): string {
  switch (direction) {
    case 'NORTH':
      return 'translate3d(0, -100%, 0)';
    case 'SOUTH':
      return 'translate3d(0, 100%, 0)';
    case 'EAST':
      return 'translate3d(100%, 0, 0)';
    case 'WEST':
      return 'translate3d(-100%, 0, 0)';
  }
}

export function getOppositeDirection(direction: CardinalDirection): CardinalDirection {
  switch (direction) {
    case 'NORTH':
      return 'SOUTH';
    case 'SOUTH':
      return 'NORTH';
    case 'EAST':
      return 'WEST';
    case 'WEST':
      return 'EAST';
  }
}

/**
 * Transitions the spatial state while enforcing a lock window against conflicting rapid transitions
 * and preserving navigation history.
 */
export function transitionSpatialDirection(
  state: SpatialNavigationState,
  target: SpatialDirection,
  nowMs: number = Date.now(),
  lockWindowMs: number = SPATIAL_TRANSITION_DURATION_MS
): SpatialNavigationState {
  if (target === state.activeDirection) {
    return state;
  }

  // Prevent conflicting mid-flight transitions unless transitioning back HOME immediately
  if (
    state.isTransitioning &&
    nowMs - state.lastTransitionAt < lockWindowMs &&
    target !== 'HOME'
  ) {
    return state;
  }

  const nextHistory = [...state.history, target].slice(-24);

  return {
    activeDirection: target,
    previousDirection: state.activeDirection,
    history: nextHistory,
    isTransitioning: lockWindowMs > 0,
    lastTransitionAt: nowMs,
  };
}

export function settleSpatialTransition(
  state: SpatialNavigationState
): SpatialNavigationState {
  if (!state.isTransitioning) return state;
  return {
    ...state,
    isTransitioning: false,
  };
}

export function navigateSpatialBack(
  state: SpatialNavigationState,
  nowMs: number = Date.now()
): SpatialNavigationState {
  if (state.history.length <= 1) {
    if (state.activeDirection === 'HOME') return state;
    return {
      activeDirection: 'HOME',
      previousDirection: state.activeDirection,
      history: ['HOME'],
      isTransitioning: true,
      lastTransitionAt: nowMs,
    };
  }
  const trimmed = state.history.slice(0, -1);
  const previous = trimmed[trimmed.length - 1] || 'HOME';
  return {
    activeDirection: previous,
    previousDirection: state.activeDirection,
    history: trimmed,
    isTransitioning: true,
    lastTransitionAt: nowMs,
  };
}

/**
 * Maps directional keyboard keys to cardinal spatial transitions when focus is not inside text inputs.
 */
export function mapKeyboardToSpatialDirection(
  key: string,
  current: SpatialDirection
): SpatialDirection | null {
  switch (key) {
    case 'Escape':
    case 'Home':
      return current === 'HOME' ? null : 'HOME';
    case 'ArrowUp':
      return current === 'SOUTH' ? 'HOME' : 'NORTH';
    case 'ArrowDown':
      return current === 'NORTH' ? 'HOME' : 'SOUTH';
    case 'ArrowRight':
      return current === 'WEST' ? 'HOME' : 'EAST';
    case 'ArrowLeft':
      return current === 'EAST' ? 'HOME' : 'WEST';
    default:
      return null;
  }
}

/**
 * Maps pointer/touch swipe delta vectors to spatial transitions (min threshold 56px).
 */
export function mapSwipeDeltaToSpatialDirection(
  deltaX: number,
  deltaY: number,
  current: SpatialDirection,
  thresholdPx: number = 56
): SpatialDirection | null {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (Math.max(absX, absY) < thresholdPx) return null;

  if (absX > absY) {
    // Swiping finger right reveals WEST (left wing); swiping left reveals EAST (right wing)
    if (deltaX > 0) {
      return current === 'EAST' ? 'HOME' : 'WEST';
    }
    return current === 'WEST' ? 'HOME' : 'EAST';
  }

  // Swiping finger down reveals NORTH (top deck); swiping up reveals SOUTH (bottom deck)
  if (deltaY > 0) {
    return current === 'SOUTH' ? 'HOME' : 'NORTH';
  }
  return current === 'NORTH' ? 'HOME' : 'SOUTH';
}

export const CARDINAL_LABELS: Record<
  CardinalDirection,
  { title: string; subtitle: string; shortcut: string }
> = {
  NORTH: {
    title: 'System Telemetry',
    subtitle: 'Diagnostics · Host Health · Control Plane',
    shortcut: '↑',
  },
  SOUTH: {
    title: 'Command Console',
    subtitle: 'Codex AI · Sandbox Execution · Query',
    shortcut: '↓',
  },
  EAST: {
    title: 'Tool Library',
    subtitle: 'Registered Functions · Sandboxes · Audit',
    shortcut: '→',
  },
  WEST: {
    title: 'Project Workspace',
    subtitle: 'Active Projects · Briefs · Code & Files',
    shortcut: '←',
  },
};

/* -------------------------------------------------------------------------- */
/*  Project Watermarks, Records & Brief Management                            */
/* -------------------------------------------------------------------------- */

export type ProjectBriefStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'changes_requested';

export interface ProjectBriefRecord {
  id: string;
  projectId: string;
  title: string;
  objectives: string;
  constraints: string;
  targetStack: string;
  status: ProjectBriefStatus;
  reviewNotes: string;
  submittedAt: number;
  updatedAt: number;
}

export interface ProjectMilestone {
  id: string;
  label: string;
  done: boolean;
}

export interface WorkspaceProjectRecord {
  id: string;
  templateId?: string;
  name: string;
  description: string;
  watermark: string;
  status: 'Active' | 'Staging' | 'Review' | 'Archived';
  files: ProjectFile[];
  milestones: ProjectMilestone[];
  brief?: ProjectBriefRecord;
  createdAt: number;
  updatedAt: number;
}

/**
 * Generates a unique, deterministic 8-hex-char project watermark (e.g., #A7F3-9D2E)
 * from a stable identifier + name seed via FNV-1a dual-lane hashing.
 */
export function computeProjectWatermark(id: string, name: string): string {
  const seed = `${id.trim()}::${name.trim()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + i * 31) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const left = (h1 >>> 16).toString(16).toUpperCase().padStart(4, '0');
  const right = (h2 >>> 16).toString(16).toUpperCase().padStart(4, '0');
  return `#${left}-${right}`;
}

export function deriveProjectMilestones(
  project: Project,
  options?: { testsPassed?: boolean; briefApproved?: boolean }
): ProjectMilestone[] {
  const hasCode = project.files.length > 0;
  const hasCommits = project.commits.length > 0;
  return [
    { id: 'ms_design', label: options?.briefApproved ? 'Brief Approved' : 'Design Ready', done: hasCode },
    { id: 'ms_build', label: `Build Active (${project.files.length} files)`, done: hasCommits },
    {
      id: 'ms_testing',
      label: options?.testsPassed ? 'Verification Passed' : 'Testing Queue',
      done: Boolean(options?.testsPassed),
    },
  ];
}

export function buildInitialWorkspaceProjects(
  activeProject: Project,
  templates: AppTemplate[]
): WorkspaceProjectRecord[] {
  const activeWatermark = computeProjectWatermark(activeProject.id, activeProject.name);
  const activeRec: WorkspaceProjectRecord = {
    id: activeProject.id,
    templateId: templates[0]?.id,
    name: activeProject.name,
    description: activeProject.description,
    watermark: activeWatermark,
    status: 'Active',
    files: activeProject.files,
    milestones: deriveProjectMilestones(activeProject),
    brief: {
      id: 'brief_initial_one',
      projectId: activeProject.id,
      title: 'Canonical Contract & Edge Sandbox Brief',
      objectives:
        'Unify AN-EVC-001 canonical JSON verification across TS and Python with a fail-closed Hono/Cloudflare runtime and tamper-evident audit ledger.',
      constraints: 'Fail-closed Ed25519 receipts, deterministic watermarks, zero plaintext secrets.',
      targetStack: 'React 19 · Hono v4 · Cloudflare D1/KV/R2 · Python 3.10',
      status: 'approved',
      reviewNotes: 'Approved under LOS-CORE-001 sovereign verification policy.',
      submittedAt: activeProject.createdAt,
      updatedAt: activeProject.updatedAt,
    },
    createdAt: activeProject.createdAt,
    updatedAt: activeProject.updatedAt,
  };

  const secondary = templates.slice(1).map((tpl, index) => ({
    id: `proj_${tpl.id}`,
    templateId: tpl.id,
    name: tpl.name,
    description: tpl.description,
    watermark: computeProjectWatermark(`proj_${tpl.id}`, tpl.name),
    status: (index === 0 ? 'Staging' : 'Review') as WorkspaceProjectRecord['status'],
    files: tpl.files,
    milestones: [
      { id: 'ms_design', label: 'Blueprint Ready', done: true },
      { id: 'ms_build', label: `${tpl.files.length} Source Files`, done: true },
      { id: 'ms_testing', label: 'Testing Queue', done: false },
    ],
    createdAt: Date.now() - (index + 2) * 3600_000,
    updatedAt: Date.now() - (index + 1) * 1800_000,
  }));

  return [activeRec, ...secondary];
}

export function validateProjectBriefInput(input: {
  title: string;
  objectives: string;
}): { ok: boolean; error?: string } {
  const title = input.title.trim();
  const objectives = input.objectives.trim();
  if (title.length < 3) {
    return { ok: false, error: 'Brief title must be at least 3 characters.' };
  }
  if (objectives.length < 10) {
    return { ok: false, error: 'Brief objectives must be at least 10 characters.' };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Tool Library Catalog Metadata                                             */
/* -------------------------------------------------------------------------- */

export type ToolLibraryCategory =
  | 'All'
  | 'Development Tools'
  | 'Analysis Suite'
  | 'Security Toolkit'
  | 'Visualization'
  | 'AI Assist Modules'
  | 'Utilities';

export interface RegisteredToolItem {
  id: string;
  name: string;
  title: string;
  category: Exclude<ToolLibraryCategory, 'All'>;
  description: string;
  availability: 'Available' | 'Control-Plane Gated' | 'On-Demand';
  permissionScope: string;
  endpoint: string;
  sampleArgs: Record<string, any>;
  isCallable: boolean;
  workspaceTab?: 'preview' | 'code' | 'files' | 'contract' | 'testing' | 'terminal' | 'metrics' | 'publish' | 'play_audit' | 'architecture';
}

export const TOOL_LIBRARY_CATEGORIES: Exclude<ToolLibraryCategory, 'All'>[] = [
  'Development Tools',
  'Analysis Suite',
  'Security Toolkit',
  'Visualization',
  'AI Assist Modules',
  'Utilities',
];

export function buildRegisteredToolCatalog(): RegisteredToolItem[] {
  const codexSchemas = new Map(CODEX_PUTER_TOOLS.map((t) => [t.function.name, t.function]));

  return [
    {
      id: 'tool_execute_code',
      name: 'execute_code',
      title: 'Sandbox Code Runner (JS / Python)',
      category: 'Development Tools',
      description:
        codexSchemas.get('execute_code')?.description ||
        'Execute JavaScript (isolated node:vm) or Python 3 code on the server sandbox.',
      availability: 'Available',
      permissionScope: 'sandbox:exec',
      endpoint: 'POST /api/tools/execute',
      sampleArgs: { language: 'javascript', code: 'const parity = [1, 2, 3].map(n => n * n); console.log("Squared:", parity);' },
      isCallable: true,
    },
    {
      id: 'tool_create_file',
      name: 'create_file',
      title: 'Workspace File Synthesizer',
      category: 'Development Tools',
      description:
        codexSchemas.get('create_file')?.description ||
        'Create or update validated workspace files with traversal protection.',
      availability: 'Available',
      permissionScope: 'workspace:write',
      endpoint: 'Client + OnDeviceFS',
      sampleArgs: { path: 'notes/telemetry-note.md', content: '# Liquid OS Snapshot Note\nVerified runtime check.\n', language: 'markdown' },
      isCallable: true,
    },
    {
      id: 'tool_math_eval',
      name: 'math_eval',
      title: 'Deterministic Math Evaluator',
      category: 'Utilities',
      description:
        codexSchemas.get('math_eval')?.description ||
        'Safely compute arithmetic expressions without eval() injection risk.',
      availability: 'Available',
      permissionScope: 'compute:pure',
      endpoint: 'Local Safe Parser',
      sampleArgs: { expression: '(256 * 4) + (1024 / 8)' },
      isCallable: true,
    },
    {
      id: 'tool_web_fetch',
      name: 'web_fetch',
      title: 'SSRF-Guarded Web Fetch Proxy',
      category: 'Utilities',
      description:
        codexSchemas.get('web_fetch')?.description ||
        'Fetch public HTTP/HTTPS pages or JSON endpoints with private-IP SSRF protection.',
      availability: 'Available',
      permissionScope: 'network:public_http',
      endpoint: 'POST /api/tools/fetch',
      sampleArgs: { url: 'https://example.com' },
      isCallable: true,
    },
    {
      id: 'tool_contract_interop',
      name: 'contract_interop',
      title: 'AN-EVC-001 Canonicalization Verifier',
      category: 'Security Toolkit',
      description:
        'Execute cross-runtime TypeScript + Python 3.10 RFC 8785 canonicalization parity vectors.',
      availability: 'Available',
      permissionScope: 'contract:verify',
      endpoint: 'GET /api/contract/interop',
      sampleArgs: {},
      isCallable: true,
      workspaceTab: 'contract',
    },
    {
      id: 'tool_control_plane_attest',
      name: 'control_plane_attest',
      title: 'Ed25519 Attestation & Preflight',
      category: 'Security Toolkit',
      description:
        'Inspect active Control Plane mode (ACTIVE / RESTRICTED / LOCKDOWN), Ed25519 keys, and deployment receipts.',
      availability: 'Control-Plane Gated',
      permissionScope: 'control_plane:attest',
      endpoint: 'GET /api/control-plane/state',
      sampleArgs: {},
      isCallable: true,
      workspaceTab: 'publish',
    },
    {
      id: 'tool_vitest_suite',
      name: 'vitest_runner',
      title: 'Live Vitest Watch & Audit Runner',
      category: 'Analysis Suite',
      description:
        'Run the workspace unit and interop test suites directly inside the Testing Workbench.',
      availability: 'Available',
      permissionScope: 'tests:read_exec',
      endpoint: 'POST /api/tests/run',
      sampleArgs: {},
      isCallable: false,
      workspaceTab: 'testing',
    },
    {
      id: 'tool_os_db_query',
      name: 'os_db_query',
      title: 'LiquidOS SQLite / DuckDB Query',
      category: 'Analysis Suite',
      description:
        'Inspect bound workspace tables, commit counts, and OS metadata via parameterized queries.',
      availability: 'Available',
      permissionScope: 'os_db:read',
      endpoint: 'GET /api/os/state',
      sampleArgs: {},
      isCallable: true,
    },
    {
      id: 'tool_preview_sandbox',
      name: 'preview_canvas',
      title: 'Isolated Split-Screen Artifact Runner',
      category: 'Visualization',
      description:
        'Inspect live HTML/CSS/React/SVG bundles in an isolated sandboxed iframe with console capture.',
      availability: 'Available',
      permissionScope: 'ui:sandbox_iframe',
      endpoint: 'Client Sandbox Frame',
      sampleArgs: {},
      isCallable: false,
      workspaceTab: 'preview',
    },
    {
      id: 'tool_codex_engine',
      name: 'codex_ai_chat',
      title: 'Codex Multi-Model Agent & ReAct Loop',
      category: 'AI Assist Modules',
      description:
        'Invoke Gemini, Claude, GPT-4o, DeepSeek, or LiteRT-LM models with tool calling and RecursiveEngine verification.',
      availability: 'On-Demand',
      permissionScope: 'ai:chat_tools',
      endpoint: 'POST /api/ai/chat',
      sampleArgs: {},
      isCallable: false,
    },
  ];
}
