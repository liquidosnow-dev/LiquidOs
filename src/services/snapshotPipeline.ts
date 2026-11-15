import {
  VECTOR_DIMENSION,
  replaceUrlChunks,
  VectorChunkRecord,
} from './vectorStore';

export interface SnapshotIndexResult {
  success: boolean;
  url: string;
  chunksIndexed: number;
  records: VectorChunkRecord[];
  capturedAt: number;
}

export function extractCleanTextFromHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunkText(
  text: string,
  maxChunkSize: number = 120,
  overlap: number = 25
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const words = clean.split(/\s+/);
  const step = Math.max(1, maxChunkSize - overlap);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + maxChunkSize).join(' ');
    if (chunk.trim().length > 20 || (chunks.length === 0 && chunk.trim().length > 0)) {
      chunks.push(chunk.trim());
    }
    if (i + maxChunkSize >= words.length) break;
  }

  return chunks;
}

function fnv1aHash(token: string, seed: number = 2166136261): number {
  let hash = seed >>> 0;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic 1536-dimensional L2-normalized semantic projection
 * combining word tokens, character 3-grams, and token bigrams so on-device
 * similarity search ranks topical matches cleanly without external APIs.
 */
export function generateDeterministicEmbedding(
  text: string,
  dimensions: number = VECTOR_DIMENSION
): number[] {
  const vec = new Float32Array(dimensions);
  const normalized = text.toLowerCase().replace(/[^a-z0-9_.\-/: ]+/g, ' ').trim();
  if (!normalized) {
    return Array.from(vec);
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // Whole-word projection (weight 2.0)
    const idx1 = fnv1aHash(tok, 2166136261) % dimensions;
    const sign1 = (fnv1aHash(tok, 374761393) & 1) === 0 ? 1 : -1;
    vec[idx1] += 2.0 * sign1;

    // Bigram projection (weight 1.2)
    if (i + 1 < tokens.length) {
      const bigram = `${tok}_${tokens[i + 1]}`;
      const idxB = fnv1aHash(bigram, 2654435761) % dimensions;
      const signB = (fnv1aHash(bigram, 1597334677) & 1) === 0 ? 1 : -1;
      vec[idxB] += 1.2 * signB;
    }

    // Subword trigram projection for morphological/prefix recall (weight 0.65)
    if (tok.length >= 3) {
      for (let j = 0; j <= tok.length - 3; j++) {
        const tri = tok.slice(j, j + 3);
        const idxT = fnv1aHash(tri, 3266489917) % dimensions;
        const signT = (fnv1aHash(tri, 668265263) & 1) === 0 ? 1 : -1;
        vec[idxT] += 0.65 * signT;
      }
    }
  }

  // L2 normalize to unit hypersphere
  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = vec[i] / norm;
    }
  }

  return Array.from(vec);
}

function encodeUrlKey(url: string): string {
  const rawHash = fnv1aHash(url).toString(36);
  const slug = url.replace(/[^a-z0-9]/gi, '_').slice(0, 18);
  return `${slug}_${rawHash}`;
}

export async function snapshotAndVectorizeUrl(
  url: string,
  rawHtml: string
): Promise<SnapshotIndexResult> {
  const cleanText = extractCleanTextFromHtml(rawHtml);
  const chunks = chunkText(cleanText);
  const capturedAt = Date.now();
  const urlKey = encodeUrlKey(url);

  const prepared = chunks.map((chunk, index) => ({
    chunkId: `snap_${urlKey}_${index}`,
    content: chunk,
    embedding: generateDeterministicEmbedding(chunk),
    timestamp: capturedAt,
  }));

  const records = replaceUrlChunks(url, prepared);

  return {
    success: true,
    url,
    chunksIndexed: records.length,
    records,
    capturedAt,
  };
}
