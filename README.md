<div align="center">

<img src="https://img.shields.io/badge/PulseOps-Unit%20Command%20View-0ea5e9?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0zIDEzaDJ2LTJIM3Yyem0wIDRoMnYtMkgzdjJ6bTAgNGgydi0ySDN2MnptNCAwaDJ2LTJIN3Yyem0wLTRoMnYtMkg3djJ6bTAtNGgydi0ySDd2MnptNCAxMmgyVjloLTJ2MTF6bTQtOGgydi0yaC0ydjJ6bTAgNGgydi0yaC0ydjJ6bTAtOGgyVjVoLTJ2NHoiLz48L3N2Zz4=" alt="PulseOps" />

# PulseOps — Unit Command View

**A real-time clinical operations dashboard for hospital charge nurses**

---

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Zustand](https://img.shields.io/badge/Zustand-5-FF6B35?style=flat-square)](https://zustand-demo.pmnd.rs)
[![React Query](https://img.shields.io/badge/React%20Query-5-FF4154?style=flat-square&logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![Vitest](https://img.shields.io/badge/Vitest-26%20tests-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev)
[![Tests](https://img.shields.io/badge/Tests-26%20passing-22c55e?style=flat-square)](/)
[![TypeScript Errors](https://img.shields.io/badge/TS%20Errors-0-22c55e?style=flat-square)](/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture Decisions](#architecture-decisions)
- [Performance Benchmarks](#performance-benchmarks)
- [Mock Server](#mock-server)
- [Accessibility Notes](#accessibility-notes)
- [Known Limitations](#known-limitations)
- [Project Structure](#project-structure)

---

## Overview

PulseOps Unit Command View is a modular, high-performance clinical dashboard that replaces a 5,100-line monolithic component with a composable, real-time architecture. It enables charge nurses to monitor patient flow, bed assignments, staff ratios, and critical alerts across hospital units - all updating live via Server-Sent Events.

### What Was Built

| Component       | Description                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| **Bed Map**     | Algorithmic SVG floor plan with cell-level memoisation, heatmap mode, zoom/pan |
| **Patient Log** | Custom virtual scroll engine with Web Worker-powered filter/sort               |
| **Alert Panel** | Real-time severity-sorted alerts with Web Audio chime and ARIA live regions    |
| **SSE Manager** | Reconnecting event stream with heartbeat detection and event replay queue      |
| **URL State**   | Full view state serialized to URL; named views persisted to IndexedDB          |
| **Mock Server** | Self-contained Express + SSE server with 460 patients, 396 beds, 8 units       |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
# Root project
npm install

# Mock server
cd mock-server && npm install && cd ..
```

### 2. Generate seed data

```bash
cd mock-server
npm run seed
cd ..
```

Expected output:

```
Seed complete:
  Units:    8
  Beds:     396
  Patients: 460
  Staff:    155
  Alerts:   53
```

### 3. Start the mock server

```bash
# In terminal 1
cd mock-server
npm start
# → PulseOps mock server running on http://localhost:3001
```

### 4. Start the frontend

```bash
# In terminal 2
npm run dev
# → http://localhost:5173
```

### 5. Run tests

```bash
npm run test -- --run
# → 26 tests passing
```

---

## Architecture Decisions

### SSE over WebSocket

Server-Sent Events were chosen over WebSocket for three reasons:

**1. Unidirectional data flow.** The dashboard is a read-heavy surface - the server pushes state changes (bed updates, alerts, telemetry) and the client sends discrete actions via REST. WebSocket's bidirectional channel adds protocol complexity that this use case does not need.

**2. HTTP/1.1 compatibility.** SSE works natively over standard HTTP without upgrade handshakes, making it easier to proxy through hospital network infrastructure (nginx, load balancers) without special WebSocket configuration.

**3. Native browser reconnection.** `EventSource` has built-in reconnection semantics. We layer exponential backoff on top for fine-grained control, but the foundation is battle-tested browser behavior.

**Fallback strategy.** When the SSE manager detects a stale connection (no heartbeat within 15 seconds), it closes the `EventSource`, queues up to 200 events during reconnection, requests a catch-up census snapshot from REST on reconnect, and replays queued events in order - deduplicated by `(bed_id, event_type)`.

---

### Web Worker Message Protocol

The patient filter/sort engine runs entirely off the main thread in `src/workers/patientWorker.ts`.

**Message types:**

| Message                | Direction     | Description                                 |
| ---------------------- | ------------- | ------------------------------------------- |
| `LOAD`                 | Main → Worker | Initial patient dataset load                |
| `FILTER_AND_SORT`      | Main → Worker | Combined filter + sort (debounced 100ms)    |
| `FILTER`               | Main → Worker | Filter only                                 |
| `SORT`                 | Main → Worker | Sort only                                   |
| `AGGREGATE`            | Main → Worker | Census stats for selected units             |
| `COMPUTE_HANDOFF_LIST` | Main → Worker | Patients likely needing transfer in 4h      |
| `RESULT`               | Worker → Main | `{ indices: number[], stats: CensusStats }` |
| `HANDOFF_LIST`         | Worker → Main | `{ indices: number[] }`                     |

**Key design: index-only results.** The worker never transfers patient objects back to the main thread. It returns only `number[]` index arrays into the original dataset. The main thread reads `patients[index]` directly from Zustand state. This eliminates serialization cost and garbage collection pressure at high patient counts.

**Debouncing.** Rapid filter changes (e.g., typing in the search box) are debounced internally at 100ms before the worker runs computation, preventing unnecessary CPU usage on intermediate keystrokes.

---

### Bed Map Layout Algorithm

The SVG bed map is generated algorithmically in `src/components/BedMap/BedMap.tsx` - no hardcoded pixel positions anywhere.

**Algorithm:**

1. Group beds by room from the unit's bed array
2. Lay rooms out in a configurable grid (`COLS = 4` rooms per row)
3. Each room's width adapts to its bed count: `roomWidth = bedCount × CELL_W + (bedCount - 1) × BED_GAP`
4. Room position: `x = PAD + (roomIndex % COLS) × (CELL_W × 2 + BED_GAP + ROOM_GAP)`
5. Row position: `y = PAD + floor(roomIndex / COLS) × (CELL_H + HEADER_H + ROOM_GAP)`
6. Each bed cell: `x = roomX + bedIndex × (CELL_W + BED_GAP)`, `y = roomY + HEADER_H`

**Cell-level memoisation.** `BedCell` uses `React.memo` with a custom equality function that returns `true` (skip re-render) unless `status`, `patient_id`, `isolation_type`, or `acuity` changed. An unrelated alert firing never causes any bed cell to re-render.

---

### URL State Serialization

The full view state is encoded as base64 JSON in the `?v=` query parameter:

```
SerializedState {
  unitId: string
  filter: FilterState
  sort: SortState
  zoom: number
  layout: "split" | "map" | "list" | "alerts"
}
```

Encoding: `btoa(encodeURIComponent(JSON.stringify(state)))`  
Decoding: `JSON.parse(decodeURIComponent(atob(encoded)))`

State is restored synchronously from the URL **before** the first data fetch, so the correct unit and filters are applied to the initial query - no layout shift or filter flash after load.

Named saved views are stored in **IndexedDB** (not localStorage) to handle the larger state blobs that include full filter objects.

---

## Performance Benchmarks

| Metric                      | Target  | Measured | Notes                          |
| --------------------------- | ------- | -------- | ------------------------------ |
| Time to Interactive         | < 2.5s  | ~1.2s    | Chrome DevTools, cold load     |
| Worker filter round-trip    | < 80ms  | ~12ms    | 460 patients, compound filter  |
| Virtual scroll FPS          | ≥ 55fps | 60fps    | Chrome Performance tab         |
| SSE reconnect (initial)     | 1s      | ~1s      | With ±25% jitter               |
| SSE reconnect (max backoff) | 30s     | 30s      | After repeated failures        |
| Heartbeat timeout           | 15s     | 15s      | Confirmed via DevTools offline |
| Alert acknowledge latency   | < 100ms | Instant  | Optimistic update              |
| Bed map re-render on SSE    | 0 cells | 1 cell   | Only changed cell re-renders   |

---

## Mock Server

### Start

```bash
cd mock-server
npm start
# → http://localhost:3001
```

### Endpoints

| Method | Path                             | Description                          |
| ------ | -------------------------------- | ------------------------------------ |
| GET    | `/api/v1/units`                  | All 8 hospital units                 |
| GET    | `/api/v1/units/:id/census`       | Beds + summary for unit              |
| GET    | `/api/v1/patients`               | Paginated, filterable patient list   |
| GET    | `/api/v1/patients/:id`           | Full patient record                  |
| POST   | `/api/v1/patients/:id/admit`     | Admit with ETag conflict (15% → 409) |
| POST   | `/api/v1/patients/:id/discharge` | Discharge with optimistic support    |
| POST   | `/api/v1/patients/:id/transfer`  | Transfer between units               |
| GET    | `/api/v1/staff`                  | Staff filtered by unit/role/shift    |
| GET    | `/api/v1/alerts`                 | Alerts filtered by severity/status   |
| POST   | `/api/v1/alerts/:id/acknowledge` | Acknowledge an alert                 |
| GET    | `/api/v1/summary/unit-stats`     | Aggregated unit statistics           |
| GET    | `/stream?unit_id=`               | SSE stream for real-time events      |

### Synthetic Scenarios Simulated

| Scenario          | Interval | Description                                |
| ----------------- | -------- | ------------------------------------------ |
| Bed status change | 3s       | Random occupied bed changes status         |
| Telemetry spike   | 5s       | Random patient vital exceeds threshold     |
| Alert fired       | 7s       | Active alert re-broadcast to clients       |
| Heartbeat         | 8s       | Server time ping to all connected clients  |
| Admit conflict    | 15%      | POST /admit returns 409 with ETag mismatch |

### Seed Data

```bash
cd mock-server
npm run seed
```

Produces `mock-server/data/hospital.json` with:

- **8 units** across cardiac, neuro, surgical, ICU, peds, oncology specialties
- **396 beds** across 116 rooms (floors 2–6)
- **460 patients** at varied acuity (1–5), status, and LOS
- **155 staff** (RN, CNA, MD, NP, Charge RN, Transport) across all shifts
- **53 alerts** of mixed severity with realistic clinical messages

---

## Accessibility Notes

### ARIA Landmark Structure

```
<header>          — PulseOps navigation bar
  <nav>           — Unit selector tabs
<main>
  role="application"  — Bed map (with keyboard instructions in aria-label)
  role="rowgroup"     — Patient log scroll container
    role="row"        — Each patient row
  role="log"          — Alert panel (live region)
    role="alert"      — Critical severity alerts
    role="status"     — High/medium severity alerts
<dialog>          — Patient detail slide-over (aria-modal)
```

### Keyboard Navigation Map

| Key           | Context           | Action                       |
| ------------- | ----------------- | ---------------------------- |
| Tab           | Bed map           | Move focus between bed cells |
| Enter / Space | Focused bed cell  | Open patient detail          |
| Arrow keys    | Bed map container | Pan the map                  |
| + / =         | Bed map container | Zoom in                      |
| −             | Bed map container | Zoom out                     |
| Escape        | Any slide-over    | Close panel                  |
| Ctrl+A        | Patient log       | Select all filtered patients |
| Click         | Column header     | Sort ascending/descending    |
| Shift+Click   | Column header     | Add secondary sort           |

### Screen Reader Support

- All bed cells have descriptive `aria-label`: `"Bed 312A — occupied — Smith, John"`
- Alert panel uses `aria-live="assertive"` for critical alerts, `aria-live="polite"` for others
- Slide-over panels use `role="dialog"` with `aria-modal="true"`
- Form controls in filters have associated labels
- axe-core integrated in development mode (`@axe-core/react`) for continuous a11y auditing
- Manually tested with NVDA + Chrome on Windows for screen reader announcements of critical alerts via ARIA live regions

### WCAG 2.1 AA Compliance

- Color is never the sole indicator of state (status text always accompanies color)
- All interactive elements are keyboard reachable and have visible focus indicators
- Minimum contrast ratio of 4.5:1 on all text elements (dark theme)
- Touch targets are minimum 44×44px

---

## Known Limitations

| Area                         | Limitation                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seed data**                | Patients generated per occupied bed - boarding/pending patients added separately. Real EHR data would have richer cross-unit relationships                                                         |
| **Admit UI**                 | Admit action backend is implemented (with 15% conflict simulation) but the admit form UI is not exposed in the frontend - only Discharge and Transfer are accessible from the patient detail panel |
| **Bulk actions**             | Bulk Assign button is UI-only - no backend endpoint exists for bulk provider assignment                                                                                                            |
| **Pinch-to-zoom**            | Bed map supports scroll wheel zoom but pinch gesture (touch) is not implemented                                                                                                                    |
| **axe-core CI**              | axe-core is integrated in dev mode via `@axe-core/react` but is not wired into the Vitest CI pipeline as automated assertions                                                                      |
| **Module Federation**        | The `remoteEntry.js` Module Federation bundle requires a production build (`npm run build`) to test as a micro-frontend remote - not testable in dev mode                                          |
| **Virtual scroll animation** | Row height transitions (collapsed <-> expanded) are instant - no CSS height animation                                                                                                              |
| **Offline queue display**    | Queue size shown in connection badge only when offline - not shown during reconnecting state                                                                                                       |
| **Test coverage**            | Coverage targets (≥80%) are met for SSE manager, URL state, and worker logic. React component tests are not included in this submission                                                            |

---

## Project Structure

```
pulseops/
├── mock-server/
│   ├── data/hospital.json
│   ├── seed.ts
│   ├── server.ts
│   └── package.json
├── src/
│   ├── components/
│   │   ├── AlertPanel/
│   │   ├── BedMap/
│   │   ├── PatientLog/
│   │   └── ui/
│   ├── features/
│   │   └── UnitCommandView/
│   ├── hooks/
│   │   ├── useSSE.ts
│   │   ├── usePatientWorker.ts
│   │   └── useUnitViewState.ts
│   ├── lib/
│   │   └── api.ts
│   ├── services/
│   │   └── sseManager.ts
│   ├── store/
│   │   └── useAppStore.ts
│   ├── types/
│   │   └── index.ts
│   └── workers/
│       └── patientWorker.ts
├── README.md
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.app.json
```

---

<div align="center">

Built with React 19 · TypeScript · Vite · Tailwind CSS · Zustand · React Query

</div>
