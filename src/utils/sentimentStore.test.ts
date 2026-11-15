import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('Sentiment Analytics & Metrics Store', () => {
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
    vi.restoreAllMocks();
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

  it('validates remote telemetry URLs and rejects invalid or non-HTTP schemes', () => {
    expect(resolveSentimentTelemetryUrl({})).toBeNull();
    expect(resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: '   ' })).toBeNull();
    expect(
      resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: 'javascript:alert(1)' })
    ).toBeNull();
    expect(
      resolveSentimentTelemetryUrl({
        VITE_SENTIMENT_TELEMETRY_URL: ' https://telemetry.liquidos.dev/events ',
      })
    ).toBe('https://telemetry.liquidos.dev/events');
  });

  it('pushes cloud telemetry only when configured and handles network errors safely', async () => {
    const saved = recordInteraction({
      promptLength: 18,
      sentiment: 'neutral',
      responseTimeMs: 120,
      toolInvocations: ['vector_search'],
      resolved: true,
    });
    const summary = computeSentimentMetrics([saved]);

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    expect(await pushTelemetryEvent(saved, summary)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    expect(
      await pushTelemetryEvent(saved, summary, 'https://telemetry.liquidos.dev/v1/ingest')
    ).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe('https://telemetry.liquidos.dev/v1/ingest');
    expect(init.method).toBe('POST');
    const parsedBody = JSON.parse(init.body);
    expect(parsedBody.event).toBe('assistant_interaction');
    expect(parsedBody.record.id).toBe(saved.id);
    expect(parsedBody.summary.totalInteractions).toBe(1);

    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect(
      await pushTelemetryEvent(saved, summary, 'https://telemetry.liquidos.dev/v1/ingest')
    ).toBe(false);
  });
});
