// SQLite storage adapter — used for local development and tests.
// Zero-dependency (Node's built-in node:sqlite). Single-process; live
// change notifications are in-process only.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PATIENTS, deriveTasks } from "../seed.mjs";

export function createSqliteStore({ dbPath }) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, ord INTEGER, profile TEXT);
    CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, patient_id TEXT, ord INTEGER, kind TEXT, label TEXT, with_label TEXT);
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id TEXT, ord INTEGER, role TEXT, from_name TEXT, body TEXT, to_recipient TEXT, label TEXT, ts INTEGER, unread INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT, type TEXT, author TEXT, body TEXT, label TEXT, ts INTEGER);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, patient_id TEXT, type TEXT, title TEXT, why TEXT, sev TEXT, supply INTEGER, lead TEXT, leadsev TEXT, status TEXT, source TEXT, assignee TEXT, ts INTEGER);
  `);

  const listeners = new Set();
  const notify = () => { for (const cb of listeners) { try { cb(); } catch { /* */ } } };

  function seedFresh() {
    db.exec("DELETE FROM messages; DELETE FROM threads; DELETE FROM notes; DELETE FROM tasks; DELETE FROM patients;");
    const insP = db.prepare("INSERT INTO patients (id, ord, profile) VALUES (?, ?, ?)");
    const insT = db.prepare("INSERT INTO threads (id, patient_id, ord, kind, label, with_label) VALUES (?, ?, ?, ?, ?, ?)");
    const insM = db.prepare("INSERT INTO messages (thread_id, ord, role, from_name, body, to_recipient, label, ts, unread) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insN = db.prepare("INSERT INTO notes (patient_id, type, author, body, label, ts) VALUES (?, ?, ?, ?, ?, ?)");
    const insTask = db.prepare("INSERT INTO tasks (id, patient_id, type, title, why, sev, supply, lead, leadsev, status, source, assignee, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    PATIENTS.forEach((p, pi) => {
      const { threads, notes, ...profile } = p;
      insP.run(p.id, pi, JSON.stringify(profile));
      (threads || []).forEach((th, ti) => {
        const tid = `${p.id}:${th.id}`;
        insT.run(tid, p.id, ti, th.kind, th.label, th.with);
        (th.msgs || []).forEach((m, mi) => insM.run(tid, mi, m.role, m.from, m.t, m.to || null, m.time || null, null, m.unread ? 1 : 0));
      });
      (notes || []).forEach((nt) => insN.run(p.id, nt.type, nt.author, nt.t, nt.time || null, null));
    });
    deriveTasks(PATIENTS).forEach((t) => insTask.run(t.id, t.patientId, t.type, t.title, t.why, t.sev, t.supply, t.lead, t.leadsev, t.status, t.source, t.assignee || "Navigator", null));
  }

  return {
    async init() {
      const n = db.prepare("SELECT COUNT(*) AS c FROM patients").get().c;
      if (n === 0) seedFresh();
    },
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async getState() {
      const patients = db.prepare("SELECT * FROM patients ORDER BY ord").all().map((row) => {
        const profile = JSON.parse(row.profile);
        const threads = db.prepare("SELECT * FROM threads WHERE patient_id=? ORDER BY ord").all(row.id).map((th) => ({
          id: th.id, kind: th.kind, label: th.label, with: th.with_label,
          msgs: db.prepare("SELECT * FROM messages WHERE thread_id=? ORDER BY ord, id").all(th.id).map((m) => ({
            id: String(m.id), role: m.role, from: m.from_name, t: m.body,
            to: m.to_recipient || undefined, time: m.label || relTime(m.ts), unread: !!m.unread,
          })),
        }));
        const notes = db.prepare("SELECT * FROM notes WHERE patient_id=? ORDER BY id DESC").all(row.id).map((nt) => ({
          id: String(nt.id), type: nt.type, author: nt.author, t: nt.body, time: nt.label || relTime(nt.ts),
        }));
        return { ...profile, threads, notes };
      });
      const tasks = db.prepare("SELECT * FROM tasks ORDER BY ts DESC, id").all().map((t) => ({
        id: t.id, pid: t.patient_id, type: t.type, title: t.title, why: t.why, sev: t.sev,
        supply: t.supply, lead: t.lead, leadsev: t.leadsev, status: t.status, source: t.source, assignee: t.assignee || "Navigator",
      }));
      return { patients, tasks };
    },
    async addMessage({ threadId, from, body, to }) {
      const ord = (db.prepare("SELECT COALESCE(MAX(ord),-1)+1 AS n FROM messages WHERE thread_id=?").get(threadId).n) || 0;
      db.prepare("INSERT INTO messages (thread_id, ord, role, from_name, body, to_recipient, label, ts, unread) VALUES (?, ?, 'nav', ?, ?, ?, NULL, ?, 0)")
        .run(threadId, ord, from || "Rae Navarro", String(body || "").slice(0, 2000), to || null, Date.now());
      notify();
    },
    async markThreadRead(threadId) {
      db.prepare("UPDATE messages SET unread=0 WHERE thread_id=? AND role!='nav'").run(threadId);
      notify();
    },
    async addNote({ patientId, type, author, body, makeTask }) {
      const text = String(body || "").slice(0, 2000);
      db.prepare("INSERT INTO notes (patient_id, type, author, body, label, ts) VALUES (?, ?, ?, ?, NULL, ?)")
        .run(patientId, type || "Note", author || "Rae Navarro", text, Date.now());
      if (makeTask) {
        const pt = db.prepare("SELECT profile FROM patients WHERE id=?").get(patientId);
        const prof = pt ? JSON.parse(pt.profile) : { name: "", supply: 0 };
        db.prepare("INSERT INTO tasks (id, patient_id, type, title, why, sev, supply, lead, leadsev, status, source, assignee, ts) VALUES (?, ?, 'note', ?, ?, 'warn', ?, 'from note', 'ok', 'open', 'note', 'Navigator', ?)")
          .run("t-note-" + Date.now(), patientId,
            "Follow-up: " + (text.length > 60 ? text.slice(0, 57) + "…" : text),
            "From " + String(type || "note").toLowerCase() + " note · " + prof.name, prof.supply, Date.now());
      }
      // Logging a Visit closes an open field-outreach task (field team's loop-closure).
      if (type === "Visit") db.prepare("UPDATE tasks SET status='done' WHERE patient_id=? AND type='outreach' AND status='open'").run(patientId);
      notify();
    },
    async escalate({ patientId, reason }) {
      const open = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE patient_id=? AND type='outreach' AND status='open'").get(patientId).c;
      if (open > 0) return;
      const pt = db.prepare("SELECT profile FROM patients WHERE id=?").get(patientId);
      const prof = pt ? JSON.parse(pt.profile) : { supply: 0 };
      const sev = (prof.supply || 0) <= 7 ? "crit" : "warn";
      db.prepare("INSERT INTO tasks (id, patient_id, type, title, why, sev, supply, lead, leadsev, status, source, assignee, ts) VALUES (?, ?, 'outreach', 'Field outreach — home visit to re-engage', ?, ?, ?, 'dispatch', 'crit', 'open', 'escalation', 'Field Outreach', ?)")
        .run("t-outreach-" + Date.now(), patientId, String(reason || "Unreachable by SMS/email/call").slice(0, 500), sev, prof.supply || 0, Date.now());
      notify();
    },
    async setTaskStatus(id, status) {
      db.prepare("UPDATE tasks SET status=? WHERE id=?").run(status, id);
      notify();
    },
    async reset() { seedFresh(); notify(); },
  };
}

function relTime(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
