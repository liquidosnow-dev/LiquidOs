import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Key,
  Clock,
  Activity,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  FileCheck2,
  Cpu,
  X
} from 'lucide-react';
import { IOS_ENTRY_POINTS, evaluateIngressShield, executeSingleWidthGate } from '../utils/liquidArchitectureEngine';
import { EntryPointDefinition, IngressEvaluationResult, SingleWidthGateSignature } from '../types/architecture';

interface IngressShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IngressShieldModal: React.FC<IngressShieldModalProps> = ({ isOpen, onClose }) => {
  const [selectedDaemon, setSelectedDaemon] = useState<'ALL' | 'D-Ingress' | 'D-Peripheral' | 'D-Extension' | 'D-System'>('ALL');
  const [activeEntryPoint, setActiveEntryPoint] = useState<EntryPointDefinition>(IOS_ENTRY_POINTS[0]);
  const [isUserInitiated, setIsUserInitiated] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [evalResult, setEvalResult] = useState<IngressEvaluationResult | null>(null);
  const [lastSignature, setLastSignature] = useState<SingleWidthGateSignature | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  if (!isOpen) return null;

  const filteredEntryPoints = selectedDaemon === 'ALL'
    ? IOS_ENTRY_POINTS
    : IOS_ENTRY_POINTS.filter(ep => ep.daemon === selectedDaemon);

  const handleTestEvaluation = (ep: EntryPointDefinition) => {
    setActiveEntryPoint(ep);
    const result = evaluateIngressShield(ep.id, isUserInitiated, hasActiveSession);
    setEvalResult(result);
  };

  const handleExecuteGateSign = () => {
    setIsSigning(true);
    setTimeout(() => {
      const sig = executeSingleWidthGate(
        `QUERY_EP_${activeEntryPoint.id}:AST_ALLOW_CHECK:KERNEL_ENCLAVE`,
        'ed25519_sk_user_root_5501'
      );
      setLastSignature(sig);
      setIsSigning(false);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Five-Ring Ingress Shield & Entry Point Security</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  39 ENTRY POINTS · 4 DAEMONS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Single-Width Authorization Gate (Width = 1, Ed25519 Signed) · Kernel SO_PEERCRED Protection
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
          
          {/* Standing Daemons Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              {
                id: 'D-Ingress',
                label: 'D-Ingress (#1–8)',
                policy: 'DROP by default',
                desc: 'App launches, URLs, push notifications & background tasks. User-initiated bypass only.',
                color: 'border-rose-500/40 bg-rose-950/20 text-rose-300',
              },
              {
                id: 'D-Peripheral',
                label: 'D-Peripheral (#9–13, #23–30)',
                policy: 'DROP by default',
                desc: 'Audio, location, Bluetooth, motion, screen, cameras. Active session required.',
                color: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
              },
              {
                id: 'D-Extension',
                label: 'D-Extension (#14–22)',
                policy: 'HOLD (30s Overlay)',
                desc: 'Share sheets, file pickers, widgets, clipboard. 30-second user approval countdown.',
                color: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
              },
              {
                id: 'D-System',
                label: 'D-System (#31–39)',
                policy: 'LOG_ONLY',
                desc: 'System memory, thermal pressure, focus modes, NFC, battery & lifecycle telemetry.',
                color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
              },
            ].map((daemon) => (
              <div
                key={daemon.id}
                onClick={() => setSelectedDaemon(daemon.id as any)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedDaemon === daemon.id
                    ? 'ring-2 ring-cyan-400 bg-slate-850'
                    : 'hover:border-slate-600 bg-slate-900/80'
                } ${daemon.color}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">{daemon.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                    {daemon.policy}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{daemon.desc}</p>
              </div>
            ))}
          </div>

          {/* Interactive Pipeline Testing Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: 39 Entry Points Selector */}
            <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[420px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-semibold text-slate-300">
                  Select Entry Point ({filteredEntryPoints.length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedDaemon('ALL')}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      selectedDaemon === 'ALL' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    All 39
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredEntryPoints.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => handleTestEvaluation(ep)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-start gap-2.5 ${
                      activeEntryPoint.id === ep.id
                        ? 'bg-cyan-950/70 border border-cyan-500/60 text-white'
                        : 'hover:bg-slate-900 border border-transparent text-slate-400'
                    }`}
                  >
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      #{ep.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-slate-200">{ep.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-cyan-400">{ep.daemon}</span>
                        <span>·</span>
                        <span>{ep.category}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Execution Evaluation & Single-Width Gate */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Context Controls */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Simulation Context Flags</span>
                  <span className="text-[10px] font-mono text-cyan-400">Target: #{activeEntryPoint.id} ({activeEntryPoint.name})</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={isUserInitiated}
                      onChange={(e) => {
                        setIsUserInitiated(e.target.checked);
                        const res = evaluateIngressShield(activeEntryPoint.id, e.target.checked, hasActiveSession);
                        setEvalResult(res);
                      }}
                      className="rounded accent-cyan-500"
                    />
                    <div>
                      <span className="font-medium text-white">isUserInitiated</span>
                      <p className="text-[10px] text-slate-400">Explicit direct touch / user gesture</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={hasActiveSession}
                      onChange={(e) => {
                        setHasActiveSession(e.target.checked);
                        const res = evaluateIngressShield(activeEntryPoint.id, isUserInitiated, e.target.checked);
                        setEvalResult(res);
                      }}
                      className="rounded accent-cyan-500"
                    />
                    <div>
                      <span className="font-medium text-white">hasActiveSession</span>
                      <p className="text-[10px] text-slate-400">Authenticated foreground peripheral pipe</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Evaluation Outcome Display */}
              {evalResult && (
                <div className={`p-4 rounded-xl border ${
                  evalResult.action === 'ALLOW'
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : evalResult.action === 'HOLD'
                    ? 'border-purple-500/50 bg-purple-950/20'
                    : evalResult.action === 'LOG_ONLY'
                    ? 'border-blue-500/50 bg-blue-950/20'
                    : 'border-rose-500/50 bg-rose-950/20'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {evalResult.action === 'ALLOW' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : evalResult.action === 'HOLD' ? (
                        <Clock className="w-5 h-5 text-purple-400 animate-pulse" />
                      ) : evalResult.action === 'LOG_ONLY' ? (
                        <Activity className="w-5 h-5 text-blue-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      )}
                      <span className="font-bold text-sm">
                        Action: <span className="font-mono">{evalResult.action}</span>
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Evaluated by {evalResult.daemon}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{evalResult.reason}</p>
                </div>
              )}

              {/* Single-Width Authorization Gate Pipeline */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white tracking-wide">Single-Width Authorization Gate</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    GATE WIDTH = 1 · ED25519
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span>Outside ➔ Blockade (4 Daemons) ➔ Gate (Width=1, Ed25519) ➔ Enclave ➔ Response</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-400">
                    Requires explicit user Ed25519 signing for each query before reaching enclave.
                  </div>
                  <button
                    onClick={handleExecuteGateSign}
                    disabled={isSigning}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    {isSigning ? 'Signing...' : 'Sign with Ed25519'}
                  </button>
                </div>

                {lastSignature && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-cyan-800/60 font-mono text-[11px] space-y-1 text-slate-300">
                    <div className="flex justify-between text-cyan-400 font-bold">
                      <span>✓ Ed25519 Enclave Signature Valid</span>
                      <span>Width: {lastSignature.widthEnforced}</span>
                    </div>
                    <div className="truncate text-slate-400">Signature: {lastSignature.signatureHex}</div>
                    <div className="truncate text-slate-500">Public Key: {lastSignature.publicKey}</div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Enclave: {lastSignature.enclaveId}</span>
                      <span>Nonce: {lastSignature.nonce}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500">
          <span>LiquidOS Secure Enclave Substrate v4.2 · Kernel SO_PEERCRED Verified</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
