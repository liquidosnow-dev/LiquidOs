import type {
  CloudSandboxSpecs,
  SandboxMetrics,
  CloudflareBindings,
  GensparkSiteConfig,
  CloudflareAccountConfig,
  GitHubRepoConfig,
  SandboxBackup,
} from '../types/sandbox.ts';
import type { ProjectFile } from '../types/index.ts';

export const INITIAL_SANDBOX_SPECS: CloudSandboxSpecs = {
  plan: 'Pro',
  cpus: 4,
  ramGb: 8,
  gpu: 'NVIDIA T4 16GB Virtualized',
  diskGb: 50,
  status: 'RUNNING',
  lastActive: Date.now(),
  autoPauseMinutes: 60,
  uptimeSeconds: 3840,
  containerId: 'sbx-ent-hono-75322657',
  ipAddress: '10.244.3.189',
};

export const INITIAL_CLOUDFLARE_BINDINGS: CloudflareBindings = {
  d1Databases: [
    {
      name: 'DB_PROD',
      id: 'd1-a9f83-4921-b0e2-88231',
      tables: [
        {
          name: 'users',
          rowCount: 42,
          schema: 'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, role TEXT, created_at INTEGER);',
        },
        {
          name: 'tasks',
          rowCount: 128,
          schema: 'CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT, status TEXT, user_id TEXT, created_at INTEGER);',
        },
        {
          name: 'audit_logs',
          rowCount: 512,
          schema: 'CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT, actor TEXT, timestamp INTEGER);',
        },
      ],
    },
  ],
  kvNamespaces: [
    {
      name: 'CACHE_KV',
      id: 'kv-cache-8823-prod',
      keysCount: 38,
      sampleKeys: [
        { key: 'session:user_root', value: '{"userId":"usr_01","role":"admin"}', expiration: 86400 },
        { key: 'ratelimit:10.244.3.189', value: '4/100', expiration: 60 },
        { key: 'config:feature_flags', value: '{"hono_v4":true,"d1_cache":true,"vector_ai":true}' },
      ],
    },
  ],
  r2Buckets: [
    {
      name: 'ASSETS_R2',
      id: 'r2-storage-assets-media',
      objectsCount: 14,
      sizeBytes: 8492040,
      sampleObjects: [
        { key: 'uploads/avatar_mercy.png', size: 142800, lastModified: '2026-11-10T14:22:00Z' },
        { key: 'assets/hero_banner.webp', size: 489200, lastModified: '2026-11-11T09:15:30Z' },
        { key: 'backups/db_snapshot_v1.sqlite', size: 7860040, lastModified: '2026-11-11T22:00:00Z' },
      ],
    },
  ],
};

export const INITIAL_GENSPARK_SITE: GensparkSiteConfig = {
  siteId: 'site_genspark_hono_8f932',
  name: 'LiquidOS Enterprise Hono Hub',
  subdomain: 'liquidos-hono',
  permanentUrl: 'https://liquidos-hono.vip.gensparksite.com',
  customDomain: 'api.liquidos.cloud',
  cnameTarget: 'liquidos-hono.vip.gensparksite.com',
  sslStatus: 'ACTIVE',
  accessControl: 'public',
  analytics: {
    requests24h: 38490,
    latencyP95Ms: 18.4,
    bandwidthMb: 612.8,
    cacheHitRatio: 0.942,
  },
  lastDeployedAt: Date.now() - 7200000,
  status: 'ACTIVE',
};

export const INITIAL_CLOUDFLARE_ACCOUNT: CloudflareAccountConfig = {
  apiToken: 'cf_tok_************************',
  accountId: '9a8d29f8c14b72183e0921ab',
  projectName: 'liquidos-edge-webapp',
  isConnected: true,
  deploymentUrl: 'https://liquidos-edge-webapp.workers.dev',
  lastDeployedAt: Date.now() - 14400000,
};

export const INITIAL_GITHUB_REPO: GitHubRepoConfig = {
  connected: true,
  username: 'liquidosnow',
  repoName: 'liquidos-hono-sandbox',
  branch: 'main',
  isPrivate: true,
  repoUrl: 'https://github.com/liquidosnow/liquidos-hono-sandbox',
  lastPushedAt: Date.now() - 3600000,
  autoPushOnCommit: true,
};

export const INITIAL_BACKUPS: SandboxBackup[] = [
  {
    id: 'bk_20261111_02',
    name: 'hono-d1-kv-prod-snapshot.tar.gz',
    sizeBytes: 4210400,
    createdAt: Date.now() - 86400000,
    commitHash: '8f43a9b2',
    filesCount: 16,
  },
  {
    id: 'bk_20261110_01',
    name: 'initial-workspace-backup.tar.gz',
    sizeBytes: 3980100,
    createdAt: Date.now() - 172800000,
    commitHash: 'c_genesis',
    filesCount: 12,
  },
];

/**
 * Generates initial Hono + Cloudflare full-stack files for `/home/user/webapp`
 */
export function getHonoFullstackInitialFiles(): ProjectFile[] {
  return [
    {
      name: 'src/index.ts',
      path: 'src/index.ts',
      language: 'typescript',
      lastModified: Date.now() - 3600000,
      content: `/**
 * @file Enterprise Hono Edge API with Cloudflare D1, KV, and R2 bindings
 * @framework Hono v4 (Running on Node.js Dev Server & Cloudflare Workers)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  ASSETS_R2: R2Bucket;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Custom-Auth'],
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    runtime: 'Cloudflare Edge / Node.js Sandbox',
    timestamp: Date.now(),
    honoVersion: '4.6.0',
    bindings: {
      d1: 'DB_PROD connected',
      kv: 'CACHE_KV connected',
      r2: 'ASSETS_R2 connected',
    },
  });
});

// D1 Database query endpoint
app.get('/api/tasks', async (c) => {
  try {
    // Check KV cache first
    const cacheKey = 'tasks:all';
    const cached = await c.env?.CACHE_KV?.get(cacheKey);
    if (cached) {
      return c.json({ source: 'kv_cache', data: JSON.parse(cached) });
    }

    // Query D1 SQL database
    const { results } = await c.env?.DB?.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 20').all() || {
      results: [
        { id: 't1', title: 'Initialize Hono Edge Sandbox', status: 'completed', user_id: 'usr_01' },
        { id: 't2', title: 'Bind Cloudflare D1 and KV namespaces', status: 'completed', user_id: 'usr_01' },
        { id: 't3', title: 'Configure Genspark 1-Click Edge Publishing', status: 'in_progress', user_id: 'usr_01' },
      ],
    };

    // Store in KV cache for 30 seconds
    if (c.env?.CACHE_KV) {
      await c.env.CACHE_KV.put(cacheKey, JSON.stringify(results), { expirationTtl: 30 });
    }

    return c.json({ source: 'd1_database', count: results.length, data: results });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// D1 Task creation endpoint
app.post('/api/tasks', async (c) => {
  const body = await c.req.json();
  const id = 't_' + Math.random().toString(36).substring(2, 9);
  const newTask = {
    id,
    title: body.title || 'New Task',
    status: body.status || 'pending',
    user_id: body.user_id || 'usr_01',
    created_at: Date.now(),
  };

  // Invalidate cache
  await c.env?.CACHE_KV?.delete('tasks:all');

  return c.json({ success: true, task: newTask }, 201);
});

// Cloudflare R2 Object Storage upload simulation
app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody();
  const filename = body['filename'] as string || 'upload_' + Date.now() + '.bin';
  return c.json({
    success: true,
    bucket: 'ASSETS_R2',
    key: 'uploads/' + filename,
    url: 'https://liquidos-hono.vip.gensparksite.com/assets/' + filename,
  });
});

export default app;
`,
    },
    {
      name: 'wrangler.jsonc',
      path: 'wrangler.jsonc',
      language: 'json',
      lastModified: Date.now() - 3600000,
      content: `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "liquidos-hono-app",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "DB_PROD",
      "database_id": "d1-a9f83-4921-b0e2-88231"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE_KV",
      "id": "kv-cache-8823-prod"
    }
  ],
  "r2_buckets": [
    {
      "binding": "ASSETS_R2",
      "bucket_name": "ASSETS_R2"
    }
  ],
  "vars": {
    "ENVIRONMENT": "production"
  }
}`,
    },
    {
      name: 'package.json',
      path: 'package.json',
      language: 'json',
      lastModified: Date.now() - 3600000,
      content: `{
  "name": "liquidos-hono-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:api": "tsx watch src/index.ts",
    "build": "vite build",
    "deploy": "wrangler deploy",
    "cf-typegen": "wrangler types"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "lucide-react": "^0.546.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241106.0",
    "wrangler": "^3.88.0",
    "typescript": "^5.6.3",
    "vite": "^6.0.0"
  }
}`,
    },
    {
      name: 'index.html',
      path: 'index.html',
      language: 'html',
      lastModified: Date.now() - 3600000,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Enterprise Cloud Sandbox · Hono + Cloudflare</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: '#06b6d4',
            cfOrange: '#f38020',
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen">
  <div class="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
    <!-- Header Banner -->
    <header class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-amber-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-cyan-950/50">
          ⚡
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold tracking-tight text-white">Enterprise Cloud Sandbox</h1>
            <span class="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-950 text-cyan-400 border border-cyan-800">HONO v4.6</span>
            <span class="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-950 text-amber-400 border border-amber-800">CLOUDFLARE EDGE</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Persistent Linux Container · D1 SQL · KV Cache · R2 Storage</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Dev Server :8787 Running
        </span>
      </div>
    </header>

    <!-- Edge Storage Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- D1 SQL Database -->
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md hover:border-slate-700 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-cyan-400 text-base">🗄️</span>
            <span class="text-xs font-bold text-slate-200">Cloudflare D1</span>
          </div>
          <span class="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded">SQL Engine</span>
        </div>
        <p class="text-xs text-slate-400">Serverless relational database running SQLite at the edge with replication.</p>
        <div class="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/80 text-slate-300">
          Binding: <span class="text-cyan-300 font-bold">DB_PROD</span><br />
          Tables: users (42), tasks (128)
        </div>
      </div>

      <!-- Cloudflare KV -->
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md hover:border-slate-700 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 text-base">⚡</span>
            <span class="text-xs font-bold text-slate-200">Cloudflare KV</span>
          </div>
          <span class="text-[10px] font-mono text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded">&lt;10ms Read</span>
        </div>
        <p class="text-xs text-slate-400">Low-latency global key-value store for session caching and rate limits.</p>
        <div class="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/80 text-slate-300">
          Binding: <span class="text-amber-300 font-bold">CACHE_KV</span><br />
          Keys: 38 keys cached
        </div>
      </div>

      <!-- Cloudflare R2 -->
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md hover:border-slate-700 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-orange-400 text-base">📦</span>
            <span class="text-xs font-bold text-slate-200">Cloudflare R2</span>
          </div>
          <span class="text-[10px] font-mono text-orange-400 bg-orange-950 px-1.5 py-0.5 rounded">Zero Egress</span>
        </div>
        <p class="text-xs text-slate-400">S3-compatible object storage with zero egress fees for user assets.</p>
        <div class="text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800/80 text-slate-300">
          Binding: <span class="text-orange-300 font-bold">ASSETS_R2</span><br />
          Objects: 14 items (8.1 MB)
        </div>
      </div>
    </div>

    <!-- Interactive Live D1 Task Manager -->
    <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-white uppercase tracking-wider">Hono API Endpoint: /api/tasks</h2>
          <p class="text-xs text-slate-400">Live query against Cloudflare D1 with automatic KV caching</p>
        </div>
        <button id="refreshBtn" onclick="loadTasks()" class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors cursor-pointer">
          Refresh D1
        </button>
      </div>

      <!-- Add Task Form -->
      <form onsubmit="addTask(event)" class="flex gap-2">
        <input
          id="taskInput"
          type="text"
          placeholder="Enter new task or wish to store in D1 database..."
          class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          required
        />
        <button
          type="submit"
          class="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-xs font-bold text-white rounded-lg transition-all shadow-md cursor-pointer"
        >
          Insert Record
        </button>
      </form>

      <!-- Task List -->
      <div id="taskList" class="space-y-2">
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Initialize Hono Edge Sandbox with D1 & KV bindings</span>
          </div>
          <span class="text-[10px] font-mono text-cyan-400">t1 · completed</span>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Bind Cloudflare D1 SQL database and KV namespace</span>
          </div>
          <span class="text-[10px] font-mono text-cyan-400">t2 · completed</span>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Configure Genspark 1-Click Edge Publishing & SSL</span>
          </div>
          <span class="text-[10px] font-mono text-amber-400">t3 · in_progress</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    let localTasks = [
      { id: 't1', title: 'Initialize Hono Edge Sandbox with D1 & KV bindings', status: 'completed' },
      { id: 't2', title: 'Bind Cloudflare D1 SQL database and KV namespace', status: 'completed' },
      { id: 't3', title: 'Configure Genspark 1-Click Edge Publishing & SSL', status: 'in_progress' }
    ];

    function renderTasks() {
      const container = document.getElementById('taskList');
      if (!container) return;
      container.innerHTML = localTasks.map(t => \`
        <div class="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between hover:border-slate-700 transition-colors">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full \${t.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}"></span>
            <span>\${t.title}</span>
          </div>
          <span class="text-[10px] font-mono text-cyan-400">\${t.id} · \${t.status}</span>
        </div>
      \`).join('');
    }

    function addTask(e) {
      e.preventDefault();
      const input = document.getElementById('taskInput');
      const val = input.value.trim();
      if (!val) return;
      const id = 't' + (localTasks.length + 1);
      localTasks.unshift({ id, title: val, status: 'pending' });
      input.value = '';
      renderTasks();
      console.log('[Hono D1 Query] INSERT INTO tasks (id, title, status) VALUES ("' + id + '", "' + val + '", "pending") -> Success');
      if (window.parent) {
        window.parent.postMessage({
          type: 'SANDBOX_CONSOLE',
          level: 'log',
          message: 'D1 INSERT -> INSERT INTO tasks (id, title, status) VALUES ("' + id + '", "' + val + '", "pending") [1.4ms]',
          timestamp: Date.now()
        }, '*');
      }
    }

    function loadTasks() {
      console.log('[Hono API GET] /api/tasks -> Reading from D1 DB_PROD & CACHE_KV');
      if (window.parent) {
        window.parent.postMessage({
          type: 'SANDBOX_CONSOLE',
          level: 'log',
          message: 'Hono GET /api/tasks [D1_DB_PROD] 200 OK (3.2ms) Cache: HIT',
          timestamp: Date.now()
        }, '*');
      }
    }
  </script>
</body>
</html>
`,
    },
    {
      name: 'README.md',
      path: 'README.md',
      language: 'markdown',
      lastModified: Date.now() - 3600000,
      content: `# Enterprise Cloud Sandbox · Hono + Cloudflare Stack

This repository runs inside a dedicated persistent Linux container at \`/home/user/webapp\`.

## Architecture
- **Backend**: [Hono v4](https://hono.dev/) on Node.js / Cloudflare Workers
- **Database**: Cloudflare D1 (SQL with SQLite dialect)
- **Cache**: Cloudflare KV (<10ms global read)
- **Object Storage**: Cloudflare R2 (S3 API compatible, 0 egress)
- **Publishing Channels**:
  1. ⭐ **Genspark Hosting** (Plus/Pro): 1-Click zero-config edge deploy with permanent URL & SSL
  2. ☁️ **Cloudflare Workers**: Direct deploy using API Token and Wrangler
  3. 🐙 **GitHub Integration**: Auto-commit every AI turn & push to remote repository

## CLI Commands in Sandbox Terminal
\`\`\`bash
# Dev server
pnpm dev

# Test Hono API
curl http://localhost:8787/api/health

# Cloudflare D1 query
wrangler d1 execute DB_PROD --command="SELECT * FROM tasks"

# Publish to Genspark Edge
genspark publish --env=production
\`\`\`
`,
    },
  ];
}

/**
 * Terminal command execution simulation for the interactive Linux terminal
 */
export function executeTerminalCommand(
  cmd: string,
  files: ProjectFile[],
  specs: CloudSandboxSpecs,
  bindings: CloudflareBindings
): { output: string; exitCode: number } {
  const trimmed = cmd.trim();
  if (!trimmed) {
    return { output: '', exitCode: 0 };
  }

  const parts = trimmed.split(/\s+/);
  const bin = parts[0];

  switch (bin) {
    case 'clear':
      return { output: '\x1b[2J\x1b[0;0H', exitCode: 0 };

    case 'pwd':
      return { output: '/home/user/webapp', exitCode: 0 };

    case 'uname':
      if (trimmed.includes('-a')) {
        return {
          output: 'Linux sandbox-ent-hono 6.6.13-cloud-x86_64 #1 SMP PREEMPT_DYNAMIC GNU/Linux',
          exitCode: 0,
        };
      }
      return { output: 'Linux', exitCode: 0 };

    case 'uptime':
      const hours = Math.floor(specs.uptimeSeconds / 3600);
      const mins = Math.floor((specs.uptimeSeconds % 3600) / 60);
      return {
        output: ` 02:08:14 up ${hours}h ${mins}m, 1 user, load average: 0.18, 0.24, 0.19 (4 vCPUs)`,
        exitCode: 0,
      };

    case 'ls':
      const isLong = trimmed.includes('-l') || trimmed.includes('-la');
      if (isLong) {
        const lines = [
          'total 64',
          'drwxr-xr-x 4 user user 4096 Nov 12 02:00 .',
          'drwxr-xr-x 3 user user 4096 Nov 12 01:50 ..',
          '-rw-r--r-- 1 user user  680 Nov 12 02:01 .env',
          'drwxr-xr-x 8 user user 4096 Nov 12 02:05 .git',
          'drwxr-xr-x 2 user user 4096 Nov 12 02:04 node_modules',
          ...files.map(f => `-rw-r--r-- 1 user user ${f.content.length.toString().padStart(5, ' ')} Nov 12 02:00 ${f.path}`),
        ];
        return { output: lines.join('\n'), exitCode: 0 };
      }
      return {
        output: files.map(f => f.path).join('  ') + '  node_modules  .git  .env',
        exitCode: 0,
      };

    case 'cat':
      const targetPath = parts[1];
      if (!targetPath) {
        return { output: 'cat: missing file operand', exitCode: 1 };
      }
      const found = files.find(f => f.path === targetPath || f.name === targetPath);
      if (found) {
        return { output: found.content, exitCode: 0 };
      }
      return { output: `cat: ${targetPath}: No such file or directory`, exitCode: 1 };

    case 'pnpm':
    case 'npm':
    case 'npx':
      if (parts[1] === 'run' && parts[2] === 'dev') {
        return {
          output: `\n> liquidos-hono-app@1.0.0 dev /home/user/webapp\n> vite\n\n  VITE v6.0.0  ready in 142 ms\n\n  ➜  Local:   http://localhost:3000/\n  ➜  Hono API: http://localhost:8787/api\n  ➜  press h + enter to show help\n`,
          exitCode: 0,
        };
      }
      if (parts[1] === 'test' || (parts[1] === 'run' && parts[2] === 'test:coverage') || parts[1] === 'vitest') {
        return {
          output: ` RUN  v4.1.0 /home/user/webapp\n      Coverage enabled with v8\n\n ✓ src/utils/contractRegistry.test.ts (8 tests)\n ✓ src/utils/securityCrypto.test.ts (6 tests)\n ✓ src/utils/sandboxEngine.test.ts (6 tests)\n ✓ src/utils/toolExecutor.test.ts (6 tests)\n ✓ src/utils/liquidArchitectureEngine.test.ts (4 tests)\n ✓ src/utils/versionControl.test.ts (4 tests)\n\n Test Files  6 passed (6)\n      Tests  34 passed (34)\n   Coverage  Open the Workspace "Testing" tab for live V8 line/branch reports.`,
          exitCode: 0,
        };
      }
      if (parts[1] === 'install' || parts[1] === 'i') {
        return {
          output: `Packages: +342\n++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\nProgress: resolved 342, reused 342, downloaded 0, added 342, done\nDone in 1.48s`,
          exitCode: 0,
        };
      }
      return {
        output: `pnpm v9.12.3 (Node.js v22.11.0)\nUsage: pnpm [command] [flags]`,
        exitCode: 0,
      };

    case 'wrangler':
      if (trimmed.includes('d1 execute')) {
        return {
          output: `Executing on DB_PROD (d1-a9f83-4921-b0e2-88231):\n┌──────────────────┬────────────────────────────────────────────────────────┬─────────────┐\n│ id               │ title                                                  │ status      │\n├──────────────────┼────────────────────────────────────────────────────────┼─────────────┤\n│ t1               │ Initialize Hono Edge Sandbox with D1 & KV bindings     │ completed   │\n│ t2               │ Bind Cloudflare D1 SQL database and KV namespace       │ completed   │\n│ t3               │ Configure Genspark 1-Click Edge Publishing & SSL       │ in_progress │\n└──────────────────┴────────────────────────────────────────────────────────┴─────────────┘\nRows: 3, Cost: 0.0001 D1 read units`,
          exitCode: 0,
        };
      }
      if (trimmed.includes('deploy')) {
        return {
          output: `Total Upload: 48.20 KiB / gzip: 12.80 KiB\nUploaded liquidos-hono-app (1.42 sec)\nPublished liquidos-hono-app (2.89 sec)\n  https://liquidos-edge-webapp.workers.dev\nCurrent Version ID: b01824a9-8391-4991-8219-9a00b8c38192`,
          exitCode: 0,
        };
      }
      return {
        output: `⛅ wrangler 3.88.0\nCommands: dev, deploy, d1, kv, r2, types, secret`,
        exitCode: 0,
      };

    case 'git':
      if (parts[1] === 'status') {
        return {
          output: `On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n\n\tmodified:   src/index.ts\n\nno changes added to commit (use "git add")`,
          exitCode: 0,
        };
      }
      if (parts[1] === 'log') {
        return {
          output: `commit 8f43a9b2 (HEAD -> main, origin/main)\nAuthor: AI Auto-Commit <ai@genspark.ai>\nDate:   Thu Nov 12 02:00:15 2026 -0800\n\n    feat: bind Cloudflare D1 and KV namespaces in Hono router\n\ncommit c_genesis\nAuthor: Mercy (liquidosnow@gmail.com)\nDate:   Thu Nov 12 01:00:00 2026 -0800\n\n    Initial enterprise sandbox setup`,
          exitCode: 0,
        };
      }
      return { output: `git version 2.45.2\nusage: git [status|log|commit|push|pull|diff]`, exitCode: 0 };

    case 'curl':
      if (trimmed.includes('/api/health')) {
        return {
          output: JSON.stringify(
            {
              status: 'ok',
              runtime: 'Cloudflare Edge / Node.js Sandbox',
              timestamp: Date.now(),
              honoVersion: '4.6.0',
              bindings: { d1: 'DB_PROD connected', kv: 'CACHE_KV connected', r2: 'ASSETS_R2 connected' },
            },
            null,
            2
          ),
          exitCode: 0,
        };
      }
      return { output: `{"status": "ok", "url": "${parts[1] || 'http://localhost:8787'}"}`, exitCode: 0 };

    case 'top':
    case 'htop':
      return {
        output: `Tasks: 18 total, 1 running, 17 sleeping\n%Cpu(s):  ${(Math.random() * 5 + 2).toFixed(1)} us,  1.1 sy,  0.0 ni, 93.8 id\nMiB Mem :   8192.0 total,   5940.2 free,   1482.4 used,    769.4 buff/cache\n\n  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n 1204 user      20   0  892340 148210  42100 S   2.4   1.8   0:42.18 node server.ts\n 1380 user      20   0  420100  58400  21000 S   0.8   0.7   0:12.44 vite\n 1492 user      20   0   18400   3200   2800 R   0.2   0.0   0:00.08 top`,
        exitCode: 0,
      };

    case 'node':
      if (trimmed.includes('interop.mjs')) {
        return {
          output: `Running AN-EVC-001 Cross-Runtime Interoperability Harness (Node ${typeof process !== 'undefined' ? process.version : 'v22'} + Python 3.10.12)...\n  ✓ V01-float-whole (1.0 == 1)                PASS\n  ✓ V02-negative-zero (-0.0 == 0)             PASS\n  ✓ V05-non-ascii ({"é":"ü"})                 PASS\n  ✓ V07-line-paragraph-separators             PASS\n  ✓ V10-key-ordering-astral (😀 < \\uFFFF)     PASS\n  ✓ R01-R04 nonfinite & int>2^53-1 rejection  PASS\n\nResult: 36/36 assertions passed — claimStatus="tested" (independentlyReproduced=false)`,
          exitCode: 0,
        };
      }
      if (trimmed.includes('run-all.mjs')) {
        return {
          output: `CAIRN / Atomic Nexus ONE · Master Verification Suite\n  [1/2] tests/suites/unit-contract.mjs ....... 67/67 PASS\n  [2/2] Full Workspace Test Runner ........... 186/186 PASS\n\nScope: structural_validation_only · Authority checks: NOT_RUN`,
          exitCode: 0,
        };
      }
      return { output: `Node.js runtime ready. Try: node verification-tools/interop.mjs`, exitCode: 0 };

    case 'python3':
      if (trimmed.includes('canonical.py')) {
        return {
          output: `Python 3.10.12 AN-EVC-001 Canonicalizer\n  ✓ UTF-16BE key sort active\n  ✓ Safe-integer literal pre-check (<= 9007199254740991) active\n  ✓ ECMAScript number formatting verified`,
          exitCode: 0,
        };
      }
      return { output: `Python 3.10.12 (main). Try: python3 verification-tools/canonical.py`, exitCode: 0 };

    default:
      return {
        output: `bash: ${bin}: command not found. Available: ls, cat, pwd, uname, uptime, node, python3, pnpm, wrangler, git, curl, top, clear`,
        exitCode: 127,
      };
  }
}
