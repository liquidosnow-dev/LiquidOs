export type SentimentType = 'positive' | 'neutral' | 'frustrated' | 'inquisitive';

export interface InteractionRecord {
  id: string;
  timestamp: number;
  promptLength: number;
  sentiment: SentimentType;
  responseTimeMs: number;
  toolInvocations: string[];
  resolved: boolean;
}

export interface SentimentMetricsSummary {
  totalInteractions: number;
  averageResponseTimeMs: number;
  sentimentBreakdown: Record<SentimentType, number>;
  resolutionRate: number;
}

export const SENTIMENT_STORAGE_KEY = 'liquidos_sentiment_metadata_v1';
const MAX_STORED_INTERACTIONS = 500;

const FRUSTRATION_KEYWORDS = ['error', 'broken', 'fail', 'stuck', 'wrong', 'why did', 'again', 'fix this'];
const POSITIVE_KEYWORDS = ['thanks', 'great', 'awesome', 'perfect', 'resolved', 'working', 'good job'];
const INQUISITIVE_KEYWORDS = ['how', 'why', 'what', 'explain', 'compare', 'explore', 'can you'];

let memoryFallbackRecords: InteractionRecord[] = [];

export function classifySentiment(prompt: string): SentimentType {
  const lower = prompt.toLowerCase();
  if (FRUSTRATION_KEYWORDS.some((k) => lower.includes(k))) return 'frustrated';
  if (POSITIVE_KEYWORDS.some((k) => lower.includes(k))) return 'positive';
  if (INQUISITIVE_KEYWORDS.some((k) => lower.includes(k))) return 'inquisitive';
  return 'neutral';
}

export function getStoredInteractions(): InteractionRecord[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SENTIMENT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [...memoryFallbackRecords];
  } catch {
    return [];
  }
}

export function clearStoredInteractions(): void {
  memoryFallbackRecords = [];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SENTIMENT_STORAGE_KEY);
    }
  } catch {
    // ignore storage access errors
  }
}

export function recordInteraction(
  record: Omit<InteractionRecord, 'id' | 'timestamp'>
): InteractionRecord {
  const current = getStoredInteractions();
  const newRecord: InteractionRecord = {
    ...record,
    id: `intent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  const updated = [newRecord, ...current].slice(0, MAX_STORED_INTERACTIONS);
  memoryFallbackRecords = updated;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SENTIMENT_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to persist sentiment metadata:', e);
  }
  return newRecord;
}

export function computeSentimentMetrics(records: InteractionRecord[]): SentimentMetricsSummary {
  const totalInteractions = records.length;
  if (totalInteractions === 0) {
    return {
      totalInteractions: 0,
      averageResponseTimeMs: 0,
      sentimentBreakdown: { positive: 0, neutral: 0, frustrated: 0, inquisitive: 0 },
      resolutionRate: 0,
    };
  }

  const totalTime = records.reduce((acc, r) => acc + r.responseTimeMs, 0);
  const resolvedCount = records.filter((r) => r.resolved).length;

  const sentimentBreakdown: Record<SentimentType, number> = {
    positive: 0,
    neutral: 0,
    frustrated: 0,
    inquisitive: 0,
  };

  records.forEach((r) => {
    sentimentBreakdown[r.sentiment] = (sentimentBreakdown[r.sentiment] || 0) + 1;
  });

  return {
    totalInteractions,
    averageResponseTimeMs: Math.round(totalTime / totalInteractions),
    sentimentBreakdown,
    resolutionRate: Number((resolvedCount / totalInteractions).toFixed(2)),
  };
}

type TelemetryEnv = {
  VITE_SENTIMENT_TELEMETRY_URL?: string;
};

function readTelemetryEnv(): TelemetryEnv {
  const processUrl =
    typeof process !== 'undefined' && process.env
      ? process.env.VITE_SENTIMENT_TELEMETRY_URL
      : undefined;
  const metaEnv = (import.meta as unknown as { env?: TelemetryEnv }).env;
  return {
    VITE_SENTIMENT_TELEMETRY_URL: processUrl ?? metaEnv?.VITE_SENTIMENT_TELEMETRY_URL,
  };
}

export function resolveSentimentTelemetryUrl(
  env: TelemetryEnv = readTelemetryEnv()
): string | null {
  const raw = env.VITE_SENTIMENT_TELEMETRY_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export type TelemetryTriggerReason = 'resolved' | 'session_close';

export interface SessionTelemetryStats {
  sessionInteractions: number;
  sessionResolved: number;
  sessionAverageResponseTimeMs: number;
  sessionDurationMs: number;
}

export interface RemoteTelemetryPayload {
  event: 'assistant_interaction' | 'assistant_session_summary';
  trigger: TelemetryTriggerReason;
  source: 'liquidos-one';
  sentAt: number;
  record?: InteractionRecord;
  summary: SentimentMetricsSummary;
  sessionStats?: SessionTelemetryStats;
}

export async function pushTelemetryEvent(
  record: InteractionRecord | undefined,
  summary: SentimentMetricsSummary = computeSentimentMetrics(getStoredInteractions()),
  endpointOverride?: string,
  trigger: TelemetryTriggerReason = 'resolved',
  sessionStats?: SessionTelemetryStats,
  preferBeacon: boolean = false
): Promise<boolean> {
  const targetUrl = endpointOverride
    ? resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: endpointOverride })
    : resolveSentimentTelemetryUrl();

  if (!targetUrl) {
    return false;
  }

  const payload: RemoteTelemetryPayload = {
    event: trigger === 'session_close' ? 'assistant_session_summary' : 'assistant_interaction',
    trigger,
    source: 'liquidos-one',
    sentAt: Date.now(),
    ...(record ? { record } : {}),
    summary,
    ...(sessionStats ? { sessionStats } : {}),
  };

  const serialized = JSON.stringify(payload);

  if (
    preferBeacon &&
    trigger === 'session_close' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    try {
      const blob =
        typeof Blob !== 'undefined'
          ? new Blob([serialized], { type: 'application/json' })
          : serialized;
      if (navigator.sendBeacon(targetUrl, blob)) {
        return true;
      }
    } catch {
      // Fall through to keepalive fetch
    }
  }

  if (typeof fetch === 'undefined') {
    return false;
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

