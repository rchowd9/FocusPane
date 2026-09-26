import React, { useEffect, useState } from "react";
import { ContextPanel } from "./components/ContextPanel";
import { TopologyGraph } from "./components/TopologyGraph";

export type UserRole = "Trainee" | "Operator" | "Supervisor";

interface AlarmEvent {
  id: str;
  tag: string;
  description: string;
  raw_severity: string;
  impact_score: number;
  timestamp: number;
  status: string;
}

export default function App() {
  const [role, setRole] = useState<UserRole>("Operator");
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AlarmEvent | null>(null);

  useEffect(() => {
    // Connect to Python FastAPI Alarm Feed
    const ws = new WebSocket("ws://localhost:8000/ws/alarms");

    ws.onmessage = (msg) => {
      const newEvent: AlarmEvent = JSON.parse(msg.data);
      setEvents((prev) => {
        const updated = [newEvent, ...prev];
        // Sort by LightGBM impact score descending
        return updated.sort((a, b) => b.impact_score - a.impact_score);
      });
    };

    return () => ws.close();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation & Role Selector */}
      <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sky-400 text-lg tracking-wide">FOCUS PANE</span>
          <span className="text-xs px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800 rounded">
            v1.0-prototype
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Active Role:</span>
          {(["Trainee", "Operator", "Supervisor"] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                role === r
                  ? "bg-sky-600 text-white font-medium"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
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
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-slate-200">Impact-Ranked Events</h2>
            <span className="text-xs text-slate-500">{events.length} Active</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[calc(100vh-12rem)]">
            {events.length === 0 && (
              <p className="text-xs text-slate-500">Connecting to SCADA WebSocket feed...</p>
            )}
            {events.map((evt) => (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className={`p-3 rounded border transition-all cursor-pointer ${
                  selectedEvent?.id === evt.id
                    ? "bg-slate-800 border-sky-500 shadow-md"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-semibold text-sky-400">{evt.tag}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      evt.impact_score > 0.8
                        ? "bg-red-950 text-red-400 border border-red-800"
                        : "bg-amber-950 text-amber-400 border border-amber-800"
                    }`}
                  >
                    Impact: {evt.impact_score}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{evt.description}</p>
                {role === "Supervisor" && (
                  <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 flex justify-between">
                    <span>Raw: {evt.raw_severity}</span>
                    <span>ID: {evt.id}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Center/Right Columns: Topology Graph & RAG Assist */}
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          <TopologyGraph selectedTag={selectedEvent?.tag} />

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ContextPanel
              selectedTag={selectedEvent?.tag}
              alarmDescription={selectedEvent?.description}
            />

            {/* Action / Replay Module */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-200 text-sm mb-2">Control Actions & Replay</h3>
                {role === "Trainee" && (
                  <p className="text-xs text-amber-400/90 bg-amber-950/40 border border-amber-900/50 p-2 rounded">
                    Trainee Mode: Read-only access enabled. Emergency override actions are restricted.
                  </p>
                )}
                {role !== "Trainee" && (
                  <div className="space-y-2">
                    <button className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded transition">
                      Acknowledge & Isolate Tag
                    </button>
                    <button className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition">
                      Export Shift Handover Summary
                    </button>
                  </div>
                )}
              </div>

              {/* Situation Replay Scrubber */}
              <div className="border-t border-slate-800 pt-3 mt-4">
                <span className="text-[11px] font-mono text-slate-400">SITUATION REPLAY (-10m)</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  defaultValue="10"
                  className="w-full accent-sky-500 mt-1 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
