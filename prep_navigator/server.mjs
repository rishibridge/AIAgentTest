// PrEP Navigator console — zero-dependency backend.
//
// Real server-side persistence (SQLite on disk) with live cross-client sync
// via Server-Sent Events. No npm dependencies: uses Node's built-in
// `node:http` and the experimental `node:sqlite` (Node 22.5+).
//
// Run:  node --experimental-sqlite server.mjs   (or: npm start)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { PATIENTS, deriveTasks } from "./seed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "continuity.db");
const PUBLIC_DIR = path.join(__dirname, "public");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

// ---------- schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY, ord INTEGER, profile TEXT
  );
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY, patient_id TEXT, ord INTEGER, kind TEXT, label TEXT, with_label TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id TEXT, ord INTEGER,
    role TEXT, from_name TEXT, body TEXT, to_recipient TEXT, label TEXT, ts INTEGER, unread INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT, type TEXT, author TEXT,
    body TEXT, label TEXT, ts INTEGER
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, patient_id TEXT, type TEXT, title TEXT, why TEXT,
    sev TEXT, supply INTEGER, lead TEXT, leadsev TEXT, status TEXT, source TEXT, ts INTEGER
  );
`);

// ---------- seeding ----------
function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) AS c FROM patients").get().c;
  if (n > 0) return;
  seedFresh();
}
function seedFresh() {
  const tx = db.exec.bind(db);
  tx("DELETE FROM messages; DELETE FROM threads; DELETE FROM notes; DELETE FROM tasks; DELETE FROM patients;");
  const insP = db.prepare("INSERT INTO patients (id, ord, profile) VALUES (?, ?, ?)");
  const insT = db.prepare("INSERT INTO threads (id, patient_id, ord, kind, label, with_label) VALUES (?, ?, ?, ?, ?, ?)");
  const insM = db.prepare("INSERT INTO messages (thread_id, ord, role, from_name, body, to_recipient, label, ts, unread) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insN = db.prepare("INSERT INTO notes (patient_id, type, author, body, label, ts) VALUES (?, ?, ?, ?, ?, ?)");
  const insTask = db.prepare("INSERT INTO tasks (id, patient_id, type, title, why, sev, supply, lead, leadsev, status, source, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

  PATIENTS.forEach((p, pi) => {
    const { threads, notes, ...profile } = p;
    insP.run(p.id, pi, JSON.stringify(profile));
    (threads || []).forEach((th, ti) => {
      const tid = `${p.id}:${th.id}`;
      insT.run(tid, p.id, ti, th.kind, th.label, th.with);
      (th.msgs || []).forEach((m, mi) =>
        insM.run(tid, mi, m.role, m.from, m.t, m.to || null, m.time || null, null, m.unread ? 1 : 0));
    });
    (notes || []).forEach((nt) => insN.run(p.id, nt.type, nt.author, nt.t, nt.time || null, null));
  });
  deriveTasks(PATIENTS).forEach((t) =>
    insTask.run(t.id, t.patientId, t.type, t.title, t.why, t.sev, t.supply, t.lead, t.leadsev, t.status, t.source, null));
}
seedIfEmpty();

// ---------- state assembly ----------
function getState() {
  const patients = db.prepare("SELECT * FROM patients ORDER BY ord").all().map((row) => {
    const profile = JSON.parse(row.profile);
    const threads = db.prepare("SELECT * FROM threads WHERE patient_id=? ORDER BY ord").all(row.id).map((th) => ({
      id: th.id, kind: th.kind, label: th.label, with: th.with_label,
      msgs: db.prepare("SELECT * FROM messages WHERE thread_id=? ORDER BY ord, id").all(th.id).map((m) => ({
        id: m.id, role: m.role, from: m.from_name, t: m.body,
        to: m.to_recipient || undefined, time: m.label || relTime(m.ts), unread: !!m.unread,
      })),
    }));
    const notes = db.prepare("SELECT * FROM notes WHERE patient_id=? ORDER BY id DESC").all(row.id).map((n) => ({
      id: n.id, type: n.type, author: n.author, t: n.body, time: n.label || relTime(n.ts),
    }));
    return { ...profile, threads, notes };
  });
  const tasks = db.prepare("SELECT * FROM tasks ORDER BY ts DESC, id").all().map((t) => ({
    id: t.id, pid: t.patient_id, type: t.type, title: t.title, why: t.why, sev: t.sev,
    supply: t.supply, lead: t.lead, leadsev: t.leadsev, status: t.status, source: t.source,
  }));
  return { patients, tasks, rev };
}
function relTime(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

// ---------- live sync (SSE) ----------
let rev = 1;
const clients = new Set();
function broadcast() {
  rev++;
  const payload = `data: ${JSON.stringify({ rev })}\n\n`;
  for (const res of clients) { try { res.write(payload); } catch { /* dropped */ } }
}

// ---------- helpers ----------
const now = () => Date.now();
function readBody(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // --- SSE stream ---
  if (p === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`retry: 3000\n\n`);
    res.write(`data: ${JSON.stringify({ rev })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* */ } }, 25000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  // --- API ---
  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/state" && req.method === "GET") return json(res, 200, getState());

      if (p === "/api/messages" && req.method === "POST") {
        const b = await readBody(req);
        const threadId = b.threadId;
        const ord = (db.prepare("SELECT COALESCE(MAX(ord),-1)+1 AS n FROM messages WHERE thread_id=?").get(threadId).n) || 0;
        db.prepare("INSERT INTO messages (thread_id, ord, role, from_name, body, to_recipient, label, ts, unread) VALUES (?, ?, 'nav', ?, ?, ?, NULL, ?, 0)")
          .run(threadId, ord, b.from || "Rae Navarro", String(b.body || "").slice(0, 2000), b.to || null, now());
        broadcast(); return json(res, 201, { ok: true });
      }

      if (p === "/api/threads/read" && req.method === "POST") {
        const b = await readBody(req);
        db.prepare("UPDATE messages SET unread=0 WHERE thread_id=? AND role!='nav'").run(b.threadId);
        broadcast(); return json(res, 200, { ok: true });
      }

      if (p === "/api/notes" && req.method === "POST") {
        const b = await readBody(req);
        const body = String(b.body || "").slice(0, 2000);
        db.prepare("INSERT INTO notes (patient_id, type, author, body, label, ts) VALUES (?, ?, ?, ?, NULL, ?)")
          .run(b.patientId, b.type || "Note", b.author || "Rae Navarro", body, now());
        if (b.makeTask) {
          const pt = db.prepare("SELECT profile FROM patients WHERE id=?").get(b.patientId);
          const prof = pt ? JSON.parse(pt.profile) : { name: "", supply: 0 };
          db.prepare("INSERT INTO tasks (id, patient_id, type, title, why, sev, supply, lead, leadsev, status, source, ts) VALUES (?, ?, 'note', ?, ?, 'warn', ?, 'from note', 'ok', 'open', 'note', ?)")
            .run("t-note-" + now() + "-" + Math.floor(rev), b.patientId,
              "Follow-up: " + (body.length > 60 ? body.slice(0, 57) + "…" : body),
              "From " + String(b.type || "note").toLowerCase() + " note · " + prof.name, prof.supply, now());
        }
        broadcast(); return json(res, 201, { ok: true });
      }

      if (p === "/api/tasks/status" && req.method === "POST") {
        const b = await readBody(req);
        if (!["open", "snoozed", "done"].includes(b.status)) return json(res, 400, { error: "bad status" });
        db.prepare("UPDATE tasks SET status=? WHERE id=?").run(b.status, b.id);
        broadcast(); return json(res, 200, { ok: true });
      }

      if (p === "/api/reset" && req.method === "POST") {
        seedFresh(); broadcast(); return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: "not found" });
    } catch (e) {
      return json(res, 500, { error: String(e && e.message || e) });
    }
  }

  // --- static files ---
  let file = p === "/" ? "/index.html" : p;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Continuity — PrEP Navigator console running at http://localhost:${PORT}`);
  console.log(`SQLite: ${DB_PATH}`);
});
