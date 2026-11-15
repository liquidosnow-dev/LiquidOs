import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import {
  DEFAULT_FREE_LLM_API_KEY,
  DEFAULT_FREE_LLM_BASE_URL,
  createFreeLlmClient,
  freeLlmClient,
  resolveFreeLlmGatewayConfig,
} from './freeLlmClient';

test('resolveFreeLlmGatewayConfig uses local FreeLLMAPI defaults when env vars are unset', () => {
  const cfg = resolveFreeLlmGatewayConfig({});
  assert.equal(cfg.baseURL, DEFAULT_FREE_LLM_BASE_URL);
  assert.equal(cfg.apiKey, DEFAULT_FREE_LLM_API_KEY);
  assert.equal(cfg.isLocalEndpoint, true);
});

test('resolveFreeLlmGatewayConfig normalizes trailing slashes and detects remote gateways', () => {
  const cfg = resolveFreeLlmGatewayConfig({
    VITE_FREE_LLM_API_BASE: ' https://gateway.example.com/v1/// ',
    VITE_FREE_LLM_API_KEY: ' sk-gateway-test ',
  });
  assert.equal(cfg.baseURL, 'https://gateway.example.com/v1');
  assert.equal(cfg.apiKey, 'sk-gateway-test');
  assert.equal(cfg.isLocalEndpoint, false);
});

test('freeLlmClient and createFreeLlmClient instantiate OpenAI-compatible clients', () => {
  assert.ok(freeLlmClient instanceof OpenAI);
  assert.equal(freeLlmClient.baseURL, DEFAULT_FREE_LLM_BASE_URL);

  const custom = createFreeLlmClient({
    baseURL: 'http://127.0.0.1:4010/v1',
    apiKey: 'local-token',
  });
  assert.ok(custom instanceof OpenAI);
  assert.equal(custom.baseURL, 'http://127.0.0.1:4010/v1');
  assert.equal(custom.apiKey, 'local-token');
});
