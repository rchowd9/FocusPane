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
        const store = db.createObjectStore("documents", { keyPath: "id" });
        store.createIndex("by-tag", "tagReference");
      },
    });
  }
  return dbPromise;
}

export async function saveDocChunks(chunks: DocChunk[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("documents", "readwrite");
  for (const chunk of chunks) {
    await tx.store.put(chunk);
  }
  await tx.done;
}

export async function getAllDocChunks(): Promise<DocChunk[]> {
  const db = await getDB();
  return db.getAll("documents");
}

// Cosine Similarity between two vector arrays
export function cosineSimilarity(a: number[], b: number[]): number {
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

// Basic BM25 Keyword Scoring
export function computeBM25Score(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const textTerms = text.toLowerCase().split(/\W+/).filter(Boolean);
  if (textTerms.length === 0) return 0;

  let score = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgdl = 50; // Average doc length heuristic
  const docLen = textTerms.length;

  for (const term of queryTerms) {
    const tf = textTerms.filter((t) => t === term).length;
    if (tf > 0) {
      const idf = Math.log(1 + 10 / 1); // Simplified IDF factor
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
    if (scores.has(chunk.id)) {
      scores.get(chunk.id)!.score += rrfScore;
    } else {
      scores.set(chunk.id, { chunk, score: rrfScore });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.chunk);
}
