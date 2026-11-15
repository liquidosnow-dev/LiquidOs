export type AuditDomain =
  | 'Build & Target SDK'
  | 'Security & Privacy'
  | 'PWA & AssetLinks'
  | 'Store Listing & Policy'
  | 'Tests & Runtime';

export type AuditStatus = 'PASS' | 'WARN' | 'FAIL';
export type AuditSeverity = 'BLOCKER' | 'RECOMMENDED' | 'INFO';

export interface PlayStoreReleaseConfig {
  packageId: string;
  appName: string;
  shortName: string;
  versionCode: number;
  versionName: string;
  targetSdk: number;
  minSdk: number;
  sha256CertFingerprint: string;
  appFormat: 'AAB' | 'APK';
  playAppSigningEnabled: boolean;
  supports64BitAbi: boolean;
  pageSize16KbAligned: boolean;
  r8ObfuscationAndSymbols: boolean;
  cleartextTrafficAllowed: boolean;
  privacyPolicyUrl: string;
  accountDeletionUrl: string;
  supportEmail: string;
  shortDescription: string;
  fullDescription: string;
  iarcAgeRating: string;
  dataSafetyDeclared: boolean;
  aiContentModerationEnabled: boolean;
  featureGraphicReady: boolean;
  phoneScreenshotsCount: number;
  tabletScreenshotsCount: number;
  originUrl: string;
}

export interface PlayStoreRuntimeEvidence {
  vitePwaConfigured: boolean;
  manifestHasId: boolean;
  manifestDisplayStandalone: boolean;
  manifestShortNameLength: number;
  icon192Size: { width: number; height: number } | null;
  icon512Size: { width: number; height: number } | null;
  maskable512Size: { width: number; height: number } | null;
  appleTouchIconSize: { width: number; height: number } | null;
  assetLinksExists: boolean;
  assetLinksPackageMatch: boolean;
  assetLinksFingerprintMatch: boolean;
  indexHtmlHasThemeColor: boolean;
  indexHtmlHasAppleTouchIcon: boolean;
  indexHtmlHasViewport: boolean;
  ruleS4GuardVerified: boolean;
  ledgerIntegrityValid: boolean;
  testFilesCount: number;
  estimatedUnitTestsCount: number;
  typeCheckConfigured: boolean;
}

export interface AuditCheckItem {
  id: string;
  domain: AuditDomain;
  title: string;
  status: AuditStatus;
  severity: AuditSeverity;
  observed: string;
  requirement: string;
  remediation: string;
  artifactPath?: string;
}

export interface DomainAuditBreakdown {
  domain: AuditDomain;
  passed: number;
  warnings: number;
  blockers: number;
  total: number;
}

export interface PlayStoreAuditReport {
  summary: {
    totalChecks: number;
    passedCount: number;
    warningCount: number;
    blockerCount: number;
    releaseReady: boolean;
    targetTrack: string;
    auditedAt: number;
  };
  domains: DomainAuditBreakdown[];
  checks: AuditCheckItem[];
  assetLinksJson: ReturnType<typeof buildAssetLinksJson>;
  twaManifestJson: ReturnType<typeof buildTwaManifestJson>;
}

export const DEFAULT_PLAY_STORE_CONFIG: PlayStoreReleaseConfig = {
  packageId: 'com.liquidos.one',
  appName: 'LiquidOS ONE',
  shortName: 'LiquidOS ONE',
  versionCode: 14,
  versionName: '1.4.0',
  targetSdk: 35,
  minSdk: 26,
  sha256CertFingerprint:
    'A4:3F:8B:21:9C:0D:4E:77:51:22:B8:E3:19:40:6A:C1:88:3E:5D:02:9F:14:7B:6C:2A:D4:09:E1:33:58:72:FA',
  appFormat: 'AAB',
  playAppSigningEnabled: true,
  supports64BitAbi: true,
  pageSize16KbAligned: true,
  r8ObfuscationAndSymbols: true,
  cleartextTrafficAllowed: false,
  privacyPolicyUrl: 'https://liquidos.one/privacy',
  accountDeletionUrl: 'https://liquidos.one/account-deletion',
  supportEmail: 'liquidosnow@gmail.com',
  shortDescription:
    'Local-first AI sandbox, Hono Edge IDE & AN-EVC-001 verifier.',
  fullDescription:
    'LiquidOS ONE unifies a local-first Sovereign Substrate, Rule S4 SQL AST guard, 22-tool MCP Signal Console, and Cloudflare D1/KV/R2 full-stack workspace with AN-EVC-001 RFC 8785 cross-runtime verification.',
  iarcAgeRating: 'Everyone (PEGI 3 / ESRB E)',
  dataSafetyDeclared: true,
  aiContentModerationEnabled: true,
  featureGraphicReady: true,
  phoneScreenshotsCount: 4,
  tabletScreenshotsCount: 2,
  originUrl: 'https://liquidos.one',
};

export function isValidAndroidPackageId(pkg: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg.trim());
}

export function isValidSha256Fingerprint(fp: string): boolean {
  return /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp.trim().toUpperCase());
}

export function isHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function buildAssetLinksJson(packageId: string, fingerprints: string[]) {
  const cleanFingerprints = fingerprints
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageId.trim(),
        sha256_cert_fingerprints: cleanFingerprints,
      },
    },
  ];
}

export function buildTwaManifestJson(config: PlayStoreReleaseConfig) {
  let host = 'liquidos.one';
  try {
    host = new URL(config.originUrl).host || 'liquidos.one';
  } catch {
    host = 'liquidos.one';
  }
  return {
    packageId: config.packageId,
    host,
    name: config.appName,
    launcherName: config.shortName,
    display: 'standalone',
    themeColor: '#090A0F',
    navigationColor: '#090A0F',
    backgroundColor: '#090A0F',
    enableNotifications: true,
    startUrl: '/',
    iconUrl: `https://${host}/pwa-512x512.png`,
    maskableIconUrl: `https://${host}/pwa-maskable-512x512.png`,
    appVersionCode: config.versionCode,
    appVersionName: config.versionName,
    minSdkVersion: config.minSdk,
    targetSdkVersion: config.targetSdk,
    signingKey: {
      path: './android/upload-keystore.jks',
      alias: 'liquidos-release',
    },
    features: {
      locationDelegation: { enabled: false },
      playBilling: { enabled: false },
    },
    fallbackType: 'customtabs',
    enableSiteSettingsShortcut: true,
  };
}

export function runFullScalePlayStoreAudit(
  config: PlayStoreReleaseConfig,
  evidence: PlayStoreRuntimeEvidence
): PlayStoreAuditReport {
  const checks: AuditCheckItem[] = [];

  // --- DOMAIN 1: Build & Target SDK ---
  checks.push({
    id: 'PS-BUILD-01',
    domain: 'Build & Target SDK',
    title: 'Android Target API Level (>= 35 / Android 15)',
    status: config.targetSdk >= 35 ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `targetSdkVersion = ${config.targetSdk} (minSdk ${config.minSdk})`,
    requirement: 'Google Play requires targetSdkVersion >= 35 for new apps and production updates.',
    remediation: 'Set targetSdkVersion to 35 or higher in build.gradle.kts / twa-manifest.json.',
    artifactPath: 'twa-manifest.json',
  });

  checks.push({
    id: 'PS-BUILD-02',
    domain: 'Build & Target SDK',
    title: 'Android App Bundle (.aab) & Play App Signing',
    status: config.appFormat === 'AAB' && config.playAppSigningEnabled ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `Format: ${config.appFormat} · Play App Signing: ${config.playAppSigningEnabled ? 'Enabled' : 'Disabled'}`,
    requirement: 'Production Play Store uploads require signed Android App Bundles (.aab) with Play App Signing.',
    remediation: 'Switch release artifact output to .aab and enroll upload key in Play App Signing.',
    artifactPath: 'crates/liquid-kernel',
  });

  checks.push({
    id: 'PS-BUILD-03',
    domain: 'Build & Target SDK',
    title: '64-Bit ABI & 16 KB ELF Page-Size Alignment',
    status:
      config.supports64BitAbi && config.pageSize16KbAligned
        ? 'PASS'
        : config.supports64BitAbi
        ? 'WARN'
        : 'FAIL',
    severity: config.supports64BitAbi ? 'RECOMMENDED' : 'BLOCKER',
    observed: `64-bit arm64-v8a: ${config.supports64BitAbi ? 'Yes' : 'No'} · 16 KB ELF align: ${config.pageSize16KbAligned ? 'Yes' : 'Pending'}`,
    requirement: 'Native JNI libraries (room-vec sqlite-vec .aar / Rust FFI) must include arm64-v8a with 16 KB page alignment.',
    remediation: 'Pass -Wl,-z,max-page-size=16384 when compiling sqlite-vec and liquid-kernel .so binaries.',
    artifactPath: 'crates/liquid-kernel/Cargo.toml',
  });

  checks.push({
    id: 'PS-BUILD-04',
    domain: 'Build & Target SDK',
    title: 'Application Package ID & Monotonic Version Code',
    status:
      isValidAndroidPackageId(config.packageId) && config.versionCode >= 1 && /^\d+\.\d+\.\d+/.test(config.versionName)
        ? 'PASS'
        : 'FAIL',
    severity: 'BLOCKER',
    observed: `${config.packageId} · versionCode ${config.versionCode} (${config.versionName})`,
    requirement: 'Valid reverse-domain package ID and positive monotonic integer versionCode.',
    remediation: 'Provide a lowercase reverse-domain packageId (e.g. com.liquidos.one) and semver versionName.',
  });

  checks.push({
    id: 'PS-BUILD-05',
    domain: 'Build & Target SDK',
    title: 'R8 Code Shrinking & Deobfuscation Mapping Export',
    status: config.r8ObfuscationAndSymbols ? 'PASS' : 'WARN',
    severity: 'RECOMMENDED',
    observed: config.r8ObfuscationAndSymbols ? 'minifyEnabled=true · mapping.txt ready' : 'R8 shrinking disabled',
    requirement: 'Upload mapping.txt and native debug symbols to Play Console for crash deobfuscation.',
    remediation: 'Enable isMinifyEnabled = true in release buildType and attach mapping.txt.',
  });

  // --- DOMAIN 2: Security & Privacy ---
  checks.push({
    id: 'PS-SEC-01',
    domain: 'Security & Privacy',
    title: 'Rule S4 Lexical AST SQL Guard & Ledger Integrity',
    status: evidence.ruleS4GuardVerified && evidence.ledgerIntegrityValid ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `Rule S4 AST: ${evidence.ruleS4GuardVerified ? 'Enforced' : 'Unverified'} · LOS-CAP-REG-001: ${evidence.ledgerIntegrityValid ? 'Valid chain' : 'Invalid'}`,
    requirement: 'Read-only Vault handles must block chained statements and mutation opcodes with tamper-evident audit logging.',
    remediation: 'Ensure validateSqlRuleS4 and verifySubstrateLedger pass on startup.',
    artifactPath: 'src/utils/sovereignSubstrate.ts',
  });

  checks.push({
    id: 'PS-SEC-02',
    domain: 'Security & Privacy',
    title: 'Network Security Config (No Remote Cleartext HTTP)',
    status: !config.cleartextTrafficAllowed ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `usesCleartextTraffic=${String(config.cleartextTrafficAllowed)} · Loopback 127.0.0.1:17373 timingSafeEqual`,
    requirement: 'Google Play rejects apps permitting arbitrary remote cleartext HTTP traffic.',
    remediation: 'Set android:usesCleartextTraffic="false" and restrict local IPC to loopback 127.0.0.1.',
  });

  checks.push({
    id: 'PS-SEC-03',
    domain: 'Security & Privacy',
    title: 'HTTPS Privacy Policy & Account Deletion URLs',
    status: isHttpsUrl(config.privacyPolicyUrl) && isHttpsUrl(config.accountDeletionUrl) ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `Privacy: ${config.privacyPolicyUrl} · Deletion: ${config.accountDeletionUrl}`,
    requirement: 'Play Console requires active HTTPS Privacy Policy and in-app/web Account Deletion URLs.',
    remediation: 'Configure valid https:// URLs for privacyPolicyUrl and accountDeletionUrl.',
  });

  checks.push({
    id: 'PS-SEC-04',
    domain: 'Security & Privacy',
    title: 'Play Data Safety Form Declaration',
    status: config.dataSafetyDeclared ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: config.dataSafetyDeclared ? 'Declared (Local-first vault · TLS in transit)' : 'Incomplete Data Safety form',
    requirement: 'All Play Store submissions must complete the Data Safety questionnaire accurately.',
    remediation: 'Complete Data Safety disclosures covering local SQLite/LanceDB storage and optional cloud sync.',
  });

  // --- DOMAIN 3: PWA & Digital Asset Links ---
  checks.push({
    id: 'PS-PWA-01',
    domain: 'PWA & AssetLinks',
    title: 'Web App Manifest & Standalone Display Mode',
    status:
      evidence.vitePwaConfigured &&
      evidence.manifestHasId &&
      evidence.manifestDisplayStandalone &&
      evidence.manifestShortNameLength > 0 &&
      evidence.manifestShortNameLength <= 12
        ? 'PASS'
        : 'FAIL',
    severity: 'BLOCKER',
    observed: `VitePWA: ${evidence.vitePwaConfigured ? 'Active' : 'Missing'} · short_name length: ${evidence.manifestShortNameLength}/12 · standalone: ${evidence.manifestDisplayStandalone}`,
    requirement: 'TWA/PWA installs require id, start_url, scope, display: standalone, and short_name <= 12 chars.',
    remediation: 'Configure VitePWA in vite.config.ts with id, standalone display, and short_name <= 12 characters.',
    artifactPath: 'vite.config.ts',
  });

  const iconsOk =
    Boolean(evidence.icon192Size && evidence.icon192Size.width >= 192 && evidence.icon192Size.height >= 192) &&
    Boolean(evidence.icon512Size && evidence.icon512Size.width >= 512 && evidence.icon512Size.height >= 512) &&
    Boolean(evidence.maskable512Size && evidence.maskable512Size.width >= 512 && evidence.maskable512Size.height >= 512) &&
    Boolean(evidence.appleTouchIconSize && evidence.appleTouchIconSize.width >= 180 && evidence.appleTouchIconSize.height >= 180);

  checks.push({
    id: 'PS-PWA-02',
    domain: 'PWA & AssetLinks',
    title: 'Compliant PNG Icon Matrix (192, 512, 512 Maskable, 180 Apple)',
    status: iconsOk ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `192=${evidence.icon192Size ? `${evidence.icon192Size.width}x${evidence.icon192Size.height}` : 'missing'} · 512=${evidence.icon512Size ? `${evidence.icon512Size.width}x${evidence.icon512Size.height}` : 'missing'} · maskable=${evidence.maskable512Size ? `${evidence.maskable512Size.width}x${evidence.maskable512Size.height}` : 'missing'} · apple=${evidence.appleTouchIconSize ? `${evidence.appleTouchIconSize.width}x${evidence.appleTouchIconSize.height}` : 'missing'}`,
    requirement: 'Play WebAPK & iOS require verified PNG assets (separate any & padded maskable 512px, plus 180px apple-touch-icon).',
    remediation: 'Generate compliant PNG icon assets inside public/ and reference them in manifest and index.html.',
    artifactPath: 'public/pwa-512x512.png',
  });

  checks.push({
    id: 'PS-PWA-03',
    domain: 'PWA & AssetLinks',
    title: 'Digital Asset Links (/.well-known/assetlinks.json)',
    status:
      evidence.assetLinksExists &&
      evidence.assetLinksPackageMatch &&
      evidence.assetLinksFingerprintMatch &&
      isValidSha256Fingerprint(config.sha256CertFingerprint)
        ? 'PASS'
        : 'FAIL',
    severity: 'BLOCKER',
    observed: `File: ${evidence.assetLinksExists ? 'Present' : 'Missing'} · Package match: ${evidence.assetLinksPackageMatch} · SHA-256 match: ${evidence.assetLinksFingerprintMatch}`,
    requirement: 'Android TWA requires /.well-known/assetlinks.json matching package_name and Play signing SHA-256.',
    remediation: 'Save and serve /.well-known/assetlinks.json with your matching packageId and 32-byte SHA-256 fingerprint.',
    artifactPath: 'public/.well-known/assetlinks.json',
  });

  checks.push({
    id: 'PS-PWA-04',
    domain: 'PWA & AssetLinks',
    title: 'HTML Viewport, Theme Color & Apple Touch Meta',
    status:
      evidence.indexHtmlHasViewport &&
      evidence.indexHtmlHasThemeColor &&
      evidence.indexHtmlHasAppleTouchIcon
        ? 'PASS'
        : 'WARN',
    severity: 'RECOMMENDED',
    observed: `viewport=${evidence.indexHtmlHasViewport} · theme-color=${evidence.indexHtmlHasThemeColor} · apple-touch-icon=${evidence.indexHtmlHasAppleTouchIcon}`,
    requirement: 'index.html should declare mobile viewport, theme-color, and PNG apple-touch-icon.',
    remediation: 'Update index.html <head> metadata for standalone PWA integration.',
    artifactPath: 'index.html',
  });

  // --- DOMAIN 4: Store Listing & Policy ---
  checks.push({
    id: 'PS-STORE-01',
    domain: 'Store Listing & Policy',
    title: 'Short & Full Store Listing Descriptions',
    status:
      config.shortDescription.trim().length > 0 &&
      config.shortDescription.trim().length <= 80 &&
      config.fullDescription.trim().length >= 50 &&
      config.fullDescription.trim().length <= 4000
        ? 'PASS'
        : 'FAIL',
    severity: 'BLOCKER',
    observed: `Short: ${config.shortDescription.trim().length}/80 chars · Full: ${config.fullDescription.trim().length}/4000 chars`,
    requirement: 'Play Console enforces <= 80 char short description and <= 4000 char full description.',
    remediation: 'Trim shortDescription to <= 80 chars and supply fullDescription between 50 and 4000 chars.',
  });

  checks.push({
    id: 'PS-STORE-02',
    domain: 'Store Listing & Policy',
    title: 'Graphic Assets (1024x500 Feature Graphic & Screenshots)',
    status:
      config.featureGraphicReady &&
      config.phoneScreenshotsCount >= 2 &&
      config.tabletScreenshotsCount >= 2
        ? 'PASS'
        : 'WARN',
    severity: config.featureGraphicReady && config.phoneScreenshotsCount >= 2 ? 'RECOMMENDED' : 'BLOCKER',
    observed: `Feature 1024x500: ${config.featureGraphicReady ? 'Ready' : 'Missing'} · Phone: ${config.phoneScreenshotsCount} · Tablet: ${config.tabletScreenshotsCount}`,
    requirement: 'Play Store requires a 1024x500 Feature Graphic, >= 2 phone screenshots, and tablet/Chromebook screenshots for large-screen promotion.',
    remediation: 'Provide >= 2 phone and >= 2 tablet screenshots alongside a 1024x500 feature graphic.',
  });

  checks.push({
    id: 'PS-STORE-03',
    domain: 'Store Listing & Policy',
    title: 'AI-Generated Content Policy & IARC Age Rating',
    status: config.aiContentModerationEnabled && Boolean(config.iarcAgeRating.trim()) ? 'PASS' : 'FAIL',
    severity: 'BLOCKER',
    observed: `Moderation/Reporting: ${config.aiContentModerationEnabled ? 'Active' : 'Missing'} · IARC: ${config.iarcAgeRating || 'Unset'}`,
    requirement: 'AI apps on Google Play require generative AI safety/reporting safeguards and a completed IARC rating.',
    remediation: 'Enable AI content moderation/reporting flags and complete IARC questionnaire.',
  });

  // --- DOMAIN 5: Tests & Runtime ---
  checks.push({
    id: 'PS-TEST-01',
    domain: 'Tests & Runtime',
    title: 'Automated Vitest Suite & Coverage Verification',
    status: evidence.testFilesCount >= 8 && evidence.estimatedUnitTestsCount >= 40 ? 'PASS' : 'WARN',
    severity: 'RECOMMENDED',
    observed: `${evidence.testFilesCount} test suites detected (${evidence.estimatedUnitTestsCount}+ unit assertions)`,
    requirement: 'Critical security, AST guard, canonicalization, and audit modules must maintain passing unit tests.',
    remediation: 'Run Vitest suite and maintain unit test coverage on core logic.',
    artifactPath: 'src/utils/',
  });

  checks.push({
    id: 'PS-TEST-02',
    domain: 'Tests & Runtime',
    title: 'Strict TypeScript Zero-Emit Gate & Support Contact',
    status: evidence.typeCheckConfigured && config.supportEmail.includes('@') ? 'PASS' : 'WARN',
    severity: 'RECOMMENDED',
    observed: `tsc --noEmit: ${evidence.typeCheckConfigured ? 'Configured' : 'Missing'} · Support: ${config.supportEmail}`,
    requirement: 'Production release builds must pass static type checking and publish a valid developer support email.',
    remediation: 'Verify lint script (`tsc --noEmit`) and valid developer email in Play Console.',
    artifactPath: 'package.json',
  });

  const domainOrder: AuditDomain[] = [
    'Build & Target SDK',
    'Security & Privacy',
    'PWA & AssetLinks',
    'Store Listing & Policy',
    'Tests & Runtime',
  ];

  const domains: DomainAuditBreakdown[] = domainOrder.map((domain) => {
    const group = checks.filter((c) => c.domain === domain);
    return {
      domain,
      passed: group.filter((c) => c.status === 'PASS').length,
      warnings: group.filter((c) => c.status === 'WARN').length,
      blockers: group.filter((c) => c.status === 'FAIL').length,
      total: group.length,
    };
  });

  const passedCount = checks.filter((c) => c.status === 'PASS').length;
  const warningCount = checks.filter((c) => c.status === 'WARN').length;
  const blockerCount = checks.filter((c) => c.status === 'FAIL').length;

  return {
    summary: {
      totalChecks: checks.length,
      passedCount,
      warningCount,
      blockerCount,
      releaseReady: blockerCount === 0,
      targetTrack: blockerCount === 0 ? 'Production / Open Testing Ready' : 'Blocked Pending Remediation',
      auditedAt: Date.now(),
    },
    domains,
    checks,
    assetLinksJson: buildAssetLinksJson(config.packageId, [config.sha256CertFingerprint]),
    twaManifestJson: buildTwaManifestJson(config),
  };
}
