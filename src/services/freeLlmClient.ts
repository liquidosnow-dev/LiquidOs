import OpenAI from 'openai';

export const DEFAULT_FREE_LLM_BASE_URL = 'http://localhost:3001/v1';
export const DEFAULT_FREE_LLM_API_KEY = 'not-needed-locally';

export interface FreeLlmGatewayConfig {
  baseURL: string;
  apiKey: string;
  isLocalEndpoint: boolean;
}

type GatewayEnv = {
  VITE_FREE_LLM_API_BASE?: string;
  VITE_FREE_LLM_API_KEY?: string;
};

function readImportMetaEnv(): GatewayEnv {
  return (
    (import.meta as unknown as { env?: GatewayEnv }).env ?? {}
  );
}

export function resolveFreeLlmGatewayConfig(
  env: GatewayEnv = readImportMetaEnv()
): FreeLlmGatewayConfig {
  const rawBase = env.VITE_FREE_LLM_API_BASE?.trim();
  const baseURL = rawBase ? rawBase.replace(/\/+$/, '') : DEFAULT_FREE_LLM_BASE_URL;
  const rawKey = env.VITE_FREE_LLM_API_KEY?.trim();
  const apiKey = rawKey || DEFAULT_FREE_LLM_API_KEY;

  return {
    baseURL,
    apiKey,
    isLocalEndpoint: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseURL),
  };
}

export function createFreeLlmClient(overrides?: {
  baseURL?: string;
  apiKey?: string;
}): OpenAI {
  const resolved = resolveFreeLlmGatewayConfig();
  return new OpenAI({
    baseURL: overrides?.baseURL?.trim() || resolved.baseURL,
    apiKey: overrides?.apiKey?.trim() || resolved.apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export const freeLlmClient = new OpenAI({
  baseURL: readImportMetaEnv().VITE_FREE_LLM_API_BASE || DEFAULT_FREE_LLM_BASE_URL,
  apiKey: readImportMetaEnv().VITE_FREE_LLM_API_KEY || DEFAULT_FREE_LLM_API_KEY,
  dangerouslyAllowBrowser: true,
});
