import React, { useEffect, useRef, useState } from "react";
import { DocChunk } from "../rag/storage";

type SearchResult = Omit<DocChunk, "embedding">;

interface ContextPanelProps {
  selectedTag?: string;
  alarmDescription?: string;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  selectedTag,
  alarmDescription,
}) => {
  const workerRef = useRef<Worker | null>(null);
  const latestRequestId = useRef<number>(0);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    const worker = new Worker(new URL("../rag/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { status, results, requestId, error } = event.data;
      if (status === "READY") {
        setModelReady(true);
      } else if (status === "SEARCH_RESULTS") {
        // Ignore responses to searches that have since been superseded
        if (requestId !== latestRequestId.current) return;
        setResults(results);
        setLoading(false);
      } else if (status === "ERROR") {
        if (requestId !== undefined && requestId !== latestRequestId.current) return;
        setError(error ?? "Unknown error");
        setLoading(false);
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      setError(event.message || "RAG worker failed to start");
      setLoading(false);
    };

    worker.postMessage({ type: "INIT_MODEL" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!alarmDescription) {
      latestRequestId.current++;
      setResults([]);
      setLoading(false);
      return;
    }
    if (modelReady) {
      const requestId = ++latestRequestId.current;
      setLoading(true);
      setError(null);
      const query = selectedTag ? `${selectedTag} ${alarmDescription}` : alarmDescription;
      workerRef.current?.postMessage({
        type: "HYBRID_SEARCH",
        requestId,
        payload: { query, topK: 3 },
      });
    }
  }, [modelReady, selectedTag, alarmDescription]);

  return (
    <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 w-full max-w-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="font-semibold text-lg">FocusPane Assist</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            modelReady ? "bg-emerald-900 text-emerald-300" : "bg-amber-900 text-amber-300"
          }`}
        >
          {modelReady ? "Local RAG Active" : "Loading WebGPU Model..."}
        </span>
      </div>

      {!selectedTag && (
        <p className="text-sm text-slate-400">Select an alarm event to view local resolution context.</p>
      )}

      {error && <p className="text-sm text-red-400">RAG error: {error}</p>}

      {loading && <p className="text-sm text-sky-400 animate-pulse">Searching manuals & historical logs...</p>}

      {selectedTag && modelReady && !loading && !error && results.length === 0 && (
        <p className="text-sm text-slate-400">No matching documents in the local index.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((item) => (
            <div key={item.id} className="p-3 bg-slate-800/60 rounded border border-slate-700">
              <span className="text-xs font-mono text-sky-400">{item.docTitle}</span>
              <p className="text-sm mt-1 text-slate-200">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
