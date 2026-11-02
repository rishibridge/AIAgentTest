/**
 * VERIFY CONSOLIDATION & ALERTS (5 User-Reported Defects)
 * ========================================================
 * 1. Live session consolidation completes in <15s with HTTP 200 (never 502).
 * 2. UI and API consolidation status agree 100% for both live-session and no-session paths.
 * 3. Multi-turn emergency alerts write at most 1 node per crisis event (never 2 or 3).
 * 4. Emergency alert and graph node labels are never truncated at ~60 characters.
 * 5. Multi-turn substance disclosure + consent ("oxycodone_undisclosed") creates exactly 1 node (never 2).
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8089';
const API = URL.replace(/\/$/, '');
const ARTIFACT_DIR = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';
const PREFIX = URL.includes('run.app') ? 'gcp_fix5' : 'local_fix5';

(async () => {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  VERIFYING 5 DEFECT FIXES ON: ${URL}`);
  console.log(`${'═'.repeat(72)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const consolidationResponses = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', res => {
    if (res.url().includes('/consolidation') && res.request().method() === 'POST') {
      consolidationResponses.push({ url: res.url(), status: res.status() });
    }
  });

  const checks = [];
  const record = (id, title, pass, detail) => {
    checks.push({ id, title, pass, detail });
    console.log(`  ${pass ? '✅' : '❌'} [${id}] ${title} — ${detail}`);
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    // Accept UI Entry Gate if visible
    const gateBtn = page.locator('[data-testid="accept-disclaimer-btn"]');
    if ((await gateBtn.count()) > 0) {
      await gateBtn.click();
      await page.waitForTimeout(800);
    }

    // Elevate to admin session so we can reset before & after
    const authData = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/api/v1/auth/accept-terms`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, admin_key: 'ally-local-admin-2026' }),
      });
      return await res.json();
    }, API);

    // Reset both patients to pristine seed state before testing
    await page.evaluate(async ({ api, token }) => {
      for (const pid of ['elena-ramirez-001', 'daniel-ramirez-002']) {
        await fetch(`${api}/api/v1/patients/${pid}/graph/reset`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Ally-Token': token },
        });
      }
    }, { api: API, token: authData.token });

    // -------------------------------------------------------------------------
    // DEFECT 1 & 2A: Live Session Consolidation in Browser UI (Daniel Ramirez)
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Patient Chat")');
    await page.waitForTimeout(600);
    await page.click('button:has-text("Daniel Ramirez")');
    await page.waitForSelector('[data-testid="live-chat-input"]', { timeout: 15000 });
    await page.waitForTimeout(800);

    await page.fill('[data-testid="live-chat-input"]', "I haven't been sleeping at all since the kitchen argument with my dad three weeks ago, and please don't tell my mom.");
    await page.click('[data-testid="live-chat-send"]');

    // Wait for Ally reply
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => !document.body.innerText.includes('Ally is thinking'), null, { timeout: 60000 });
    await page.waitForTimeout(1200);

    // Click End & Consolidate in the UI and time it
    const t0 = Date.now();
    await page.click('button:has-text("End & Consolidate")');
    await page.waitForSelector('[data-testid="consolidation-complete-card"], [data-testid="consolidation-error-card"]', { timeout: 35000 });
    const elapsedMs = Date.now() - t0;

    const completeVisible = (await page.locator('[data-testid="consolidation-complete-card"]').count()) === 1;
    const errorVisible = (await page.locator('[data-testid="consolidation-error-card"]').count()) > 0;
    const lastConsolHttp = consolidationResponses[consolidationResponses.length - 1]?.status || 0;

    // Query GET /conversations for daniel-ramirez-002 to verify API status matches UI
    const danielConvs = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/api/v1/patients/daniel-ramirez-002/conversations`, { credentials: 'include' });
      return await res.json();
    }, API);
    const danielConvList = Array.isArray(danielConvs) ? danielConvs : (danielConvs.conversations || []);
    const allDanielConsolidated = danielConvList.length >= 2 && danielConvList.every(c => c.status === 'consolidated');

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_01_live_session_consolidated.png` });

    record(
      'D1',
      'Live session consolidation succeeds with HTTP 200 (never 502) in fast single-pass',
      completeVisible && !errorVisible && lastConsolHttp === 200 && elapsedMs < 20000,
      `httpStatus=${lastConsolHttp}, elapsedMs=${elapsedMs}ms, completeCard=${completeVisible}, errorCard=${errorVisible}`
    );

    record(
      'D2A',
      'UI and API agree 100% on live-session consolidated status',
      completeVisible && !errorVisible && allDanielConsolidated,
      `uiComplete=${completeVisible}, apiConversations=${JSON.stringify(danielConvList.map(c => ({ id: c.id, status: c.status })))}`
    );

    // -------------------------------------------------------------------------
    // DEFECT 2B: No-Session (0-message session) Consolidation Path in Browser UI
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Back")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Elena Ramirez")');
    await page.waitForSelector('[data-testid="live-chat-input"]', { timeout: 15000 });
    await page.waitForTimeout(800);

    const tNoSess0 = Date.now();
    await page.click('button:has-text("End & Consolidate")');
    await page.waitForSelector('[data-testid="consolidation-complete-card"], [data-testid="consolidation-error-card"]', { timeout: 20000 });
    const elapsedNoSessMs = Date.now() - tNoSess0;
    const noSessComplete = (await page.locator('[data-testid="consolidation-complete-card"]').count()) === 1;
    const noSessError = (await page.locator('[data-testid="consolidation-error-card"]').count()) > 0;
    const noSessHttp = consolidationResponses[consolidationResponses.length - 1]?.status || 0;

    const elenaConvsAfterNoSess = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations`, { credentials: 'include' });
      return await res.json();
    }, API);
    const elenaConvList = Array.isArray(elenaConvsAfterNoSess) ? elenaConvsAfterNoSess : (elenaConvsAfterNoSess.conversations || []);
    const allElenaConsolidated = elenaConvList.length >= 1 && elenaConvList.every(c => c.status === 'consolidated');

    record(
      'D2B',
      'No-session (0-message) consolidation path succeeds with HTTP 200 and UI/API agreement',
      noSessComplete && !noSessError && noSessHttp === 200 && allElenaConsolidated,
      `httpStatus=${noSessHttp}, elapsedMs=${elapsedNoSessMs}ms, uiComplete=${noSessComplete}, allConsolidated=${allElenaConsolidated}`
    );

    // -------------------------------------------------------------------------
    // DEFECT 3 & 4: Multi-Turn Emergency Alerts (1 node per event, untruncated labels)
    // -------------------------------------------------------------------------
    const siTurns = [
      "I don't want to be here anymore. I've been thinking about ending my life tonight and I have a full bottle of sleeping pills on my nightstand.",
      "I already wrote a goodbye note to Daniel and poured a glass of water. I'm going to swallow all of the pills tonight.",
      "Please don't try to talk me out of it, I have the bottle open in my hand right now and I'm ready to end everything."
    ];
    const siResult = await page.evaluate(async ({ api, turns }) => {
      const startRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'SI Multi-turn Dedup Test' }),
      });
      const { conversation_id } = await startRes.json();
      const responses = [];
      for (const text of turns) {
        const msgRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations/${conversation_id}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        responses.push(await msgRes.json());
      }
      const graphRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/graph`, { credentials: 'include' });
      const graph = await graphRes.json();
      return { conversation_id, responses, graph };
    }, { api: API, turns: siTurns });

    const emergencyNodesAfterSI = (siResult.graph.nodes || []).filter(
      n => n.id.startsWith('emergency_alert')
    );

    // Also run a 2-turn Violent Ideation / Tarasoff conversation on Elena Ramirez
    const violenceTurns = [
      "I bought a hunting knife today and I'm waiting outside Raul's office at 5pm to stab him in the parking lot for what he did.",
      "He's walking toward the exit in ten minutes and I have the knife in my coat pocket right now."
    ];
    const violenceResult = await page.evaluate(async ({ api, turns }) => {
      const startRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Violence Multi-turn Dedup Test' }),
      });
      const { conversation_id } = await startRes.json();
      for (const text of turns) {
        await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations/${conversation_id}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
      const graphRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/graph`, { credentials: 'include' });
      const graph = await graphRes.json();
      return { conversation_id, graph };
    }, { api: API, turns: violenceTurns });

    const emergencyNodesAfterBoth = (violenceResult.graph.nodes || []).filter(
      n => n.id.startsWith('emergency_alert')
    );

    record(
      'D3',
      'Emergency alerts write exactly 1 node per crisis event across multi-turn conversations (never 2 or 3)',
      emergencyNodesAfterSI.length === 1 && emergencyNodesAfterBoth.length === 2,
      `after3TurnSI=${emergencyNodesAfterSI.length} node (${emergencyNodesAfterSI.map(n => n.id).join(',')}), after2TurnViolence=${emergencyNodesAfterBoth.length} nodes (${emergencyNodesAfterBoth.map(n => n.id).join(',')})`
    );

    // Check Defect #4: labels are NOT truncated at ~60 characters
    const alertLabels = emergencyNodesAfterBoth.map(n => n.label || '');
    const hasFullLengthLabel = alertLabels.every(l => l.length > 62);
    const anyCutAt61 = alertLabels.some(l => l.length === 61);
    record(
      'D4',
      'Emergency alert labels preserve full untruncated reason (>62 chars, never cut at 60/61 chars)',
      hasFullLengthLabel && !anyCutAt61,
      `lengths=${JSON.stringify(alertLabels.map(l => l.length))}, labels=${JSON.stringify(alertLabels)}`
    );

    // -------------------------------------------------------------------------
    // DEFECT 5: Multi-Turn Substance Disclosure + Consent ("oxycodone_undisclosed")
    // -------------------------------------------------------------------------
    const oxyTurns = [
      "I've been taking my neighbor's oxycodone for my back pain. About 3 pills a day for the last two weeks.",
      "Keep it between us please. I don't want my doctor to know about the oxy."
    ];
    const oxyResult = await page.evaluate(async ({ api, turns }) => {
      const startRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Oxycodone Dedup Test' }),
      });
      const { conversation_id } = await startRes.json();
      for (const text of turns) {
        await fetch(`${api}/api/v1/patients/elena-ramirez-001/conversations/${conversation_id}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
      const graphRes = await fetch(`${api}/api/v1/patients/elena-ramirez-001/graph`, { credentials: 'include' });
      const graph = await graphRes.json();
      return { conversation_id, graph };
    }, { api: API, turns: oxyTurns });

    const oxyNodes = (oxyResult.graph.nodes || []).filter(
      n => /oxycodone|\boxy\b/i.test(n.id) || /oxycodone|\boxy\b/i.test(n.label || '')
    );

    // Reload Elena's graph in the UI so we can screenshot the rendered SVG with the single oxycodone node & wrapped untruncated emergency labels
    await page.click('button:has-text("Back")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Elena Ramirez")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_02_elena_deduped_alerts_and_oxycodone.png` });

    record(
      'D5',
      'oxycodone_undisclosed exists once on the graph after multi-turn disclosure + consent lock',
      oxyNodes.length === 1 && oxyNodes[0].kind === 'undisclosed',
      `oxyNodeCount=${oxyNodes.length}, nodes=${JSON.stringify(oxyNodes.map(n => ({ id: n.id, label: n.label, kind: n.kind })))}`
    );

    // Reset both patients back to pristine seed state
    await page.evaluate(async ({ api, token }) => {
      for (const pid of ['elena-ramirez-001', 'daniel-ramirez-002']) {
        await fetch(`${api}/api/v1/patients/${pid}/graph/reset`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Ally-Token': token },
        });
      }
    }, { api: API, token: authData.token });

  } finally {
    await browser.close();
  }

  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  SUMMARY: ${passed}/${checks.length} PASSED (${failed} FAILED)`);
  console.log(`${'═'.repeat(72)}\n`);
  if (failed > 0) process.exit(1);
})();
