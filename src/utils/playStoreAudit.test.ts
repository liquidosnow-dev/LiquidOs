import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLAY_STORE_CONFIG,
  PlayStoreRuntimeEvidence,
  buildAssetLinksJson,
  buildTwaManifestJson,
  isValidAndroidPackageId,
  isValidSha256Fingerprint,
  runFullScalePlayStoreAudit,
} from './playStoreAudit';

const HEALTHY_EVIDENCE: PlayStoreRuntimeEvidence = {
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

describe('Play Store Readiness & Full-Scale Audit Engine', () => {
  it('passes all 18 checks when targetSdk >= 35, .aab, 16KB aligned, and PWA/AssetLinks verified', () => {
    const report = runFullScalePlayStoreAudit(DEFAULT_PLAY_STORE_CONFIG, HEALTHY_EVIDENCE);
    expect(report.summary.totalChecks).toBe(18);
    expect(report.summary.blockerCount).toBe(0);
    expect(report.summary.warningCount).toBe(0);
    expect(report.summary.passedCount).toBe(18);
    expect(report.summary.releaseReady).toBe(true);
  });

  it('flags targetSdk < 35, APK format, and missing AssetLinks as release blockers', () => {
    const brokenConfig = {
      ...DEFAULT_PLAY_STORE_CONFIG,
      targetSdk: 33,
      appFormat: 'APK' as const,
      sha256CertFingerprint: 'INVALID_FP',
    };
    const brokenEvidence = {
      ...HEALTHY_EVIDENCE,
      assetLinksExists: false,
      assetLinksFingerprintMatch: false,
    };

    const report = runFullScalePlayStoreAudit(brokenConfig, brokenEvidence);
    expect(report.summary.releaseReady).toBe(false);
    expect(report.summary.blockerCount).toBeGreaterThanOrEqual(3);
    expect(report.checks.find((c) => c.id === 'PS-BUILD-01')?.status).toBe('FAIL');
    expect(report.checks.find((c) => c.id === 'PS-BUILD-02')?.status).toBe('FAIL');
    expect(report.checks.find((c) => c.id === 'PS-PWA-03')?.status).toBe('FAIL');
  });

  it('validates Android package IDs and 32-byte SHA-256 certificate fingerprints strictly', () => {
    expect(isValidAndroidPackageId('com.liquidos.one')).toBe(true);
    expect(isValidAndroidPackageId('InvalidPkg')).toBe(false);
    expect(isValidSha256Fingerprint(DEFAULT_PLAY_STORE_CONFIG.sha256CertFingerprint)).toBe(true);
    expect(isValidSha256Fingerprint('AA:BB:CC')).toBe(false);
  });

  it('generates valid Digital Asset Links and Bubblewrap twa-manifest.json payloads', () => {
    const assetLinks = buildAssetLinksJson('com.liquidos.one', [
      DEFAULT_PLAY_STORE_CONFIG.sha256CertFingerprint,
    ]);
    expect(assetLinks).toHaveLength(1);
    expect(assetLinks[0].target.package_name).toBe('com.liquidos.one');
    expect(assetLinks[0].relation).toContain('delegate_permission/common.handle_all_urls');

    const twa = buildTwaManifestJson(DEFAULT_PLAY_STORE_CONFIG);
    expect(twa.packageId).toBe('com.liquidos.one');
    expect(twa.targetSdkVersion).toBe(35);
    expect(twa.display).toBe('standalone');
  });
});
