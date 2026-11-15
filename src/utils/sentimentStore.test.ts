import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classifySentiment,
  clearStoredInteractions,
  computeSentimentMetrics,
  getStoredInteractions,
  InteractionRecord,
  pushTelemetryEvent,
  recordInteraction,
  resolveSentimentTelemetryUrl,
} from '../services/sentimentStore';
import {
  dispatchAggregatedSentiment,
  getTelemetryEndpointFromProcessOrVite,
} from '../hooks/useAssistantSentiment';

describe('Sentiment Analytics & Metrics Store', () => {
  const originalTelemetryEnv = process.env.VITE_SENTIMENT_TELEMETRY_URL;

  const sampleRecords: InteractionRecord[] = [
    {
      id: '1',
      timestamp: 1000,
      promptLength: 20,
      sentiment: 'positive',
      responseTimeMs: 400,
      toolInvocations: ['compile_applet'],
      resolved: true,
    },
    {
      id: '2',
      timestamp: 2000,
      promptLength: 45,
      sentiment: 'frustrated',
      responseTimeMs: 1200,
      toolInvocations: [],
      resolved: false,
    },
    {
      id: '3',
      timestamp: 3000,
      promptLength: 15,
      sentiment: 'inquisitive',
      responseTimeMs: 300,
      toolInvocations: ['lint_applet'],
      resolved: true,
    },
  ];

  beforeEach(() => {
    clearStoredInteractions();
    delete process.env.VITE_SENTIMENT_TELEMETRY_URL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalTelemetryEnv === undefined) {
      delete process.env.VITE_SENTIMENT_TELEMETRY_URL;
    } else {
      process.env.VITE_SENTIMENT_TELEMETRY_URL = originalTelemetryEnv;
    }
  });

  it('computes correct aggregate metrics', () => {
    const metrics = computeSentimentMetrics(sampleRecords);
    expect(metrics.totalInteractions).toBe(3);
    expect(metrics.averageResponseTimeMs).toBe(633);
    expect(metrics.resolutionRate).toBe(0.67);
    expect(metrics.sentimentBreakdown.positive).toBe(1);
    expect(metrics.sentimentBreakdown.frustrated).toBe(1);
    expect(metrics.sentimentBreakdown.inquisitive).toBe(1);
    expect(metrics.sentimentBreakdown.neutral).toBe(0);
  });

  it('handles empty interaction sets gracefully', () => {
    const metrics = computeSentimentMetrics([]);
    expect(metrics.totalInteractions).toBe(0);
    expect(metrics.averageResponseTimeMs).toBe(0);
    expect(metrics.resolutionRate).toBe(0);
  });

  it('classifies prompt sentiment across frustrated, positive, inquisitive, and neutral signals', () => {
    expect(classifySentiment('Why did this build fail with an error again?')).toBe('frustrated');
    expect(classifySentiment('Awesome, thanks — that worked perfectly!')).toBe('positive');
    expect(classifySentiment('How does RFC 8785 canonicalization compare to JSON.stringify?')).toBe(
      'inquisitive'
    );
    expect(classifySentiment('Generate a new Cloudflare Worker route for invoices')).toBe('neutral');
  });

  it('records and retrieves stored interaction telemetry', () => {
    const saved = recordInteraction({
      promptLength: 32,
      sentiment: 'positive',
      responseTimeMs: 240,
      toolInvocations: ['execute_code'],
      resolved: true,
    });
    expect(saved.id).toMatch(/^intent_/);

    const stored = getStoredInteractions();
    expect(stored.length).toBe(1);
    expect(stored[0].sentiment).toBe('positive');
    expect(stored[0].toolInvocations).toEqual(['execute_code']);
  });

  it('detects VITE_SENTIMENT_TELEMETRY_URL from process.env and rejects invalid schemes', () => {
    expect(getTelemetryEndpointFromProcessOrVite()).toBeNull();
    process.env.VITE_SENTIMENT_TELEMETRY_URL = 'https://telemetry.liquidos.dev/v1/metrics';
    expect(getTelemetryEndpointFromProcessOrVite()).toBe(
      'https://telemetry.liquidos.dev/v1/metrics'
    );

    expect(resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: '   ' })).toBeNull();
    expect(
      resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: 'javascript:alert(1)' })
    ).toBeNull();
  });

  it('posts aggregated sentiment metrics via background fetch on resolved and session_close triggers', async () => {
    const saved = recordInteraction({
      promptLength: 18,
      sentiment: 'positive',
      responseTimeMs: 120,
      toolInvocations: ['vector_search'],
      resolved: true,
    });
    const summary = computeSentimentMetrics([saved]);

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    expect(await pushTelemetryEvent(saved, summary)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env.VITE_SENTIMENT_TELEMETRY_URL = 'https://telemetry.liquidos.dev/v1/ingest';

    expect(await dispatchAggregatedSentiment('resolved', saved)).toBe(true);
    expect(await dispatchAggregatedSentiment('session_close', saved)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [url1, init1] = fetchSpy.mock.calls[0];
    expect(url1).toBe('https://telemetry.liquidos.dev/v1/ingest');
    expect(init1.method).toBe('POST');
    expect(init1.keepalive).toBe(true);
    const body1 = JSON.parse(init1.body);
    expect(body1.event).toBe('assistant_interaction');
    expect(body1.trigger).toBe('resolved');
    expect(body1.summary.totalInteractions).toBe(1);
    expect(body1.summary.resolutionRate).toBe(1);

    const [, init2] = fetchSpy.mock.calls[1];
    const body2 = JSON.parse(init2.body);
    expect(body2.event).toBe('assistant_session_summary');
    expect(body2.trigger).toBe('session_close');

    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect(await dispatchAggregatedSentiment('session_close', saved)).toBe(false);
  });
});
