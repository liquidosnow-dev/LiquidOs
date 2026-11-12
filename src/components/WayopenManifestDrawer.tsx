import React, { useState } from 'react';
import {
  FileCode2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  Database,
  Layers,
  Copy,
  Check,
  FileCheck,
  Lock,
  X
} from 'lucide-react';
import { HandoffStage, WayopenManifestV11 } from '../types/architecture';
import { advanceHandoffStage, createWayopenManifestV11, executeRollbackToSource } from '../utils/liquidArchitectureEngine';

interface WayopenManifestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WayopenManifestDrawer: React.FC<WayopenManifestDrawerProps> = ({ isOpen, onClose }) => {
  const [currentStage, setCurrentStage] = useState<HandoffStage>('PREPARED');
  const [signatureValid, setSignatureValid] = useState(true);
  const [readVerifiedByTarget, setReadVerifiedByTarget] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [rollbackResult, setRollbackResult] = useState<{
    discardedStagingFiles: string[];
    intactPrimaryTables: string[];
  } | null>(null);

  const [manifest, setManifest] = useState<WayopenManifestV11>(() =>
    createWayopenManifestV11({
      artifactIdentifier: 'liquid-mercury-vault-core-v4.2',
      claimant: 'Architect-Agent#4 (SO_PEERCRED verified)',
      method: 'Zero-copy Pi hook verification via WAL SQLite FTS5',
      observedResult: 'State 5/5 reached; DuckDB OLAP zero-copy sync active',
      evidenceLocation: 'enclave://liquid/evidence/claim_94.dat',
      reviewer: 'SecurityEnclaveAuditor#1',
      limitations: 'Constrained to ~2.8GB iPad peak RAM envelope',
    })
  );

  if (!isOpen) return null;

  const STAGES: { stage: HandoffStage; label: string; desc: string }[] = [
    { stage: 'PREPARED', label: '1. PREPARED', desc: 'Query compiled & staged' },
    { stage: 'SIGNED', label: '2. SIGNED', desc: 'Ed25519 single-width gate signed' },
    { stage: 'PERSISTED', label: '3. PERSISTED', desc: 'Written to WAL SQLite & DuckDB' },
    { stage: 'READ', label: '4. READ', desc: 'Target actor inspects payload' },
    { stage: 'CONFIRMED', label: '5. CONFIRMED', desc: 'Explicitly verified state locked' },
  ];

  const handleAdvance = () => {
    setErrorMessage(null);
    setRollbackResult(null);

    const result = advanceHandoffStage(currentStage, signatureValid, readVerifiedByTarget);
    if (result.error) {
      setErrorMessage(result.error);
      setCurrentStage(result.nextStage);
    } else {
      setCurrentStage(result.nextStage);
    }
  };

  const handleReset = () => {
    setCurrentStage('PREPARED');
    setErrorMessage(null);
    setRollbackResult(null);
  };

  const handleTriggerRollback = () => {
    const res = executeRollbackToSource(
      ['staging/handoff_claim_01.tmp', 'staging/wal_pending.diff', 'staging/mcp_checkpoint_staged.bin'],
      ['sqlite_mercury_wal (FTS5)', 'duckdb_olap_columnar', 'lancedb_hnsw_idx', 'sha256_audit_ledger']
    );
    setRollbackResult({
      discardedStagingFiles: res.discardedStagingFiles,
      intactPrimaryTables: res.intactPrimaryTables,
    });
    setCurrentStage('ROLLED_BACK');
  };

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Handoff State Machine & Wayopen Claim Ledger</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  MANIFEST.json v1.1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Five-Stage Lifecycle (PREPARED ➔ SIGNED ➔ PERSISTED ➔ READ ➔ CONFIRMED) & ROLLBACK_TO_SOURCE Isolation
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 5-Stage Stepper Bar */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-300">Container State Transition Pipeline</span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                currentStage === 'CONFIRMED'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                  : currentStage === 'RECOVERY_PENDING' || currentStage === 'ROLLED_BACK'
                  ? 'bg-rose-950 text-rose-400 border border-rose-700'
                  : 'bg-cyan-950 text-cyan-400 border border-cyan-700'
              }`}>
                CURRENT: {currentStage}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {STAGES.map((s, idx) => {
                const isPassed = STAGES.findIndex(item => item.stage === currentStage) >= idx;
                const isCurrent = currentStage === s.stage;

                return (
                  <div
                    key={s.stage}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      isCurrent
                        ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 ring-2 ring-cyan-500/50'
                        : isPassed
                        ? 'border-emerald-600/50 bg-emerald-950/20 text-emerald-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-500'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{s.label}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{s.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Stage Controls */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={signatureValid}
                    onChange={(e) => setSignatureValid(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Ed25519 Signature Valid</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={readVerifiedByTarget}
                    onChange={(e) => setReadVerifiedByTarget(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Target Actor Read Verification (Required for CONFIRMED)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  onClick={handleAdvance}
                  disabled={currentStage === 'CONFIRMED' || currentStage === 'ROLLED_BACK'}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  Advance Stage
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleTriggerRollback}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Trigger ROLLBACK_TO_SOURCE
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage} (Transition halted to RECOVERY_PENDING).</span>
              </div>
            )}

            {/* Rollback Details Banner */}
            {rollbackResult && (
              <div className="mt-3 p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/50 text-xs space-y-2">
                <div className="flex items-center justify-between text-amber-300 font-bold">
                  <span>✓ Targeted Fault Recovery: ROLLBACK_TO_SOURCE Executed</span>
                  <span className="font-mono text-[10px]">Strict Staging File Discard</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="p-2 rounded bg-black/40 border border-rose-800/40">
                    <div className="text-rose-400 font-bold mb-1">Discarded Handoff Staging Files:</div>
                    {rollbackResult.discardedStagingFiles.map((f, i) => (
                      <div key={i} className="text-slate-300 truncate">✗ {f}</div>
                    ))}
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-emerald-800/40">
                    <div className="text-emerald-400 font-bold mb-1">Untouched Primary Database Tables:</div>
                    {rollbackResult.intactPrimaryTables.map((t, i) => (
                      <div key={i} className="text-slate-300 truncate">✓ {t}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Wayopen Claim Ledger: 10 Mandatory Fields */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Wayopen Claim Ledger (MANIFEST.json v1.1 — 10 Mandatory Fields)
                </span>
              </div>
              <button
                onClick={handleCopyManifest}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied JSON' : 'Copy Manifest'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: '1. claim_id', val: manifest.claim_id },
                { label: '2. artifact_identifier', val: manifest.artifact_identifier },
                { label: '3. sha256', val: manifest.sha256 },
                { label: '4. size_bytes', val: `${manifest.size_bytes} bytes` },
                { label: '5. claimant', val: manifest.claimant },
                { label: '6. method', val: manifest.method },
                { label: '7. observed_result', val: manifest.observed_result },
                { label: '8. evidence_location', val: manifest.evidence_location },
                { label: '9. reviewer', val: manifest.reviewer },
                { label: '10. limitations', val: manifest.limitations },
              ].map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[10px] font-mono text-cyan-400">{item.label}</div>
                  <div className="text-xs font-mono text-slate-200 truncate mt-0.5">{item.val}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500">
          <span>Row-Level Claim Ledger v1.1 · Tamper-Evident SHA-256 Checkpoints</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Close Drawer
          </button>
        </div>

      </div>
    </div>
  );
};
