import { runLiveEnvironmentVerification } from '../src/utils/environmentVerifier';

async function main() {
  const baseUrl = process.env.LIQUIDOS_VERIFY_BASE_URL || 'http://127.0.0.1:3000';
  console.log(`\n[LiquidOS ONE] Running live environment verifier against ${baseUrl} ...\n`);

  const report = await runLiveEnvironmentVerification(baseUrl);
  for (const check of report.checks) {
    const marker = check.passed ? 'PASS' : 'FAIL';
    const statusText = check.statusCode ? `HTTP ${check.statusCode}` : 'ERR';
    console.log(
      `  [${marker}] ${check.label} (${statusText}, ${check.durationMs}ms) -> ${check.detail}`
    );
  }

  console.log(
    `\nSummary: ${report.passedCount}/${report.totalCount} environment probes passed.\n`
  );

  if (!report.allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Environment verifier crashed:', err);
  process.exit(1);
});
