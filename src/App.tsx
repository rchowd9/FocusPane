import React, { useEffect, useMemo, useState } from "react";
import { ContextPanel } from "./components/ContextPanel";
import { TopologyGraph } from "./components/TopologyGraph";
import { FEED_ENDPOINT, FEED_MODE, useAlarmFeed } from "./feed/useAlarmFeed";
import { buildHandoverSummary, downloadText } from "./lib/handover";
import { TrackedAlarm, UserRole } from "./types";

export type { UserRole } from "./types";

const MAX_VISIBLE_EVENTS = 200;
const REPLAY_WINDOW_MIN = 10;
const ROLES: UserRole[] = ["Trainee", "Operator", "Supervisor"];

const STORAGE_KEYS = {
  role: "focuspane-role",
  selectedId: "focuspane-selected-id",
  tagFilter: "focuspane-tag-filter",
  replayMinutes: "focuspane-replay-minutes",
} as const;

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    if (value == null || value === "") {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors in private browsing or restricted environments.
  }
}

function formatClock(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour12: false });
}

export default function App() {
  const { alarms, status, acknowledge } = useAlarmFeed();
  const [role, setRole] = useState<UserRole>(() => readStoredValue(STORAGE_KEYS.role, "Operator"));
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    readStoredValue<string | null>(STORAGE_KEYS.selectedId, null)
  );
  const [tagFilter, setTagFilter] = useState<string | undefined>(() =>
    readStoredValue<string | undefined>(STORAGE_KEYS.tagFilter, undefined)
  );
  // Minutes rewound from "now" and the frozen cutoff time (Unix seconds); 0 / null = live
  const [replayMinutes, setReplayMinutes] = useState<number>(() =>
    readStoredValue<number>(STORAGE_KEYS.replayMinutes, 0)
  );

  const isReplay = replayCutoff !== null;

  // The plant state as of the replay cutoff (or live)
  const view: TrackedAlarm[] = useMemo(() => {
    if (replayCutoff === null) return alarms;
    return alarms
      .filter((a) => a.timestamp <= replayCutoff)
      .map((a) =>
        a.acknowledgedAt !== undefined && a.acknowledgedAt > replayCutoff
          ? { ...a, status: "ACTIVE" as const, acknowledgedAt: undefined }
          : a
      );
  }, [alarms, replayCutoff]);

  // Impact-ranked queue: unacknowledged first, then by LightGBM impact score
  const queue = useMemo(
    () =>
      view
        .filter((a) => !tagFilter || a.tag === tagFilter)
        .sort(
          (a, b) =>
            Number(a.status === "ACKNOWLEDGED") - Number(b.status === "ACKNOWLEDGED") ||
            b.impact_score - a.impact_score ||
            b.timestamp - a.timestamp
        )
        .slice(0, MAX_VISIBLE_EVENTS),
    [view, tagFilter]
  );

  const tagImpact = useMemo(() => {
    const impact = new Map<string, number>();
    for (const a of view) {
      if (a.status !== "ACTIVE") continue;
      impact.set(a.tag, Math.max(impact.get(a.tag) ?? 0, a.impact_score));
    }
    return impact;
  }, [view]);

  const activeCount = view.filter((a) => a.status === "ACTIVE").length;
  const criticalCount = view.filter((a) => a.status === "ACTIVE" && a.impact_score > 0.8).length;
  const selectedEvent = view.find((a) => a.id === selectedId) ?? null;

  const handleReplayChange = (minutesBack: number) => {
    setReplayMinutes(minutesBack);
    setReplayCutoff(minutesBack === 0 ? null : Date.now() / 1000 - minutesBack * 60);
  };

  const acknowledgeTag = (tag: string) =>
    acknowledge(alarms.filter((a) => a.tag === tag && a.status === "ACTIVE").map((a) => a.id));

  const exportHandover = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    downloadText(`focuspane-handover-${stamp}.md`, buildHandoverSummary(view, role));
  };

  const feedBadge =
    FEED_MODE === "simulated"
      ? { text: "Simulated feed", cls: "bg-violet-950 text-violet-300 border-violet-800" }
      : status === "live"
        ? { text: `Live · ${FEED_ENDPOINT!.replace(/^wss?:\/\//, "").split("/")[0]}`, cls: "bg-emerald-950 text-emerald-300 border-emerald-800" }
        : { text: status === "connecting" ? "Connecting..." : "Reconnecting...", cls: "bg-amber-950 text-amber-300 border-amber-800" };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation & Role Selector */}
      <header className="min-h-14 border-b border-slate-800 px-4 sm:px-6 py-2 flex flex-wrap gap-2 items-center justify-between bg-slate-900">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-sky-400 text-lg tracking-wide">FOCUS PANE</span>
          <span className="text-xs px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 rounded">
            v1.1-prototype
          </span>
          <span className={`text-xs px-2 py-0.5 border rounded ${feedBadge.cls}`}>{feedBadge.text}</span>
          {isReplay && (
            <span className="text-xs px-2 py-0.5 border rounded bg-amber-950 text-amber-300 border-amber-700 animate-pulse">
              REPLAY · {formatClock(replayCutoff!)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Active Role:</span>
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                role === r ? "bg-sky-600 text-white font-medium" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      {/* Main Control Panel Dashboard */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4">
        {/* Left Column: Impact-Ranked Event Queue */}
        <section className="col-span-12 lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-slate-200">Impact-Ranked Events</h2>
            <span className="text-xs text-slate-500">
              <span className="text-red-400">{criticalCount} critical</span> · {activeCount} active
            </span>
          </div>

          {tagFilter && (
            <button
              onClick={() => setTagFilter(undefined)}
              className="self-start mb-2 text-[11px] px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 hover:bg-sky-900"
            >
              Filtered to {tagFilter} ✕
            </button>
          )}

          {role === "Trainee" && (
            <p className="text-[11px] text-slate-400 mb-2">
              Events are sorted by <span className="text-slate-200">impact score</span> (0–1, the model's estimate of
              process consequence), not by arrival time. Red badges (&gt; 0.8) need attention first.
            </p>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[calc(100vh-12rem)]">
            {queue.length === 0 && (
              <p className="text-xs text-slate-500">
                {isReplay
                  ? "No alarms had been raised at this point in time."
                  : FEED_MODE === "websocket" && status !== "live"
                    ? "Connecting to SCADA WebSocket feed..."
                    : "No alarms."}
              </p>
            )}
            {queue.map((evt) => {
              const acked = evt.status === "ACKNOWLEDGED";
              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedId(evt.id)}
                  className={`p-3 rounded border transition-all cursor-pointer ${
                    selectedId === evt.id
                      ? "bg-slate-800 border-sky-500 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  } ${acked ? "opacity-50" : ""}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-xs font-semibold text-sky-400">{evt.tag}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        acked
                          ? "bg-slate-800 text-slate-400 border-slate-700"
                          : evt.impact_score > 0.8
                            ? "bg-red-950 text-red-400 border-red-800"
                            : "bg-amber-950 text-amber-400 border-amber-800"
                      }`}
                    >
                      {acked ? "ACK · " : ""}Impact: {evt.impact_score.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{evt.description}</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">{formatClock(evt.timestamp)}</p>
                  {role === "Supervisor" && (
                    <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 flex justify-between">
                      <span>Raw: {evt.raw_severity}</span>
                      <span>ID: {evt.id}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Center/Right Columns: Topology Graph & RAG Assist */}
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          <TopologyGraph
            selectedTag={tagFilter ?? selectedEvent?.tag}
            tagImpact={tagImpact}
            onSelectTag={(tag) => setTagFilter((current) => (tag === current ? undefined : tag))}
          />

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ContextPanel
              selectedTag={selectedEvent?.tag}
              alarmDescription={selectedEvent?.description}
              role={role}
            />

            {/* Action / Replay Module */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-200 text-sm mb-2">Control Actions & Replay</h3>
                {selectedEvent && (
                  <p className="text-xs text-slate-400 mb-2">
                    Selected: <span className="font-mono text-sky-400">{selectedEvent.tag}</span> ·{" "}
                    {selectedEvent.status.toLowerCase()}
                  </p>
                )}
                {role === "Trainee" ? (
                  <p className="text-xs text-amber-400/90 bg-amber-950/40 border border-amber-900/50 p-2 rounded">
                    Trainee Mode: Read-only access enabled. Emergency override actions are restricted.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <button
                      disabled={!selectedEvent || isReplay}
                      onClick={() => selectedEvent && acknowledgeTag(selectedEvent.tag)}
                      title={isReplay ? "Return to live view to take actions" : undefined}
                      className="w-full py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition"
                    >
                      Acknowledge & Isolate Tag
                    </button>
                    {role === "Supervisor" && (
                      <button
                        disabled={isReplay || queue.every((a) => a.status !== "ACTIVE")}
                        onClick={() => acknowledge(queue.map((a) => a.id))}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-200 text-xs font-medium rounded transition"
                      >
                        Bulk Acknowledge {tagFilter ? tagFilter : "All Visible"}
                      </button>
                    )}
                    <button
                      onClick={exportHandover}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition"
                    >
                      Export Shift Handover Summary
                    </button>
                  </div>
                )}
              </div>

              {/* Situation Replay Scrubber */}
              <div className="border-t border-slate-800 pt-3 mt-4">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>SITUATION REPLAY</span>
                  <span className={isReplay ? "text-amber-300" : "text-emerald-400"}>
                    {isReplay ? `-${replayMinutes}m` : "LIVE"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={REPLAY_WINDOW_MIN}
                  step={0.5}
                  value={REPLAY_WINDOW_MIN - replayMinutes}
                  onChange={(e) => handleReplayChange(REPLAY_WINDOW_MIN - Number(e.target.value))}
                  aria-label="Situation replay time offset"
                  className="w-full accent-sky-500 mt-1 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>-{REPLAY_WINDOW_MIN}m</span>
                  {isReplay && (
                    <button onClick={() => handleReplayChange(0)} className="text-sky-400 hover:underline">
                      Return to live
                    </button>
                  )}
                  <span>now</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
