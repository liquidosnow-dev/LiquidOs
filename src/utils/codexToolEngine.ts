import { ChatMessage, ModelHyperparameters, ModelOption, ProjectFile, ToolCall } from '../types';
import { validateIngestPath } from './onDeviceFs';
import { extractFilesFromResponse, safeEvaluateMath } from './toolExecutor';

export interface PuterToolFunctionSchema {
  type: 'function';
  function: {
    name: 'execute_code' | 'web_fetch' | 'math_eval' | 'create_file';
    description: string;
    parameters: Record<string, any>;
    strict?: boolean;
  };
}

export interface PuterToolCallPayload {
  id?: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string | Record<string, any>;
  };
}

export interface PuterChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: PuterToolCallPayload[];
}

export interface PuterChatResponse {
  message?: {
    role?: string;
    content?: string | Array<{ type?: string; text?: string }> | null;
    tool_calls?: PuterToolCallPayload[];
    reasoning_content?: string;
  };
  text?: string;
  toString?: () => string;
}

export type PuterAiChatFn = (
  promptOrMessages: string | PuterChatMessage[],
  options?: {
    model?: string;
    tools?: PuterToolFunctionSchema[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }
) => Promise<PuterChatResponse | string>;

export const CODEX_PUTER_TOOLS: PuterToolFunctionSchema[] = [
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description:
        'Execute JavaScript (isolated node:vm) or Python 3 (isolated subprocess) code on the Codex sandbox runner and inspect stdout, logs, and return values.',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['javascript', 'python'],
            description: 'Target sandbox runtime language.',
          },
          code: {
            type: 'string',
            description: 'Source code to run inside the isolated sandbox.',
          },
        },
        required: ['language', 'code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description:
        'Fetch public HTTP/HTTPS web pages or JSON APIs via the Codex server proxy with SSRF protection.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Public http:// or https:// URL to retrieve.',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'math_eval',
      description:
        'Safely evaluate deterministic mathematical expressions (arithmetic, parentheses, exponents).',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Algebraic numeric expression to compute, e.g. "(128 * 4) + 2^8".',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description:
        'Create or update a file in the live project workspace (HTML, CSS, JS, React TSX/JSX, Python, SVG, JSON).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path within the workspace, e.g. "App.tsx", "styles.css", or "hero.svg".',
          },
          content: {
            type: 'string',
            description: 'Complete file contents.',
          },
          language: {
            type: 'string',
            description: 'Optional language hint (html, css, javascript, typescript, python, svg, json).',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
];

export interface CodexToolDispatchCallbacks {
  fetchFn?: typeof fetch;
  onCreateFile?: (file: { path: string; content: string; language?: string }) => void;
}

export interface DispatchedToolResult {
  toolCall: ToolCall;
  serializedOutput: string;
}

export function getPuterAiChat(win: any = typeof window !== 'undefined' ? window : undefined): PuterAiChatFn | null {
  if (win && win.puter && win.puter.ai && typeof win.puter.ai.chat === 'function') {
    return win.puter.ai.chat.bind(win.puter.ai);
  }
  return null;
}

function normalizePuterContent(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
  fallbackResponse?: PuterChatResponse
): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof fallbackResponse?.text === 'string') return fallbackResponse.text;
  if (fallbackResponse && typeof fallbackResponse.toString === 'function') {
    const str = fallbackResponse.toString();
    if (str && str !== '[object Object]') return str;
  }
  return '';
}

function parseToolArgs(rawArgs: string | Record<string, any> | undefined): Record<string, any> {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object') return rawArgs;
  try {
    const parsed = JSON.parse(rawArgs);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function dispatchCodexToolCall(
  toolName: string,
  rawArgs: string | Record<string, any>,
  callbacks: CodexToolDispatchCallbacks = {}
): Promise<DispatchedToolResult> {
  const start = Date.now();
  const args = parseToolArgs(rawArgs);
  const fetchFn = callbacks.fetchFn || (typeof fetch !== 'undefined' ? fetch : undefined);
  const id = 'tc_' + Math.random().toString(36).substring(2, 9);

  if (toolName === 'math_eval') {
    const expr = String(args.expression ?? args.code ?? '').trim();
    const res = safeEvaluateMath(expr);
    const toolCall: ToolCall = {
      id,
      toolName: 'math_eval',
      status: res.success ? 'success' : 'failed',
      arguments: { expression: expr },
      result: res.success ? { expression: expr, result: res.result } : undefined,
      error: res.error,
      executionTimeMs: Math.max(1, Date.now() - start),
      timestamp: Date.now(),
    };
    return {
      toolCall,
      serializedOutput: JSON.stringify(res.success ? { success: true, result: res.result } : { success: false, error: res.error }),
    };
  }

  if (toolName === 'create_file') {
    const rawPath = String(args.path ?? args.filename ?? '').trim();
    const content = typeof args.content === 'string' ? args.content : '';
    const language = typeof args.language === 'string' ? args.language : undefined;
    const pathCheck = validateIngestPath(rawPath);

    if (!pathCheck.ok) {
      const toolCall: ToolCall = {
        id,
        toolName: 'create_file',
        status: 'failed',
        arguments: { path: rawPath, bytes: content.length },
        error: pathCheck.reason,
        executionTimeMs: Math.max(1, Date.now() - start),
        timestamp: Date.now(),
      };
      return {
        toolCall,
        serializedOutput: JSON.stringify({ success: false, error: pathCheck.reason }),
      };
    }

    callbacks.onCreateFile?.({
      path: pathCheck.path,
      content,
      language,
    });

    const resultPayload = {
      success: true,
      path: pathCheck.path,
      bytes: content.length,
      language: language || pathCheck.path.split('.').pop() || 'text',
    };
    const toolCall: ToolCall = {
      id,
      toolName: 'create_file',
      status: 'success',
      arguments: { path: pathCheck.path, language, bytes: content.length },
      result: resultPayload,
      executionTimeMs: Math.max(1, Date.now() - start),
      timestamp: Date.now(),
    };
    return {
      toolCall,
      serializedOutput: JSON.stringify(resultPayload),
    };
  }

  if (toolName === 'execute_code') {
    const language = String(args.language ?? 'javascript').toLowerCase();
    const code = typeof args.code === 'string' ? args.code : '';
    if (!code.trim()) {
      const toolCall: ToolCall = {
        id,
        toolName: 'execute_code',
        status: 'failed',
        arguments: { language, code },
        error: 'Code payload is empty',
        executionTimeMs: Math.max(1, Date.now() - start),
        timestamp: Date.now(),
      };
      return {
        toolCall,
        serializedOutput: JSON.stringify({ success: false, error: 'Code payload is empty' }),
      };
    }

    if (!fetchFn) {
      throw new Error('fetch is unavailable for execute_code dispatch');
    }

    try {
      const resp = await fetchFn('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code }),
      });
      const data = await resp.json();
      const toolCall: ToolCall = {
        id,
        toolName: 'execute_code',
        status: data.success ? 'success' : 'failed',
        arguments: { language, code },
        result: data.success
          ? { runtime: data.runtime || language, result: data.result, logs: data.logs || [] }
          : undefined,
        error: data.success ? undefined : data.error || 'Sandbox execution failed',
        executionTimeMs: data.executionTimeMs ?? Math.max(1, Date.now() - start),
        timestamp: Date.now(),
      };
      return {
        toolCall,
        serializedOutput: JSON.stringify(data),
      };
    } catch (err: any) {
      const message = err?.message || 'Failed to invoke /api/tools/execute';
      const toolCall: ToolCall = {
        id,
        toolName: 'execute_code',
        status: 'failed',
        arguments: { language, code },
        error: message,
        executionTimeMs: Math.max(1, Date.now() - start),
        timestamp: Date.now(),
      };
      return {
        toolCall,
        serializedOutput: JSON.stringify({ success: false, error: message }),
      };
    }
  }

  if (toolName === 'web_fetch') {
    const url = String(args.url ?? '').trim();
    if (!fetchFn) {
      throw new Error('fetch is unavailable for web_fetch dispatch');
    }
    try {
      const resp = await fetchFn('/api/tools/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      const toolCall: ToolCall = {
        id,
        toolName: 'web_fetch',
        status: data.success ? 'success' : 'failed',
        arguments: { url },
        result: data.success
          ? {
              status: data.status,
              contentType: data.contentType,
              length: data.length,
              data: typeof data.data === 'string' ? data.data.slice(0, 1200) : data.data,
            }
          : undefined,
        error: data.success ? undefined : data.error || 'Failed to fetch URL',
        executionTimeMs: Math.max(1, Date.now() - start),
        timestamp: Date.now(),
      };
      return {
        toolCall,
        serializedOutput: JSON.stringify(data),
      };
    } catch (err: any) {
      const message = err?.message || 'Failed to invoke /api/tools/fetch';
      const toolCall: ToolCall = {
        id,
        toolName: 'web_fetch',
        status: 'failed',
        arguments: { url },
        error: message,
        executionTimeMs: Math.max(1, Date.now() - start),
        timestamp: Date.now(),
      };
      return {
        toolCall,
        serializedOutput: JSON.stringify({ success: false, error: message }),
      };
    }
  }

  const unknownCall: ToolCall = {
    id,
    toolName: 'execute_code',
    status: 'failed',
    arguments: { toolName, ...args },
    error: `Unsupported Codex tool: ${toolName}`,
    executionTimeMs: Math.max(1, Date.now() - start),
    timestamp: Date.now(),
  };
  return {
    toolCall: unknownCall,
    serializedOutput: JSON.stringify({ success: false, error: unknownCall.error }),
  };
}

export interface RunCodexChatOptions {
  promptText: string;
  history: ChatMessage[];
  selectedModel: ModelOption;
  persona?: string;
  settings: ModelHyperparameters;
  workspaceFiles: ProjectFile[];
  vectorHits?: Array<{ url?: string; content?: string; similarity?: number }>;
  existingToolCalls?: ToolCall[];
  puterAiChat?: PuterAiChatFn | null;
  fetchFn?: typeof fetch;
  onCreateFile?: (file: { path: string; content: string; language?: string }) => void;
  maxToolRounds?: number;
}

export interface RunCodexChatResult {
  replyText: string;
  toolCalls: ToolCall[];
  generatedFiles: Array<{ path: string; content: string; language?: string }>;
  runtimeUsed: 'puter-sdk' | 'server-chat';
  reasoningTrace?: string;
}

export async function runCodexPuterChat(options: RunCodexChatOptions): Promise<RunCodexChatResult> {
  const {
    promptText,
    history,
    selectedModel,
    persona,
    settings,
    workspaceFiles,
    vectorHits = [],
    existingToolCalls = [],
    fetchFn = typeof fetch !== 'undefined' ? fetch : undefined,
    onCreateFile,
    maxToolRounds = 5,
  } = options;

  const toolCalls: ToolCall[] = [...existingToolCalls];
  const createdFilesMap = new Map<string, { path: string; content: string; language?: string }>();

  const recordCreatedFile = (file: { path: string; content: string; language?: string }) => {
    createdFilesMap.set(file.path, file);
    onCreateFile?.(file);
  };

  // Pre-flight explicit deterministic tools requested in prompt
  const mathMatch = promptText.match(/(?:calculate|math|eval|compute)\s+([0-9+\-*/().,%^ \t\neE]+)/i);
  if (mathMatch) {
    const { toolCall } = await dispatchCodexToolCall(
      'math_eval',
      { expression: mathMatch[1] },
      { fetchFn, onCreateFile: recordCreatedFile }
    );
    toolCalls.push(toolCall);
  }

  const fetchMatch = promptText.match(/(?:fetch|get|scrape|inspect)\s+(https?:\/\/[^\s"'<>]+)/i);
  if (fetchMatch) {
    const { toolCall } = await dispatchCodexToolCall(
      'web_fetch',
      { url: fetchMatch[1] },
      { fetchFn, onCreateFile: recordCreatedFile }
    );
    toolCalls.push(toolCall);
  }

  const inlineCodeMatch = promptText.match(/```(js|javascript|python|py)\s*\n([\s\S]*?)```/i);
  if (inlineCodeMatch) {
    const rawLang = inlineCodeMatch[1].toLowerCase();
    const lang = rawLang === 'py' || rawLang === 'python' ? 'python' : 'javascript';
    const { toolCall } = await dispatchCodexToolCall(
      'execute_code',
      { language: lang, code: inlineCodeMatch[2] },
      { fetchFn, onCreateFile: recordCreatedFile }
    );
    toolCalls.push(toolCall);
  }

  const puterChat = options.puterAiChat !== undefined ? options.puterAiChat : getPuterAiChat();
  const shouldUsePuter = Boolean(puterChat && selectedModel.supportsPuter !== false);

  if (shouldUsePuter && puterChat) {
    try {
      const workspaceFileNames = workspaceFiles.map((f) => f.path).slice(0, 24).join(', ');
      const vectorContextText =
        vectorHits.length > 0
          ? `\nLive Preview Vector Context:\n${vectorHits
              .slice(0, 4)
              .map((h, i) => `[${i + 1}] (${h.url || 'preview'}): ${String(h.content || '').slice(0, 220)}`)
              .join('\n')}`
          : '';

      const systemContent = [
        'You are Codex inside LiquidOS ONE, a full-stack application builder with live tool-calling capabilities.',
        persona ? `Active Persona: ${persona}.` : '',
        workspaceFileNames ? `Current Workspace Files: ${workspaceFileNames}.` : '',
        selectedModel.supportsTools
          ? 'Use the provided tools (execute_code, web_fetch, math_eval, create_file) whenever executing code, fetching URLs, evaluating math, or creating/updating workspace files.'
          : 'Provide clear reasoning and clean fenced code blocks with filepath annotations.',
        vectorContextText,
      ]
        .filter(Boolean)
        .join('\n');

      const conversation: PuterChatMessage[] = [
        { role: 'system', content: systemContent },
        ...history.slice(-8).map((m) => ({
          role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: promptText },
      ];

      let finalReplyText = '';
      let reasoningTrace: string | undefined;
      const targetPuterModel = selectedModel.puterModelId || selectedModel.id;

      for (let round = 0; round < maxToolRounds; round++) {
        const response = await puterChat(conversation, {
          model: targetPuterModel,
          tools: selectedModel.supportsTools ? CODEX_PUTER_TOOLS : undefined,
          temperature: settings.temperature,
          max_tokens: settings.maxOutput,
        });

        if (typeof response === 'string') {
          finalReplyText = response;
          break;
        }

        const msg = response?.message;
        if (msg?.reasoning_content) {
          reasoningTrace = reasoningTrace
            ? `${reasoningTrace}\n${msg.reasoning_content}`
            : msg.reasoning_content;
        }

        const pendingToolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
        const textContent = normalizePuterContent(msg?.content, response);

        if (pendingToolCalls.length === 0) {
          finalReplyText = textContent;
          break;
        }

        conversation.push({
          role: 'assistant',
          content: msg?.content && typeof msg.content === 'string' ? msg.content : null,
          tool_calls: pendingToolCalls,
        });

        for (let i = 0; i < pendingToolCalls.length; i++) {
          const tcPayload = pendingToolCalls[i];
          const toolCallId = tcPayload.id || `call_${round}_${i}`;
          const dispatched = await dispatchCodexToolCall(
            tcPayload.function.name,
            tcPayload.function.arguments,
            { fetchFn, onCreateFile: recordCreatedFile }
          );
          toolCalls.push(dispatched.toolCall);
          conversation.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: dispatched.serializedOutput,
          });
        }
      }

      if (finalReplyText.trim()) {
        const extracted = extractFilesFromResponse(finalReplyText);
        for (const f of extracted.files) {
          if (!createdFilesMap.has(f.path)) {
            const { toolCall } = await dispatchCodexToolCall(
              'create_file',
              { path: f.path, content: f.content, language: f.language },
              { fetchFn, onCreateFile: recordCreatedFile }
            );
            toolCalls.push(toolCall);
          }
        }

        return {
          replyText: finalReplyText,
          toolCalls,
          generatedFiles: Array.from(createdFilesMap.values()),
          runtimeUsed: 'puter-sdk',
          reasoningTrace,
        };
      }
    } catch (puterErr) {
      // Fall through cleanly to backend /api/ai/chat + deterministic tool execution if Puter session is unauthenticated or offline
      console.warn('Puter SDK chat fell back to server synthesis:', puterErr);
    }
  }

  // Fallback / server-backed Codex endpoint (/api/ai/chat)
  if (!fetchFn) {
    throw new Error('fetch is unavailable for server chat fallback');
  }

  const response = await fetchFn('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        ...history,
        {
          id: 'u_' + Date.now(),
          sender: 'user',
          content: promptText,
          timestamp: Date.now(),
        },
      ],
      model: selectedModel.id,
      persona,
      settings,
      toolsEnabled: selectedModel.supportsTools,
      vectorContext: vectorHits.map((h) => ({
        url: h.url,
        content: h.content,
        similarity: h.similarity,
      })),
    }),
  });

  const data = await response.json();
  const replyText = data.text || 'Application changes synthesized.';

  // Extract generated files and record genuine create_file tool dispatches
  const { files: extractedFiles } = extractFilesFromResponse(replyText);
  for (const f of extractedFiles) {
    const { toolCall } = await dispatchCodexToolCall(
      'create_file',
      { path: f.path, content: f.content, language: f.language },
      { fetchFn, onCreateFile: recordCreatedFile }
    );
    toolCalls.push(toolCall);
  }

  return {
    replyText,
    toolCalls,
    generatedFiles: Array.from(createdFilesMap.values()),
    runtimeUsed: 'server-chat',
  };
}
