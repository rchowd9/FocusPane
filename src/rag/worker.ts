import { pipeline, env } from "@xenova/transformers";
import {
  DocChunk,
  saveDocChunks,
  getAllDocChunks,
  cosineSimilarity,
  computeBM25Score,
  reciprocalRankFusion,
} from "./storage";

// Allow local browser execution with WebGPU/WASM
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static instance: any = null;

  static async getInstance(progressCallback?: Function) {
    if (this.instance === null) {
      this.instance = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          device: "webgpu", // Default to WebGPU acceleration
          progress_callback: progressCallback,
        }
      );
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    if (type === "INIT_MODEL") {
      self.postMessage({ status: "LOADING", message: "Initializing WebGPU embedding model..." });
      await PipelineSingleton.getInstance((progress: any) => {
        self.postMessage({ status: "PROGRESS", progress });
      });
      self.postMessage({ status: "READY", message: "Model loaded successfully." });
    }

    if (type === "INDEX_DOCUMENTS") {
      const extractor = await PipelineSingleton.getInstance();
      const chunks: { id: string; docTitle: string; content: string; tagReference?: string }[] = payload;

      const processedChunks: DocChunk[] = [];
      for (const chunk of chunks) {
        const output = await extractor(chunk.content, { pooling: "mean", normalize: true });
        const embedding = Array.from(output.data) as number[];

        processedChunks.push({
          ...chunk,
          embedding,
        });
      }

      await saveDocChunks(processedChunks);
      self.postMessage({ status: "INDEXED", count: processedChunks.length });
    }

    if (type === "HYBRID_SEARCH") {
      const { query, topK = 3 } = payload;
      const extractor = await PipelineSingleton.getInstance();

      // 1. Generate Query Vector
      const queryOutput = await extractor(query, { pooling: "mean", normalize: true });
      const queryEmbedding = Array.from(queryOutput.data) as number[];

      // 2. Fetch Stored Chunks from IndexedDB
      const allChunks = await getAllDocChunks();

      // 3. Vector Similarity Search
      const vectorRanked = [...allChunks].sort((a, b) => {
        const simA = cosineSimilarity(queryEmbedding, a.embedding);
        const simB = cosineSimilarity(queryEmbedding, b.embedding);
        return simB - simA;
      });

      // 4. BM25 Keyword Search
      const bm25Ranked = [...allChunks].sort((a, b) => {
        const scoreA = computeBM25Score(query, a.content);
        const scoreB = computeBM25Score(query, b.content);
        return scoreB - scoreA;
      });

      // 5. Reciprocal Rank Fusion (RRF)
      const fusedResults = reciprocalRankFusion(
        vectorRanked.slice(0, 10),
        bm25Ranked.slice(0, 10)
      );

      self.postMessage({
        status: "SEARCH_RESULTS",
        results: fusedResults.slice(0, topK),
      });
    }
  } catch (error: any) {
    self.postMessage({ status: "ERROR", error: error.message });
  }
});
