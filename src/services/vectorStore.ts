export const VECTOR_DIMENSION = 1536;
const IDB_DB_NAME = 'liquidos_vector_vault_v1';
const IDB_STORE_NAME = 'vector_chunks';

export interface VectorChunkRecord {
  chunkId: string;
  url: string;
  content: string;
  timestamp: number;
  embedding: number[];
}

export interface VectorSearchHit {
  chunk_id: string;
  url: string;
  content: string;
  timestamp: number;
  distance: number;
  similarity: number;
}

export interface VectorVaultStats {
  totalChunks: number;
  distinctUrls: number;
  lastIndexedAt: number | null;
}

// In-memory vector store index synchronized with IndexedDB when available
const memoryVault = new Map<string, VectorChunkRecord>();
let idbHydrationPromise: Promise<void> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: 'chunkId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function hydrateVectorVault(): Promise<void> {
  if (!hasIndexedDb()) return;
  if (idbHydrationPromise) return idbHydrationPromise;

  idbHydrationPromise = (async () => {
    try {
      const db = await openVaultDb();
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const records: VectorChunkRecord[] = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      });
      for (const rec of records) {
        if (rec?.chunkId && !memoryVault.has(rec.chunkId)) {
          memoryVault.set(rec.chunkId, rec);
        }
      }
      db.close();
    } catch {
      // Ignore IndexedDB errors in restricted iframe or private mode
    }
  })();

  return idbHydrationPromise;
}

async function persistChunkToIdb(record: VectorChunkRecord): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openVaultDb();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal in private browsing / non-browser contexts
  }
}

async function deleteUrlFromIdb(url: string): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openVaultDb();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const records: VectorChunkRecord[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
    for (const rec of records) {
      if (rec.url === url) {
        store.delete(rec.chunkId);
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IndexedDB failures
  }
}

export function l2Distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const len = Math.min(a.length, b.length);
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function insertVectorChunk(
  chunkId: string,
  url: string,
  content: string,
  embedding: number[],
  timestamp: number = Date.now()
): VectorChunkRecord {
  const normalized = new Float32Array(VECTOR_DIMENSION);
  const copyLen = Math.min(embedding.length, VECTOR_DIMENSION);
  for (let i = 0; i < copyLen; i++) {
    normalized[i] = embedding[i];
  }

  const record: VectorChunkRecord = {
    chunkId,
    url,
    content,
    timestamp,
    embedding: Array.from(normalized),
  };

  memoryVault.set(chunkId, record);
  void persistChunkToIdb(record);
  return record;
}

export function replaceUrlChunks(
  url: string,
  chunks: Array<{ chunkId: string; content: string; embedding: number[]; timestamp?: number }>
): VectorChunkRecord[] {
  for (const [key, existing] of memoryVault.entries()) {
    if (existing.url === url) {
      memoryVault.delete(key);
    }
  }
  void deleteUrlFromIdb(url);

  const inserted: VectorChunkRecord[] = [];
  for (const ch of chunks) {
    inserted.push(
      insertVectorChunk(ch.chunkId, url, ch.content, ch.embedding, ch.timestamp ?? Date.now())
    );
  }
  return inserted;
}

export function similaritySearch(
  queryEmbedding: number[],
  limit: number = 5
): VectorSearchHit[] {
  if (memoryVault.size === 0 || limit <= 0) return [];

  const scored: VectorSearchHit[] = [];
  for (const rec of memoryVault.values()) {
    const distance = l2Distance(queryEmbedding, rec.embedding);
    const similarity = cosineSimilarity(queryEmbedding, rec.embedding);
    scored.push({
      chunk_id: rec.chunkId,
      url: rec.url,
      content: rec.content,
      timestamp: rec.timestamp,
      distance: Number(distance.toFixed(4)),
      similarity: Number(similarity.toFixed(4)),
    });
  }

  scored.sort((a, b) => a.distance - b.distance || b.similarity - a.similarity);
  return scored.slice(0, limit);
}

export function listVectorChunks(): VectorChunkRecord[] {
  return Array.from(memoryVault.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function getVectorVaultStats(): VectorVaultStats {
  const urls = new Set<string>();
  let lastIndexedAt: number | null = null;

  for (const rec of memoryVault.values()) {
    urls.add(rec.url);
    if (lastIndexedAt === null || rec.timestamp > lastIndexedAt) {
      lastIndexedAt = rec.timestamp;
    }
  }

  return {
    totalChunks: memoryVault.size,
    distinctUrls: urls.size,
    lastIndexedAt,
  };
}

export function clearVectorVault(): void {
  memoryVault.clear();
  if (hasIndexedDb()) {
    void (async () => {
      try {
        const db = await openVaultDb();
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).clear();
        db.close();
      } catch {
        // ignore
      }
    })();
  }
}
