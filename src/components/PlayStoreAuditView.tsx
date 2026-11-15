import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Copy,
  Check,
  Search,
  Save,
  Smartphone,
  FileCode2,
} from 'lucide-react';
import {
  AuditDomain,
  AuditStatus,
  DEFAULT_PLAY_STORE_CONFIG,
  PlayStoreAuditReport,
  PlayStoreReleaseConfig,
  PlayStoreRuntimeEvidence,
  runFullScalePlayStoreAudit,
} from '../utils/playStoreAudit';

const FALLBACK_EVIDENCE: PlayStoreRuntimeEvidence = {
  vitePwaConfigured: true,
  manifestHasId: true,
  manifestDisplayStandalone: true,
  manifestShortNameLength: 12,
  icon192Size: { width: 192, height: 192 },
  icon512Size: { width: 512, height: 512 },
  maskable512Size: { width: 512, height: 512 },
  appleTouchIconSize: { width: 180, height: 180 },
  assetLinksExists: true,
  assetLinksPackageMatch: true,
  assetLinksFingerprintMatch: true,
  indexHtmlHasThemeColor: true,
  indexHtmlHasAppleTouchIcon: true,
  indexHtmlHasViewport: true,
  ruleS4GuardVerified: true,
  ledgerIntegrityValid: true,
  testFilesCount: 9,
  estimatedUnitTestsCount: 44,
  typeCheckConfigured: true,
};

export const PlayStoreAuditView: React.FC = () => {
  const [config, setConfig] = useState<PlayStoreReleaseConfig>(DEFAULT_PLAY_STORE_CONFIG);
  const [report, setReport] = useState<PlayStoreAuditReport>(() =>
    runFullScalePlayStoreAudit(DEFAULT_PLAY_STORE_CONFIG, FALLBACK_EVIDENCE)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunningAudit, setIsRunningAudit] = useState<boolean>(false);
  const [isSavingAssetLinks, setIsSavingAssetLinks] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);

  const [domainFilter, setDomainFilter] = useState<'ALL' | AuditDomain>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AuditStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [manifestTab, setManifestTab] = useState<'assetlinks' | 'twa'>('assetlinks');
  const [copiedManifest, setCopiedManifest] = useState<boolean>(false);

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/audit/playstore');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.report) setReport(data.report);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Unable to load server audit telemetry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handleRunFullAudit = async () => {
    setIsRunningAudit(true);
    setErrorBanner(null);
    setSaveSuccessBanner(null);
    try {
      const res = await fetch('/api/audit/playstore/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data.config) setConfig(data.config);
      if (data.report) setReport(data.report);
      setSaveSuccessBanner(
        `Full-scale audit completed (${data.report.summary.passedCount}/${data.report.summary.totalChecks} checks passed) and recorded in LOS-CAP-REG-001.`
      );
    } catch (err: any) {
      setErrorBanner(err?.message || 'Audit run failed');
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleSaveAssetLinksAndAudit = async () => {
    setIsSavingAssetLinks(true);
    setErrorBanner(null);
    setSaveSuccessBanner(null);
    try {
      const res = await fetch('/api/audit/playstore/assetlinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: config.packageId,
          sha256CertFingerprint: config.sha256CertFingerprint,
          configPatch: config,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (data.config) setConfig(data.config);
      if (data.report) setReport(data.report);
      setSaveSuccessBanner(
        `Updated public/.well-known/assetlinks.json for ${data.config.packageId} and re-verified Play Store readiness.`
      );
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to save AssetLinks');
    } finally {
      setIsSavingAssetLinks(false);
    }
  };

  const handleDownloadAuditReport = () => {
    const payload = JSON.stringify({ config, report }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidos-playstore-audit-${config.packageId}-v${config.versionName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyManifest = () => {
    const content =
      manifestTab === 'assetlinks'
        ? JSON.stringify(report.assetLinksJson, null, 2)
        : JSON.stringify(report.twaManifestJson, null, 2);
    navigator.clipboard.writeText(content);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  const filteredChecks = report.checks.filter((check) => {
    if (domainFilter !== 'ALL' && check.domain !== domainFilter) return false;
    if (statusFilter !== 'ALL' && check.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        check.title.toLowerCase().includes(q) ||
        check.id.toLowerCase().includes(q) ||
        check.observed.toLowerCase().includes(q) ||
        check.requirement.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const { summary } = report;

  return (
    <div className="@container flex flex-col h-full w-full bg-transparent text-slate-100 overflow-y-auto p-4 @[640px]:p-6 space-y-5 font-sans">
      {/* Top Play Store Readiness Summary */}
      <div className="p-4 @[640px]:p-5 rounded-2xl glass-surface-2 space-y-4">
        <div className="flex flex-col @[880px]:flex-row @[880px]:items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-[11px] font-mono text-cyan-300 flex items-center gap-2 flex-wrap">
              <span>Google Play Console 2026 Policy</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="tabular-nums">Target API {config.targetSdk}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>16 KB ELF Alignment</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>TWA Digital Asset Links</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg @[640px]:text-xl font-bold tracking-tight text-white">
                Play Store Readiness &amp; Full-Scale Audit
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold ${
                  summary.releaseReady ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.releaseReady ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{summary.releaseReady ? 'READY FOR RELEASE' : 'BLOCKERS DETECTED'}</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {summary.passedCount}/{summary.totalChecks} checks passed · {summary.warningCount} warnings ·{' '}
              {summary.blockerCount} blockers · Package {config.packageId} ({config.versionName} / code{' '}
              {config.versionCode})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunFullAudit}
              disabled={isRunningAudit || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningAudit ? 'animate-spin' : ''}`} />
              <span>{isRunningAudit ? 'Auditing Workspace...' : 'Run Full-Scale Audit'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadAuditReport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-surface-1 hover:border-cyan-400/50 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Audit JSON</span>
            </button>
          </div>
        </div>

        {errorBanner && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2"
          >
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {saveSuccessBanner && (
          <div
            role="status"
            className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessBanner}</span>
          </div>
        )}
      </div>

      {/* 5-Domain Audit Breakdown Strip */}
      <div className="grid grid-cols-1 @[520px]:grid-cols-2 @[920px]:grid-cols-5 gap-3">
        {report.domains.map((dom) => {
          const isActive = domainFilter === dom.domain;
          const hasBlocker = dom.blockers > 0;
          const hasWarn = dom.warnings > 0;
          return (
            <button
              key={dom.domain}
              type="button"
              onClick={() => setDomainFilter(isActive ? 'ALL' : dom.domain)}
              className={`p-3.5 rounded-xl text-left transition-colors cursor-pointer space-y-1.5 ${
                isActive ? 'glass-surface-3' : 'glass-surface-1 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-white truncate">{dom.domain}</span>
                {hasBlocker ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : hasWarn ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-300">
                {dom.passed}/{dom.total} passed
                {dom.blockers > 0 ? ` · ${dom.blockers} fail` : dom.warnings > 0 ? ` · ${dom.warnings} warn` : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Split: Checklist & Policy Controls */}
      <div className="grid grid-cols-1 @[920px]:grid-cols-12 gap-4 items-start">
        {/* Left: Live Audit Checklist */}
        <div className="@[920px]:col-span-7 p-4 @[640px]:p-5 rounded-2xl glass-surface-2 space-y-3">
          <div className="flex flex-col @[600px]:flex-row @[600px]:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Play Console Audit Matrix</span>
              </h3>
              <p className="text-[11px] font-mono tabular-nums text-slate-400">
                Showing {filteredChecks.length} of {report.checks.length} checks
                {domainFilter !== 'ALL' ? ` · ${domainFilter}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter checks..."
                  aria-label="Filter Play Store audit checks"
                  className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-40"
                />
              </div>

              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
                {(['ALL', 'FAIL', 'WARN', 'PASS'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                      statusFilter === status
                        ? 'bg-cyan-600/80 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status === 'ALL' ? 'All' : status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="h-16 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-xs text-slate-400">
              <div>No audit checks match the current domain or status filter.</div>
              <button
                type="button"
                onClick={() => {
                  setDomainFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-lg glass-surface-1 text-cyan-300 hover:text-white cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden bg-black/25 max-h-[560px] overflow-y-auto">
              {filteredChecks.map((check) => (
                <div key={check.id} className="p-3.5 space-y-1.5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                          {check.id}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="font-semibold text-white">{check.title}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {check.domain} · {check.severity}
                        {check.artifactPath ? ` · ${check.artifactPath}` : ''}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold shrink-0 ${
                        check.status === 'PASS'
                          ? 'text-emerald-400'
                          : check.status === 'WARN'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {check.status === 'PASS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : check.status === 'WARN' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{check.status}</span>
                    </span>
                  </div>

                  <div className="text-xs font-mono text-cyan-200/90 break-words">{check.observed}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {check.status === 'PASS' ? check.requirement : `Action: ${check.remediation}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Editable Play Console & TWA Configuration + Live AssetLinks */}
        <div className="@[920px]:col-span-5 space-y-4">
          <div className="p-4 @[640px]:p-5 rounded-2xl glass-surface-2 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Play Console &amp; TWA Release Parameters</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 @[480px]:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1" htmlFor="ps-pkg">
                  Android Package ID
                </label>
                <input
                  id="ps-pkg"
                  type="text"
                  value={config.packageId}
                  onChange={(e) => setConfig((prev) => ({ ...prev, packageId: e.target.value }))}
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1" htmlFor="ps-sdk">
                  Target SDK (Min 35)
                </label>
                <input
                  id="ps-sdk"
                  type="number"
                  min={26}
                  max={36}
                  value={config.targetSdk}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, targetSdk: Number(e.target.value) || 35 }))
                  }
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1" htmlFor="ps-ver-code">
                  Version Code
                </label>
                <input
                  id="ps-ver-code"
                  type="number"
                  min={1}
                  value={config.versionCode}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, versionCode: Number(e.target.value) || 1 }))
                  }
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1" htmlFor="ps-format">
                  Release Artifact
                </label>
                <select
                  id="ps-format"
                  value={config.appFormat}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      appFormat: e.target.value as 'AAB' | 'APK',
                    }))
                  }
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="AAB">Android App Bundle (.aab)</option>
                  <option value="APK">Legacy APK (.apk)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1" htmlFor="ps-sha">
                Play Signing SHA-256 Certificate Fingerprint
              </label>
              <input
                id="ps-sha"
                type="text"
                value={config.sha256CertFingerprint}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, sha256CertFingerprint: e.target.value }))
                }
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-[11px] font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <label htmlFor="ps-short-desc">Short Description</label>
                <span className="tabular-nums">{config.shortDescription.length}/80</span>
              </div>
              <input
                id="ps-short-desc"
                type="text"
                value={config.shortDescription}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, shortDescription: e.target.value }))
                }
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-1 @[480px]:grid-cols-2 gap-2 pt-1 text-xs">
              {[
                { key: 'pageSize16KbAligned' as const, label: '16 KB ELF Page Aligned' },
                { key: 'supports64BitAbi' as const, label: '64-Bit ARM64 ABI' },
                { key: 'playAppSigningEnabled' as const, label: 'Play App Signing' },
                { key: 'dataSafetyDeclared' as const, label: 'Data Safety Form Ready' },
                { key: 'aiContentModerationEnabled' as const, label: 'AI Policy Moderation' },
                { key: 'r8ObfuscationAndSymbols' as const, label: 'R8 + Mapping Symbols' },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/10 cursor-pointer hover:border-white/20"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(config[toggle.key])}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [toggle.key]: e.target.checked }))
                    }
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-[11px] text-slate-200">{toggle.label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveAssetLinksAndAudit}
              disabled={isSavingAssetLinks}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSavingAssetLinks ? 'Writing AssetLinks...' : 'Save AssetLinks & Re-Audit'}
              </span>
            </button>
          </div>

          {/* Generated Digital Asset Links / Bubblewrap Manifest Preview */}
          <div className="p-4 rounded-2xl glass-surface-2 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setManifestTab('assetlinks')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                    manifestTab === 'assetlinks'
                      ? 'bg-cyan-600/80 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  assetlinks.json
                </button>
                <button
                  type="button"
                  onClick={() => setManifestTab('twa')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                    manifestTab === 'twa'
                      ? 'bg-cyan-600/80 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  twa-manifest.json
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyManifest}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-[11px] font-medium text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {copiedManifest ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-cyan-400" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                {manifestTab === 'assetlinks'
                  ? 'Served live at /.well-known/assetlinks.json'
                  : 'Bubblewrap CLI Android App Bundle configuration'}
              </span>
            </div>

            <pre className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono text-cyan-200 max-h-56 overflow-auto leading-relaxed">
              {manifestTab === 'assetlinks'
                ? JSON.stringify(report.assetLinksJson, null, 2)
                : JSON.stringify(report.twaManifestJson, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
