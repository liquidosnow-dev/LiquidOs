import { ProjectFile } from '../types';

/**
 * Extracts code blocks from markdown assistant responses
 * Looks for:
 * ```html <!-- filepath: index.html --> ... ```
 * or ```javascript // filepath: app.js ... ```
 * or raw ```html / ```jsx blocks
 */
export function extractFilesFromResponse(markdown: string): { files: ProjectFile[]; cleanMarkdown: string } {
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?(?:\s+(?:<!--|\/\/|\/\*)\s*filepath:\s*([^\s*>-]+)\s*(?:-->|\*\/)?)?\n([\s\S]*?)```/g;
  const files: ProjectFile[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const rawLang = (match[1] || 'html').toLowerCase();
    let filepath = match[2];
    const content = match[3];

    // Check if first line of content is a comment containing filepath
    let cleanedContent = content;
    if (!filepath) {
      const firstLine = content.split('\n')[0] || '';
      const fpMatch = firstLine.match(/(?:<!--|\/\/|\/\*)\s*filepath:\s*([^\s*>-]+)/i);
      if (fpMatch) {
        filepath = fpMatch[1];
        cleanedContent = content.substring(firstLine.length).replace(/^\n+/, '');
      }
    }

    if (!filepath) {
      // Default naming based on language
      if (rawLang === 'html') filepath = 'index.html';
      else if (rawLang === 'css') filepath = 'styles.css';
      else if (rawLang === 'js' || rawLang === 'javascript') filepath = 'app.js';
      else if (rawLang === 'jsx' || rawLang === 'tsx') filepath = 'App.tsx';
      else if (rawLang === 'json') filepath = 'data.json';
      else filepath = 'snippet.' + rawLang;
    }

    let language: ProjectFile['language'] = 'html';
    if (rawLang === 'css') language = 'css';
    else if (rawLang === 'js' || rawLang === 'javascript') language = 'javascript';
    else if (rawLang === 'ts' || rawLang === 'typescript' || rawLang === 'tsx' || rawLang === 'jsx') language = 'typescript';
    else if (rawLang === 'json') language = 'json';
    else if (rawLang === 'md' || rawLang === 'markdown') language = 'markdown';

    files.push({
      name: filepath.split('/').pop() || filepath,
      path: filepath,
      language,
      content: cleanedContent.trim(),
      lastModified: Date.now(),
    });
  }

  return { files, cleanMarkdown: markdown };
}

/**
 * Evaluates safe math expressions
 */
export function safeEvaluateMath(expression: string): { success: boolean; result?: number; error?: string } {
  try {
    const sanitized = expression.trim();
    // Allow digits, basic operators, parens, decimal points, exponents
    if (!/^[0-9+\-*/().,%^ \t\neE]+$/.test(sanitized)) {
      return { success: false, error: 'Expression contains disallowed characters' };
    }
    // Replace ^ with ** for power
    const normalized = sanitized.replace(/\^/g, '**');
    const val = Function(`"use strict"; return (${normalized})`)();
    if (typeof val !== 'number' || isNaN(val)) {
      return { success: false, error: 'Evaluation did not produce a valid number' };
    }
    return { success: true, result: val };
  } catch (err: any) {
    return { success: false, error: err.message || 'Math evaluation error' };
  }
}

/**
 * Builds composite HTML document for the sandboxed preview iframe
 */
export function bundlePreviewHtml(files: ProjectFile[]): string {
  const htmlFile = files.find(f => f.path.endsWith('.html') || f.name === 'index.html') || files[0];
  const cssFiles = files.filter(f => f.path.endsWith('.css') || f.name.endsWith('.css'));
  const jsFiles = files.filter(f => (f.path.endsWith('.js') || f.path.endsWith('.ts') || f.name.endsWith('.js')) && !f.path.endsWith('.html'));

  let baseHtml = htmlFile ? htmlFile.content : '<div class="p-8 text-center text-slate-500">No HTML file provided</div>';

  // If baseHtml doesn't have <html> structure, wrap it
  if (!baseHtml.includes('<html') && !baseHtml.includes('<!DOCTYPE') && !baseHtml.includes('<body')) {
    baseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${baseHtml}
</body>
</html>`;
  } else {
    // Inject Tailwind CDN if missing
    if (!baseHtml.includes('tailwindcss')) {
      baseHtml = baseHtml.replace('<head>', '<head>\n  <script src="https://cdn.tailwindcss.com"></script>');
    }
  }

  // Inject CSS
  if (cssFiles.length > 0) {
    const combinedCss = cssFiles.map(c => `/* ${c.name} */\n${c.content}`).join('\n\n');
    baseHtml = baseHtml.replace('</head>', `<style>\n${combinedCss}\n</style>\n</head>`);
  }

  // Inject console interceptor and JS files
  const consoleScript = `
<script>
(function() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  function sendLog(level, args) {
    try {
      window.parent.postMessage({
        type: 'SANDBOX_CONSOLE',
        level: level,
        message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        timestamp: Date.now()
      }, '*');
    } catch(e) {}
  }
  console.log = function() { sendLog('log', arguments); originalLog.apply(console, arguments); };
  console.warn = function() { sendLog('warn', arguments); originalWarn.apply(console, arguments); };
  console.error = function() { sendLog('error', arguments); originalError.apply(console, arguments); };
  window.onerror = function(msg, url, line) {
    sendLog('error', ['Uncaught exception: ' + msg + ' at line ' + line]);
  };
})();
</script>`;

  baseHtml = baseHtml.replace('<head>', `<head>${consoleScript}`);

  if (jsFiles.length > 0) {
    const combinedJs = jsFiles.map(j => `// ${j.name}\n${j.content}`).join('\n\n');
    baseHtml = baseHtml.replace('</body>', `<script>\n${combinedJs}\n</script>\n</body>`);
  }

  return baseHtml;
}
