import { ProjectFile } from '../types';

/**
 * Extracts code blocks from markdown assistant responses
 * Looks for:
 * ```html <!-- filepath: index.html --> ... ```
 * or ```javascript // filepath: app.js ... ```
 * or raw ```html / ```jsx / ```tsx / ```svg blocks
 */
export function extractFilesFromResponse(markdown: string): { files: ProjectFile[]; cleanMarkdown: string } {
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?(?:\s+(?:<!--|\/\/|\/\*|#)\s*filepath:\s*([^\s*>-]+)\s*(?:-->|\*\/)?)?\n([\s\S]*?)```/g;
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
      const fpMatch = firstLine.match(/(?:<!--|\/\/|\/\*|#)\s*filepath:\s*([^\s*>-]+)/i);
      if (fpMatch) {
        filepath = fpMatch[1];
        cleanedContent = content.substring(firstLine.length).replace(/^\n+/, '');
      }
    }

    if (!filepath) {
      if (rawLang === 'html') filepath = 'index.html';
      else if (rawLang === 'css') filepath = 'styles.css';
      else if (rawLang === 'js' || rawLang === 'javascript') filepath = 'app.js';
      else if (rawLang === 'jsx' || rawLang === 'tsx') filepath = 'App.tsx';
      else if (rawLang === 'svg') filepath = 'artifact.svg';
      else if (rawLang === 'py' || rawLang === 'python') filepath = 'main.py';
      else if (rawLang === 'json') filepath = 'data.json';
      else filepath = 'snippet.' + rawLang;
    }

    let language: ProjectFile['language'] = 'html';
    if (rawLang === 'css' || rawLang === 'scss') language = 'css';
    else if (rawLang === 'js' || rawLang === 'javascript') language = 'javascript';
    else if (rawLang === 'ts' || rawLang === 'typescript' || rawLang === 'tsx' || rawLang === 'jsx') language = 'typescript';
    else if (rawLang === 'py' || rawLang === 'python') language = 'python';
    else if (rawLang === 'svg' || filepath.toLowerCase().endsWith('.svg')) language = 'svg';
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
    if (!/^[0-9+\-*/().,%^ \t\neE]+$/.test(sanitized)) {
      return { success: false, error: 'Expression contains disallowed characters' };
    }
    const normalized = sanitized.replace(/\^/g, '**');
    const val = Function(`"use strict"; return (${normalized})`)();
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return { success: false, error: 'Evaluation did not produce a valid number' };
    }
    return { success: true, result: val };
  } catch (err: any) {
    return { success: false, error: err.message || 'Math evaluation error' };
  }
}

export type PreviewRuntimeKind = 'svg' | 'react' | 'html';

const isNonBrowserModule = (filePath: string) => {
  const p = filePath.toLowerCase();
  return (
    p.startsWith('server.') ||
    p.startsWith('src/index.') ||
    p.startsWith('src/server.') ||
    p.startsWith('src/lib/') ||
    p.startsWith('verification-tools/') ||
    p.startsWith('tests/') ||
    p.includes('/api/') ||
    p.endsWith('.config.ts') ||
    p.endsWith('.test.ts') ||
    p.endsWith('.test.tsx') ||
    p.endsWith('.test.js') ||
    p.endsWith('.mjs')
  );
};

export function detectPreviewRuntime(
  files: ProjectFile[],
  preferredFilePath?: string
): { kind: PreviewRuntimeKind; entryPath: string } {
  const preferred = preferredFilePath
    ? files.find((f) => f.path === preferredFilePath || f.name === preferredFilePath)
    : undefined;

  if (preferred) {
    const lower = preferred.path.toLowerCase();
    if (lower.endsWith('.svg')) {
      return { kind: 'svg', entryPath: preferred.path };
    }
    if ((lower.endsWith('.tsx') || lower.endsWith('.jsx')) && !isNonBrowserModule(preferred.path)) {
      return { kind: 'react', entryPath: preferred.path };
    }
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return { kind: 'html', entryPath: preferred.path };
    }
  }

  const htmlFile = files.find((f) => f.path.toLowerCase().endsWith('.html') || f.name === 'index.html');
  const reactFiles = files.filter(
    (f) =>
      (f.path.toLowerCase().endsWith('.tsx') || f.path.toLowerCase().endsWith('.jsx')) &&
      !isNonBrowserModule(f.path)
  );
  const svgFile = files.find((f) => f.path.toLowerCase().endsWith('.svg'));

  if (htmlFile) {
    return { kind: 'html', entryPath: htmlFile.path };
  }
  if (reactFiles.length > 0) {
    const appReact =
      reactFiles.find((f) => /app\.(tsx|jsx)$/i.test(f.name)) || reactFiles[0];
    return { kind: 'react', entryPath: appReact.path };
  }
  if (svgFile) {
    return { kind: 'svg', entryPath: svgFile.path };
  }
  return { kind: 'html', entryPath: files[0]?.path || 'index.html' };
}

const CONSOLE_BRIDGE_SCRIPT = `
<script>
(function() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  function formatVal(a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || a.message;
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
    catch(e) { return String(a); }
  }
  function sendLog(level, args) {
    try {
      window.parent.postMessage({
        type: 'SANDBOX_CONSOLE',
        level: level,
        message: Array.from(args).map(formatVal).join(' '),
        timestamp: Date.now()
      }, '*');
    } catch(e) {}
  }
  console.log = function() { sendLog('log', arguments); originalLog.apply(console, arguments); };
  console.warn = function() { sendLog('warn', arguments); originalWarn.apply(console, arguments); };
  console.error = function() { sendLog('error', arguments); originalError.apply(console, arguments); };
  window.onerror = function(msg, url, line) {
    sendLog('error', ['Uncaught exception: ' + msg + (line ? ' at line ' + line : '')]);
  };
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event && event.reason;
    sendLog('error', ['Unhandled rejection: ' + formatVal(reason)]);
  });
  window.addEventListener('message', function(event) {
    if (!event || !event.data || event.data.type !== 'SANDBOX_EVAL') return;
    var code = String(event.data.code || '');
    if (!code.trim()) return;
    try {
      var res = (0, eval)(code);
      if (res !== undefined) {
        sendLog('log', ['=> ' + formatVal(res)]);
      } else {
        sendLog('log', ['Executed snippet']);
      }
    } catch (err) {
      sendLog('error', [err && err.message ? err.message : String(err)]);
    }
  });
})();
</script>`;

function transformReactModulesForBrowser(reactFiles: ProjectFile[], entryPath: string): string {
  const ordered = [
    ...reactFiles.filter((f) => f.path !== entryPath),
    ...reactFiles.filter((f) => f.path === entryPath),
  ];

  const blocks = ordered.map((file, idx) => {
    let code = file.content;
    // Strip external React / lucide imports and provide React hooks + lightweight Lucide icons on window
    code = code.replace(/^\s*import\s+[\s\S]*?from\s+['"]react['"]\s*;?\s*$/gm, '');
    code = code.replace(/^\s*import\s+[\s\S]*?from\s+['"]react-dom(?:\/client)?['"]\s*;?\s*$/gm, '');
    code = code.replace(/^\s*import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]\s*;?\s*$/gm, (_m, names) => {
      const ids = String(names)
        .split(',')
        .map((n) => n.trim().split(/\s+as\s+/).pop()?.trim())
        .filter(Boolean);
      return ids.map((id) => `const ${id} = __createIconProxy('${id}');`).join('\n');
    });
    // Strip relative local imports (adjacent files are concatenated in order)
    code = code.replace(/^\s*import\s+[\s\S]*?from\s+['"]\.[^'"]+['"]\s*;?\s*$/gm, '');
    // Normalize exports so entry component binds cleanly
    const isEntry = idx === ordered.length - 1;
    code = code.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, isEntry ? 'const __DefaultArtifact = function $1' : 'function $1');
    code = code.replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)/g, isEntry ? 'const __DefaultArtifact = class $1' : 'class $1');
    code = code.replace(/export\s+default\s+/g, isEntry ? 'const __DefaultArtifact = ' : 'const __ExportedSub = ');
    code = code.replace(/^\s*export\s+(?=(const|let|var|function|class)\b)/gm, '');
    return `// --- ${file.path} ---\n${code}`;
  });

  const combinedSource = blocks.join('\n\n');
  // Find fallback component identifier if export default wasn't explicit
  const namedComponentMatch = combinedSource.match(/(?:function|const)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=|\()/);
  const fallbackName = namedComponentMatch ? namedComponentMatch[1] : 'App';

  return `
const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
  useContext,
  createContext,
  Fragment
} = React;

function __createIconProxy(name) {
  return function SandboxIcon(props) {
    const size = (props && props.size) || 16;
    const className = (props && props.className) || '';
    return React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: 'inline-block shrink-0 ' + className,
        'aria-label': name,
      },
      React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
      React.createElement('path', { d: 'M9 12h6M12 9v6' })
    );
  };
}

class __PreviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error('React Runtime Error:', error && error.message ? error.message : String(error));
  }
  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        { className: 'm-4 p-4 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 font-mono text-xs' },
        React.createElement('div', { className: 'font-bold mb-1' }, 'Component Render Error'),
        React.createElement('pre', { className: 'whitespace-pre-wrap' }, String(this.state.error.message || this.state.error))
      );
    }
    return this.props.children;
  }
}

${combinedSource}

;(function() {
  var Target = typeof __DefaultArtifact !== 'undefined'
    ? __DefaultArtifact
    : (typeof ${fallbackName} !== 'undefined' ? ${fallbackName} : null);
  var rootEl = document.getElementById('root');
  if (rootEl && Target) {
    ReactDOM.createRoot(rootEl).render(
      React.createElement(__PreviewErrorBoundary, null, React.createElement(Target))
    );
  } else if (rootEl) {
    console.warn('No root React component found to mount in preview.');
  }
})();
`;
}

/**
 * Builds composite HTML document for the sandboxed preview iframe.
 * Supports HTML, CSS, JavaScript, React (.tsx/.jsx), and SVG (.svg) artifacts.
 */
export function bundlePreviewHtml(files: ProjectFile[], preferredFilePath?: string): string {
  const { kind, entryPath } = detectPreviewRuntime(files, preferredFilePath);
  const cssFiles = files.filter((f) => f.path.endsWith('.css') || f.name.endsWith('.css'));
  const combinedCss = cssFiles.map((c) => `/* ${c.name} */\n${c.content}`).join('\n\n');

  if (kind === 'svg') {
    const svgFile = files.find((f) => f.path === entryPath) || files.find((f) => f.path.endsWith('.svg'));
    const svgMarkup = svgFile ? svgFile.content : '<svg viewBox="0 0 100 100"></svg>';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${CONSOLE_BRIDGE_SCRIPT}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #060913;
      background-image: radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px);
      background-size: 20px 20px;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .svg-stage svg {
      max-width: 90vw;
      max-height: 82vh;
      filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.45));
    }
    ${combinedCss}
  </style>
</head>
<body>
  <div class="svg-stage p-6">${svgMarkup}</div>
  <script>
    console.log('SVG artifact mounted: ${entryPath}');
  </script>
</body>
</html>`;
  }

  if (kind === 'react') {
    const reactFiles = files.filter(
      (f) =>
        (f.path.toLowerCase().endsWith('.tsx') || f.path.toLowerCase().endsWith('.jsx')) &&
        !isNonBrowserModule(f.path)
    );
    const transpiledSource = transformReactModulesForBrowser(reactFiles, entryPath)
      .replace(/<\/script>/gi, '<\\/script>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${CONSOLE_BRIDGE_SCRIPT}
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background: #020617; color: #f1f5f9; }
    ${combinedCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
${transpiledSource}
  </script>
</body>
</html>`;
  }

  // HTML + CSS + JavaScript mode
  const htmlFile =
    files.find((f) => f.path === entryPath && (f.path.endsWith('.html') || f.path.endsWith('.htm'))) ||
    files.find((f) => f.path.endsWith('.html') || f.name === 'index.html') ||
    files[0];

  const clientJsFiles = files.filter(
    (f) =>
      f.path.endsWith('.js') &&
      !f.path.endsWith('.test.js') &&
      !isNonBrowserModule(f.path)
  );

  let baseHtml = htmlFile ? htmlFile.content : '<div class="p-8 text-center text-slate-500">No HTML file provided</div>';

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
    if (!baseHtml.includes('tailwindcss')) {
      baseHtml = baseHtml.replace('<head>', '<head>\n  <script src="https://cdn.tailwindcss.com"></script>');
    }
  }

  if (cssFiles.length > 0) {
    baseHtml = baseHtml.replace('</head>', `<style>\n${combinedCss}\n</style>\n</head>`);
  }

  baseHtml = baseHtml.replace('<head>', `<head>${CONSOLE_BRIDGE_SCRIPT}`);

  if (clientJsFiles.length > 0) {
    for (const j of clientJsFiles) {
      const hasModules = j.content.includes('import ') || j.content.includes('export ');
      const scriptTag = hasModules
        ? `<script type="module">\n// ${j.name}\n${j.content}\n</script>`
        : `<script>\n// ${j.name}\n${j.content}\n</script>`;
      baseHtml = baseHtml.replace('</body>', `${scriptTag}\n</body>`);
    }
  }

  return baseHtml;
}
