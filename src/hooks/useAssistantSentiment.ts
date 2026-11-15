import { useCallback, useEffect, useRef } from 'react';
import {
  classifySentiment,
  computeSentimentMetrics,
  getStoredInteractions,
  InteractionRecord,
  pushTelemetryEvent,
  recordInteraction,
  resolveSentimentTelemetryUrl,
  TelemetryTriggerReason,
} from '../services/sentimentStore';

export interface UseAssistantSentimentOptions {
  telemetryUrl?: string;
}

export function getTelemetryEndpointFromProcessOrVite(override?: string): string | null {
  if (override) {
    return resolveSentimentTelemetryUrl({ VITE_SENTIMENT_TELEMETRY_URL: override });
  }
  const processUrl =
    typeof process !== 'undefined' && process.env
      ? process.env.VITE_SENTIMENT_TELEMETRY_URL
      : undefined;
  const metaUrl = (
    import.meta as unknown as { env?: { VITE_SENTIMENT_TELEMETRY_URL?: string } }
  ).env?.VITE_SENTIMENT_TELEMETRY_URL;

  return resolveSentimentTelemetryUrl({
    VITE_SENTIMENT_TELEMETRY_URL: processUrl ?? metaUrl,
  });
}

export function dispatchAggregatedSentiment(
  trigger: TelemetryTriggerReason,
  latestRecord?: InteractionRecord,
  endpointOverride?: string
): Promise<boolean> {
  const endpoint = getTelemetryEndpointFromProcessOrVite(endpointOverride);
  if (!endpoint) {
    return Promise.resolve(false);
  }
  const summary = computeSentimentMetrics(getStoredInteractions());
  return pushTelemetryEvent(latestRecord, summary, endpoint, trigger);
}

export function useAssistantSentiment(options?: UseAssistantSentimentOptions) {
  const startTimeRef = useRef<number>(Date.now());
  const telemetryOverride = options?.telemetryUrl;
  const hasSessionActivityRef = useRef<boolean>(false);
  const lastRecordRef = useRef<InteractionRecord | undefined>(undefined);

  const startInteractionTimer = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const flushSessionTelemetry = useCallback(() => {
    if (!hasSessionActivityRef.current) return Promise.resolve(false);
    hasSessionActivityRef.current = false;
    return dispatchAggregatedSentiment('session_close', lastRecordRef.current, telemetryOverride);
  }, [telemetryOverride]);

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
      lastRecordRef.current = savedRecord;
      hasSessionActivityRef.current = true;

      if (resolved) {
        void dispatchAggregatedSentiment('resolved', savedRecord, telemetryOverride);
      }

      return savedRecord;
    },
    [telemetryOverride]
  );

  useEffect(() => {
    const handleSessionClose = () => {
      if (!hasSessionActivityRef.current) return;
      hasSessionActivityRef.current = false;
      void dispatchAggregatedSentiment('session_close', lastRecordRef.current, telemetryOverride);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handleSessionClose);
      window.addEventListener('beforeunload', handleSessionClose);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handleSessionClose);
        window.removeEventListener('beforeunload', handleSessionClose);
      }
      handleSessionClose();
    };
  }, [telemetryOverride]);

  return {
    startInteractionTimer,
    trackInteraction,
    flushSessionTelemetry,
  };
}
