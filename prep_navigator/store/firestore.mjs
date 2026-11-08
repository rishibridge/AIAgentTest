// Firestore storage adapter — used on Google Cloud Run.
//
// Collections: patients, threads, messages, notes, tasks.
// Live cross-client/cross-instance sync uses Firestore onSnapshot listeners:
// any write (from any Cloud Run instance) fires the snapshot handler, which
// notifies subscribers → the server re-broadcasts over SSE. On Cloud Run,
// credentials come from Application Default Credentials (the service account);
// no key file is needed. Locally, point at the emulator with
// FIRESTORE_EMULATOR_HOST.

import { Firestore } from "@google-cloud/firestore";
import { PATIENTS, deriveTasks } from "../seed.mjs";

export function createFirestoreStore({ projectId } = {}) {
  const db = new Firestore(projectId ? { projectId } : {});
  const col = (n) => db.collection(n);

  const listeners = new Set();
  const notify = () => { for (const cb of listeners) { try { cb(); } catch { /* */ } } };

  async function isEmpty() {
    const snap = await col("patients").limit(1).get();
    return snap.empty;
  }

  async function deleteAll() {
    for (const name of ["patients", "threads", "messages", "notes", "tasks"]) {
      let snap = await col(name).limit(300).get();
      while (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        snap = await col(name).limit(300).get();
      }
    }
  }

  async function seedFresh() {
    await deleteAll();
    let seq = 0;
    const batch = db.batch();
    PATIENTS.forEach((p, pi) => {
      const { threads, notes, ...profile } = p;
      batch.set(col("patients").doc(p.id), { ord: pi, ...profile });
      (threads || []).forEach((th, ti) => {
        const tid = `${p.id}:${th.id}`;
        batch.set(col("threads").doc(tid), { patientId: p.id, ord: ti, kind: th.kind, label: th.label, withLabel: th.with });
        (th.msgs || []).forEach((m) => {
          batch.set(col("messages").doc(), {
            threadId: tid, seq: seq++, role: m.role, from: m.from, body: m.t,
            to: m.to || null, label: m.time || null, ts: null, unread: !!m.unread,
          });
        });
      });
      (notes || []).forEach((nt) => {
        batch.set(col("notes").doc(), { patientId: p.id, seq: seq++, type: nt.type, author: nt.author, body: nt.t, label: nt.time || null, ts: null });
      });
    });
    deriveTasks(PATIENTS).forEach((t, i) => {
      batch.set(col("tasks").doc(t.id), {
        patientId: t.patientId, type: t.type, title: t.title, why: t.why, sev: t.sev,
        supply: t.supply, lead: t.lead, leadsev: t.leadsev, status: t.status, source: t.source, assignee: t.assignee || "Navigator", ts: null, seq: i,
      });
    });
    await batch.commit();
  }

  return {
    async init() {
      if (await isEmpty()) await seedFresh();
    },
    subscribe(cb) {
      listeners.add(cb);
      // Watch the mutable collections; coalesce bursts into one notify.
      let t = null;
      const bump = () => { clearTimeout(t); t = setTimeout(notify, 80); };
      const unsub = ["messages", "notes", "tasks"].map((n) =>
        col(n).onSnapshot(() => bump(), () => { /* listener error: ignore, client will re-fetch on next change */ }));
      return () => { listeners.delete(cb); unsub.forEach((u) => u && u()); };
    },
    async getState() {
      const [pSnap, tSnap, mSnap, nSnap, kSnap] = await Promise.all([
        col("patients").get(), col("threads").get(), col("messages").get(), col("notes").get(), col("tasks").get(),
      ]);
      const threadsByPatient = {}, msgsByThread = {}, notesByPatient = {};
      tSnap.forEach((d) => { const t = d.data(); (threadsByPatient[t.patientId] ||= []).push({ id: d.id, ...t }); });
      mSnap.forEach((d) => { const m = d.data(); (msgsByThread[m.threadId] ||= []).push({ id: d.id, ...m }); });
      nSnap.forEach((d) => { const n = d.data(); (notesByPatient[n.patientId] ||= []).push({ id: d.id, ...n }); });

      const patients = pSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ord || 0) - (b.ord || 0))
        .map((row) => {
          const { ord, ...profile } = row;
          const threads = (threadsByPatient[row.id] || [])
            .sort((a, b) => (a.ord || 0) - (b.ord || 0))
            .map((th) => ({
              id: th.id, kind: th.kind, label: th.label, with: th.withLabel,
              msgs: (msgsByThread[th.id] || []).sort((a, b) => a.seq - b.seq).map((m) => ({
                id: m.id, role: m.role, from: m.from, t: m.body,
                to: m.to || undefined, time: m.label || relTime(m.ts), unread: !!m.unread,
              })),
            }));
          const notes = (notesByPatient[row.id] || []).sort((a, b) => b.seq - a.seq).map((nt) => ({
            id: nt.id, type: nt.type, author: nt.author, t: nt.body, time: nt.label || relTime(nt.ts),
          }));
          return { ...profile, threads, notes };
        });

      const tasks = kSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.ts || b.seq || 0) - (a.ts || a.seq || 0))
        .map((t) => ({ id: t.id, pid: t.patientId, type: t.type, title: t.title, why: t.why, sev: t.sev,
          supply: t.supply, lead: t.lead, leadsev: t.leadsev, status: t.status, source: t.source, assignee: t.assignee || "Navigator" }));
      return { patients, tasks };
    },
    async addMessage({ threadId, from, body, to }) {
      await col("messages").add({
        threadId, seq: Date.now(), role: "nav", from: from || "Rae Navarro",
        body: String(body || "").slice(0, 2000), to: to || null, label: null, ts: Date.now(), unread: false,
      });
    },
    async markThreadRead(threadId) {
      const snap = await col("messages").where("threadId", "==", threadId).get();
      const batch = db.batch(); let n = 0;
      snap.forEach((d) => { const m = d.data(); if (m.role !== "nav" && m.unread) { batch.update(d.ref, { unread: false }); n++; } });
      if (n) await batch.commit();
    },
    async addNote({ patientId, type, author, body, makeTask }) {
      const text = String(body || "").slice(0, 2000);
      await col("notes").add({ patientId, seq: Date.now(), type: type || "Note", author: author || "Rae Navarro", body: text, label: null, ts: Date.now() });
      if (makeTask) {
        const pd = await col("patients").doc(patientId).get();
        const prof = pd.exists ? pd.data() : { name: "", supply: 0 };
        await col("tasks").doc("t-note-" + Date.now()).set({
          patientId, type: "note", title: "Follow-up: " + (text.length > 60 ? text.slice(0, 57) + "…" : text),
          why: "From " + String(type || "note").toLowerCase() + " note · " + prof.name,
          sev: "warn", supply: prof.supply, lead: "from note", leadsev: "ok", status: "open", source: "note", assignee: "Navigator", ts: Date.now(), seq: Date.now(),
        });
      }
      // Logging a Visit closes an open field-outreach task.
      if (type === "Visit") {
        const snap = await col("tasks").where("patientId", "==", patientId).get();
        const batch = db.batch(); let n = 0;
        snap.forEach((d) => { const t = d.data(); if (t.type === "outreach" && t.status === "open") { batch.update(d.ref, { status: "done" }); n++; } });
        if (n) await batch.commit();
      }
    },
    async escalate({ patientId, reason }) {
      const snap = await col("tasks").where("patientId", "==", patientId).get();
      if (snap.docs.some((d) => { const t = d.data(); return t.type === "outreach" && t.status === "open"; })) return;
      const pd = await col("patients").doc(patientId).get();
      const prof = pd.exists ? pd.data() : { supply: 0 };
      const sev = (prof.supply || 0) <= 7 ? "crit" : "warn";
      await col("tasks").doc("t-outreach-" + Date.now()).set({
        patientId, type: "outreach", title: "Field outreach — home visit to re-engage",
        why: String(reason || "Unreachable by SMS/email/call").slice(0, 500),
        sev, supply: prof.supply || 0, lead: "dispatch", leadsev: "crit", status: "open", source: "escalation", assignee: "Field Outreach", ts: Date.now(), seq: Date.now(),
      });
    },
    async setTaskStatus(id, status) {
      await col("tasks").doc(id).update({ status });
    },
    async reset() { await seedFresh(); notify(); },
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
