import { AlarmEvent } from "../types";
import { PlantTag, TAG_CATALOG, downstreamOf } from "../plant";

// In-browser stand-in for the FastAPI alarm stream, used when no
// VITE_ALARM_FEED_URL is configured (e.g. a static Vercel deployment).

const EVENT_INTERVAL_MS = 3000;
const CASCADE_PROBABILITY = 0.2;
const HISTORY_EVENTS = 14;
const HISTORY_WINDOW_S = 9 * 60;

const tagLookup = new Map(TAG_CATALOG.map((t) => [t.tag, t]));
let nextId = 1001;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Simulates the LightGBM gradient-boosted impact scoring model
function impactScore(baseImpact: number): number {
  const noise = Math.random() * 0.1 - 0.05;
  return Math.round(Math.max(0.1, Math.min(1, baseImpact + noise)) * 100) / 100;
}

function makeEvent(tag: PlantTag, timestamp = Date.now() / 1000): AlarmEvent {
  return {
    id: `SIM-${nextId++}`,
    tag: tag.tag,
    description: tag.desc,
    raw_severity: pick(["CRITICAL", "HIGH", "WARNING"]),
    impact_score: impactScore(tag.baseImpact),
    timestamp,
    status: "ACTIVE",
  };
}

export function startSimulator(onEvent: (event: AlarmEvent) => void): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const schedule = (fn: () => void, delay: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, delay);
    timers.add(t);
  };

  // Backfill a few minutes of history so Situation Replay has something to show
  const now = Date.now() / 1000;
  for (let i = HISTORY_EVENTS; i > 0; i--) {
    onEvent(makeEvent(pick(TAG_CATALOG), now - (i / HISTORY_EVENTS) * HISTORY_WINDOW_S));
  }

  // Walk the topology downstream to mimic an alarm flood during a process upset
  const cascade = (tag: string, depth: number) => {
    for (const next of downstreamOf(tag)) {
      schedule(() => {
        onEvent(makeEvent(tagLookup.get(next)!));
        if (depth < 4) cascade(next, depth + 1);
      }, 600 + Math.random() * 900);
    }
  };

  const interval = setInterval(() => {
    const tag = pick(TAG_CATALOG);
    onEvent(makeEvent(tag));
    if (Math.random() < CASCADE_PROBABILITY) cascade(tag.tag, 1);
  }, EVENT_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    timers.forEach(clearTimeout);
  };
}
