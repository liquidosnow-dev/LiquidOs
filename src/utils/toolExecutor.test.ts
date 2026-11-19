import { test } from 'vitest';
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
  assert.equal(html.includes('SANDBOX_EVAL'), true);
  assert.equal(html.includes('App ready'), true);
});

test('bundlePreviewHtml renders React TSX/JSX artifacts and SVG files inside isolated sandbox', () => {
  const files = [
    {
      name: 'index.html',
      path: 'index.html',
      language: 'html' as const,
      content: '<div>Vanilla Host</div>',
      lastModified: Date.now(),
    },
    {
      name: 'Widget.tsx',
      path: 'src/Widget.tsx',
      language: 'typescript' as const,
      content: `import React, { useState } from 'react';
export default function Widget() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}`,
      lastModified: Date.now(),
    },
    {
      name: 'logo.svg',
      path: 'assets/logo.svg',
      language: 'svg' as const,
      content: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#22d3ee"/></svg>',
      lastModified: Date.now(),
    },
  ];

  const reactHtml = bundlePreviewHtml(files, 'src/Widget.tsx');
  assert.equal(reactHtml.includes('babel.min.js'), true);
  assert.equal(reactHtml.includes('ReactDOM.createRoot'), true);
  assert.equal(reactHtml.includes('__PreviewErrorBoundary'), true);
  assert.equal(reactHtml.includes('SANDBOX_CONSOLE'), true);

  const svgHtml = bundlePreviewHtml(files, 'assets/logo.svg');
  assert.equal(svgHtml.includes('<circle cx="32" cy="32" r="24" fill="#22d3ee"/>'), true);
  assert.equal(svgHtml.includes('svg-stage'), true);
  assert.equal(svgHtml.includes('SANDBOX_CONSOLE'), true);
});
