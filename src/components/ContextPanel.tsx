import React, { useEffect, useRef, useState } from "react";
import { DocChunk } from "../rag/storage";
import { UserRole } from "../types";

type SearchResult = Omit<DocChunk, "embedding"> & { keywordMatch?: boolean };

interface ContextPanelProps {
  selectedTag?: string;
  alarmDescription?: string;
  role: UserRole;
}

type FileProgress = Record<string, { loaded: number; total: number }>;

export const ContextPanel: React.FC<ContextPanelProps> = ({
  selectedTag,
  alarmDescription,
  role,
}) => {
  const workerRef = useRef<Worker | null>(null);
  const latestRequestId = useRef<number>(0);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Loading embedding model...");
  const [fileProgress, setFileProgress] = useState<FileProgress>({});
  const [docCount, setDocCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState<string>("");
  const [activeQuery, setActiveQuery] = useState<string>("");

  useEffect(() => {
    // Initialize Web Worker
    const worker = new Worker(new URL("../rag/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { status, results, requestId, error, progress, message, docCount } = event.data;
      if (status === "PROGRESS" && progress?.status === "progress" && progress.file) {
        setFileProgress((prev) => ({
          ...prev,
          [progress.file]: { loaded: progress.loaded ?? 0, total: progress.total ?? 0 },
        }));
      } else if (status === "LOADING" || status === "INDEXING") {
        setStatusText(message);
      } else if (status === "READY") {
        setDocCount(docCount ?? 0);
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

  // Selecting an alarm replaces any manual query
  useEffect(() => {
    setManualQuery("");
    setActiveQuery(
      alarmDescription ? (selectedTag ? `${selectedTag} ${alarmDescription}` : alarmDescription) : ""
    );
  }, [selectedTag, alarmDescription]);

  useEffect(() => {
    if (!activeQuery) {
      latestRequestId.current++;
      setResults([]);
      setLoading(false);
      return;
    }
    if (modelReady) {
      const requestId = ++latestRequestId.current;
      setLoading(true);
      setError(null);
      workerRef.current?.postMessage({
        type: "HYBRID_SEARCH",
        requestId,
        payload: { query: activeQuery, topK: role === "Trainee" ? 2 : 3 },
      });
    }
  }, [modelReady, activeQuery, role]);

  const files = Object.values(fileProgress);
  const totalBytes = files.reduce((sum, f) => sum + f.total, 0);
  const loadedBytes = files.reduce((sum, f) => sum + f.loaded, 0);
  const percent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;

  return (
    <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 w-full flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 gap-2">
        <h3 className="font-semibold text-sm">FocusPane Assist</h3>
        <span
          className={`text-[11px] px-2 py-0.5 rounded whitespace-nowrap ${
            modelReady ? "bg-emerald-900 text-emerald-300" : "bg-amber-900 text-amber-300"
          }`}
        >
          {modelReady
            ? `Local RAG · ${docCount} docs`
            : percent > 0 && percent < 100
              ? `Downloading model ${percent}%`
              : percent >= 100
                ? "Initializing..."
                : "Starting..."}
        </span>
      </div>

      {!modelReady && !error && (
        <div className="mb-3">
          <p className="text-xs text-slate-400">{statusText}</p>
          <div className="h-1 mt-2 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            One-time model download, cached by the browser. Inference runs entirely on this device.
          </p>
        </div>
      )}

      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setActiveQuery(manualQuery.trim());
        }}
      >
        <input
          value={manualQuery}
          onChange={(e) => setManualQuery(e.target.value)}
          placeholder="Ask the manuals, e.g. cavitation"
          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={!modelReady}
          className="text-xs px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </form>

      {!activeQuery && (
        <p className="text-sm text-slate-400">Select an alarm event to view local resolution context.</p>
      )}

      {error && <p className="text-sm text-red-400">RAG error: {error}</p>}

      {loading && <p className="text-sm text-sky-400 animate-pulse">Searching manuals & historical logs...</p>}

      {activeQuery && modelReady && !loading && !error && results.length === 0 && (
        <p className="text-sm text-slate-400">No matching documents in the local index.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3 overflow-y-auto">
          {role === "Trainee" && (
            <p className="text-[11px] text-sky-300/80">
              Guidance is ranked by relevance to the selected alarm. Confirm actions with an operator.
            </p>
          )}
          {results.map((item) => (
            <div key={item.id} className="p-3 bg-slate-800/60 rounded border border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-sky-400">{item.docTitle}</span>
                {item.keywordMatch && role !== "Trainee" && (
                  <span className="text-[10px] px-1.5 rounded bg-slate-700 text-slate-300 whitespace-nowrap">
                    keyword match
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 text-slate-200">{item.content}</p>
              {role === "Supervisor" && (
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  chunk {item.id}
                  {item.tagReference ? ` · tag ${item.tagReference}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
