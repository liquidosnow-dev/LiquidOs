import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFilesFromResponse, safeEvaluateMath, bundlePreviewHtml } from './toolExecutor';

test('extractFilesFromResponse parses annotated code blocks', () => {
  const md = `
Here is your application:

\`\`\`html
<!-- filepath: index.html -->
<main class="container">
  <h1>Hello App</h1>
</main>
\`\`\`

And the styling:
\`\`\`css
/* filepath: styles.css */
body { background: #000; }
\`\`\`
`;

  const { files } = extractFilesFromResponse(md);
  assert.equal(files.length, 2);
  assert.equal(files[0].path, 'index.html');
  assert.equal(files[0].content.includes('<h1>Hello App</h1>'), true);
  assert.equal(files[1].path, 'styles.css');
  assert.equal(files[1].content.includes('background: #000'), true);
});

test('safeEvaluateMath computes valid algebraic operations and rejects unsafe inputs', () => {
  const valid1 = safeEvaluateMath('(10 + 5) * 2 - 4 / 2');
  assert.equal(valid1.success, true);
  assert.equal(valid1.result, 28);

  const power = safeEvaluateMath('2 ^ 4');
  assert.equal(power.success, true);
  assert.equal(power.result, 16);

  const unsafe = safeEvaluateMath('process.exit()');
  assert.equal(unsafe.success, false);

  const alertUnsafe = safeEvaluateMath('alert(1)');
  assert.equal(alertUnsafe.success, false);
});

test('bundlePreviewHtml packages files with Tailwind and console listener', () => {
  const files = [
    {
      name: 'index.html',
      path: 'index.html',
      language: 'html' as const,
      content: '<div id="app">Active Preview</div>',
      lastModified: Date.now(),
    },
    {
      name: 'app.js',
      path: 'app.js',
      language: 'javascript' as const,
      content: 'console.log("App ready");',
      lastModified: Date.now(),
    },
  ];

  const html = bundlePreviewHtml(files);
  assert.equal(html.includes('tailwindcss'), true);
  assert.equal(html.includes('Active Preview'), true);
  assert.equal(html.includes('SANDBOX_CONSOLE'), true);
  assert.equal(html.includes('App ready'), true);
});
