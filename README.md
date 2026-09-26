# FocusPane ── Edge RAG & Adaptive Control Interface for Industrial Maintenance

FocusPane is an intelligence and presentation layer for industrial control rooms (SCADA/DCS). It addresses alarm flooding during process upsets by re-ordering events by impact, rendering interactive topological plant maps, and serving zero-latency operational guidance using 100% client-side Retrieval-Augmented Generation (RAG).

---

## Key Features

- **Impact-Ranked Event Queue:** Dynamically prioritizes incoming alarm floods using LightGBM process criticality scoring rather than raw timestamp order.
- **100% Client-Side RAG Engine:** Uses `Transformers.js` over WebGPU and local `IndexedDB` vector storage to query operating manuals and resolution logs with zero cloud data transmission[cite: 1].
- **Hybrid Search (Dense Vector + BM25 RRF):** Combines dense vector similarity with BM25 keyword matching via Reciprocal Rank Fusion (RRF) to precisely pinpoint tag numbers and maintenance steps[cite: 1].
- **Role-Adaptive Interface:** Dynamically shifts UI density, visible terminology, and accessible controls based on the logged-in user profile (`Trainee`, `Operator`, `Supervisor`)[cite: 1].
- **Situation Replay:** Provides an $N$-minute timeline scrubber to rewind and replay historical alarm sequences for seamless shift handovers[cite: 1].

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Cytoscape.js[cite: 1] |
| **Client AI & Storage** | Hugging Face `Transformers.js`, WebGPU, Web Workers, IndexedDB (`idb`)[cite: 1] |
| **Backend & Scoring** | Python 3.11, FastAPI, LightGBM, scikit-learn[cite: 1] |
| **Data Streaming** | OPC UA Client Libraries, TimescaleDB / PostgreSQL[cite: 1] |

---

## Architecture Overview
