// Mock plant model shared by the in-browser simulator and the topology map.
// Keep in sync with TAG_CATALOG / TOPOLOGY in backend/main.py.

export interface PlantTag {
  tag: string;
  desc: string;
  baseImpact: number;
}

export const TAG_CATALOG: PlantTag[] = [
  { tag: "ELEC-401", desc: "Substation B Bus Voltage Sag", baseImpact: 0.6 },
  { tag: "LEVEL-110", desc: "Deaerator Tank Level Low", baseImpact: 0.68 },
  { tag: "COMP-501", desc: "Instrument Air Compressor Trip", baseImpact: 0.71 },
  { tag: "PUMP-101A", desc: "Feed Water Pump High Vibration", baseImpact: 0.85 },
  { tag: "FLOW-105", desc: "Coolant Loop Low Flow Rate", baseImpact: 0.74 },
  { tag: "TEMP-302", desc: "Reactor Vessel Core Temp High", baseImpact: 0.98 },
  { tag: "PRESS-210", desc: "Steam Header Pressure High", baseImpact: 0.88 },
  { tag: "VALVE-204", desc: "Main Steam Line Pressure Relief Open", baseImpact: 0.92 },
];

// Directed process connections: an upset at `source` propagates to `target`.
export const TOPOLOGY: [source: string, target: string][] = [
  ["ELEC-401", "PUMP-101A"],
  ["ELEC-401", "COMP-501"],
  ["LEVEL-110", "PUMP-101A"],
  ["PUMP-101A", "FLOW-105"],
  ["FLOW-105", "TEMP-302"],
  ["TEMP-302", "PRESS-210"],
  ["PRESS-210", "VALVE-204"],
  ["COMP-501", "VALVE-204"],
];

export function downstreamOf(tag: string): string[] {
  return TOPOLOGY.filter(([source]) => source === tag).map(([, target]) => target);
}
