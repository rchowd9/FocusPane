import { useCallback, useEffect, useState } from "react";
import { AlarmEvent, FeedMode, FeedStatus, TrackedAlarm } from "../types";
import { startSimulator } from "./simulator";

const MAX_HISTORY = 500;
const RECONNECT_DELAY_MS = 3000;

// Set VITE_ALARM_FEED_URL (e.g. ws://localhost:8000/ws/alarms) to stream from the
// FastAPI backend; leave it unset to run the self-contained in-browser simulator.
const FEED_URL: string | undefined = import.meta.env.VITE_ALARM_FEED_URL || undefined;

export const FEED_MODE: FeedMode = FEED_URL ? "websocket" : "simulated";
export const FEED_ENDPOINT = FEED_URL;

export function useAlarmFeed() {
  const [alarms, setAlarms] = useState<TrackedAlarm[]>([]);
  const [status, setStatus] = useState<FeedStatus>("connecting");

  const ingest = useCallback((event: AlarmEvent) => {
    setAlarms((prev) => {
      const existing = prev.find((a) => a.id === event.id);
      const tracked: TrackedAlarm = existing
        ? { ...event, status: existing.status, acknowledgedAt: existing.acknowledgedAt }
        : { ...event, status: "ACTIVE" };
      return [tracked, ...prev.filter((a) => a.id !== event.id)].slice(0, MAX_HISTORY);
    });
  }, []);

  useEffect(() => {
    if (!FEED_URL) {
      // Reset so StrictMode's double-mount doesn't duplicate the backfilled history
      setAlarms([]);
      setStatus("live");
      return startSimulator(ingest);
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      ws = new WebSocket(FEED_URL);
      ws.onopen = () => setStatus("live");
      ws.onmessage = (msg) => {
        try {
          ingest(JSON.parse(msg.data));
        } catch {
          console.warn("Dropping malformed alarm message:", msg.data);
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        setStatus("reconnecting");
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [ingest]);

  const acknowledge = useCallback((ids: string[]) => {
    const now = Date.now() / 1000;
    const targets = new Set(ids);
    setAlarms((prev) =>
      prev.map((a) =>
        targets.has(a.id) && a.status === "ACTIVE"
          ? { ...a, status: "ACKNOWLEDGED", acknowledgedAt: now }
          : a
      )
    );
  }, []);

  return { alarms, status, acknowledge };
}
