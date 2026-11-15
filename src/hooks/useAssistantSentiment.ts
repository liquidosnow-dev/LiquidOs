import { useCallback, useEffect, useRef } from 'react';
import {
  classifySentiment,
  computeSentimentMetrics,
  getStoredInteractions,
  InteractionRecord,
  pushTelemetryEvent,
  recordInteraction,
  resolveSentimentTelemetryUrl,
  SessionTelemetryStats,
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

export function computeSessionStatsSnapshot(
  sessionRecords: InteractionRecord[],
  sessionStartedAt: number
): SessionTelemetryStats {
  const sessionInteractions = sessionRecords.length;
  const sessionResolved = sessionRecords.filter((r) => r.resolved).length;
  const totalTime = sessionRecords.reduce((acc, r) => acc + r.responseTimeMs, 0);
  return {
    sessionInteractions,
    sessionResolved,
    sessionAverageResponseTimeMs:
      sessionInteractions > 0 ? Math.round(totalTime / sessionInteractions) : 0,
    sessionDurationMs: Math.max(0, Date.now() - sessionStartedAt),
  };
}

export function dispatchAggregatedSentiment(
  trigger: TelemetryTriggerReason,
  latestRecord?: InteractionRecord,
  endpointOverride?: string,
  sessionStats?: SessionTelemetryStats,
  preferBeacon: boolean = trigger === 'session_close'
): Promise<boolean> {
  const endpoint = getTelemetryEndpointFromProcessOrVite(endpointOverride);
  if (!endpoint) {
    return Promise.resolve(false);
  }
  const summary = computeSentimentMetrics(getStoredInteractions());
  return pushTelemetryEvent(latestRecord, summary, endpoint, trigger, sessionStats, preferBeacon);
}

export function useAssistantSentiment(options?: UseAssistantSentimentOptions) {
  const startTimeRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const sessionRecordsRef = useRef<InteractionRecord[]>([]);
  const telemetryOverride = options?.telemetryUrl;
  const hasSessionActivityRef = useRef<boolean>(false);
  const lastRecordRef = useRef<InteractionRecord | undefined>(undefined);

  const startInteractionTimer = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const getSessionStats = useCallback((): SessionTelemetryStats => {
    return computeSessionStatsSnapshot(sessionRecordsRef.current, sessionStartRef.current);
  }, []);

  const flushSessionTelemetry = useCallback(
    (preferBeacon: boolean = true) => {
      if (!hasSessionActivityRef.current) return Promise.resolve(false);
      hasSessionActivityRef.current = false;
      const stats = computeSessionStatsSnapshot(
        sessionRecordsRef.current,
        sessionStartRef.current
      );
      sessionRecordsRef.current = [];
      sessionStartRef.current = Date.now();
      return dispatchAggregatedSentiment(
        'session_close',
        lastRecordRef.current,
        telemetryOverride,
        stats,
        preferBeacon
      );
    },
    [telemetryOverride]
  );

  const trackInteraction = useCallback(
    (
      prompt: string,
      toolInvocations: string[] = [],
      resolved: boolean = true
    ): InteractionRecord | null => {
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) return null;

      const responseTimeMs = Math.max(0, Date.now() - startTimeRef.current);
      const sentiment = classifySentiment(normalizedPrompt);

      const record: Omit<InteractionRecord, 'id' | 'timestamp'> = {
        promptLength: normalizedPrompt.length,
        sentiment,
        responseTimeMs,
        toolInvocations,
        resolved,
      };

      const savedRecord = recordInteraction(record);
      lastRecordRef.current = savedRecord;
      sessionRecordsRef.current.push(savedRecord);
      hasSessionActivityRef.current = true;

      if (resolved) {
        const stats = computeSessionStatsSnapshot(
          sessionRecordsRef.current,
          sessionStartRef.current
        );
        void dispatchAggregatedSentiment(
          'resolved',
          savedRecord,
          telemetryOverride,
          stats,
          false
        );
      }

      return savedRecord;
    },
    [telemetryOverride]
  );

  useEffect(() => {
    const handleSessionClose = () => {
      if (!hasSessionActivityRef.current) return;
      void flushSessionTelemetry(true);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        handleSessionClose();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handleSessionClose);
      window.addEventListener('beforeunload', handleSessionClose);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handleSessionClose);
        window.removeEventListener('beforeunload', handleSessionClose);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      handleSessionClose();
    };
  }, [flushSessionTelemetry]);

  return {
    startInteractionTimer,
    trackInteraction,
    flushSessionTelemetry,
    getSessionStats,
  };
}
