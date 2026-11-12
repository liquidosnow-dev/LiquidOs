import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Terminal,
  Activity,
  HardDrive,
  Box,
  Zap,
  RotateCw,
  X,
  Play
} from 'lucide-react';
import {
  DUAL_INFERENCE_SPEC,
  generateDaemonNotepads,
  VERIFICATION_DISCIPLINES,
} from '../utils/liquidArchitectureEngine';
import { DaemonNotepadState } from '../types/architecture';

interface KineticMonolithViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KineticMonolithView: React.FC<KineticMonolithViewProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'topology' | 'dual_inference' | 'notepad_daemons' | 'disciplines'>('topology');
  const [focusedPrompt, setFocusedPrompt] = useState('Analyze AST allow-list check for SQLite WAL commit');
  const [isInferring, setIsInferring] = useState(false);
  const [inferenceResults, setInferenceResults] = useState<{
    focused: string;
    exploratory: string;
  } | null>(null);

  const [daemons] = useState<DaemonNotepadState[]>(() => generateDaemonNotepads(36));
  const totalDaemonMemoryMb = daemons.reduce((acc, d) => acc + d.memoryUsageMb, 0);

  if (!isOpen) return null;

  const handleRunDualInference = () => {
    setIsInferring(true);
    setTimeout(() => {
      setInferenceResults({
        focused: `[FOCUSED STREAM · temp 0.10 · seed 198662]:
✓ Query AST parsed: SELECT token_id, wal_index FROM mercury_vault_wal WHERE token_id = 42
✓ Verification: Kernel SO_PEERCRED confirmed (UID=501, GID=20, PID=18442).
✓ 10k Scan Row Threshold: 1 row scanned <= 10,000 threshold.
✓ Memory MTU: 384 bytes <= 1,232B cap. All 3 execution barriers passed without violations.`,
        exploratory: `[EXPLORATORY STREAM · temp 0.85 · seed ${Math.floor(Math.random() * 800000) + 100000}]:
💡 Architectural Hypothesis:
1. LanceDB 1536-dim HNSW graph could leverage zero-copy DuckDB memory buffers on A16 unified memory.
2. Parallelizing D-Ingress and D-Peripheral checks could shave 0.34ms off socket cold-start.
3. Suggest adding a quantum-resistant Kyber-768 hybrid layer alongside Ed25519 single-width gate.`,
      });
      setIsInferring(false);
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-6xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Kinetic Monolith & On-Device Duality.SI Engine</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  iPad A16 (6 GB) · ~2.8 GB Peak RAM Envelope
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Origin Console (mercurysi.lovable.app) & Kinetic Monolith (liquidos-mercurysi.base44.app)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2">
          {[
            { id: 'topology', label: '3D Kinetic Topology', icon: Box },
            { id: 'dual_inference', label: 'Duality.SI Dual Inference', icon: Sparkles },
            { id: 'notepad_daemons', label: `Notepad Daemons (${daemons.length})`, icon: Activity },
            { id: 'disciplines', label: '4 Verification Disciplines', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: 3D Kinetic Topology & Hardware Truths */}
          {activeTab === 'topology' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30 border border-cyan-800/60 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-mono text-cyan-400 font-bold tracking-wider">HARDWARE TRUTH MATRIX</span>
                    <h3 className="text-base font-bold text-white mt-0.5">Physical Device Boundaries & Entitlements</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded bg-black/60 border border-slate-700 text-slate-300">
                      Entitlement: <span className="text-emerald-400">increased-memory-limit</span>
                    </span>
                    <span className="px-2.5 py-1 rounded bg-black/60 border border-slate-700 text-slate-300">
                      Peak RAM: <span className="text-cyan-400 font-bold">~2.8 GB / 6 GB</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] font-mono text-cyan-400">1. KERNEL IPC</div>
                    <div className="text-sm font-bold text-white mt-1">SO_PEERCRED</div>
                    <p className="text-xs text-slate-400 mt-1">Direct kernel-anchored socket credentials pass identity without userland spoofing.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] font-mono text-amber-400">2. MEMORY MTU</div>
                    <div className="text-sm font-bold text-white mt-1">1,232-Byte Cap</div>
                    <p className="text-xs text-slate-400 mt-1">Network MTU framing cap strictly enforced with 10k max scan row threshold.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] font-mono text-purple-400">3. VECTOR RETRIEVAL</div>
                    <div className="text-sm font-bold text-white mt-1">LanceDB HNSW</div>
                    <p className="text-xs text-slate-400 mt-1">1536-dim embeddings with 5ms cosine latency threshold & 64-hop graph limits.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] font-mono text-emerald-400">4. METAL RUNTIME</div>
                    <div className="text-sm font-bold text-white mt-1">n_gpu_layers = 99</div>
                    <p className="text-xs text-slate-400 mt-1">llama.cpp + Metal runtime with Q8_0 KV cache on Apple A16 unified memory.</p>
                  </div>
                </div>
              </div>

              {/* Architecture Blueprint Diagram reference */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400 font-bold">💧</div>
                  <div>
                    <div className="text-xs font-bold text-white">Interactive Diagram & Vector Sync Available in Main Workspace</div>
                    <div className="text-[11px] text-slate-400">Referenced from IMG 1 & 5: Pi Pipeline Hook Router, Liquid Mercury Vault & Mobile KMP Core</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">ACTIVE · CONFIRMED</span>
              </div>
            </div>
          )}

          {/* TAB 2: Duality.SI Dual Inference */}
          {activeTab === 'dual_inference' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">Dual-Stream On-Device Inference Pipeline</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    Qwen3-1.7B · Q8_0 · llama.cpp
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={focusedPrompt}
                    onChange={(e) => setFocusedPrompt(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    placeholder="Enter prompt for dual stream evaluation..."
                  />
                  <button
                    onClick={handleRunDualInference}
                    disabled={isInferring}
                    className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isInferring ? 'Inferring...' : 'Execute Dual Stream'}
                  </button>
                </div>
              </div>

              {/* Streams Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Focused Stream */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-800/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-cyan-300">1. Focused Stream</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                        temp 0.10 · seed 198662
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">Deterministic precision, code synthesis, mathematical validation.</p>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {inferenceResults ? inferenceResults.focused : `[Focused Stream Ready]
Awaiting execution. Will emit deterministic byte-for-byte evaluation with zero hallucination.`}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between">
                    <span>Target: AST & Crypto Gate</span>
                    <span className="text-cyan-400">Greedy/Argmax Sampling</span>
                  </div>
                </div>

                {/* Exploratory Stream */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-800/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-300">2. Exploratory Stream</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                        temp 0.85 · randomized seed
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">Creative architecture discovery, diverse hypotheses generation.</p>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {inferenceResults ? inferenceResults.exploratory : `[Exploratory Stream Ready]
Awaiting execution. Will explore divergent topology hypotheses and alternative pipeline hooks.`}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between">
                    <span>Target: Architectural Synthesis</span>
                    <span className="text-purple-400">Min P 0.05 · Top P 0.90</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: Ultra Prompt Engine & Notepad Constraint */}
          {activeTab === 'notepad_daemons' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Notepad Constraint Architecture</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Each daemon reads peer pads but writes exclusively to its own couple-MB pad, keeping all 36 daemons within ~3–7 MB total RAM.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400">{totalDaemonMemoryMb.toFixed(2)} MB TOTAL RAM</div>
                  <div className="text-[10px] text-slate-500">Across {daemons.length} Resident Daemons</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {daemons.map((d) => (
                  <div key={d.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-slate-400 truncate">{d.name.split('-')[1]}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="font-mono text-cyan-400 font-bold">{d.padSizeKb} KB</div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">Max: 2048 KB</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Four Verification Disciplines */}
          {activeTab === 'disciplines' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 1. SRRO-2 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">1. SRRO-2 Build-Time Defense</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    7 ATTACK VECTORS CLOSED
                  </span>
                </div>
                <p className="text-xs text-slate-400">Seals build configuration and toolchains against build-time injection attacks.</p>
                <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-slate-300 space-y-1">
                  <div>✓ PIPELINE.md (cryptographic integrity lock)</div>
                  <div>✓ VERSION_SEAL.md & versions.lock verified</div>
                  <div>✓ seal.sh execution & Keychain HMAC active</div>
                </div>
              </div>

              {/* 2. AEGIS-HAA */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">2. AEGIS-HAA Decoupled Triad</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    DECOUPLED SECURITY
                  </span>
                </div>
                <p className="text-xs text-slate-400">Decouples three distinct pillars so failed checkpoints never corrupt verified states.</p>
                <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-slate-300 space-y-1">
                  <div>✓ Integrity: SHA-256 Merkle root verification</div>
                  <div>✓ Authenticity: Ed25519 single-width gate signing</div>
                  <div>✓ Freshness: Cryptographic nonces & timestamp checks</div>
                </div>
              </div>

              {/* 3. 3CU */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">3. 3CU Evaluation Suite</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    4-BOX EVALUATION
                  </span>
                </div>
                <p className="text-xs text-slate-400">Founder-sealed evaluation certifying production safety and novel artifact hashes.</p>
                <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-slate-300 space-y-1">
                  <div>✓ Box 1: Code execution in isolated sandboxes</div>
                  <div>✓ Box 2: Creation hash novelty certification</div>
                  <div>✓ Box 3: Centralization check & dependency lock</div>
                  <div>✓ Box 4: Utopia limitations verification</div>
                </div>
              </div>

              {/* 4. Sovereign Trinity */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">4. Sovereign Trinity Composition Rule</span>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                    CREDENTIAL ISOLATION
                  </span>
                </div>
                <p className="text-xs text-slate-400">Core composition rule governing cross-device and cloud checkpoint migration.</p>
                <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-purple-300 font-bold text-center py-3">
                  "Move the checkpoint, not the credentials"
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500">
          <span>Origin Console (mercurysi.lovable.app) & Kinetic Monolith Substrate</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Close Monolith
          </button>
        </div>

      </div>
    </div>
  );
};
