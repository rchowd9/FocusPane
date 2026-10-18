import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface DocChunk {
  id: string;
  docTitle: string;
  content: string;
  tagReference?: string;
  embedding: number[];
}

interface FocusPaneDB extends DBSchema {
  documents: {
    key: string;
    value: DocChunk;
    indexes: { "by-tag": string };
  };
}

const DB_NAME = "FocusPane_VectorStore";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FocusPaneDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FocusPaneDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FocusPaneDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Guard so future version bumps don't fail on an existing store
        if (!db.objectStoreNames.contains("documents")) {
          const store = db.createObjectStore("documents", { keyPath: "id" });
          store.createIndex("by-tag", "tagReference");
        }
      },
    }).catch((err) => {
      // Don't cache a rejected open; allow the next call to retry
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function saveDocChunks(chunks: DocChunk[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("documents", "readwrite");
  await Promise.all([...chunks.map((chunk) => tx.store.put(chunk)), tx.done]);
}

export async function getAllDocChunks(): Promise<DocChunk[]> {
  const db = await getDB();
  return db.getAll("documents");
}

// Cosine Similarity between two vector arrays
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Keeps hyphenated tag numbers like "PUMP-101A" together as a single token
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
}

export interface BM25CorpusStats {
  docCount: number;
  avgDocLength: number;
  docFrequency: Map<string, number>;
}

export function buildBM25Stats(texts: string[]): BM25CorpusStats {
  const docFrequency = new Map<string, number>();
  let totalLength = 0;
  for (const text of texts) {
    const terms = tokenize(text);
    totalLength += terms.length;
    for (const term of new Set(terms)) {
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
  }
  return {
    docCount: texts.length,
    avgDocLength: texts.length > 0 ? totalLength / texts.length : 0,
    docFrequency,
  };
}

// BM25 Keyword Scoring (Okapi BM25 with corpus-derived IDF and average length)
export function computeBM25Score(
  query: string,
  text: string,
  stats: BM25CorpusStats
): number {
  const queryTerms = new Set(tokenize(query));
  const textTerms = tokenize(text);
  if (textTerms.length === 0 || stats.docCount === 0) return 0;

  const termFreq = new Map<string, number>();
  for (const t of textTerms) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);

  let score = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgdl = stats.avgDocLength || textTerms.length;
  const docLen = textTerms.length;

  for (const term of queryTerms) {
    const tf = termFreq.get(term) ?? 0;
    if (tf > 0) {
      const df = stats.docFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (stats.docCount - df + 0.5) / (df + 0.5));
      const num = tf * (k1 + 1);
      const denom = tf + k1 * (1 - b + b * (docLen / avgdl));
      score += idf * (num / denom);
    }
  }
  return score;
}

// Reciprocal Rank Fusion (RRF) to combine Vector + BM25 results
export function reciprocalRankFusion(
  vectorRankings: DocChunk[],
  bm25Rankings: DocChunk[],
  k: number = 60
): DocChunk[] {
  const scores = new Map<string, { chunk: DocChunk; score: number }>();

  vectorRankings.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + (rank + 1));
    scores.set(chunk.id, { chunk, score: rrfScore });
  });

  bm25Rankings.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + (rank + 1));
    const existing = scores.get(chunk.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(chunk.id, { chunk, score: rrfScore });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.chunk);
}
