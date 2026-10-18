import { TrackedAlarm, UserRole } from "../types";

function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour12: false });
}

function alarmLine(a: TrackedAlarm): string {
  const ack = a.acknowledgedAt ? ` (ack ${formatTime(a.acknowledgedAt)})` : "";
  return `| ${formatTime(a.timestamp)} | ${a.tag} | ${a.description} | ${a.impact_score.toFixed(2)} | ${a.raw_severity} | ${a.status}${ack} |`;
}

export function buildHandoverSummary(alarms: TrackedAlarm[], role: UserRole): string {
  const active = alarms.filter((a) => a.status === "ACTIVE");
  const acknowledged = alarms.filter((a) => a.status === "ACKNOWLEDGED");

  // One row per tag: its highest-impact active alarm
  const byTag = new Map<string, TrackedAlarm>();
  for (const a of active) {
    const current = byTag.get(a.tag);
    if (!current || a.impact_score > current.impact_score) byTag.set(a.tag, a);
  }
  const openTags = [...byTag.values()].sort((a, b) => b.impact_score - a.impact_score);

  const header = "| Time | Tag | Description | Impact | Raw | Status |\n| --- | --- | --- | --- | --- | --- |";

  return [
    "# FocusPane Shift Handover Summary",
    "",
    `- Generated: ${new Date().toLocaleString()}`,
    `- Prepared by role: ${role}`,
    `- Active alarms: ${active.length} across ${byTag.size} tags`,
    `- Acknowledged this shift: ${acknowledged.length}`,
    "",
    "## Open Tags (highest impact first)",
    "",
    openTags.length ? [header, ...openTags.map(alarmLine)].join("\n") : "_No active alarms._",
    "",
    "## Acknowledged / Isolated",
    "",
    acknowledged.length ? [header, ...acknowledged.map(alarmLine)].join("\n") : "_None._",
    "",
  ].join("\n");
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
