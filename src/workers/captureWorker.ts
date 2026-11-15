import {
  extractCleanTextFromHtml,
  chunkText,
  generateDeterministicEmbedding,
  snapshotAndVectorizeUrl,
  SnapshotIndexResult,
} from '../services/snapshotPipeline';
import { replaceUrlChunks } from '../services/vectorStore';

export interface CaptureWorkerRequest {
  requestId: string;
  url: string;
  rawHtml: string;
}

export interface CaptureWorkerChunkPayload {
  chunkId: string;
  content: string;
  embedding: number[];
  timestamp: number;
}

export interface CaptureWorkerResponse {
  requestId: string;
  url: string;
  chunks: CaptureWorkerChunkPayload[];
  capturedAt: number;
}

// Web Worker message loop when executed inside a dedicated worker context
const isWorkerContext =
  typeof self !== 'undefined' &&
  typeof (self as unknown as { importScripts?: unknown }).importScripts === 'function';

if (isWorkerContext) {
  self.addEventListener('message', (event: MessageEvent<CaptureWorkerRequest>) => {
    const { requestId, url, rawHtml } = event.data;
    const cleanText = extractCleanTextFromHtml(rawHtml);
    const textChunks = chunkText(cleanText);
    const capturedAt = Date.now();
    const safeUrlSlug = url.replace(/[^a-z0-9]/gi, '_').slice(0, 20);

    const chunks: CaptureWorkerChunkPayload[] = textChunks.map((content, index) => ({
      chunkId: `snap_${safeUrlSlug}_${index}`,
      content,
      embedding: generateDeterministicEmbedding(content),
      timestamp: capturedAt,
    }));

    const response: CaptureWorkerResponse = {
      requestId,
      url,
      chunks,
      capturedAt,
    };
    (self as unknown as { postMessage: (msg: CaptureWorkerResponse) => void }).postMessage(
      response
    );
  });
}

/**
 * Runs HTML snapshot extraction and embedding generation inside a background Web Worker
 * when supported, committing indexed vectors into the local sovereign store.
 * Falls back synchronously to snapshotAndVectorizeUrl in Node / SSR / restricted sandboxes.
 */
export async function runCapturePipeline(
  url: string,
  rawHtml: string
): Promise<SnapshotIndexResult> {
  if (typeof Worker === 'undefined') {
    return snapshotAndVectorizeUrl(url, rawHtml);
  }

  return new Promise<SnapshotIndexResult>((resolve) => {
    let settled = false;
    let worker: Worker | null = null;

    const fallback = async () => {
      if (settled) return;
      settled = true;
      worker?.terminate();
      resolve(await snapshotAndVectorizeUrl(url, rawHtml));
    };

    try {
      worker = new Worker(new URL('./captureWorker.ts', import.meta.url), {
        type: 'module',
      });
      const requestId = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const timeout = setTimeout(() => {
        void fallback();
      }, 2500);

      worker.onmessage = (event: MessageEvent<CaptureWorkerResponse>) => {
        if (event.data?.requestId !== requestId || settled) return;
        settled = true;
        clearTimeout(timeout);
        const records = replaceUrlChunks(event.data.url, event.data.chunks);
        worker?.terminate();
        resolve({
          success: true,
          url: event.data.url,
          chunksIndexed: records.length,
          records,
          capturedAt: event.data.capturedAt,
        });
      };

      worker.onerror = () => {
        clearTimeout(timeout);
        void fallback();
      };

      worker.postMessage({ requestId, url, rawHtml } satisfies CaptureWorkerRequest);
    } catch {
      void fallback();
    }
  });
}
