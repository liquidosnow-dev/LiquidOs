import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  CODEX_PUTER_TOOLS,
  dispatchCodexToolCall,
  runCodexPuterChat,
  type PuterAiChatFn,
} from './codexToolEngine';
import type { ModelHyperparameters, ModelOption } from '../types';

const TEST_MODEL: ModelOption = {
  id: 'claude-3.7-sonnet',
  name: 'Claude 3.7 Sonnet',
  provider: 'Anthropic',
  badges: ['Reasoning', 'Tools'],
  supportsTools: true,
  supportsReasoning: true,
  supportsVision: true,
  supportsThinkingHigh: true,
  supportsPuter: true,
  puterModelId: 'claude-3-7-sonnet',
  description: 'Test model',
};

const TEST_SETTINGS: ModelHyperparameters = {
  temperature: 0.4,
  topP: 0.9,
  seed: 42,
  maxOutput: 4096,
  minP: 0.05,
  repetitionPenalty: 1.0,
  buildQuality: 'thorough',
  quickEdits: true,
};

test('CODEX_PUTER_TOOLS registers execute_code, web_fetch, math_eval, and create_file', () => {
  const names = CODEX_PUTER_TOOLS.map((t) => t.function.name);
  assert.deepEqual(names, ['execute_code', 'web_fetch', 'math_eval', 'create_file']);
});

test('dispatchCodexToolCall executes math_eval, create_file, execute_code, and web_fetch cleanly', async () => {
  const created: Array<{ path: string; content: string }> = [];
  const mockFetch = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === '/api/tools/execute') {
      return new Response(
        JSON.stringify({
          success: true,
          runtime: body.language === 'python' ? 'python3' : 'node:vm',
          result: '42',
          logs: ['42'],
          executionTimeMs: 9,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url === '/api/tools/fetch') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 200,
          contentType: 'json',
          data: { ok: true, url: body.url },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as unknown as typeof fetch;

  const mathRes = await dispatchCodexToolCall('math_eval', { expression: '(15 + 5) * 2' });
  assert.equal(mathRes.toolCall.status, 'success');
  assert.equal(mathRes.toolCall.result.result, 40);

  const fileRes = await dispatchCodexToolCall(
    'create_file',
    { path: 'src/Logo.svg', content: '<svg viewBox="0 0 10 10"></svg>' },
    { onCreateFile: (f) => created.push(f) }
  );
  assert.equal(fileRes.toolCall.status, 'success');
  assert.equal(created.length, 1);
  assert.equal(created[0].path, 'src/Logo.svg');

  // Path traversal rejected safely
  const badFileRes = await dispatchCodexToolCall(
    'create_file',
    { path: '../etc/passwd', content: 'nope' },
    { onCreateFile: (f) => created.push(f) }
  );
  assert.equal(badFileRes.toolCall.status, 'failed');

  const execRes = await dispatchCodexToolCall(
    'execute_code',
    { language: 'python', code: 'print(6 * 7)' },
    { fetchFn: mockFetch }
  );
  assert.equal(execRes.toolCall.status, 'success');
  assert.equal(execRes.toolCall.result.result, '42');

  const fetchRes = await dispatchCodexToolCall(
    'web_fetch',
    { url: 'https://example.com/status.json' },
    { fetchFn: mockFetch }
  );
  assert.equal(fetchRes.toolCall.status, 'success');
  assert.equal(fetchRes.toolCall.result.data.ok, true);
});

test('runCodexPuterChat executes multi-turn puter.ai.chat tool-calling loop and persists created files', async () => {
  let callTurn = 0;
  const createdFiles: Array<{ path: string; content: string }> = [];

  const mockPuterChat: PuterAiChatFn = async (_msgs, opts) => {
    callTurn += 1;
    assert.equal(opts?.model, 'claude-3-7-sonnet');
    assert.equal(Array.isArray(opts?.tools), true);

    if (callTurn === 1) {
      return {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_math_1',
              type: 'function',
              function: {
                name: 'math_eval',
                arguments: JSON.stringify({ expression: '12 * 12' }),
              },
            },
            {
              id: 'call_file_1',
              type: 'function',
              function: {
                name: 'create_file',
                arguments: JSON.stringify({
                  path: 'Counter.tsx',
                  content: 'export default function Counter() { return <div>144</div>; }',
                  language: 'typescript',
                }),
              },
            },
          ],
        },
      };
    }

    return {
      message: {
        role: 'assistant',
        content: 'Created `Counter.tsx` displaying 144.',
      },
    };
  };

  const result = await runCodexPuterChat({
    promptText: 'Build a counter widget showing 12*12',
    history: [],
    selectedModel: TEST_MODEL,
    settings: TEST_SETTINGS,
    workspaceFiles: [],
    puterAiChat: mockPuterChat,
    onCreateFile: (f) => createdFiles.push(f),
  });

  assert.equal(result.runtimeUsed, 'puter-sdk');
  assert.equal(callTurn, 2);
  assert.equal(result.replyText.includes('Counter.tsx'), true);
  assert.equal(result.toolCalls.length, 2);
  assert.equal(result.toolCalls[0].toolName, 'math_eval');
  assert.equal(result.toolCalls[1].toolName, 'create_file');
  assert.equal(createdFiles.length, 1);
  assert.equal(createdFiles[0].path, 'Counter.tsx');
});

test('runCodexPuterChat falls back to /api/ai/chat cleanly when Puter SDK is unavailable', async () => {
  const createdFiles: Array<{ path: string; content: string }> = [];
  const mockFetch = (async (url: string) => {
    if (url === '/api/ai/chat') {
      return new Response(
        JSON.stringify({
          success: true,
          text: 'Here is your SVG badge:\n\n```svg\n<!-- filepath: badge.svg -->\n<svg viewBox="0 0 120 40"><rect width="120" height="40" fill="#0ea5e9"/></svg>\n```',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as unknown as typeof fetch;

  const result = await runCodexPuterChat({
    promptText: 'calculate 8 + 9 and create an SVG badge',
    history: [],
    selectedModel: TEST_MODEL,
    settings: TEST_SETTINGS,
    workspaceFiles: [],
    puterAiChat: null,
    fetchFn: mockFetch,
    onCreateFile: (f) => createdFiles.push(f),
  });

  assert.equal(result.runtimeUsed, 'server-chat');
  assert.equal(result.toolCalls.some((tc) => tc.toolName === 'math_eval' && tc.result?.result === 17), true);
  assert.equal(result.toolCalls.some((tc) => tc.toolName === 'create_file'), true);
  assert.equal(createdFiles[0].path, 'badge.svg');
});
