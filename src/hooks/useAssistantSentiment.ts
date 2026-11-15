import { useCallback, useRef } from 'react';
import {
  classifySentiment,
  computeSentimentMetrics,
  getStoredInteractions,
  InteractionRecord,
  pushTelemetryEvent,
  recordInteraction,
  resolveSentimentTelemetryUrl,
} from '../services/sentimentStore';

export interface UseAssistantSentimentOptions {
  telemetryUrl?: string;
}

export function useAssistantSentiment(options?: UseAssistantSentimentOptions) {
  const startTimeRef = useRef<number>(Date.now());
  const telemetryOverride = options?.telemetryUrl;

  const startInteractionTimer = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const trackInteraction = useCallback(
    (prompt: string, toolInvocations: string[] = [], resolved: boolean = true): InteractionRecord => {
      const responseTimeMs = Math.max(0, Date.now() - startTimeRef.current);
      const sentiment = classifySentiment(prompt);

      const record: Omit<InteractionRecord, 'id' | 'timestamp'> = {
        promptLength: prompt.length,
        sentiment,
        responseTimeMs,
        toolInvocations,
        resolved,
      };

      const savedRecord = recordInteraction(record);

      const resolvedUrl = telemetryOverride
        ? resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: telemetryOverride })
        : resolveSentimentTelemetryUrl();

      if (resolvedUrl) {
        const summary = computeSentimentMetrics(getStoredInteractions());
        void pushTelemetryEvent(savedRecord, summary, resolvedUrl);
      }

      return savedRecord;
    },
    [telemetryOverride]
  );

  return {
    startInteractionTimer,
    trackInteraction,
  };
}
