import { DocChunk } from "./storage";

// Sample operating-manual and maintenance-log excerpts, embedded into IndexedDB
// on first load so the Assist panel works out of the box. Illustrative only.
// Bump the version prefix when editing content so clients re-index.
export const SEED_PREFIX = "seed-v1-";

type SeedChunk = Omit<DocChunk, "embedding">;

const chunks: Omit<SeedChunk, "id">[] = [
  {
    docTitle: "OM-PUMP-101 Feed Water Pump Manual §4.2",
    tagReference: "PUMP-101A",
    content:
      "High vibration on PUMP-101A above 7.1 mm/s RMS: verify suction pressure and deaerator level first, as cavitation is the most common cause. If suction is normal, transfer load to standby pump PUMP-101B and inspect coupling alignment and bearing temperatures.",
  },
  {
    docTitle: "Maintenance Log WO-23817",
    tagReference: "PUMP-101A",
    content:
      "PUMP-101A vibration alarm traced to worn drive-end bearing. Bearing replaced and laser alignment performed. Recommend vibration trending review weekly for 30 days after any bearing work.",
  },
  {
    docTitle: "OM-VALVE-204 Pressure Relief Procedure §2.1",
    tagReference: "VALVE-204",
    content:
      "Main steam pressure relief VALVE-204 open indication: confirm steam header pressure on PRESS-210. If header pressure is below setpoint and valve remains open, suspect a stuck pilot or loss of instrument air. Do not attempt manual reseat while the line is pressurized.",
  },
  {
    docTitle: "Emergency Operating Procedure EOP-3 Core Temperature",
    tagReference: "TEMP-302",
    content:
      "Reactor vessel core temperature high on TEMP-302: immediately verify coolant loop flow on FLOW-105. Low coolant flow combined with rising core temperature requires rapid power reduction per EOP-3 step 4 and notification of the shift supervisor.",
  },
  {
    docTitle: "Instrument Calibration Record IC-302",
    tagReference: "TEMP-302",
    content:
      "TEMP-302 thermocouple drift of +4 degC found during last outage calibration. Cross-check against redundant sensor TEMP-302B before acting on a single high reading.",
  },
  {
    docTitle: "OM-FLOW-105 Coolant Loop Manual §3.4",
    tagReference: "FLOW-105",
    content:
      "Coolant loop low flow on FLOW-105 is usually downstream of a feed pump issue. Check PUMP-101A status and strainer differential pressure. A clogged strainer shows a rising differential above 0.8 bar.",
  },
  {
    docTitle: "Electrical Operations Guide EOG-12 Bus Voltage",
    tagReference: "ELEC-401",
    content:
      "Substation B bus voltage sag on ELEC-401 can trip motor-driven equipment, including feed water pumps and the instrument air compressor. Check the upstream transformer tap changer and expect sympathetic alarms on PUMP-101A and COMP-501.",
  },
  {
    docTitle: "OM-DEA-110 Deaerator Operations §5",
    tagReference: "LEVEL-110",
    content:
      "Deaerator tank level low on LEVEL-110 reduces net positive suction head for the feed pumps. Increase makeup water flow and verify the level control valve is not stuck. Sustained low level will cause PUMP-101A cavitation and vibration.",
  },
  {
    docTitle: "OM-COMP-501 Instrument Air System",
    tagReference: "COMP-501",
    content:
      "Instrument air compressor trip on COMP-501: start the standby compressor and monitor air header pressure. Below 5.5 bar, air-operated valves including VALVE-204 may fail to their safe position.",
  },
  {
    docTitle: "OM-PRESS-210 Steam Header Control",
    tagReference: "PRESS-210",
    content:
      "Steam header pressure high on PRESS-210: check turbine load rejection and the pressure controller output. If pressure continues rising, relief valve VALVE-204 is expected to lift at 92 bar.",
  },
  {
    docTitle: "Shift Handover Standard SHS-1",
    content:
      "During an alarm flood, address the highest-impact root cause first rather than the oldest alarm. Acknowledge consequential alarms only after confirming the upstream cause, and record isolations in the handover summary.",
  },
  {
    docTitle: "Alarm Management Philosophy AMP-2",
    content:
      "Alarms are ranked by process impact rather than arrival time. Impact scores above 0.8 indicate a risk to safety or production and must be addressed within 5 minutes; scores between 0.5 and 0.8 within 30 minutes.",
  },
];

export const SEED_DOCS: SeedChunk[] = chunks.map((c, i) => ({ ...c, id: `${SEED_PREFIX}${i}` }));
