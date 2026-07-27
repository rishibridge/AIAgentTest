# Continuity — PrEP Navigator Console

A web console for **PrEP navigators** to monitor and manage patient lifecycle
and prevent gaps in care. The organizing goal is **100% MPR / continuous
supply**: every patient has a *supply runway*, and each blocking step —
testing, encounter, first fill, refill, renewal, prior auth — needs lead time
to clear before that runway hits zero. The app treats continuity as
**critical-path scheduling against a countdown** and prioritizes a navigator's
work by *days until a gap, net of the lead time each blocker needs*.

This iteration adds **real server-side persistence** with **live cross-client
sync** — open it in two browsers and changes appear in both in real time.

## What's inside

| Area | Description |
|------|-------------|
| **Worklist** | Tasks ranked by time-to-gap. Mark **Done**, **Snooze**/restore; live KPIs (Urgent / Open / Cleared). |
| **Patient 360** | Continuity clock, critical path, clinical requirements, activity log. |
| **Messaging** | Per-patient **Patient · SMS** and internal **Care team** threads, with templates and provider/pharmacy **routing + @mentions**. |
| **Inbox** | Unified view of every thread across the panel, filterable, with unread badges. |
| **Notes & call log** | Log calls / needs / notes; a **Need** can auto-create a follow-up task. |
| **Panel Health** | Cohort MPR, on-time testing, and a continuity funnel showing where gaps originate. |

## Architecture

- **Backend** (`server.mjs`) — zero-dependency Node using built-in `node:http`
  and `node:sqlite`. Serves the UI, exposes a small JSON API, and pushes live
  updates over **Server-Sent Events** (`/api/events`). On any write the server
  bumps a revision and every connected client re-fetches state.
- **Storage** — an on-disk **SQLite** database (`data/continuity.db`, created
  and seeded on first run). Mutable, collaborative entities (messages, notes,
  tasks) are proper rows; read-mostly patient clinical profiles are stored as
  JSON. The server stamps real timestamps on everything created at runtime.
- **Frontend** (`public/index.html`) — a single self-contained page that reads
  from the API and subscribes to SSE; UI selection (current patient, open
  thread) is client-side, data is server-side.

## Run it

Requires **Node 22.5+** (for the built-in `node:sqlite`). No `npm install` —
there are no dependencies.

```bash
cd prep_navigator
npm start            # → http://localhost:5173
```

Then open **two** browser windows at the same URL, act in one (send a message,
clear a task, add a note) and watch it appear in the other. The **Reset**
button in the top bar reseeds the server's sample data for everyone.

### Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `PORT` | `5173` | HTTP port |
| `DB_PATH` | `./data/continuity.db` | SQLite file location |

## API

| Method & path | Body | Effect |
|---|---|---|
| `GET /api/state` | — | Full snapshot: patients (+threads, +messages, +notes) and tasks |
| `POST /api/messages` | `{threadId, body, to?}` | Append a navigator message to a thread |
| `POST /api/threads/read` | `{threadId}` | Clear unread on a thread |
| `POST /api/notes` | `{patientId, type, body, makeTask?}` | Add a note; optionally create a follow-up task |
| `POST /api/tasks/status` | `{id, status}` | `open` \| `snoozed` \| `done` |
| `POST /api/reset` | — | Reseed sample data |
| `GET /api/events` | — | SSE stream of `{rev}` change notifications |

## Scope & honest caveats

This is a **functional prototype**, not a production clinical system. The
sample panel is fictional. Before real use it would need, at minimum:

- **Authentication & RBAC**, and an **audit log** of every access and change.
- **PHI safeguards**: encryption at rest/in transit, a BAA, and HIPAA-aligned
  hosting — this build stores plaintext SQLite locally and has no auth.
- **Real integrations** in place of the seeded data: EHR (FHIR/HL7), pharmacy
  (Surescripts/NCPDP), labs (HL7 ORU), messaging (SMS/secure), and
  eligibility/PA. The data model maps cleanly onto FHIR resources
  (`Patient`, `MedicationRequest`/`MedicationDispense`, `Observation`,
  `Encounter`, `Coverage`, `Task`, `Communication`).
- **Conflict handling** for true concurrent multi-navigator editing (today the
  server serializes writes and clients re-fetch on change).
