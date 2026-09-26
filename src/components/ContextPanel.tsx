import React, { useEffect, useRef, useState } from "react";
import { DocChunk } from "../rag/storage";

interface ContextPanelProps {
  selectedTag?: string;
  alarmDescription?: string;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  selectedTag,
  alarmDescription,
}) => {
  const workerRef = useRef<Worker | null>(null);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<DocChunk[]>([]);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL("../rag/worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { status, results, message } = event.data;
      if (status === "READY") {
        setModelReady(true);
      } else if (status === "SEARCH_RESULTS") {
        setResults(results);
        setLoading(false);
      }
    };

    workerRef.current.postMessage({ type: "INIT_MODEL" });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (modelReady && alarmDescription) {
      setLoading(true);
      const query = selectedTag ? `${selectedTag} ${alarmDescription}` : alarmDescription;
      workerRef.current?.postMessage({
        type: "HYBRID_SEARCH",
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

      {loading && <p className="text-sm text-sky-400 animate-pulse">Searching manuals & historical logs...</p>}

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
