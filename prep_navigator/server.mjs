// PrEP Navigator console — HTTP server + live sync, storage-agnostic.
//
// Picks a storage adapter at startup:
//   • Firestore  — on Cloud Run, or when STORE=firestore / a Firestore
//     emulator host is set. Real cross-instance persistence + live sync.
//   • SQLite     — locally by default (Node built-in node:sqlite, no deps).
//
// The HTTP API and the browser (SSE) are identical for both. On any write,
// the store notifies subscribers → the server bumps a revision and pushes it
// to every connected client, which re-fetches /api/state.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;
const PUBLIC_DIR = path.join(__dirname, "public");

// ---- choose storage adapter ----
const onCloudRun = !!process.env.K_SERVICE;
const wantFirestore =
  process.env.STORE === "firestore" || onCloudRun || !!process.env.FIRESTORE_EMULATOR_HOST;

let store;
if (wantFirestore) {
  const { createFirestoreStore } = await import("./store/firestore.mjs");
  store = createFirestoreStore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT });
  console.log("storage: Firestore" + (process.env.FIRESTORE_EMULATOR_HOST ? ` (emulator ${process.env.FIRESTORE_EMULATOR_HOST})` : ""));
} else {
  const { createSqliteStore } = await import("./store/sqlite.mjs");
  const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "continuity.db");
  store = createSqliteStore({ dbPath });
  console.log("storage: SQLite (" + dbPath + ")");
}
await store.init();

// ---- live sync ----
let rev = 1;
const clients = new Set();
store.subscribe(() => { rev++; const payload = `data: ${JSON.stringify({ rev })}\n\n`; for (const res of clients) { try { res.write(payload); } catch { /* */ } } });

// ---- helpers ----
function readBody(req) {
  return new Promise((resolve) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } }); });
}
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// ---- server ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`retry: 3000\n\n`);
    res.write(`data: ${JSON.stringify({ rev })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* */ } }, 25000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (p === "/api/health") return json(res, 200, { ok: true, storage: wantFirestore ? "firestore" : "sqlite" });

  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/state" && req.method === "GET") { const s = await store.getState(); return json(res, 200, { ...s, rev }); }
      if (p === "/api/messages" && req.method === "POST") { const b = await readBody(req); await store.addMessage({ threadId: b.threadId, from: b.from, body: b.body, to: b.to }); return json(res, 201, { ok: true }); }
      if (p === "/api/threads/read" && req.method === "POST") { const b = await readBody(req); await store.markThreadRead(b.threadId); return json(res, 200, { ok: true }); }
      if (p === "/api/notes" && req.method === "POST") { const b = await readBody(req); await store.addNote({ patientId: b.patientId, type: b.type, author: b.author, body: b.body, makeTask: b.makeTask }); return json(res, 201, { ok: true }); }
      if (p === "/api/tasks/status" && req.method === "POST") { const b = await readBody(req); if (!["open", "snoozed", "done"].includes(b.status)) return json(res, 400, { error: "bad status" }); await store.setTaskStatus(b.id, b.status); return json(res, 200, { ok: true }); }
      if (p === "/api/tasks/escalate" && req.method === "POST") { const b = await readBody(req); await store.escalate({ patientId: b.patientId, reason: b.reason }); return json(res, 201, { ok: true }); }
      if (p === "/api/reset" && req.method === "POST") { await store.reset(); return json(res, 200, { ok: true }); }
      return json(res, 404, { error: "not found" });
    } catch (e) { return json(res, 500, { error: String((e && e.message) || e) }); }
  }

  // static
  const file = p === "/" ? "/index.html" : p;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Continuity — PrEP Navigator console on http://localhost:${PORT}`));
