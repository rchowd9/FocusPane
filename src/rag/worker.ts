import {
  pipeline,
  env,
  FeatureExtractionPipeline,
  ProgressCallback,
} from "@huggingface/transformers";
import {
  DocChunk,
  saveDocChunks,
  getAllDocChunks,
  getAllDocIds,
  deleteDocChunks,
  cosineSimilarity,
  buildBM25Stats,
  computeBM25Score,
  reciprocalRankFusion,
} from "./storage";
import { SEED_DOCS, SEED_PREFIX } from "./seedDocs";

// Typed handle to the worker global scope (the DOM lib types `self` as Window)
const ctx = self as unknown as Worker;

// Allow local browser execution with WebGPU/WASM
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

// pipeline()'s overloads produce a union too complex for tsc; pin the one we use
const loadFeatureExtractor = pipeline as (
  task: "feature-extraction",
  model: string,
  options: { device: "webgpu" | "wasm"; progress_callback?: ProgressCallback }
) => Promise<FeatureExtractionPipeline>;

class PipelineSingleton {
  // Cache the promise, not the result, so concurrent callers share one load
  static instance: Promise<FeatureExtractionPipeline> | null = null;

  static getInstance(progressCallback?: ProgressCallback): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      this.instance = this.load(progressCallback).catch((err) => {
        this.instance = null;
        throw err;
      });
    }
    return this.instance;
  }

  private static async load(progressCallback?: ProgressCallback): Promise<FeatureExtractionPipeline> {
    const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
    if (hasWebGPU) {
      try {
        return await loadFeatureExtractor("feature-extraction", MODEL_ID, {
          device: "webgpu", // Prefer WebGPU acceleration
          progress_callback: progressCallback,
        });
      } catch (err) {
        console.warn("WebGPU unavailable, falling back to WASM:", err);
      }
    }
    return loadFeatureExtractor("feature-extraction", MODEL_ID, {
      device: "wasm",
      progress_callback: progressCallback,
    });
  }
}

async function embed(extractor: FeatureExtractionPipeline, text: string): Promise<number[]> {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function indexChunks(
  extractor: FeatureExtractionPipeline,
  chunks: Omit<DocChunk, "embedding">[]
): Promise<number> {
  const processedChunks: DocChunk[] = [];
  for (const chunk of chunks) {
    processedChunks.push({ ...chunk, embedding: await embed(extractor, chunk.content) });
  }
  await saveDocChunks(processedChunks);
  return processedChunks.length;
}

// Index the bundled sample manuals once, and drop chunks from older seed versions
async function ensureSeedIndex(extractor: FeatureExtractionPipeline): Promise<void> {
  const existing = await getAllDocIds();
  const current = new Set(SEED_DOCS.map((d) => d.id));
  const stale = existing.filter((id) => id.startsWith("seed-") && !current.has(id));
  if (stale.length > 0) await deleteDocChunks(stale);

  const have = new Set(existing);
  const missing = SEED_DOCS.filter((d) => !have.has(d.id));
  if (missing.length === 0) return;

  ctx.postMessage({ status: "INDEXING", message: `Indexing ${missing.length} sample documents...` });
  await indexChunks(extractor, missing);
}

ctx.addEventListener("message", async (event: MessageEvent) => {
  const { type, payload, requestId } = event.data;

  try {
    if (type === "INIT_MODEL") {
      ctx.postMessage({ status: "LOADING", message: "Initializing WebGPU embedding model..." });
      const extractor = await PipelineSingleton.getInstance((progress) => {
        ctx.postMessage({ status: "PROGRESS", progress });
      });
      await ensureSeedIndex(extractor);
      const docCount = (await getAllDocIds()).length;
      ctx.postMessage({ status: "READY", docCount, message: "Model loaded successfully." });
    }

    if (type === "INDEX_DOCUMENTS") {
      const extractor = await PipelineSingleton.getInstance();
      const count = await indexChunks(extractor, payload);
      ctx.postMessage({ status: "INDEXED", count });
    }

    if (type === "HYBRID_SEARCH") {
      const { query, topK = 3 } = payload;
      const extractor = await PipelineSingleton.getInstance();

      // 1. Generate Query Vector
      const queryEmbedding = await embed(extractor, query);

      // 2. Fetch Stored Chunks from IndexedDB
      const allChunks = await getAllDocChunks();

      // 3. Vector Similarity Search (score once, then sort)
      const vectorRanked = allChunks
        .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
        .sort((a, b) => b.score - a.score)
        .map((s) => s.chunk);

      // 4. BM25 Keyword Search (only chunks that actually match a query term)
      const bm25Stats = buildBM25Stats(allChunks.map((c) => c.content));
      const bm25Scored = allChunks
        .map((chunk) => ({ chunk, score: computeBM25Score(query, chunk.content, bm25Stats) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);
      const bm25Ranked = bm25Scored.map((s) => s.chunk);
      const keywordHits = new Set(bm25Ranked.map((c) => c.id));

      // 5. Reciprocal Rank Fusion (RRF)
      const fusedResults = reciprocalRankFusion(
        vectorRanked.slice(0, 10),
        bm25Ranked.slice(0, 10)
      );

      ctx.postMessage({
        status: "SEARCH_RESULTS",
        requestId,
        // Embeddings aren't needed by the UI; avoid copying them across threads
        results: fusedResults.slice(0, topK).map(({ embedding: _embedding, ...rest }) => ({
          ...rest,
          keywordMatch: keywordHits.has(rest.id),
        })),
      });
    }
  } catch (error) {
    ctx.postMessage({
      status: "ERROR",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
