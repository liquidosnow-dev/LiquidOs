import { Project, ProjectFile } from '../types';

export interface AppTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: string;
  files: ProjectFile[];
}

export const TEMPLATES: AppTemplate[] = [
  {
    id: 'liquid-os',
    name: 'LiquidOS Mercury Vault & Pipeline Router',
    badge: 'Architecture · IMG 1 & 5',
    description: 'Pi Pipeline Ingress Hook, SHA-256 Tamper-Evident Ledger, DuckDB OLAP & LanceDB Vector Index with interactive state transitions.',
    icon: '💧',
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        lastModified: Date.now(),
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LiquidOS Mercury Vault</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 15px rgba(6, 182, 212, 0.4); }
      50% { box-shadow: 0 0 30px rgba(6, 182, 212, 0.8); }
    }
    .glow-cyan { animation: pulse-glow 3s infinite; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased p-4 md:p-8">
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Top Header -->
    <header class="flex flex-col md:flex-row md:items-center justify-between border-b border-cyan-900/60 pb-5 gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xl shadow-lg">💧</div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl md:text-2xl font-bold tracking-tight text-white">LIQUID OS · MERCURY VAULT</h1>
            <span class="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">v4.2-SEC</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Pi Pipeline Hook Router · Kernel-Anchored Socket Credentials · WAL SQLite</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <div class="text-xs text-slate-400">Current Vault State</div>
          <div id="state-label" class="text-xs font-mono font-bold text-emerald-400">STATE 5/5: CONFIRMED</div>
        </div>
        <button onclick="injectPacket()" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md hover:shadow-cyan-500/20 active:scale-95 flex items-center gap-2">
          <span>⚡</span> Ingest Pipeline Packet
        </button>
      </div>
    </header>

    <!-- State Machine Stepper -->
    <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Engine Local Container Sandbox State Transitions</div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono" id="stepper">
        <div id="step-0" class="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 font-semibold transition-all">1. PREPARED</div>
        <div id="step-1" class="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 font-semibold transition-all">2. SIGNED</div>
        <div id="step-2" class="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 font-semibold transition-all">3. PERSISTED</div>
        <div id="step-3" class="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 font-semibold transition-all">4. READ</div>
        <div id="step-4" class="p-2.5 rounded-lg border border-emerald-500 bg-emerald-950/50 text-emerald-300 font-bold transition-all shadow-sm">5. CONFIRMED</div>
      </div>
    </div>

    <!-- Triple Barrier Architecture Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 hover:border-cyan-500/40 transition-colors">
        <div class="flex items-center justify-between text-xs mb-2">
          <span class="text-cyan-400 font-semibold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span> [SECURITY BARRIER]
          </span>
          <span class="text-emerald-400 font-mono text-[11px]">ENFORCED</span>
        </div>
        <div class="text-2xl font-bold text-white font-mono" id="metric-ingress">1,232 B</div>
        <p class="text-xs text-slate-400 mt-1">MTU framing caps strictly validated. Kernel socket auth bound.</p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 hover:border-amber-500/40 transition-colors">
        <div class="flex items-center justify-between text-xs mb-2">
          <span class="text-amber-400 font-semibold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span> [MEMORY MTU BARRIER]
          </span>
          <span class="text-amber-400 font-mono text-[11px]">14.8M rows/s</span>
        </div>
        <div class="text-2xl font-bold text-white font-mono">DuckDB OLAP</div>
        <p class="text-xs text-slate-400 mt-1">Zero-copy shared memory lock checks. Atomic barrier gates.</p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 hover:border-purple-500/40 transition-colors">
        <div class="flex items-center justify-between text-xs mb-2">
          <span class="text-purple-400 font-semibold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-purple-400"></span> [VECTOR INDEX BARRIER]
          </span>
          <span class="text-purple-300 font-mono text-[11px]">LanceDB HNSW</span>
        </div>
        <div class="text-2xl font-bold text-white font-mono">1,536-dim</div>
        <p class="text-xs text-slate-400 mt-1">Cosine latency bound: 1.42ms. Graph depth: 64 hops.</p>
      </div>
    </div>

    <!-- Interactive Vault Storage Tabs -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div class="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-3 gap-2">
        <button onclick="switchTab('ledger')" id="tab-btn-ledger" class="px-4 py-2 text-xs font-semibold rounded-t-lg bg-slate-900 border-t border-x border-slate-800 text-cyan-400">
          SHA-256 Audit Ledger
        </button>
        <button onclick="switchTab('sqlite')" id="tab-btn-sqlite" class="px-4 py-2 text-xs font-semibold rounded-t-lg text-slate-400 hover:text-slate-200">
          SQLite (WAL + FTS5)
        </button>
        <button onclick="switchTab('vector')" id="tab-btn-vector" class="px-4 py-2 text-xs font-semibold rounded-t-lg text-slate-400 hover:text-slate-200">
          LanceDB Vector Query
        </button>
      </div>

      <!-- Tab 1: Audit Ledger -->
      <div id="tab-ledger" class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs text-slate-400">Tamper-evident cryptographically chained transaction records</div>
          <div class="flex items-center gap-2">
            <button onclick="addAuditRow()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded border border-slate-700">
              + Commit Transaction
            </button>
            <button onclick="tamperLedger()" class="px-3 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs rounded border border-rose-800">
              Simulate Fault
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400">
                <th class="py-2 px-3">Idx</th>
                <th class="py-2 px-3">Action</th>
                <th class="py-2 px-3">Entity</th>
                <th class="py-2 px-3">SHA-256 Hash</th>
                <th class="py-2 px-3">Prev Hash</th>
                <th class="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody id="ledger-body" class="divide-y divide-slate-800/60">
              <tr class="hover:bg-slate-800/30">
                <td class="py-2 px-3 text-cyan-400">0</td>
                <td class="py-2 px-3 text-slate-300 font-bold">PIPELINE_INIT</td>
                <td class="py-2 px-3 text-slate-400">root-sub</td>
                <td class="py-2 px-3 text-slate-400 truncate max-w-[140px]">8f43a9b2...0c1</td>
                <td class="py-2 px-3 text-slate-500 font-mono">00000000...000</td>
                <td class="py-2 px-3 text-emerald-400 font-semibold">VALID</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2 px-3 text-cyan-400">1</td>
                <td class="py-2 px-3 text-slate-300 font-bold">WAL_FLUSH</td>
                <td class="py-2 px-3 text-slate-400">dbRO-sync</td>
                <td class="py-2 px-3 text-slate-400 truncate max-w-[140px]">3c9902ae...78d</td>
                <td class="py-2 px-3 text-slate-500 font-mono">8f43a9b2...0c1</td>
                <td class="py-2 px-3 text-emerald-400 font-semibold">VALID</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: SQLite Console -->
      <div id="tab-sqlite" class="p-4 space-y-3 hidden">
        <div class="flex items-center gap-2">
          <input id="sql-input" type="text" value="SELECT * FROM pipeline_hooks WHERE active = 1 ORDER BY priority DESC;" class="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500" />
          <button onclick="runSql()" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold rounded text-white">Execute SQL</button>
        </div>
        <div id="sql-output" class="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre">
[SQLite WAL Result - 3 rows returned in 0.8ms]
id  | hook_name             | barrier_type   | status    | mtu_bytes
----+-----------------------+----------------+-----------+----------
101 | ingress_barrier_guard | SECURITY_GATE  | ACTIVE    | 1232
102 | wal_commit_scheduler  | MEMORY_BARRIER | VERIFIED  | 4096
103 | lance_hnsw_indexer    | VECTOR_BARRIER | OPERATING | 1536</div>
      </div>

      <!-- Tab 3: Vector Index -->
      <div id="tab-vector" class="p-4 space-y-3 hidden">
        <div class="text-xs text-slate-400">Perform nearest-neighbor semantic search across LiquidOS LanceDB vector store:</div>
        <div class="flex items-center gap-2">
          <input id="vec-query" type="text" value="pi pipeline kernel credentials bypass" class="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200" />
          <button onclick="runVectorQuery()" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-xs font-semibold rounded text-white">Cosine Query</button>
        </div>
        <div id="vec-results" class="space-y-2 pt-2">
          <div class="p-3 bg-slate-950/70 border border-purple-900/40 rounded-lg flex items-center justify-between">
            <div>
              <div class="text-xs font-semibold text-purple-300">security_enclave_tee.c · Line 84</div>
              <div class="text-[11px] text-slate-400">Hook Execution & Rerouting Engine AST Allow-list Check</div>
            </div>
            <div class="text-xs font-mono font-bold text-emerald-400">Score: 0.964</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentStep = 4;
    let ledgerCount = 2;

    function injectPacket() {
      currentStep = 0;
      updateStepper();
      
      const interval = setInterval(() => {
        currentStep++;
        updateStepper();
        if (currentStep >= 4) {
          clearInterval(interval);
          addAuditRow('PACKET_INGRESS', 'barrier_net', 'Packet ' + Math.floor(Math.random() * 9000 + 1000) + ' processed');
        }
      }, 350);
    }

    function updateStepper() {
      const stepNames = ['1. PREPARED', '2. SIGNED', '3. PERSISTED', '4. READ', '5. CONFIRMED'];
      for (let i = 0; i < 5; i++) {
        const el = document.getElementById('step-' + i);
        if (i < currentStep) {
          el.className = 'p-2.5 rounded-lg border border-cyan-800/80 bg-cyan-950/30 text-cyan-400 font-semibold transition-all';
        } else if (i === currentStep) {
          el.className = 'p-2.5 rounded-lg border border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold transition-all shadow-md';
        } else {
          el.className = 'p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-600 font-medium transition-all';
        }
      }
      document.getElementById('state-label').textContent = 'STATE ' + (currentStep + 1) + '/5: ' + stepNames[currentStep];
    }

    function switchTab(tab) {
      ['ledger', 'sqlite', 'vector'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
        document.getElementById('tab-btn-' + t).className = 'px-4 py-2 text-xs font-semibold rounded-t-lg text-slate-400 hover:text-slate-200';
      });
      document.getElementById('tab-' + tab).classList.remove('hidden');
      document.getElementById('tab-btn-' + tab).className = 'px-4 py-2 text-xs font-semibold rounded-t-lg bg-slate-900 border-t border-x border-slate-800 text-cyan-400';
    }

    function addAuditRow(action = 'TRANSACTION_COMMIT', entity = 'vault_core', info = 'Committed to SQLite WAL') {
      const tbody = document.getElementById('ledger-body');
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/30 transition-all';
      const fakeHash = Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 5);
      const prevHash = '8f43a9b2...0c1';
      tr.innerHTML = \`
        <td class="py-2 px-3 text-cyan-400">\${ledgerCount++}</td>
        <td class="py-2 px-3 text-slate-200 font-bold">\${action}</td>
        <td class="py-2 px-3 text-slate-400">\${entity}</td>
        <td class="py-2 px-3 text-slate-400 truncate max-w-[140px] font-mono">\${fakeHash}</td>
        <td class="py-2 px-3 text-slate-500 font-mono">\${prevHash}</td>
        <td class="py-2 px-3 text-emerald-400 font-semibold">VALID</td>
      \`;
      tbody.prepend(tr);
    }

    function tamperLedger() {
      const step = document.getElementById('step-4');
      step.className = 'p-2.5 rounded-lg border border-rose-500 bg-rose-950/60 text-rose-300 font-bold';
      step.textContent = 'FAULT: ROLLBACK';
      document.getElementById('state-label').textContent = 'FAULT DETECTED: ROLLBACK_TO_SOURCE';
      document.getElementById('state-label').className = 'text-xs font-mono font-bold text-rose-400';
      setTimeout(() => {
        alert('Security Enclave TEE detected tamper alteration on SHA-256 Audit Ledger. Triggered automatic ROLLBACK_TO_SOURCE as specified in Pi Pipeline Architecture.');
        updateStepper();
      }, 200);
    }

    function runSql() {
      const q = document.getElementById('sql-input').value;
      document.getElementById('sql-output').textContent = '[Executed: ' + q + ']\\n✓ Query dispatched to DuckDB / SQLite WAL replica. Elapsed: 0.42ms\\nRows affected: 12. Memory MTU framing: COMPLIANT.';
    }

    function runVectorQuery() {
      const q = document.getElementById('vec-query').value;
      const res = document.getElementById('vec-results');
      res.innerHTML = \`
        <div class="p-3 bg-slate-950/70 border border-purple-900/40 rounded-lg flex items-center justify-between">
          <div>
            <div class="text-xs font-semibold text-purple-300">pi_pipeline_hook_router.ts · AST Allow-list Check</div>
            <div class="text-[11px] text-slate-400">Query matched "\${q}" against LanceDB 1536-dim embeddings.</div>
          </div>
          <div class="text-xs font-mono font-bold text-emerald-400">Score: 0.982</div>
        </div>
      \`;
    }
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'apollo-hyperparameters',
    name: 'Apollo Hyperparameter Studio',
    badge: 'Settings · IMG 2',
    description: 'Interactive inference playground with Temperature, Top P, Seed, Max Output, Sampling Min P & Repetition Penalty.',
    icon: '⚙️',
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        lastModified: Date.now(),
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apollo Advanced Model Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-black text-slate-100 min-h-screen flex items-center justify-center p-4 font-sans">
  <!-- Apollo Modal Container (Matching Screenshot IMG 2) -->
  <div class="w-full max-w-lg bg-zinc-900/95 border border-zinc-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
    <div class="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
      <div class="flex items-center gap-2">
        <button class="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300">‹</button>
        <h2 class="text-lg font-bold text-white">Advanced</h2>
      </div>
      <button onclick="resetDefaults()" class="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300" title="Reset defaults">↺</button>
    </div>

    <div class="space-y-5">
      <!-- Temperature -->
      <div>
        <div class="flex items-center justify-between text-sm mb-1.5">
          <span class="text-zinc-200 font-medium">Temperature</span>
          <div class="flex items-center gap-2">
            <span id="temp-val" class="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs">0.70</span>
            <input type="checkbox" checked class="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
          </div>
        </div>
        <input id="temp-slider" type="range" min="0" max="2" step="0.05" value="0.70" oninput="updateParam('temp', this.value)" class="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white" />
      </div>

      <!-- Top P -->
      <div>
        <div class="flex items-center justify-between text-sm mb-1.5">
          <span class="text-zinc-200 font-medium">Top P</span>
          <div class="flex items-center gap-2">
            <span id="topp-val" class="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs">0.90</span>
            <input type="checkbox" checked class="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
          </div>
        </div>
        <input id="topp-slider" type="range" min="0" max="1" step="0.05" value="0.90" oninput="updateParam('topp', this.value)" class="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white" />
      </div>

      <!-- Seed -->
      <div>
        <div class="flex items-center justify-between text-sm mb-1.5">
          <span class="text-zinc-200 font-medium">Seed</span>
          <div class="flex items-center gap-2">
            <input id="seed-val" type="number" value="198662" class="w-20 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs text-right border-none focus:outline-none" />
            <input type="checkbox" checked class="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
          </div>
        </div>
      </div>

      <!-- Maximum Output -->
      <div>
        <div class="flex items-center justify-between text-sm mb-1.5">
          <span class="text-zinc-200 font-medium">Maximum output</span>
          <div class="flex items-center gap-2">
            <span id="max-val" class="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs">2048</span>
            <input type="checkbox" checked class="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
          </div>
        </div>
        <input id="max-slider" type="range" min="256" max="8192" step="256" value="2048" oninput="updateParam('max', this.value)" class="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white" />
      </div>

      <!-- Sampling Section -->
      <div class="pt-2 border-t border-zinc-800">
        <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Sampling</h3>

        <!-- Min P -->
        <div class="mb-5">
          <div class="flex items-center justify-between text-sm mb-1.5">
            <span class="text-zinc-200 font-medium">Min P</span>
            <div class="flex items-center gap-2">
              <span id="minp-val" class="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs">0.05</span>
              <input type="checkbox" checked class="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
            </div>
          </div>
          <input id="minp-slider" type="range" min="0" max="0.5" step="0.01" value="0.05" oninput="updateParam('minp', this.value)" class="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white" />
        </div>

        <!-- Repetition Penalty -->
        <div>
          <div class="flex items-center justify-between text-sm mb-1.5">
            <span class="text-zinc-200 font-medium">Repetition penalty</span>
            <div class="flex items-center gap-2">
              <span id="rep-val" class="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs">1.10</span>
              <input type="checkbox" checked class="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
            </div>
          </div>
          <input id="rep-slider" type="range" min="1" max="2" step="0.05" value="1.10" oninput="updateParam('rep', this.value)" class="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white" />
        </div>
      </div>
    </div>

    <!-- Live Test Prompt Output -->
    <div class="mt-6 pt-4 border-t border-zinc-800">
      <button onclick="simulateGenerate()" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-lg">
        <span>✨</span> Test Sampling Pipeline
      </button>
      <div id="test-output" class="mt-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400 min-h-[60px]">
        Config ready: Temperature 0.70 · Top P 0.90 · Min P 0.05 · Seed 198662
      </div>
    </div>
  </div>

  <script>
    function updateParam(param, val) {
      document.getElementById(param + '-val').textContent = parseFloat(val).toFixed(2);
    }
    function resetDefaults() {
      document.getElementById('temp-slider').value = 0.70;
      document.getElementById('temp-val').textContent = '0.70';
      document.getElementById('topp-slider').value = 0.90;
      document.getElementById('topp-val').textContent = '0.90';
      document.getElementById('max-slider').value = 2048;
      document.getElementById('max-val').textContent = '2048';
      document.getElementById('minp-slider').value = 0.05;
      document.getElementById('minp-val').textContent = '0.05';
      document.getElementById('rep-slider').value = 1.10;
      document.getElementById('rep-val').textContent = '1.10';
      document.getElementById('test-output').textContent = 'Reset to factory Apollo hyperparameter baseline.';
    }
    function simulateGenerate() {
      const out = document.getElementById('test-output');
      out.textContent = 'Simulating inference pass...';
      setTimeout(() => {
        out.innerHTML = '<span class="text-emerald-400">✓ Token Stream [284 tokens generated at 48.2 tok/s]:</span><br/>"Through temperature 0.70 and Min P 0.05 gating, tail hallucinations are pruned while preserving creative lexical variety."';
      }, 400);
    }
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'agents-toolkit',
    name: "The Agent's Toolkit & Loop Runner",
    badge: 'Agent Patterns · IMG 3',
    description: 'Tool-Calling, ReAct loop, RAG document retriever, MCP protocol plug, Multi-Agent handoff, and Computer Use virtual pointer.',
    icon: '🛠️',
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        lastModified: Date.now(),
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Agent's Toolkit</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-slate-100 min-h-screen p-4 md:p-8 font-sans">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <button class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">‹</button>
      <h1 class="text-xl font-bold text-white">The Agent's Toolkit</h1>
    </div>

    <p class="text-xs text-zinc-400 uppercase tracking-wider mb-4 font-semibold">Agent patterns — how agents are built</p>

    <!-- Cards List Matching Screenshot IMG 3 -->
    <div class="space-y-3">
      <!-- 1. Tool-Calling -->
      <div onclick="inspectPattern('tool_calling')" class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-start gap-4">
        <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg shrink-0">🛠️</div>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">Tool-Calling</div>
          <p class="text-xs text-zinc-400 mt-0.5">The model asks your code to do something and gives back the result.</p>
          <p class="text-[11px] text-zinc-500 italic mt-1">Our Writer calls a real syllable-counting tool.</p>
        </div>
        <span class="text-zinc-600 text-lg">›</span>
      </div>

      <!-- 2. ReAct -->
      <div onclick="inspectPattern('react')" class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-start gap-4">
        <div class="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-lg shrink-0">🔄</div>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">ReAct</div>
          <p class="text-xs text-zinc-400 mt-0.5">The pattern of reason → act → observe → repeat.</p>
          <p class="text-[11px] text-zinc-500 italic mt-1">This is Loop #1 — the engine inside one agent.</p>
        </div>
        <span class="text-zinc-600 text-lg">›</span>
      </div>

      <!-- 3. RAG -->
      <div onclick="inspectPattern('rag')" class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-start gap-4">
        <div class="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-lg shrink-0">🔍</div>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">RAG</div>
          <p class="text-xs text-zinc-400 mt-0.5">Fetch relevant documents first, paste them into the prompt.</p>
          <p class="text-[11px] text-zinc-500 italic mt-1">Not in our loop demo — shown here on its own.</p>
        </div>
        <span class="text-zinc-600 text-lg">›</span>
      </div>

      <!-- 4. MCP -->
      <div onclick="inspectPattern('mcp')" class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-start gap-4">
        <div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg shrink-0">🔌</div>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">MCP</div>
          <p class="text-xs text-zinc-400 mt-0.5">A universal plug so any tool connects to any AI.</p>
          <p class="text-[11px] text-zinc-500 italic mt-1">The plug standard many AI apps use to reach tools.</p>
        </div>
        <span class="text-zinc-600 text-lg">›</span>
      </div>

      <!-- 5. Multi-Agent -->
      <div onclick="inspectPattern('multi_agent')" class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-start gap-4">
        <div class="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center text-lg shrink-0">👥</div>
        <div class="flex-1">
          <div class="text-sm font-bold text-white">Multi-Agent</div>
          <p class="text-xs text-zinc-400 mt-0.5">Several role-specialized agents cooperating.</p>
          <p class="text-[11px] text-zinc-500 italic mt-1">This IS our demo — Writer + Reviewer.</p>
        </div>
        <span class="text-zinc-600 text-lg">›</span>
      </div>

      <!-- 6. A2A -->
      <div onclick="inspectPattern('a2a')" class="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-start gap-4">
        <div class="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-lg shrink-0">🧬</div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-white">A2A</span>
            <span class="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[10px] rounded font-bold">NEW</span>
          </div>
          <p class="text-xs text-zinc-400 mt-0.5">A shared language so agents from different makers can hand off work.</p>
        </div>
        <span class="text-zinc-600 text-lg">›</span>
      </div>
    </div>

    <!-- Interactive Execution Modal -->
    <div id="inspector" class="hidden mt-6 p-4 rounded-2xl bg-zinc-900 border border-cyan-800/60 shadow-2xl">
      <div class="flex items-center justify-between pb-2 border-b border-zinc-800">
        <h3 id="insp-title" class="text-sm font-bold text-cyan-400">ReAct Loop Interactive Stepper</h3>
        <button onclick="closeInspector()" class="text-xs text-zinc-500 hover:text-zinc-300">✕ Close</button>
      </div>
      <div id="insp-body" class="mt-3 text-xs font-mono text-zinc-300 space-y-2">
        <!-- populated dynamically -->
      </div>
    </div>
  </div>

  <script>
    function inspectPattern(type) {
      const modal = document.getElementById('inspector');
      const title = document.getElementById('insp-title');
      const body = document.getElementById('insp-body');
      modal.classList.remove('hidden');

      if (type === 'react') {
        title.textContent = '🔄 ReAct Engine Live Stepper';
        body.innerHTML = \`
          <div class="p-2.5 rounded bg-zinc-950 border border-zinc-800"><span class="text-cyan-400">1. REASON:</span> "User requested app generation for LiquidOS Mercury Vault."</div>
          <div class="p-2.5 rounded bg-zinc-950 border border-zinc-800"><span class="text-amber-400">2. ACT:</span> Calling execute_code(generate_schema)</div>
          <div class="p-2.5 rounded bg-zinc-950 border border-zinc-800"><span class="text-emerald-400">3. OBSERVE:</span> Table created with 5 state transitions verified.</div>
          <div class="p-2.5 rounded bg-zinc-950 border border-zinc-800"><span class="text-purple-400">4. REPEAT:</span> Synthesis loop converged in 1 iteration.</div>
        \`;
      } else {
        title.textContent = '🛠️ Pattern Inspector: ' + type.toUpperCase();
        body.innerHTML = '<div class="p-3 bg-zinc-950 rounded text-zinc-400">Simulating live interactive execution of ' + type + ' across Codex microservices.</div>';
      }
    }
    function closeInspector() {
      document.getElementById('inspector').classList.add('hidden');
    }
  </script>
</body>
</html>`,
      },
    ],
  },
];
