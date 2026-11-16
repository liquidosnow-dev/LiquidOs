import React, { useState } from 'react';
import {
  Rocket,
  CheckCircle2,
  Globe,
  Shield,
  ExternalLink,
  Copy,
  Check,
  X,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { Project, DeploymentRecord } from '../types';
import type { ControlPlaneState } from '../utils/ingestionControlPlane';
import type { CloudflareAccountConfig, CloudflareBindings } from '../types/sandbox';
import { ed25519Validator } from '../utils/clientEd25519Verifier';

interface DeployCheckDiagnostic {
  service: string;
  target: string;
  ok: boolean;
  code: string;
  detail: string;
}

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  controlPlaneState?: ControlPlaneState;
  cloudflareBindings?: CloudflareBindings;
  cloudflareConfig?: CloudflareAccountConfig;
  ensureControlPlaneSession?: () => Promise<string | null>;
  buildControlPlaneHeaders?: () => Record<string, string>;
  onDeploymentVerified?: (record: DeploymentRecord) => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  project,
  controlPlaneState,
  cloudflareBindings,
  cloudflareConfig,
  ensureControlPlaneSession,
  buildControlPlaneHeaders,
  onDeploymentVerified,
}) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentRecord, setDeploymentRecord] = useState<DeploymentRecord | null>(null);
  const [deployError, setDeployError] = useState<{ code: string; message: string } | null>(null);
  const [diagnostics, setDiagnostics] = useState<DeployCheckDiagnostic[]>([]);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const resolveHeaders = async (): Promise<Record<string, string>> => {
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

  const handleStartDeploy = async () => {
    setIsDeploying(true);
    setDeployError(null);
    setDiagnostics([]);
    setStep(1);

    try {
      const permit = controlPlaneState?.activePermit;
      const preflightHeaders = await resolveHeaders();

      // Step 1: Hono / Cloudflare Service-to-Service & Control Plane Preflight
      const preflightRes = await fetch('/api/deploy/preflight', {
        method: 'POST',
        credentials: 'include',
        headers: preflightHeaders,
        body: JSON.stringify({
          permitId: permit?.permitId || null,
          projectName: project.name,
          channel: 'edge',
          files: project.files,
          cloudflareBindings,
          cloudflareConfig,
          expectedEpoch: controlPlaneState?.epoch,
          expectedFencingVersion: permit?.fencingVersion,
          workspaceId: 'ws_unified_one',
        }),
      });
      const preflightData = await preflightRes.json().catch(() => null);
      const preflightChecks: DeployCheckDiagnostic[] = Array.isArray(preflightData?.checks)
        ? preflightData.checks
        : [];
      if (preflightChecks.length > 0) {
        setDiagnostics(preflightChecks);
      }

      if (!preflightRes.ok || !preflightData?.ok) {
        setIsDeploying(false);
        setDeployError({
          code: preflightData?.failureCode || preflightData?.code || `HTTP_${preflightRes.status}`,
          message:
            preflightData?.failureReason ||
            preflightData?.error ||
            'Deployment preflight blocked by Hono/Cloudflare or Control Plane policy.',
        });
        return;
      }

      // Step 2: Pre-ship client-side Ed25519 validation BEFORE calling /api/deploy
      setStep(2);
      const preShipCheck = await ed25519Validator.verifyShipment({
        receipt: preflightData.receipt,
        files: project.files,
        cloudflareBindings,
        cloudflareConfig,
        projectName: project.name,
        channel: 'edge',
        workspaceId: 'ws_unified_one',
        expectedBindingsDigest: preflightData.bindingsDigest,
      });
      const preShipDiagnostic: DeployCheckDiagnostic = {
        service: 'client_ed25519_verifier',
        target: `WebCrypto (${preShipCheck.keyId || 'keyring'})`,
        ok: preShipCheck.verified,
        code: preShipCheck.code,
        detail: preShipCheck.reason,
      };
      setDiagnostics([...preflightChecks, preShipDiagnostic]);

      if (!preShipCheck.verified) {
        setIsDeploying(false);
        setDeployError({
          code: preShipCheck.code,
          message: `Pre-ship Ed25519 validator aborted deployment before cloud request: ${preShipCheck.reason}`,
        });
        return;
      }

      // Step 3: Ship with pre-validated Ed25519 receipt
      setStep(3);
      const deployHeaders = await resolveHeaders();
      const deployRes = await fetch('/api/deploy', {
        method: 'POST',
        credentials: 'include',
        headers: deployHeaders,
        body: JSON.stringify({
          permitId: permit?.permitId || null,
          projectName: project.name,
          channel: 'edge',
          files: project.files,
          cloudflareBindings,
          cloudflareConfig,
          suppliedReceipt: preflightData.receipt,
          expectedEpoch: controlPlaneState?.epoch,
          expectedFencingVersion: permit?.fencingVersion,
          workspaceId: 'ws_unified_one',
        }),
      });
      const data = await deployRes.json().catch(() => null);
      const serverChecks: DeployCheckDiagnostic[] = Array.isArray(data?.checks) ? data.checks : [];
      if (serverChecks.length > 0) {
        setDiagnostics([...serverChecks, preShipDiagnostic]);
      }

      if (!deployRes.ok || !data?.ok || !data?.ed25519Verification?.verified) {
        setIsDeploying(false);
        setDeployError({
          code: data?.code || `HTTP_${deployRes.status}`,
          message:
            data?.error ||
            'Fail-closed gate blocked deployment: Control Plane Ed25519 signature verification did not pass.',
        });
        return;
      }

      const clientCheck = await ed25519Validator.verifyShipment({
        receipt: data.receipt,
        files: project.files,
        cloudflareBindings,
        cloudflareConfig,
        projectName: project.name,
        channel: 'edge',
        workspaceId: 'ws_unified_one',
        expectedBindingsDigest: preflightData?.bindingsDigest || data?.bindingsDigest,
      });

      const clientDiagnostic: DeployCheckDiagnostic = {
        service: 'client_ed25519_verifier',
        target: `WebCrypto (${clientCheck.keyId || 'keyring'})`,
        ok: clientCheck.verified,
        code: clientCheck.code,
        detail: clientCheck.reason,
      };
      setDiagnostics([...serverChecks, clientDiagnostic]);

      if (!clientCheck.verified) {
        setIsDeploying(false);
        setDeployError({
          code: clientCheck.code,
          message: `Client-side Ed25519 receipt validation blocked deployment: ${clientCheck.reason}`,
        });
        return;
      }

      const record: DeploymentRecord = {
        id: data.deploymentId,
        projectName: project.name,
        channel: data.channel,
        domain: data.domain,
        url: data.url,
        status: 'ACTIVE',
        deployedAt: new Date().toLocaleTimeString(),
        treeDigest: data.treeDigest,
        bindingsDigest: clientCheck.computedBindingsDigest,
        ed25519Verification: {
          ...data.ed25519Verification,
          clientVerified: true,
          clientVerifiedAt: clientCheck.verifiedAt,
          clientCode: clientCheck.code,
        },
        serviceToService: data.serviceToService,
        security: data.security,
        metrics: data.metrics,
      };
      setIsDeploying(false);
      setDeploymentRecord(record);
      onDeploymentVerified?.(record);
    } catch (err: any) {
      setIsDeploying(false);
      setDeployError({
        code: 'ERR_CONTROL_PLANE_UNREACHABLE',
        message:
          err?.message ||
          'Fail-closed block: Deployment orchestrator / Control Plane unreachable.',
      });
    }
  };

  const handleCopyLink = () => {
    if (deploymentRecord) {
      navigator.clipboard.writeText(deploymentRecord.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Verified Edge Production Deployment</h2>
              <p className="text-xs text-slate-400">
                Hono/Cloudflare Preflight · Ed25519 Control Plane Gate · TLS 1.3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not deployed yet state */}
        {!deploymentRecord && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Project: {project.name}</div>
                <span className="text-[11px] font-mono text-cyan-300">
                  Mode: {controlPlaneState?.mode || 'ACTIVE'}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span>{project.files.length} source files</span>
                <span>·</span>
                <span>Branch: {project.currentBranch}</span>
                <span>·</span>
                <span className="text-emerald-400 font-mono">Ed25519 pre-ship validation armed</span>
              </div>
            </div>

            {deployError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-rose-300 font-mono">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>DEPLOYMENT BLOCKED · {deployError.code}</span>
                </div>
                <p className="text-rose-200/90 leading-relaxed">{deployError.message}</p>
              </div>
            )}

            {diagnostics.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] font-mono">
                {diagnostics.map((d) => (
                  <div key={d.service} className="flex items-start justify-between gap-2">
                    <span className={d.ok ? 'text-emerald-400' : 'text-rose-400'}>
                      {d.ok ? 'PASS' : 'FAIL'} · {d.service}
                    </span>
                    <span className="text-slate-400 text-right truncate max-w-[260px]" title={d.detail}>
                      {d.code}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isDeploying ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-cyan-800/60 text-center space-y-4">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white">
                    {step === 1 && 'Running Hono & Cloudflare preflight & issuing Ed25519 receipt...'}
                    {step === 2 && 'Validating Control Plane Ed25519 receipt via WebCrypto before ship...'}
                    {step === 3 && 'Dispatching pre-verified bundle to Edge deployment endpoint...'}
                  </div>
                  <div className="text-xs text-cyan-400 font-mono">Step {step}/3 in progress</div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartDeploy}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Rocket className="w-4 h-4" />
                <span>Verify Ed25519 &amp; Deploy to Edge</span>
              </button>
            )}
          </div>
        )}

        {/* Deployed successfully state */}
        {deploymentRecord && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Deployment Verified &amp; Active</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200">
                  {deploymentRecord.deployedAt}
                </span>
              </div>

              {/* URL Display Bar */}
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-emerald-800/50 text-xs font-mono">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 truncate flex-1">{deploymentRecord.url}</span>
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
                  title="Copy URL"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Ed25519 & Service-to-Service Receipt Proof */}
              {deploymentRecord.ed25519Verification && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-cyan-800/40 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between text-cyan-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {deploymentRecord.ed25519Verification.clientVerified
                          ? 'Client WebCrypto + Control Plane Ed25519 Verified'
                          : 'Ed25519 Control Plane Verified'}
                      </span>
                    </span>
                    <span className="text-emerald-400">
                      seq #{deploymentRecord.ed25519Verification.linearizationSeq}
                    </span>
                  </div>
                  <div className="text-slate-400 truncate">
                    Receipt: {deploymentRecord.ed25519Verification.receiptId} · Key:{' '}
                    {deploymentRecord.ed25519Verification.keyId}
                  </div>
                  {deploymentRecord.treeDigest && (
                    <div className="text-slate-400 truncate">
                      Bundle: {deploymentRecord.treeDigest.slice(0, 16)}…
                      {deploymentRecord.bindingsDigest
                        ? ` · Bindings: ${deploymentRecord.bindingsDigest.slice(0, 16)}…`
                        : ''}
                    </div>
                  )}
                  {deploymentRecord.serviceToService && (
                    <div className="text-slate-400 truncate">
                      Services: {deploymentRecord.serviceToService.honoHealth} ·{' '}
                      {deploymentRecord.serviceToService.cloudflareBindings}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Edge Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">EDGE LATENCY</div>
                <div className="text-cyan-400 font-bold mt-0.5">
                  {deploymentRecord.metrics.edgeLatency}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">BUNDLE SIZE</div>
                <div className="text-amber-400 font-bold mt-0.5">
                  {deploymentRecord.metrics.bundleSize}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">ACTIVE REGIONS</div>
                <div className="text-purple-400 font-bold mt-0.5">3 Global</div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={deploymentRecord.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <span>Visit Live Application</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => {
                  setDeploymentRecord(null);
                  setDeployError(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Redeploy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
