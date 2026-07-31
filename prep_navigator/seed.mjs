// Seed data for the PrEP Navigator console (fictional sample panel).
// This is the source of truth loaded into SQLite on first run.
// Message/note `time` values become display labels; new items created at
// runtime get real server timestamps instead.

export const PATIENTS = [
  {
    id: "marcus", name: "Marcus R.", age: 31, mrn: "PN-40213", supply: 4, mpr: 0.91,
    sev: "crit", type: "lab", action: "Order HIV test", actWithin: 0, provider: "Dr. Osei", pharmacy: "Mail order",
    headline: "Order quarterly HIV Ag/Ab + rapid — result gates the refill",
    why: "Supply ends in 4d · lab needs 2d turnaround → order today or supply lapses",
    lead: "needs 2d lead", leadsev: "crit",
    track: [ { label: "HIV test", dd: "due now", pos: 8, sev: "crit" }, { label: "Refill", dd: "day 4", pos: 40, sev: "warn" } ],
    fill: 70, gapAt: 78,
    steps: [
      { s: "done", t: "Encounter complete", d: "Telehealth visit 12 Jun · quarterly", when: "12 Jun" },
      { s: "active", t: "Quarterly HIV Ag/Ab test", d: "Required within 90d to authorize refill — last neg 18 Apr", when: "OVERDUE\nby 9d" },
      { s: "wait", t: "Approve refill (30d)", d: "Rx can't be written until a current HIV result is in — then ships", when: "on\nresult" },
      { s: "wait", t: "Next quarterly labs", d: "HIV + renal + STI panel", when: "~12 Sep" },
    ],
    labs: [
      { k: "HIV Ag/Ab", v: "Neg", s: "18 Apr · 100d ago", sev: "crit" },
      { k: "Creatinine", v: "0.9 mg/dL", s: "CrCl 104 · normal", sev: "ok" },
      { k: "HBV sAg", v: "Neg", s: "baseline 4 Jan", sev: "ok" },
      { k: "STI panel", v: "GC/CT neg", s: "18 Apr", sev: "ok" },
    ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "2 of 6 left", exp: "expires 04 Jan 27" },
    feed: [
      { sev: "crit", t: "<b>Refill blocked</b> — HIV test > 90d; Rx needs a current result before it can ship", m: "today · 08:12 · Surescripts" },
      { sev: "info", t: "Reminder SMS sent — 'time for your PrEP labs'", m: "yesterday · auto" },
      { sev: "ok", t: "Telehealth encounter documented", m: "12 Jun · Dr. Osei" },
    ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Marcus R.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Hi Marcus — you're due for a quick HIV test before your next refill. Home kit or clinic?", time: "Mon 09:12" },
        { role: "patient", from: "Marcus R.", t: "A home kit would be easier, I'm slammed at work", time: "Mon 09:31" },
        { role: "nav", from: "Rae Navarro", t: "Done — ordering it now, arrives in 2 days. Refill unlocks the moment results are in 👍", time: "Mon 09:34" },
      ] },
      { id: "team", kind: "team", label: "Care team", with: "Dr. Osei · CVS #4471", msgs: [
        { role: "provider", from: "Dr. Osei", t: "Marcus is overdue on quarterly HIV. I'll e-sign a home test order if you route the packet.", time: "Tue 08:05", unread: true },
        { role: "pharmacist", from: "Mail-order Rx", t: "Can't write or ship the refill without a current HIV result on file — standing by.", time: "Tue 08:40", unread: true },
      ] },
    ],
    notes: [
      { type: "Call", author: "Rae Navarro", t: "Called Marcus 08:20 — confirmed prefers home test, day-shift work. Ordered OraQuick, ETA 2d.", time: "Tue 08:22" },
      { type: "Need", author: "Rae Navarro", t: "Needs evening/weekend lab options going forward — day job limits clinic visits.", time: "Tue 08:25" },
    ],
  },
  {
    id: "dana", name: "Dana W.", age: 27, mrn: "PN-39880", supply: 12, mpr: 0.97,
    sev: "crit", type: "renew", action: "Renew Rx", actWithin: 4, provider: "Dr. Lin", pharmacy: "Mail order",
    headline: "Prescription out of refills — route renewal packet to prescriber",
    why: "0 refills left · renewal needs an encounter first → 8d critical path vs 12d supply",
    lead: "needs 8d lead", leadsev: "crit",
    track: [ { label: "Encounter", dd: "day 3", pos: 24, sev: "warn" }, { label: "Renewal", dd: "day 6", pos: 52, sev: "warn" }, { label: "Refill", dd: "day 8", pos: 70, sev: "ok" } ],
    fill: 82, gapAt: 88,
    steps: [
      { s: "active", t: "Schedule renewal encounter", d: "Telehealth slot — prescriber Dr. Lin", when: "book\ntoday" },
      { s: "wait", t: "Send renewal packet", d: "Auto-compiled: last HIV neg, renal, adherence 0.97", when: "on visit" },
      { s: "wait", t: "New Rx to pharmacy", d: "90-day supply requested", when: "~+6d" },
      { s: "wait", t: "Refill ships", d: "Mail-order · to patient's door", when: "~+8d" },
    ],
    labs: [
      { k: "HIV Ag/Ab", v: "Neg", s: "02 Jul · 25d ago", sev: "ok" },
      { k: "Creatinine", v: "0.8 mg/dL", s: "CrCl 118", sev: "ok" },
      { k: "STI panel", v: "CT positive", s: "treated 02 Jul", sev: "warn" },
      { k: "HCV Ab", v: "Neg", s: "02 Jul", sev: "ok" },
    ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "0 of 6 left", exp: "expires 30 Jul 26" },
    feed: [
      { sev: "warn", t: "<b>Rx exhausted</b> — auto-task: renewal", m: "today · rules engine" },
      { sev: "ok", t: "CT treatment confirmed by pharmacy", m: "05 Jul" },
    ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Dana W.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Hey Dana, your prescription needs a renewal. 15-min video visit Thursday 4pm?", time: "Today 10:02" },
        { role: "patient", from: "Dana W.", t: "Thursday works!", time: "Today 10:19", unread: true },
      ] },
      { id: "team", kind: "team", label: "Care team", with: "Dr. Lin · Walgreens #221", msgs: [
        { role: "provider", from: "Dr. Lin", t: "Happy to renew at the Thu visit — send me the adherence + last labs beforehand.", time: "Today 10:25", unread: true },
        { role: "nav", from: "Rae Navarro", t: "Packet's queued, I'll attach it before the call.", time: "Today 10:40" },
      ] },
    ],
    notes: [
      { type: "Call", author: "Rae Navarro", t: "Reached Dana, booked Thu 4pm telehealth. Reminded re: CT follow-up (treated 2 Jul).", time: "Today 10:20" },
      { type: "Need", author: "Rae Navarro", t: "Prefers video visits; transport is a barrier for in-person.", time: "Today 10:21" },
    ],
  },
  {
    id: "sam", name: "Sam T.", age: 44, mrn: "PN-41002", supply: 18, mpr: 0.94,
    sev: "warn", type: "pa", action: "Re-enroll copay", actWithin: 13, provider: "Dr. Osei", pharmacy: "Mail order",
    headline: "Copay assistance expiring — re-enroll before next fill",
    why: "Coverage ends in 15d · PA reprocessing ~5d → start before fill #4",
    lead: "needs 5d lead", leadsev: "warn",
    track: [ { label: "PA renew", dd: "day 5", pos: 30, sev: "warn" }, { label: "Refill", dd: "day 18", pos: 82, sev: "ok" } ],
    fill: 60, gapAt: 78,
    steps: [
      { s: "active", t: "Re-enroll copay assistance", d: "Manufacturer PAP — income re-attestation on file", when: "submit\ntoday" },
      { s: "wait", t: "Confirm PA active", d: "Payer BIN/PCN verification", when: "~+5d" },
      { s: "wait", t: "Refill ships", d: "$0 copay restored", when: "~+18d" },
    ],
    labs: [
      { k: "HIV Ag/Ab", v: "Neg", s: "20 May · 68d ago", sev: "ok" },
      { k: "Creatinine", v: "1.1 mg/dL", s: "CrCl 82 · monitor", sev: "warn" },
      { k: "STI panel", v: "Neg", s: "20 May", sev: "ok" },
      { k: "HBV sAg", v: "Neg", s: "baseline", sev: "ok" },
    ],
    rx: { drug: "Emtricitabine/Tenofovir AF", refills: "3 of 6 left", exp: "expires 12 Nov 26" },
    feed: [
      { sev: "warn", t: "<b>Assistance expiring</b> in 15 days", m: "today · benefits sync" },
      { sev: "ok", t: "Refill #3 shipped", m: "09 Jul" },
    ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Sam T.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Sam, your $0 copay program is up for renewal — reply YES and I'll handle it.", time: "Yst 15:10" },
        { role: "patient", from: "Sam T.", t: "YES, thanks Rae", time: "Yst 15:22" },
      ] },
      { id: "team", kind: "team", label: "Care team", with: "Costco Rx · Dr. Osei", msgs: [
        { role: "pharmacist", from: "Costco Rx", t: "Heads up — current PA expires in 15 days.", time: "Yst 14:30" },
      ] },
    ],
    notes: [
      { type: "Call", author: "Rae Navarro", t: "Left VM re: renal recheck (CrCl 82, monitor). Copay re-enrollment submitted.", time: "Yst 15:25" },
    ],
  },
  {
    id: "jordan", name: "Jordan P.", age: 23, mrn: "PN-40771", supply: 9, mpr: 0.88,
    sev: "warn", type: "refill", action: "Approve refill", actWithin: 1, provider: "Dr. Rao", pharmacy: "Mail order",
    headline: "Refill ready for approval — approve to ship before supply runs out",
    why: "Awaiting your approval · supply ends 9d · adherence trending down (0.88)",
    lead: "ships same day", leadsev: "ok",
    track: [ { label: "Approve", dd: "now", pos: 20, sev: "warn" }, { label: "Supply end", dd: "day 9", pos: 66, sev: "warn" } ],
    fill: 74, gapAt: 83,
    steps: [
      { s: "done", t: "Refill request received", d: "Mail-order pharmacy · 30-day, labs current", when: "21 Jul" },
      { s: "active", t: "Approve refill", d: "Ships same day once you approve — arrives in ~2 days", when: "approve\nnow" },
      { s: "wait", t: "Quarterly labs", d: "HIV + renal due next cycle", when: "~15 Aug" },
    ],
    labs: [
      { k: "HIV Ag/Ab", v: "Neg", s: "01 Jun · 56d ago", sev: "ok" },
      { k: "Creatinine", v: "0.9 mg/dL", s: "CrCl 110", sev: "ok" },
      { k: "STI panel", v: "Neg", s: "01 Jun", sev: "ok" },
      { k: "Adherence", v: "MPR 0.88", s: "↓ from 0.95", sev: "warn" },
    ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "4 of 6 left", exp: "expires 20 Feb 27" },
    feed: [
      { sev: "warn", t: "<b>Refill awaiting approval</b> — ready to ship", m: "today · pharmacy sync" },
      { sev: "info", t: "Adherence dip flagged by rules engine", m: "2 days ago" },
    ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Jordan P.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Hi Jordan — approving your refill now, it ships today and should arrive in ~2 days 📦 All good?", time: "Today 08:15" },
        { role: "patient", from: "Jordan P.", t: "awesome, thank you!", time: "Today 08:44", unread: true },
      ] },
      { id: "team", kind: "team", label: "Care team", with: "Mail-order pharmacy", msgs: [
        { role: "pharmacist", from: "Mail-order Rx", t: "Refill is queued and ready to ship — awaiting navigator approval.", time: "Today 07:50", unread: true },
      ] },
    ],
    notes: [
      { type: "Note", author: "Rae Navarro", t: "Adherence dipped 0.95 → 0.88. Switching to 90-day mail-order to cut pickup friction.", time: "Today 08:46" },
    ],
  },
  {
    id: "aisha", name: "Aisha K.", age: 35, mrn: "PN-39510", supply: 26, mpr: 0.99,
    sev: "warn", type: "lab", action: "Schedule labs", actWithin: 6, provider: "Dr. Lin", pharmacy: "Mail order",
    headline: "Quarterly labs due in 20 days — schedule now to stay ahead",
    why: "On track · pre-scheduling labs keeps the next refill unblocked",
    lead: "schedule ahead", leadsev: "ok",
    track: [ { label: "Labs", dd: "day 20", pos: 52, sev: "ok" }, { label: "Refill", dd: "day 26", pos: 74, sev: "ok" } ],
    fill: 56, gapAt: 82,
    steps: [
      { s: "done", t: "Refill #4 dispensed", d: "90-day supply", when: "01 Jul" },
      { s: "active", t: "Schedule quarterly labs", d: "HIV + renal + STI · mobile phlebotomy option", when: "~16 Aug" },
      { s: "wait", t: "Refill authorization", d: "unblocks on lab result", when: "~22 Aug" },
    ],
    labs: [
      { k: "HIV Ag/Ab", v: "Neg", s: "18 May", sev: "ok" },
      { k: "Creatinine", v: "0.7 mg/dL", s: "CrCl 121", sev: "ok" },
      { k: "STI panel", v: "Neg", s: "18 May", sev: "ok" },
      { k: "Adherence", v: "MPR 0.99", s: "excellent", sev: "ok" },
    ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "3 of 6 left", exp: "expires 10 Mar 27" },
    feed: [
      { sev: "ok", t: "90-day refill shipped", m: "01 Jul" },
      { sev: "info", t: "Labs pre-scheduling window opened", m: "today" },
    ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Aisha K.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Hi Aisha — time to book your quarterly labs. Mobile phlebotomy can come to you; pick a morning?", time: "Today 11:00" },
        { role: "patient", from: "Aisha K.", t: "Tuesday AM would be perfect", time: "Today 11:12", unread: true },
      ] },
      { id: "team", kind: "team", label: "Care team", with: "Dr. Lin", msgs: [
        { role: "provider", from: "Dr. Lin", t: "All stable — fine to keep the 90-day cadence.", time: "Mon 16:20" },
      ] },
    ],
    notes: [
      { type: "Note", author: "Rae Navarro", t: "Model adherence (MPR 0.99). Pre-scheduling labs to stay ahead of the refill.", time: "Today 11:05" },
    ],
  },

  { id: "terrell", name: "Terrell J.", age: 29, mrn: "PN-41190", supply: 6, mpr: 0.79, sev: "crit", type: "outreach", action: "Home visit", actWithin: 0, assignee: "Field Outreach", provider: "Dr. Osei", pharmacy: "Mail order",
    headline: "Unreachable 8 days — field visit to re-engage before supply lapses", why: "3 calls + 2 texts + 1 email, no reply · supply ends 6d · MPR 0.79",
    lead: "dispatch today", leadsev: "crit",
    track: [ { label: "Field visit", dd: "now", pos: 14, sev: "crit" }, { label: "Supply end", dd: "day 6", pos: 60, sev: "crit" } ], fill: 80, gapAt: 70,
    steps: [ { s: "done", t: "Remote outreach exhausted", d: "3 calls · 2 SMS · 1 email over 8 days — no response", when: "18–26 Jul" },
      { s: "active", t: "Field outreach home visit", d: "Assigned to community outreach team — last address on file", when: "dispatch\ntoday" },
      { s: "wait", t: "Approve refill", d: "Ships once re-engaged and HIV result is current", when: "on\ncontact" } ],
    labs: [ { k: "HIV Ag/Ab", v: "Neg", s: "12 May · 76d ago", sev: "warn" }, { k: "Creatinine", v: "1.0 mg/dL", s: "CrCl 96", sev: "ok" }, { k: "Adherence", v: "MPR 0.79", s: "↓ falling", sev: "crit" } ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "1 of 6 left", exp: "expires 15 Sep 26" },
    feed: [ { sev: "crit", t: "<b>Unreachable</b> — 8 days, all remote channels tried", m: "today · rules engine" }, { sev: "warn", t: "Escalated to field outreach", m: "today · Rae Navarro" } ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Terrell J.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Hi Terrell, checking in on your PrEP — please call me back, I want to make sure you don't run out.", time: "Thu 14:02" },
        { role: "nav", from: "Rae Navarro", t: "Following up — I can send a home test kit or have someone stop by. Reply anytime.", time: "Mon 09:10" } ] },
      { id: "team", kind: "team", label: "Care team", with: "Field outreach · Dr. Osei", msgs: [
        { role: "nav", from: "Rae Navarro", t: "@Field can you attempt a home visit? 8 days unreachable, supply ends in 6.", time: "today 08:30", unread: true } ] } ],
    notes: [ { type: "Call", author: "Rae Navarro", t: "3rd call attempt, voicemail full. Escalating to field outreach for in-person.", time: "today 08:25" } ] },

  { id: "priya", name: "Priya N.", age: 24, mrn: "PN-41205", supply: 2, mpr: 1.00, sev: "warn", type: "refill", action: "Approve first fill", actWithin: 1, provider: "Dr. Lin", pharmacy: "Mail order",
    headline: "New start — approve first fill to begin protection", why: "Baseline labs complete · eligible · first fill ready to ship",
    lead: "ships same day", leadsev: "ok",
    track: [ { label: "First fill", dd: "now", pos: 16, sev: "warn" } ], fill: 12, gapAt: 80,
    steps: [ { s: "done", t: "Intake & eligibility", d: "Risk assessment complete", when: "24 Jul" },
      { s: "done", t: "Baseline labs", d: "HIV neg · renal normal · HBV neg", when: "25 Jul" },
      { s: "active", t: "Approve first fill", d: "90-day supply ready — ships on approval", when: "approve\nnow" } ],
    labs: [ { k: "HIV Ag/Ab", v: "Neg", s: "25 Jul · baseline", sev: "ok" }, { k: "Creatinine", v: "0.8 mg/dL", s: "CrCl 120", sev: "ok" }, { k: "HBV sAg", v: "Neg", s: "25 Jul", sev: "ok" } ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "new Rx", exp: "expires 25 Jul 27" },
    feed: [ { sev: "ok", t: "Baseline labs resulted — eligible", m: "25 Jul" }, { sev: "info", t: "First fill queued", m: "today" } ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Priya N.", msgs: [
        { role: "patient", from: "Priya N.", t: "Excited to start! When does it arrive?", time: "Today 09:40", unread: true },
        { role: "nav", from: "Rae Navarro", t: "Approving now — ships today, arrives in ~2 days 🎉", time: "Today 09:45" } ] },
      { id: "team", kind: "team", label: "Care team", with: "Dr. Lin", msgs: [
        { role: "provider", from: "Dr. Lin", t: "Cleared to start — first fill approved on my end.", time: "Today 08:00" } ] } ],
    notes: [ { type: "Note", author: "Rae Navarro", t: "New start, highly motivated. Set 90-day cadence.", time: "Today 09:46" } ] },

  { id: "devon", name: "Devon R.", age: 38, mrn: "PN-38900", supply: 68, mpr: 0.99, sev: "ok", type: "refill", action: "On track — refill auto-ships", actWithin: 40, provider: "Dr. Rao", pharmacy: "Mail order",
    headline: "Continuous — next refill auto-ships, labs current", why: "90-day supply · MPR 0.99 · quarterly labs done",
    lead: "none", leadsev: "ok",
    track: [ { label: "Labs", dd: "day 40", pos: 60, sev: "ok" }, { label: "Refill", dd: "day 68", pos: 84, sev: "ok" } ], fill: 24, gapAt: 92,
    steps: [ { s: "done", t: "90-day refill shipped", d: "Mail-order", when: "10 Jul" },
      { s: "wait", t: "Quarterly labs", d: "HIV + renal", when: "~5 Sep" }, { s: "wait", t: "Next refill", d: "auto-ships on labs", when: "~9 Oct" } ],
    labs: [ { k: "HIV Ag/Ab", v: "Neg", s: "08 Jul", sev: "ok" }, { k: "Creatinine", v: "0.9 mg/dL", s: "CrCl 108", sev: "ok" }, { k: "Adherence", v: "MPR 0.99", s: "excellent", sev: "ok" } ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "3 of 6 left", exp: "expires 18 Apr 27" },
    feed: [ { sev: "ok", t: "90-day refill shipped", m: "10 Jul" } ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Devon R.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "All set for the quarter, Devon — labs due early Sep, I'll book mobile phlebotomy closer to then.", time: "10 Jul" } ] },
      { id: "team", kind: "team", label: "Care team", with: "Dr. Rao", msgs: [
        { role: "provider", from: "Dr. Rao", t: "No changes — stable.", time: "09 Jul" } ] } ],
    notes: [ { type: "Note", author: "Rae Navarro", t: "Model continuity. No action until labs window.", time: "10 Jul" } ] },

  { id: "kwame", name: "Kwame B.", age: 33, mrn: "PN-40560", supply: 0, mpr: 0.61, sev: "crit", type: "outreach", action: "Re-engage (home visit)", actWithin: 0, assignee: "Field Outreach", provider: "Dr. Lin", pharmacy: "Mail order",
    headline: "Lapsed — 0 days supply, lost to follow-up; field re-engagement", why: "Coverage gap now · unreachable 3 weeks · MPR 0.61",
    lead: "dispatch now", leadsev: "crit",
    track: [ { label: "Field visit", dd: "now", pos: 10, sev: "crit" } ], fill: 96, gapAt: 18,
    steps: [ { s: "done", t: "Remote outreach exhausted", d: "5 attempts over 3 weeks", when: "Jul" },
      { s: "active", t: "Field re-engagement visit", d: "Community outreach — confirm status & restart", when: "dispatch\nnow" },
      { s: "wait", t: "Re-test + restart", d: "HIV test before any restart", when: "on\ncontact" } ],
    labs: [ { k: "HIV Ag/Ab", v: "Neg", s: "02 Apr · 116d ago", sev: "crit" }, { k: "Adherence", v: "MPR 0.61", s: "lapsed", sev: "crit" } ],
    rx: { drug: "Emtricitabine/Tenofovir DF", refills: "0 of 6 left", exp: "expired 01 Jul 26" },
    feed: [ { sev: "crit", t: "<b>Coverage gap</b> — 0 days supply", m: "today" }, { sev: "warn", t: "Escalated to field outreach", m: "3 days ago" } ],
    threads: [
      { id: "sms", kind: "patient", label: "Patient", with: "Kwame B.", msgs: [
        { role: "nav", from: "Rae Navarro", t: "Kwame, we've missed you — your PrEP lapsed. No judgment, let's get you covered again. Call anytime.", time: "last wk" } ] },
      { id: "team", kind: "team", label: "Care team", with: "Field outreach", msgs: [
        { role: "nav", from: "Rae Navarro", t: "@Field please attempt in-person — lapsed 3 wks, unreachable.", time: "3 days ago", unread: true } ] } ],
    notes: [ { type: "Call", author: "Rae Navarro", t: "5th attempt failed. Field outreach assigned for door knock.", time: "3 days ago" } ] },
];

// A worklist task is derived from each patient's current lifecycle blocker.
export function deriveTasks(patients) {
  return patients.map((p) => ({
    id: "t-" + p.id, patientId: p.id, type: p.type, title: p.headline, why: p.why,
    sev: p.sev, supply: p.supply, lead: p.lead, leadsev: p.leadsev, status: "open", source: "lifecycle",
    assignee: p.assignee || "Navigator",
  }));
}
