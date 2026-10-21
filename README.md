# FocusPane — Edge RAG & Adaptive Control Interface for Industrial Maintenance

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frchowd9%2FFocusPane&project-name=focuspane)

FocusPane is an intelligence and presentation layer for industrial control rooms (SCADA/DCS). It tackles **alarm flooding** during process upsets by ranking events by process impact instead of arrival time, showing where alarms sit on a live plant topology map, and surfacing operating-manual guidance with a **fully client-side Retrieval-Augmented Generation (RAG)** engine. No alarm or document data leaves the browser.

> **Status:** prototype. The plant, alarm stream, impact model and manuals are simulated sample data.

---

## Features

| Feature | What it does |
| :--- | :--- |
| **Impact-ranked event queue** | Alarms are ordered by impact score (0–1) rather than timestamp. Unacknowledged alarms stay on top; scores above 0.8 are flagged critical. |
| **Live plant topology map** | Cytoscape.js graph of the process flow. Nodes turn amber/red by their highest active impact. Click a node to filter the queue to that tag; click the background to clear. |
| **Alarm-flood simulation** | The simulator randomly cascades upsets downstream through the topology (e.g. `ELEC-401 → PUMP-101A → FLOW-105 → TEMP-302`), reproducing the floods FocusPane is designed for. |
| **100% client-side hybrid RAG** | `Transformers.js` (`all-MiniLM-L6-v2`) runs in a Web Worker on WebGPU, falling back to WASM. Chunks are embedded into IndexedDB and searched with dense vectors + BM25, fused with Reciprocal Rank Fusion. |
| **Bundled sample knowledge base** | Twelve sample manual/maintenance-log excerpts are indexed automatically on first load, so the Assist panel works out of the box. |
| **Ask the manuals** | Selecting an alarm queries the index automatically; you can also type free-text questions. |
| **Role-adaptive UI** | **Trainee:** read-only, inline explanations, fewer results. **Operator:** acknowledge/isolate and export. **Supervisor:** raw severity, event and chunk IDs, keyword-match flags, bulk acknowledge. |
| **Acknowledge & isolate** | Acknowledges every active alarm on the selected tag; acknowledged alarms are dimmed and sink below active ones. |
| **Situation replay** | Scrub up to 10 minutes back to see the queue, the map and acknowledgement state as they were at that moment. Actions are locked while replaying. |
| **Shift handover export** | Downloads a Markdown summary of open tags (highest impact first) and alarms acknowledged during the shift. |

---

## Quick Start

Requires **Node.js 18+**.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. With no configuration, the UI runs the **built-in alarm simulator**, so no backend is needed.

### Productivity shortcuts

- `N` jumps to the next critical or highest-impact active alarm.
- `Esc` clears the current tag filter and selection.
- The active role, selected tag and replay minute offset are persisted in the browser so your control-room context survives refreshes.

The first visit downloads the embedding model from the Hugging Face Hub. The browser caches it, and every later search runs offline on your machine.

### Optional: stream from the Python backend

The FastAPI service streams simulated alarm events over a WebSocket.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python main.py            # or: uvicorn main:app --reload --port 8000
```

Then point the UI at it by creating `.env.local` in the project root (see [.env.example](.env.example)):

```bash
VITE_ALARM_FEED_URL=ws://localhost:8000/ws/alarms
```

Restart `npm run dev`. The header badge changes from **Simulated feed** to **Live · localhost:8000**.

| Backend endpoint | Purpose |
| :--- | :--- |
| `GET /api/health` | Health check |
| `WS /ws/alarms` | Alarm event stream (one event every 3 s) |
| `GET /docs` | OpenAPI docs |

---

## Deploying to Vercel

The frontend is a static Vite build and deploys to Vercel as-is. The included [vercel.json](vercel.json) sets the framework, build command, output directory and long-lived caching for hashed assets.

**One click:** use the **Deploy with Vercel** button above.

**From the dashboard:** go to *Add New → Project* and import `rchowd9/FocusPane`. The settings are detected from `vercel.json`, so click **Deploy**.

**From the CLI:**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

### Alarm feed on Vercel

Vercel Functions can't hold long-lived WebSocket connections, so the FastAPI backend isn't deployed to Vercel. You have two options:

1. **Default (no setup):** leave `VITE_ALARM_FEED_URL` unset and the deployed app uses the in-browser simulator.
2. **Live backend:** deploy `backend/` to a host that supports WebSockets (Render, Railway, Fly.io and similar). Use start command `uvicorn main:app --host 0.0.0.0 --port $PORT`. Then in Vercel go to *Project → Settings → Environment Variables* and set:
   - `VITE_ALARM_FEED_URL=wss://<your-backend-host>/ws/alarms` (it must be `wss://`, because the Vercel site is served over HTTPS)

   Redeploy afterwards, because Vite inlines the variable at build time. On the backend, you can optionally set `ALLOWED_ORIGINS=https://<your-app>.vercel.app` to restrict CORS.

`.vercelignore` keeps `backend/` and local virtualenvs out of the Vercel upload.

---

## Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                 │
│  Alarm source ──► useAlarmFeed ──► App (rank / filter / replay) │
│  (simulator or        │                 │            │          │
│   FastAPI WS)         │           TopologyGraph   ContextPanel  │
│                       │           (Cytoscape)          │        │
│                       ▼                                ▼        │
│               ack state, history              RAG Web Worker    │
│                                      Transformers.js (WebGPU/WASM)
│                                      IndexedDB vectors + BM25 → RRF
└─────────────────────────────────────────────────────────────────┘
```

### Project Layout

```
src/
  App.tsx                    Dashboard: queue, actions, replay, role switching
  plant.ts                   Shared tag catalog and process topology
  types.ts                   Alarm/role/feed types
  feed/useAlarmFeed.ts       Feed hook: WebSocket or simulator, acknowledgement
  feed/simulator.ts          In-browser alarm generator with downstream cascades
  components/TopologyGraph.tsx
  components/ContextPanel.tsx  RAG Assist panel
  rag/worker.ts              Embedding model, indexing, hybrid search
  rag/storage.ts             IndexedDB store, cosine, BM25, RRF
  rag/seedDocs.ts            Bundled sample manuals
  lib/handover.ts            Shift handover Markdown export
backend/
  main.py                    FastAPI alarm stream (simulated impact scoring)
```

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend UI | React 18, TypeScript, Vite 6, Tailwind CSS 4, Cytoscape.js |
| Client AI & storage | Hugging Face Transformers.js 3, WebGPU / WASM, Web Workers, IndexedDB (`idb`) |
| Backend (optional) | Python 3.11+, FastAPI, Uvicorn |
| Hosting | Vercel (static frontend) |

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Serve the production build locally |

## Roadmap

- Replace simulated impact scores with a trained LightGBM criticality model.
- Ingest real plant data through an OPC UA client, with TimescaleDB/PostgreSQL alarm history.
- Upload and index your own manuals (PDF/Markdown) from the UI. The worker already supports `INDEX_DOCUMENTS`.
- Persist acknowledgements and handover notes server-side.
