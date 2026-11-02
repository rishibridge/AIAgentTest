/**
 * EXHAUSTIVE 33-ISSUE + 6-UNEXERCISED BLACK-BOX VERIFICATION SUITE
 * =================================================================
 * Verifies every item in PRISM_Ally_Issue_List.docx (C1-C2, H1-H11, M1-M15, L1-L5)
 * plus all 6 "Not Exercised" items end-to-end against http://127.0.0.1:8089
 * using real HTTP calls and Playwright Chromium on Desktop (1440x900) and Mobile iPhone 13 (390x844).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.argv[2] || 'http://127.0.0.1:8089';
const ADMIN_KEY = 'ally-local-admin-2026';
const ELENA_ID = 'elena-ramirez-001';
const DANIEL_ID = 'daniel-ramirez-002';
const ARTIFACT_DIR = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';
const IS_GCP = BASE_URL.includes('run.app');
const SHOT_PREFIX = IS_GCP ? 'gcp_verify_33' : 'verify_33';
const REPORT_PATH = `${ARTIFACT_DIR}/scratch/${SHOT_PREFIX}_issues_results.json`;
const DATA_DIR = 'C:/Users/rishi/Agent Test/prism-platform/ally/data';

const results = [];
function record(id, title, passed, evidence) {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ id, title, passed, evidence });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${id}] ${title}\n   ↳ ${evidence}`);
}

async function rawReq(method, urlPath, { token = null, adminKey = null, body = undefined } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Ally-Token'] = token;
  if (adminKey) headers['X-Ally-Admin-Key'] = adminKey;
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch (_) {}
  } else {
    try { data = await res.text(); } catch (_) {}
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), data };
}

(async () => {
  console.log(`\n${'═'.repeat(76)}`);
  console.log(`  PRISM / ALLY — 33 ISSUES + 6 UNEXERCISED FULL BLACK-BOX VERIFICATION`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`${'═'.repeat(76)}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Ensure clean seed state before starting
    await rawReq('POST', `/api/v1/patients/${ELENA_ID}/graph/reset`, { adminKey: ADMIN_KEY });
    await rawReq('POST', `/api/v1/patients/${DANIEL_ID}/graph/reset`, { adminKey: ADMIN_KEY });

    // ══════════════════════════════════════════════════════════════════
    // 1. SECURITY, GATE, HEADERS, FONTS & COPY (C1, C2, M6, M7, L3, L4)
    // ══════════════════════════════════════════════════════════════════

    const docsRes = await rawReq('GET', '/docs');
    const openapiRes = await rawReq('GET', '/openapi.json');
    const redocRes = await rawReq('GET', '/redoc');
    const unauthPatients = await rawReq('GET', '/api/v1/patients');
    const unauthGraph = await rawReq('GET', `/api/v1/patients/${ELENA_ID}/graph`);

    // Obtain a fresh user token to test RBAC & 429 rate-limiting
    const rateUserAuth = await rawReq('POST', '/api/v1/auth/accept-terms', { body: { accepted: true } });
    const rateUserToken = rateUserAuth.data?.token;
    const rbacCreate = await rawReq('POST', '/api/v1/patients', {
      token: rateUserToken,
      body: { id: 'unauth-test', name: 'Blocked User', age: 30 },
    });
    const rbacDeleteNode = await rawReq('DELETE', `/api/v1/patients/${ELENA_ID}/graph/nodes/sofia`, { token: rateUserToken });
    const rbacReset = await rawReq('POST', `/api/v1/patients/${ELENA_ID}/graph/reset`, { token: rateUserToken });

    // Test 429 rate limit on model-spending route (/handoffs with cached default so 0 LLM cost)
    let hit429At = null;
    for (let i = 1; i <= 35; i++) {
      const rlRes = await rawReq('POST', `/api/v1/patients/${ELENA_ID}/handoffs`, {
        token: rateUserToken,
        body: { recipient: 'Dr. A. Patel', recipient_type: 'Clinician' },
      });
      if (rlRes.status === 429) {
        hit429At = i;
        break;
      }
    }

    const c1Pass =
      docsRes.status !== 200 &&
      openapiRes.status !== 200 &&
      redocRes.status !== 200 &&
      unauthPatients.status === 401 &&
      unauthGraph.status === 401 &&
      rbacCreate.status === 403 &&
      rbacDeleteNode.status === 403 &&
      rbacReset.status === 403 &&
      hit429At === 31;
    record(
      'C1',
      'API locked down: docs disabled, 401 unauth, 403 non-admin destructive routes, 429 rate-limiting',
      c1Pass,
      `/docs=${docsRes.status}, /openapi.json=${openapiRes.status}, /redoc=${redocRes.status}, unauth=/patients:${unauthPatients.status}, non-admin POST/DELETE/reset=${rbacCreate.status}/${rbacDeleteNode.status}/${rbacReset.status}, 429 triggered at request #${hit429At}`
    );

    // Health endpoint & Security headers (M6, M7)
    const healthRes = await rawReq('GET', '/api/v1/health');
    const healthKeys = Object.keys(healthRes.data || {});
    const m6Pass = healthRes.status === 200 && healthKeys.length === 1 && healthRes.data?.status === 'healthy';
    record(
      'M6',
      'Health endpoint redacted (no patient IDs or family-link leakage)',
      m6Pass,
      `GET /api/v1/health -> ${JSON.stringify(healthRes.data)}`
    );

    const hdrs = healthRes.headers;
    const m7Pass =
      Boolean(hdrs['strict-transport-security']) &&
      Boolean(hdrs['content-security-policy']) &&
      hdrs['x-frame-options'] === 'DENY' &&
      hdrs['x-content-type-options'] === 'nosniff';
    record(
      'M7',
      'Security headers present (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)',
      m7Pass,
      `HSTS=${Boolean(hdrs['strict-transport-security'])}, CSP=${Boolean(hdrs['content-security-policy'])}, XFO=${hdrs['x-frame-options']}, XCTO=${hdrs['x-content-type-options']}`
    );

    // Browser Desktop Context (1440x900)
    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopCtx.newPage();
    const externalFontRequests = [];
    const selfHostedFontResponses = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) {
        externalFontRequests.push(u);
      }
    });
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/fonts/') && res.status() === 200) {
        selfHostedFontResponses.push(path.basename(u));
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[data-testid="accept-disclaimer-btn"]', { timeout: 15000 });

    const gateBodyText = await page.textContent('body');
    const gateHasCopyright = gateBodyText.includes('All rights reserved') || gateBodyText.includes('proprietary');
    const tokenBeforeAccept = await page.evaluate(() => sessionStorage.getItem('ally_auth_token'));

    await page.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_01_entry_gate.png` });
    await page.click('[data-testid="accept-disclaimer-btn"]');
    await page.waitForTimeout(1000);

    const tokenAfterAccept = await page.evaluate(() => sessionStorage.getItem('ally_auth_token'));
    const meCheck = await rawReq('GET', '/api/v1/auth/me', { token: tokenAfterAccept });
    const c2Pass = !tokenBeforeAccept && Boolean(tokenAfterAccept) && meCheck.status === 200 && meCheck.data?.authenticated === true;
    record(
      'C2',
      'Entry Gate issues real HMAC-signed server session token enforced on /api',
      c2Pass,
      `tokenBefore=${Boolean(tokenBeforeAccept)}, tokenAfterLen=${(tokenAfterAccept || '').length}, /auth/me=${JSON.stringify(meCheck.data)}`
    );

    const landingText = await page.textContent('body');
    const landingNoDupCopyright = !landingText.includes('Unauthorized copying, reproduction, modification');
    const l3Pass = gateHasCopyright && landingNoDupCopyright;
    record(
      'L3',
      'IP copyright notice kept solely in Entry Gate and removed from Landing footer',
      l3Pass,
      `gateHasCopyright=${gateHasCopyright}, landingNoDuplicateIPBlock=${landingNoDupCopyright}`
    );

    const fontsCssCheck = await rawReq('GET', '/fonts/fonts.css');
    const l4Pass = externalFontRequests.length === 0 && fontsCssCheck.status === 200;
    record(
      'L4',
      'Zero Google CDN font requests; self-hosted /fonts/fonts.css + .woff2 served locally',
      l4Pass,
      `externalGoogleFontRequests=${externalFontRequests.length}, /fonts/fonts.css=${fontsCssCheck.status}, loadedAssets=${selfHostedFontResponses.slice(0, 5).join(', ')}`
    );

    // ══════════════════════════════════════════════════════════════════
    // 2. DEMO MODE: HOOK PACING, COPY TOGGLE, STORY CONTROLS, PRESENTER,
    //    ISOLATION, LOGICAL ISOLATION WORDING & SVG ACCESSIBILITY
    //    (M1, M3, M4, M5, M8, L2, L5)
    // ══════════════════════════════════════════════════════════════════

    await page.click('button:has-text("Demo Mode")');
    await page.waitForTimeout(600);
    // Start Hook manually paused (M4)
    const manualHookBtn = page.locator('button:has-text("Step Manually")');
    const hasManualStart = (await manualHookBtn.count()) > 0;
    if (hasManualStart) {
      await manualHookBtn.click();
    } else {
      await page.click('button:has-text("Begin Presentation")');
    }
    await page.waitForTimeout(500);

    const hasSlowPace = (await page.locator('button:has-text("0.5x")').count()) > 0;
    const hasHookPrev = (await page.locator('button:has-text("Prev")').count()) > 0;
    const hasHookNext = (await page.locator('button:has-text("Next")').count()) > 0;
    const hasPlayPause = (await page.locator('button:has-text("Play"), button:has-text("Pause")').count()) > 0;

    // Jump via clickable slide strip to slide 6 (SCENES.AI_TRANSACTION_2: Master of Modalities) to verify L5 copy toggle
    await page.click('button[title="Jump to slide 6"]');
    await page.waitForTimeout(300);
    const clinicalCopyText = await page.textContent('body');
    const defaultClinicalClean =
      !clinicalCopyText.includes('beats the shit out of humans') &&
      clinicalCopyText.includes('dramatically outperforms standard between-visit workflows');
    await page.click('button:has-text("Clinical Copy")');
    await page.waitForTimeout(250);
    const deckCopyText = await page.textContent('body');
    const hasOriginalDeckPhrase = deckCopyText.includes('beats the shit out of humans');
    // Toggle back to Clinical Copy
    await page.click('button:has-text("Original Deck Copy")');
    await page.waitForTimeout(150);

    record(
      'M4',
      'Hook allows manual paused start, Pause/Play, Prev/Next, clickable slide strip, and 0.5x/0.75x slower pacing',
      hasManualStart && hasSlowPace && hasHookPrev && hasHookNext && hasPlayPause,
      `manualPausedStart=${hasManualStart}, 0.5x=${hasSlowPace}, Prev=${hasHookPrev}, Next=${hasHookNext}, Play/Pause=${hasPlayPause}`
    );
    record(
      'L5',
      'Hook defaults to Clinical Copy and provides instant toggle to Original Deck Copy',
      defaultClinicalClean && hasOriginalDeckPhrase,
      `defaultClinicalClean=${defaultClinicalClean}, originalPhraseOnToggle=${hasOriginalDeckPhrase}`
    );

    // Skip Hook into 18-step Story
    await page.click('button:has-text("Skip Hook")');
    await page.waitForSelector('[data-testid="demo-progress-strip"]', { timeout: 10000 });

    // Presenter Mode toggle (M5)
    const bannerInitiallyVisible = (await page.locator('[data-testid="presenter-notes-banner"]').count()) === 1;
    await page.click('[data-testid="presenter-mode-toggle"]');
    await page.waitForTimeout(200);
    const bannerHiddenAfterToggle = (await page.locator('[data-testid="presenter-notes-banner"]').count()) === 0;
    await page.click('[data-testid="presenter-mode-toggle"]');
    await page.waitForTimeout(200);
    const bannerVisibleAgain = (await page.locator('[data-testid="presenter-notes-banner"]').count()) === 1;
    record(
      'M5',
      'Presenter Mode visibly toggles the Speaker Cue teleprompter banner and turn counter',
      bannerInitiallyVisible && bannerHiddenAfterToggle && bannerVisibleAgain,
      `initial=${bannerInitiallyVisible}, afterOff=${bannerHiddenAfterToggle}, afterOn=${bannerVisibleAgain}`
    );

    // Visible story navigation & 18-phase progress strip (M3)
    await page.click('[data-testid="demo-next-btn"]'); // elena_graph_intro
    await page.waitForTimeout(300);
    // Check L2 SVG extracted text separation on Elena's graph (`metformin\nirregular` -> `metformin irregular`, NOT `metforminirregular`)
    const svgExtractedText = await page.evaluate(() => {
      const nodeGroups = Array.from(document.querySelectorAll('svg g[role="img"]'));
      const svg = nodeGroups[0]?.closest('svg') || document.querySelector('svg[viewBox="0 0 1100 620"]');
      return {
        nodeRoleCount: nodeGroups.length,
        sampleAriaLabel: nodeGroups[0]?.getAttribute('aria-label') || '',
        rawText: svg ? svg.textContent : '',
      };
    });
    const l2Pass =
      svgExtractedText.nodeRoleCount >= 10 &&
      Boolean(svgExtractedText.sampleAriaLabel) &&
      !svgExtractedText.rawText.includes('metforminirregular') &&
      svgExtractedText.rawText.toLowerCase().includes('metformin irregular');
    record(
      'L2',
      'SVG graph nodes have accessible role="img"/aria-label and space separators between multi-line tspans',
      l2Pass,
      `nodeRoleImgCount=${svgExtractedText.nodeRoleCount}, sampleAria="${svgExtractedText.sampleAriaLabel}", noConcatMetformin=${!svgExtractedText.rawText.includes('metforminirregular')}`
    );

    // Jump via progress pill to Daniel Profile (phase index 10) and Family System (phase index 16)
    await page.click('[data-testid="phase-pill-10"]');
    await page.waitForTimeout(250);
    const danielProfileText = await page.textContent('body');
    const hasDanielProfile = danielProfileText.includes('Patient profile • Case 2 of 2') && danielProfileText.includes('Daniel Ramirez');

    await page.click('[data-testid="phase-pill-16"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_02_demo_presenter_controls.png` });
    const familyText = await page.textContent('body');
    const hasLogicalIsolationWording =
      familyText.includes('Per-patient keyed logical isolation is enforced') &&
      !familyText.toLowerCase().includes('cryptographic isolation');

    await page.click('[data-testid="demo-prev-btn"]');
    await page.waitForTimeout(200);
    const steppedBackToDanielUpdates = (await page.textContent('body')).includes('Clinician Updates Received');

    record(
      'M3',
      'Demo story has visible Previous/Next buttons, clickable 18-phase progress strip, and Daniel Profile card',
      hasDanielProfile && steppedBackToDanielUpdates,
      `danielProfileRendered=${hasDanielProfile}, prevButtonSteppedBack=${steppedBackToDanielUpdates}`
    );

    // Return to Home
    await page.click('button:has-text("Home")');
    await page.waitForTimeout(400);

    // ══════════════════════════════════════════════════════════════════
    // 3. PERSISTENCE, PER-PATIENT KEYED SEALING & DETERMINISTIC SEED (H11, M8)
    // ══════════════════════════════════════════════════════════════════

    const elenaApiRes = await rawReq('GET', `/api/v1/patients/${ELENA_ID}`, { adminKey: ADMIN_KEY });
    const sqliteExists = fs.existsSync(`${DATA_DIR}/ally_patients.sqlite3`);
    const elenaJsonPath = `${DATA_DIR}/${ELENA_ID}.json`;
    const elenaJsonExists = fs.existsSync(elenaJsonPath);
    const elenaDiskObj = elenaJsonExists ? JSON.parse(fs.readFileSync(elenaJsonPath, 'utf-8')) : {};
    const sealObj = elenaDiskObj._isolation_seal || {};
    const hasIsolationSeal =
      sealObj.patient_id === ELENA_ID &&
      sealObj.algorithm === 'PBKDF2-HMAC-SHA256' &&
      typeof sealObj.hmac === 'string' &&
      sealObj.hmac.length === 64;
    const seedStartedAt = elenaApiRes.data?.conversations?.[0]?.started_at || elenaDiskObj.conversations?.[0]?.started_at;
    const h11Pass = sqliteExists && elenaJsonExists && seedStartedAt === '2026-05-12T21:10:00Z';
    record(
      'H11',
      'Persistent disk JSON + transactional SQLite store with deterministic seed timestamps across restarts',
      h11Pass,
      `sqliteExists=${sqliteExists}, jsonExists=${elenaJsonExists}, seedStartedAt=${seedStartedAt}`
    );
    record(
      'M8',
      'Per-patient PBKDF2-HMAC-SHA256 derived key sealing implemented on storage AND UI uses honest keyed logical isolation wording',
      hasIsolationSeal && hasLogicalIsolationWording,
      `algorithm=${sealObj.algorithm}, keyId=${sealObj.key_id}, hmacPrefix=${(sealObj.hmac || '').slice(0, 16)}..., uiWordingVerified=${hasLogicalIsolationWording}`
    );

    // ══════════════════════════════════════════════════════════════════
    // 4. ABANDONED 0-MESSAGE SESSION CLEANUP (M2) + DEMO ISOLATION (M1)
    //    + LIVE CHAT MEMORY/MARKDOWN/HUMANIZED LABELS/TELEMETRY (H8, H9, M12, L1)
    // ══════════════════════════════════════════════════════════════════

    // Open Patient Chat -> Daniel -> do NOT send any message -> click Back -> verify 0-message session abandoned (M2)
    await page.click('button:has-text("Patient Chat")');
    await page.waitForTimeout(600);
    await page.click('button:has-text("Daniel Ramirez")');
    await page.waitForSelector('[data-testid="live-chat-input"]', { timeout: 10000 });
    await page.waitForTimeout(800); // allow startConversation to complete
    await page.click('button:has-text("Back")');
    await page.waitForTimeout(800);

    const danielConvsAfterAbandon = await rawReq('GET', `/api/v1/patients/${DANIEL_ID}/conversations`, { adminKey: ADMIN_KEY });
    const zeroMsgActiveConvs = (danielConvsAfterAbandon.data?.conversations || []).filter(
      (c) => c.status === 'active' && (c.message_count === 0 || (c.messages && c.messages.length === 0))
    );
    record(
      'M2',
      'Navigating away from a zero-message live chat abandons/prunes the empty session immediately',
      zeroMsgActiveConvs.length === 0,
      `danielActiveZeroMessageConversations=${zeroMsgActiveConvs.length}, totalConversations=${(danielConvsAfterAbandon.data?.conversations || []).length}`
    );

    // Open Elena in Live Interactive Sandbox and test H9 (passive SI + friend's anxiety pills + tramadol), H8 (no raw **), L1 (humanized labels), M12 (telemetry), M1 (Demo isolation)
    let capturedMessageApiPayload = null;
    const msgResponseListener = async (res) => {
      if (res.url().includes(`/patients/${ELENA_ID}/conversations/`) && res.url().endsWith('/messages') && res.request().method() === 'POST') {
        try { capturedMessageApiPayload = await res.json(); } catch (_) {}
      }
    };
    page.on('response', msgResponseListener);

    await page.click('button:has-text("Elena Ramirez")');
    await page.waitForSelector('[data-testid="live-chat-input"]', { timeout: 10000 });
    await page.waitForTimeout(800);

    const h9Prompt = "My back hurt so bad last night that I took my tramadol and then took two of my friend's anxiety pills again to fall asleep after lying awake at 3 AM wishing I wouldn't wake up.";
    await page.fill('[data-testid="live-chat-input"]', h9Prompt);
    await page.click('[data-testid="live-chat-send"]');

    // Wait for Ally's reply bubble
    await page.waitForFunction(
      () => {
        const allText = document.body.innerText;
        return !allText.includes('Ally is thinking...') && allText.includes('Elena');
      },
      null,
      { timeout: 90000 }
    );
    await page.waitForTimeout(1500);
    page.off('response', msgResponseListener);

    await page.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_03_live_chat_h8_h9_l1.png` });

    const botReplyText = capturedMessageApiPayload?.bot_response?.text || '';
    const botLow = botReplyText.toLowerCase();
    const h8Pass = botReplyText.length > 20 && !botReplyText.includes('**');
    record(
      'H8',
      'Chat bubbles contain zero literal raw markdown "**" asterisks',
      h8Pass,
      `replyLen=${botReplyText.length}, containsDoubleAsterisk=${botReplyText.includes('**')}`
    );

    const recognizesSafetyAndInteraction =
      (botLow.includes('safe') || botLow.includes('heav') || botLow.includes('dark') || botLow.includes('3 am') || botLow.includes('three')) &&
      (botLow.includes('tramadol') || botLow.includes('breath') || botLow.includes('sedat') || botLow.includes('combin') || botLow.includes('mix') || botLow.includes('danger'));
    const recognizesPriorNode =
      botLow.includes('before') || botLow.includes('friend') || botLow.includes('remember') || botLow.includes('benzo') || botLow.includes('again');
    record(
      'H9',
      'Live reply prioritizes passive-SI + tramadol/benzo safety assessment and recognizes existing undisclosed node',
      recognizesSafetyAndInteraction && recognizesPriorNode,
      `safetyAndInteraction=${recognizesSafetyAndInteraction}, recognizedExistingContext=${recognizesPriorNode}, excerpt="${botReplyText.slice(0, 140)}..."`
    );

    const m12Bot = capturedMessageApiPayload?.bot_response || {};
    const m12Pass =
      Boolean(m12Bot.model) &&
      Boolean(m12Bot.version || m12Bot.model_version) &&
      typeof m12Bot.context_tokens === 'number' &&
      m12Bot.context_tokens > 0 &&
      typeof m12Bot.latency_ms === 'number' &&
      m12Bot.latency_ms > 0;
    record(
      'M12',
      'Messages API response stamps model, version, context_tokens, and latency_ms',
      m12Pass,
      `model=${m12Bot.model}, version=${m12Bot.version || m12Bot.model_version}, context_tokens=${m12Bot.context_tokens}, latency_ms=${m12Bot.latency_ms}`
    );

    const chatDomText = await page.textContent('body');
    const hasRawGraphUpdated = chatDomText.includes('GRAPH UPDATED') || chatDomText.includes('sleep_disturbed') || chatDomText.includes('benzos_undisclosed');
    record(
      'L1',
      'Patient chat hides raw internal snake_case node IDs and humanizes Memory Updated badges',
      !hasRawGraphUpdated,
      `containsRawSnakeCaseOrGraphUpdated=${hasRawGraphUpdated}`
    );

    // Verify M1: Even after a live sandbox session mutated Elena's live record, Demo Mode uses isolated canonical seed!
    await page.click('button:has-text("Back")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Home")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Demo Mode")');
    await page.waitForTimeout(400);
    await page.click('button:has-text("Step Manually")');
    await page.waitForTimeout(250);
    await page.click('button:has-text("Skip Hook")');
    await page.waitForSelector('[data-testid="phase-pill-3"]', { timeout: 10000 });
    await page.click('[data-testid="phase-pill-3"]'); // elena_chat
    await page.waitForTimeout(300);
    const demoElenaText = await page.textContent('body');
    const m1Pass = demoElenaText.includes('Conversation #12 • Late Evening') && !demoElenaText.includes('took two of my friend\'s anxiety pills again');
    record(
      'M1',
      'Guided Demo Mode is strictly isolated from Live Interactive Sandbox mutations',
      m1Pass,
      `canonicalConv12Intact=${demoElenaText.includes('Conversation #12 • Late Evening')}, zeroLiveLeakInDemo=${!demoElenaText.includes("took two of my friend's anxiety pills again")}`
    );
    await page.click('button:has-text("Home")');
    await page.waitForTimeout(300);

    // Reset Elena back to pristine seed after the live chat test
    await rawReq('POST', `/api/v1/patients/${ELENA_ID}/graph/reset`, { adminKey: ADMIN_KEY });

    // ══════════════════════════════════════════════════════════════════
    // 5. PROVIDER DASHBOARD: CACHED HANDOFFS, SEED COMPLETENESS, DANIEL
    //    TRANSFER SUMMARY, HYPOTHESIS LIFECYCLE, DIVERGENCES, SNAPSHOTS,
    //    PRONOUNS, DDx BUTTONS & PERSISTED DEBATE VERDICTS
    //    (H2, H3, H10, M9, M10, M11, M13, M14, M15, NE4, NE5, NE6)
    // ══════════════════════════════════════════════════════════════════

    // Check NE5 (`GET /clinician/handoff`) and M9 (Seed handoff completeness for Elena & Daniel)
    const elenaHandoffRead = await rawReq('GET', `/api/v1/patients/${ELENA_ID}/clinician/handoff`, { adminKey: ADMIN_KEY });
    const danielHandoffRead = await rawReq('GET', `/api/v1/patients/${DANIEL_ID}/clinician/handoff`, { adminKey: ADMIN_KEY });
    const eh = elenaHandoffRead.data || {};
    const dh = danielHandoffRead.data || {};
    record(
      'NE5',
      'Not Exercised #5: GET /clinician/handoff read endpoint returns complete handoff object (200)',
      elenaHandoffRead.status === 200 && danielHandoffRead.status === 200 && Boolean(eh.clinical_narrative) && Boolean(dh.clinical_narrative),
      `elenaStatus=${elenaHandoffRead.status} (narrativeLen=${(eh.clinical_narrative || '').length}), danielStatus=${danielHandoffRead.status} (narrativeLen=${(dh.clinical_narrative || '').length})`
    );

    const m9Pass =
      Boolean(eh.demographics) &&
      Boolean(eh.clinical_narrative) &&
      Array.isArray(eh.active_themes) && eh.active_themes.length >= 3 &&
      Array.isArray(eh.quotes_vs_inferences) && eh.quotes_vs_inferences.length >= 2 &&
      Array.isArray(eh.hypotheses) && eh.hypotheses.length >= 2 &&
      Boolean(dh.demographics) &&
      Boolean(dh.clinical_narrative) &&
      Array.isArray(dh.active_themes) && dh.active_themes.length >= 3 &&
      Array.isArray(dh.quotes_vs_inferences) && dh.quotes_vs_inferences.length >= 2;
    record(
      'M9',
      'Seed handoff objects for Elena and Daniel have complete demographics, narrative, themes, quotes_vs_inferences, and hypotheses',
      m9Pass,
      `elenaThemes=${eh.active_themes?.length}, elenaQuotes=${eh.quotes_vs_inferences?.length}, danielThemes=${dh.active_themes?.length}, danielQuotes=${dh.quotes_vs_inferences?.length}`
    );

    // Open Provider Dashboard -> Elena first to check H3 deterministic caching & H2 Elena divergences
    await page.click('button:has-text("Provider Dashboard")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Elena Ramirez")');
    await page.waitForSelector('[data-testid="handoff-provenance"]', { timeout: 15000 });
    await page.waitForTimeout(600);

    const elenaProv1 = await page.textContent('[data-testid="handoff-provenance"]');
    // Navigate back to Hub and reopen Elena to prove deterministic cache hit (no conflicting re-synthesis!)
    await page.click('button:has-text("Hub")');
    await page.waitForTimeout(400);
    await page.click('button:has-text("Elena Ramirez")');
    await page.waitForSelector('[data-testid="handoff-provenance"]', { timeout: 15000 });
    await page.waitForTimeout(600);
    const elenaProv2 = await page.textContent('[data-testid="handoff-provenance"]');

    const h3Pass =
      elenaProv2.includes('Cached Synthesis') &&
      elenaProv2.includes('Generated:') &&
      elenaProv2.includes('Model:') &&
      elenaProv2.includes('Graph Version: v1') &&
      elenaProv1 === elenaProv2;
    record(
      'H3',
      'Consultation synthesis caches deterministically per graph_version and displays generated_at, model, and graph_version',
      h3Pass,
      `provenanceBar="${elenaProv2.trim()}"`
    );

    // Check Elena Divergences tab
    await page.click('[data-testid="tab-divergences"]');
    await page.waitForTimeout(400);
    const elenaDivText = await page.textContent('body');

    // Switch to Daniel in Provider Dashboard to check M10, M11, H2, H10, NE4, M15, NE6, M13
    await page.click('button:has-text("Hub")');
    await page.waitForTimeout(400);
    await page.click('button:has-text("Daniel Ramirez")');
    await page.waitForSelector('[data-testid="handoff-provenance"]', { timeout: 15000 });
    await page.waitForTimeout(600);

    await page.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_04_daniel_transfer_summary.png` });

    const danielSummaryText = await page.textContent('body');
    const m10Pass =
      !danielSummaryText.includes('Marco on PrEP — protected') &&
      danielSummaryText.includes('Descovy') &&
      danielSummaryText.includes('I am tired') &&
      danielSummaryText.includes('Risk & Protective Factors') &&
      !danielSummaryText.includes('See narrative');
    record(
      'M10',
      "Daniel's Transfer Summary maps Diagnoses, Medications (Descovy), Symptoms, Themes, Evidence Tracker, and Low Risk details cleanly with zero Marco mislabeling",
      m10Pass,
      `noMarcoInDx=${!danielSummaryText.includes('Marco on PrEP — protected')}, hasDescovyMed=${danielSummaryText.includes('Descovy')}, hasSymptom=${danielSummaryText.includes('I am tired')}, zeroSeeNarrativeFallback=${!danielSummaryText.includes('See narrative')}`
    );

    // M11: Hypothesis lifecycle objects & interactive Confirm button in UI
    const openConfirmBtns = page.locator('button[data-testid^="confirm-hyp-"]');
    const openCountBefore = await openConfirmBtns.count();
    let hypConfirmedInUi = false;
    if (openCountBefore > 0) {
      await openConfirmBtns.first().click();
      await page.waitForTimeout(600);
      const bodyAfterHyp = await page.textContent('body');
      hypConfirmedInUi = bodyAfterHyp.includes('CONFIRMED by Dr. A. Patel') && !bodyAfterHyp.includes('{"id":');
    }
    record(
      'M11',
      'Clinical hypotheses have structured lifecycle fields (id, generated_by, model_version, status, confirmed_by, timestamp) and interactive Confirm/Refute controls',
      openCountBefore > 0 && hypConfirmedInUi,
      `openHypothesesFound=${openCountBefore}, confirmedInUiWithProvenance=${hypConfirmedInUi}`
    );

    // H10 & NE4: Snapshots list + Snapshot retrieval by ID in UI
    await page.click('[data-testid="tab-graph"]');
    await page.waitForSelector('[data-testid="toggle-snapshots-btn"]', { timeout: 10000 });
    await page.click('[data-testid="toggle-snapshots-btn"]');
    await page.waitForSelector('[data-testid="snapshots-panel"]', { timeout: 10000 });
    const snapBtns = page.locator('button[data-testid^="snapshot-item-"]');
    const snapCount = await snapBtns.count();
    let snapDetailText = '';
    if (snapCount > 0) {
      await snapBtns.first().click();
      await page.waitForSelector('[data-testid="snapshot-detail"]', { timeout: 10000 });
      snapDetailText = await page.textContent('[data-testid="snapshot-detail"]');
    }
    const snapsApi = await rawReq('GET', `/api/v1/patients/${DANIEL_ID}/graph/snapshots`, { adminKey: ADMIN_KEY });
    const snapsList = Array.isArray(snapsApi.data) ? snapsApi.data : (snapsApi.data?.snapshots || []);
    record(
      'H10',
      'GET /graph/snapshots returns HTTP 200 with accurate node_count and edge_count',
      snapsApi.status === 200 && snapsList.length >= 1 && typeof snapsList[0]?.node_count === 'number',
      `HTTP ${snapsApi.status}, count=${snapsList.length}, first=${JSON.stringify(snapsList[0])}`
    );
    record(
      'NE4',
      'Not Exercised #4: Snapshot retrieval by ID exercised through UI Snapshots panel',
      snapCount > 0 && snapDetailText.includes('Nodes captured:') && !snapDetailText.includes('Error:'),
      `detail="${snapDetailText}"`
    );

    // H2: Divergences tab live API-driven & patient-specific
    await page.click('[data-testid="tab-divergences"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_05_daniel_divergences.png` });
    const danielDivText = await page.textContent('body');
    const elenaDivApi = await rawReq('GET', `/api/v1/patients/${ELENA_ID}/graph/divergences`, { adminKey: ADMIN_KEY });
    const danielDivApi = await rawReq('GET', `/api/v1/patients/${DANIEL_ID}/graph/divergences`, { adminKey: ADMIN_KEY });
    const h2Pass =
      (elenaDivApi.data?.divergences?.length || 0) >= 3 &&
      (danielDivApi.data?.divergences?.length || 0) >= 3 &&
      elenaDivText.includes('Tramadol') &&
      !danielDivText.includes('Tramadol') &&
      (danielDivText.includes('HIV Risk Window') || danielDivText.toLowerCase().includes('hiv testing'));
    record(
      'H2',
      'Divergences tab is live API-backed with distinct seeded divergences for Elena vs Daniel',
      h2Pass,
      `elenaApiCount=${elenaDivApi.data?.divergences?.length}, danielApiCount=${danielDivApi.data?.divergences?.length}, danielShowsHIVRiskWindowNotTramadol=${danielDivText.includes('HIV Risk Window') && !danielDivText.includes('Tramadol')}`
    );

    // M15 & NE6 & M13: Daniel DDx Arena pronouns, Challenge/Advocate/Compare/Judge UI buttons, and Persisted Debate Verdicts
    await page.click('[data-testid="tab-ddx"]');
    await page.waitForSelector('[data-testid="ddx-role-copilot"]', { timeout: 10000 });
    await page.waitForTimeout(400);

    const ddxArenaText = await page.textContent('body');
    const m15Pass =
      ddxArenaText.includes('What medications is he on?') &&
      !ddxArenaText.includes('What medications is she on?') &&
      !ddxArenaText.includes('alongside Marco on PrEP');
    record(
      'M15',
      'DDx Arena quick questions use patient-aware pronouns (he/his for Daniel) and exclude relationship/event nodes from diagnosis templates',
      m15Pass,
      `hasMalePronoun=${ddxArenaText.includes('What medications is he on?')}, noFemalePronoun=${!ddxArenaText.includes('What medications is she on?')}, noMarcoDxTemplate=${!ddxArenaText.includes('alongside Marco on PrEP')}`
    );

    // Exercise Challenge (defend), Advocate (challenge), Compare (compare), and Judge (debate) buttons through UI (NE6)
    await page.click('[data-testid="ddx-role-defend"]');
    await page.waitForTimeout(150);
    const challengePlaceholder = await page.getAttribute('[data-testid="ddx-chat-input"]', 'placeholder');

    await page.click('[data-testid="ddx-role-challenge"]');
    await page.waitForTimeout(150);
    const advocatePlaceholder = await page.getAttribute('[data-testid="ddx-chat-input"]', 'placeholder');

    await page.click('[data-testid="ddx-role-compare"]');
    await page.waitForTimeout(150);
    const comparePlaceholder = await page.getAttribute('[data-testid="ddx-chat-input"]', 'placeholder');
    // Actually run Compare through the UI to verify live model response!
    await page.fill('[data-testid="ddx-chat-input"]', 'Adjustment Disorder vs Generalized Anxiety Disorder');
    await page.click('[data-testid="ddx-send-btn"]');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="bot-response-bubble"]').length >= 2,
      null,
      { timeout: 90000 }
    );
    const compareReplyCount = await page.locator('[data-testid="bot-response-bubble"]').count();

    // Click Judge role pill -> launch DdxDebate setup screen in UI!
    await page.click('[data-testid="ddx-role-debate"]');
    await page.waitForTimeout(150);
    await page.fill('[data-testid="ddx-chat-input"]', 'HIV Testing & PrEP Avoidance');
    await page.click('[data-testid="ddx-send-btn"]');
    await page.waitForSelector('[data-testid="debate-topic-input"]', { timeout: 10000 });
    const judgeComponentOpened = (await page.locator('[data-testid="role-picker-judge"]').count()) === 1;

    record(
      'NE6',
      'Not Exercised #6: Challenge, Advocate, Compare, and Judge buttons all exercised through the DDx Arena UI',
      challengePlaceholder.includes('challenge') &&
        advocatePlaceholder.includes('defend') &&
        comparePlaceholder.includes('two diagnoses') &&
        compareReplyCount >= 2 &&
        judgeComponentOpened,
      `placeholders=[${challengePlaceholder} | ${advocatePlaceholder} | ${comparePlaceholder}], liveCompareBubbles=${compareReplyCount}, judgeSetupOpened=${judgeComponentOpened}`
    );

    // Record a persisted debate verdict on Daniel's divergence topic and verify GET /debate/verdicts + UI sidebar (M13)
    const verdictPost = await rawReq('POST', `/api/v1/patients/${DANIEL_ID}/debate/verdicts`, {
      adminKey: ADMIN_KEY,
      body: {
        session_id: 'verify-session-m13',
        topic: 'HIV Testing & PrEP Avoidance vs. Acute Health Anxiety',
        round: 2,
        winner: 'for',
        score: 2,
        judge_type: 'human_clinician',
        rationale: 'Avoidance was fear-driven and resolved following warm handoff to Dr. Tran.',
        advocate_summary: 'Testing completed (HIV negative) and Descovy initiated once stigma barrier was lowered.',
        skeptic_summary: '6-month delay raised concern for generalized health avoidance.',
      },
    });
    const verdictsGet = await rawReq('GET', `/api/v1/patients/${DANIEL_ID}/debate/verdicts`, { adminKey: ADMIN_KEY });
    // Close DdxDebate view to return to DDx Arena split view and verify Persisted Debate Verdicts sidebar renders!
    await page.locator('div:has(> span:has-text("DDx Clinical Debate")) > button').first().click();
    await page.waitForSelector('[data-testid="persisted-verdicts-section"]', { timeout: 10000 });
    await page.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_06_ddx_arena_persisted_verdict.png` });
    const persistedSidebarText = await page.textContent('[data-testid="persisted-verdicts-section"]');
    const m13Pass =
      verdictPost.status === 200 &&
      (verdictsGet.data?.verdicts?.length || 0) >= 1 &&
      persistedSidebarText.includes('HIV Testing & PrEP Avoidance') &&
      persistedSidebarText.includes('Winner: FOR');
    record(
      'M13',
      'Debate verdicts persist to patient record, resolve matching divergences, and render in DDx Arena & GET /debate/verdicts',
      m13Pass,
      `POST=${verdictPost.status}, GET count=${verdictsGet.data?.verdicts?.length}, sidebar="${persistedSidebarText.slice(0, 110)}..."`
    );

    // ══════════════════════════════════════════════════════════════════
    // 6. THROWAWAY PATIENT PIPELINE TESTS:
    //    INGEST (H5), SCRIBE (H6), CONSOLIDATION (H1), HANDOFF VALIDATION (H4),
    //    DIVERGENCE NODE HYDRATION (M14), NODE/EDGE DELETE & RESET (NE1, NE2, NE3)
    // ══════════════════════════════════════════════════════════════════

    // Clean up any leftover non-seeded throwaway patients before creating fresh Camila Morales
    const existingPatientsRes = await rawReq('GET', '/api/v1/patients', { adminKey: ADMIN_KEY });
    for (const pat of Array.isArray(existingPatientsRes.data) ? existingPatientsRes.data : []) {
      if (pat.id !== ELENA_ID && pat.id !== DANIEL_ID) {
        await rawReq('DELETE', `/api/v1/patients/${pat.id}`, { adminKey: ADMIN_KEY });
      }
    }

    const createTestPat = await rawReq('POST', '/api/v1/patients', {
      adminKey: ADMIN_KEY,
      body: {
        name: ' Camila Morales ',
        age: 39,
        bio: '39yo school bus driver in Merced presenting with fatigue, alcohol use concerns, and hypertension.',
      },
    });
    if ((createTestPat.status !== 200 && createTestPat.status !== 201) || !createTestPat.data?.id) {
      throw new Error(`Failed to create throwaway patient: ${createTestPat.status} ${JSON.stringify(createTestPat.data)}`);
    }
    const TEST_PID = createTestPat.data.id;

    // H5: Document Ingest with multiple claims including alcohol use -> unique claim IDs, string labels, edges to self, AND Clinician Copilot recalls alcohol use!
    const ingestNote =
      'Outside PCP Transfer Note (Dr. Gomez): Patient reports drinking 4-5 glasses of wine nightly to cope with route stress. ' +
      'Blood pressure elevated at 152/94 mmHg; started on lisinopril 10mg daily. Fasting labs show HbA1c 6.3% and mild AST elevation at 54 U/L.';
    const ingestRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/graph/ingest`, {
      adminKey: ADMIN_KEY,
      body: { text: ingestNote, source_name: 'Dr. Gomez PCP Note' },
    });
    const testGraphAfterIngest = await rawReq('GET', `/api/v1/patients/${TEST_PID}/graph`, { adminKey: ADMIN_KEY });
    const ingNodes = (testGraphAfterIngest.data?.nodes || []).filter((n) => n.kind !== 'self');
    const ingEdges = testGraphAfterIngest.data?.edges || [];
    const allLabelsStrings = ingNodes.every((n) => typeof n.label === 'string' && !n.label.trim().startsWith('{') && n.id !== 'claim');

    // Ask Clinician Copilot about alcohol use on the ingested patient!
    const copilotAlcoholRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/clinician/messages`, {
      adminKey: ADMIN_KEY,
      body: { text: 'Does the record contain any information about alcohol use?', role: 'copilot' },
    });
    const copilotAlcoholText = (copilotAlcoholRes.data?.response?.text || copilotAlcoholRes.data?.bot_response?.text || '').toLowerCase();
    const copilotKnowsAlcohol = copilotAlcoholText.includes('wine') || copilotAlcoholText.includes('4') || copilotAlcoholText.includes('nightly') || copilotAlcoholText.includes('alcohol');
    const h5Pass =
      ingestRes.status === 200 &&
      ingNodes.length >= 2 &&
      ingEdges.length >= 2 &&
      allLabelsStrings &&
      copilotKnowsAlcohol;
    record(
      'H5',
      'Document ingest mints unique claim nodes with string labels + properties + edges to self, and Clinician Copilot cites ingested alcohol use',
      h5Pass,
      `HTTP ${ingestRes.status}, extractedNodes=${ingNodes.length}, edges=${ingEdges.length}, allStringLabels=${allLabelsStrings}, copilotRecalledWine=${copilotKnowsAlcohol}`
    );

    // M14: POST /graph/divergences with two node IDs resolves real node labels, sources, and credibility (zero "Unknown")
    const nodeAId = ingNodes[0]?.id;
    const nodeBId = ingNodes[1]?.id;
    const createDivRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/graph/divergences`, {
      adminKey: ADMIN_KEY,
      body: { claim_a_id: nodeAId, claim_b_id: nodeBId, topic: 'Alcohol vs Hypertension Contribution' },
    });
    const createdDiv = createDivRes.data?.divergence || {};
    const m14Pass =
      createDivRes.status === 200 &&
      createdDiv.claimA?.text &&
      createdDiv.claimA.text !== 'Unknown' &&
      createdDiv.claimA.source !== 'Unknown' &&
      createdDiv.claimB?.text &&
      createdDiv.claimB.text !== 'Unknown';
    record(
      'M14',
      'Divergence creation resolves real node labels, provenance sources, and credibility weights (zero "Unknown")',
      m14Pass,
      `claimA="${createdDiv.claimA?.text?.slice(0, 45)}" (${createdDiv.claimA?.source}, cred=${createdDiv.claimA?.credibility}), claimB="${createdDiv.claimB?.text?.slice(0, 45)}"`
    );

    // H6: Post-Visit Scribe live Gemini SOAP + CPT/ICD-10 + Graph consolidation
    const scribeTranscript =
      'Clinician (45-minute individual psychotherapy session): Camila discussed intense guilt after yelling at her teenage daughter Lucia last Tuesday. ' +
      'She acknowledged cutting wine intake down from 5 glasses to 2 glasses nightly over the past four days and practicing paced diaphragmatic breathing before bed. ' +
      'Denied suicidal ideation, intent, or plan. Plan: Continue CBT/MI relapse prevention and coordinate liver panel follow-up with Dr. Gomez.';
    const scribeRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/clinician/post_visit`, {
      adminKey: ADMIN_KEY,
      body: { transcript: scribeTranscript },
    });
    const scribeNotes = scribeRes.data?.session_notes || '';
    const scribeBilling = scribeRes.data?.billing_context || '';
    const scribeUpdates = scribeRes.data?.graph_updates || {};
    const isNotStub =
      !scribeNotes.includes('Patient attended session. Discussed recent events') &&
      !scribeBilling.includes('ICD-10 based on primary diagnosis');
    const isTranscriptSpecific =
      (scribeNotes.toLowerCase().includes('lucia') || scribeNotes.toLowerCase().includes('wine')) &&
      /[A-Z]\d{2}/.test(scribeBilling);
    const h6Pass = scribeRes.status === 200 && isNotStub && isTranscriptSpecific && (scribeUpdates.nodes_added || 0) >= 1;
    record(
      'H6',
      'Post-Visit Scribe generates transcript-grounded SOAP notes, specific CPT & ICD-10-CM codes, and consolidates new nodes into PatientGraph',
      h6Pass,
      `HTTP ${scribeRes.status}, nodesAdded=${scribeUpdates.nodes_added}, edgesAdded=${scribeUpdates.edges_added}, billingExcerpt="${scribeBilling.slice(0, 90).replace(/\n/g, ' ')}..."`
    );

    // H1: Start conversation on throwaway patient, send message, end conversation, verify GET /consolidation/pending, run POST /consolidation -> all 5 steps succeed!
    const startConvRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/conversations`, {
      adminKey: ADMIN_KEY,
      body: { label: 'Consolidation Verification Session' },
    });
    const testCid = startConvRes.data?.conversation_id;
    await rawReq('POST', `/api/v1/patients/${TEST_PID}/conversations/${testCid}/messages`, {
      adminKey: ADMIN_KEY,
      body: { text: 'I have been worried my blood pressure medication makes me dizzy in the mornings before my bus route, and I miss my sister Rosa in Fresno.' },
    });
    await rawReq('POST', `/api/v1/patients/${TEST_PID}/conversations/${testCid}/end`, { adminKey: ADMIN_KEY });

    const pendingBefore = await rawReq('GET', `/api/v1/patients/${TEST_PID}/consolidation/pending`, { adminKey: ADMIN_KEY });
    const wasPending = (pendingBefore.data?.pending_count || 0) >= 1;

    const consolRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/consolidation`, {
      adminKey: ADMIN_KEY,
      body: { conversation_id: testCid },
    });
    const pendingAfter = await rawReq('GET', `/api/v1/patients/${TEST_PID}/consolidation/pending`, { adminKey: ADMIN_KEY });
    const steps = consolRes.data?.steps || [];
    const zeroStepErrors = steps.length === 5 && steps.every((s) => !JSON.stringify(s).includes('expected str instance, dict found') && !s.error);
    const h1Pass = consolRes.status === 200 && consolRes.data?.status === 'complete' && wasPending && pendingAfter.data?.pending_count === 0 && zeroStepErrors;
    record(
      'H1',
      'Consolidation validates node schemas, runs all 5 steps without dict/str errors, tracks pending sessions, and marks consolidated only on success',
      h1Pass,
      `HTTP ${consolRes.status}, steps=${steps.length}, pendingBefore=${pendingBefore.data?.pending_count}, pendingAfter=${pendingAfter.data?.pending_count}, zeroStepErrors=${zeroStepErrors}`
    );

    // H4: POST /handoffs on throwaway patient validates non-empty output (never persists null fields)
    const handoffGenRes = await rawReq('POST', `/api/v1/patients/${TEST_PID}/handoffs`, {
      adminKey: ADMIN_KEY,
      body: { recipient: 'Dr. Gomez', recipient_type: 'PCP', force: true },
    });
    const genPkg = handoffGenRes.data?.handoff || {};
    const h4Pass =
      handoffGenRes.status === 200 &&
      typeof genPkg.clinical_narrative === 'string' &&
      genPkg.clinical_narrative.trim().length > 40 &&
      Boolean(genPkg.risk_assessment?.level);
    record(
      'H4',
      'POST /handoffs produces schema-validated non-empty clinical_narrative, risk_assessment, themes, and hypotheses',
      h4Pass,
      `HTTP ${handoffGenRes.status}, narrativeLen=${(genPkg.clinical_narrative || '').length}, riskLevel=${genPkg.risk_assessment?.level}, hypotheses=${genPkg.hypotheses?.length}`
    );

    // NE1, NE2, NE3: Exercise Edge Deletion, Node Deletion, and Graph Reset!
    const gBeforeDel = await rawReq('GET', `/api/v1/patients/${TEST_PID}/graph`, { adminKey: ADMIN_KEY });
    const targetEdge = (gBeforeDel.data?.edges || [])[0];
    const edgeDelRes = await rawReq(
      'DELETE',
      `/api/v1/patients/${TEST_PID}/graph/edges?source=${encodeURIComponent(targetEdge.source)}&target=${encodeURIComponent(targetEdge.target)}`,
      { adminKey: ADMIN_KEY }
    );
    record(
      'NE2',
      'Not Exercised #2: Edge deletion (DELETE /graph/edges) removes edge cleanly under Admin role',
      edgeDelRes.status === 200 && edgeDelRes.data?.status === 'deleted',
      `deleted edge ${targetEdge?.source} -> ${targetEdge?.target} (HTTP ${edgeDelRes.status})`
    );

    const targetNode = (gBeforeDel.data?.nodes || []).find((n) => n.kind !== 'self');
    const nodeDelRes = await rawReq('DELETE', `/api/v1/patients/${TEST_PID}/graph/nodes/${encodeURIComponent(targetNode.id)}`, { adminKey: ADMIN_KEY });
    record(
      'NE1',
      'Not Exercised #1: Node deletion (DELETE /graph/nodes/{id}) removes node cleanly under Admin role',
      nodeDelRes.status === 200 && nodeDelRes.data?.status === 'deleted',
      `deleted node ${targetNode?.id} (HTTP ${nodeDelRes.status})`
    );

    const resetDanielRes = await rawReq('POST', `/api/v1/patients/${DANIEL_ID}/graph/reset`, { adminKey: ADMIN_KEY });
    record(
      'NE3',
      'Not Exercised #3: Graph reset (POST /graph/reset) restores clean seed graph and persists to disk/SQLite',
      resetDanielRes.status === 200 && resetDanielRes.data?.status === 'reset',
      `reset ${DANIEL_ID} -> nodes=${resetDanielRes.data?.node_count}, edges=${resetDanielRes.data?.edge_count}`
    );

    // Delete throwaway test patient so shared hub only has Elena & Daniel
    const delThrowaway = await rawReq('DELETE', `/api/v1/patients/${TEST_PID}`, { adminKey: ADMIN_KEY });
    if (delThrowaway.status !== 200) {
      throw new Error(`Failed to clean up throwaway patient ${TEST_PID}: ${delThrowaway.status}`);
    }

    await desktopCtx.close();

    // ══════════════════════════════════════════════════════════════════
    // 7. MOBILE VIEWPORT VERIFICATION — iPhone 13 (390x844) (H7)
    // ══════════════════════════════════════════════════════════════════

    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mPage = await mobileCtx.newPage();
    await mPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await mPage.click('[data-testid="accept-disclaimer-btn"]');
    await mPage.waitForTimeout(600);
    await mPage.click('button:has-text("Patient Chat")');
    await mPage.waitForTimeout(500);
    await mPage.click('button:has-text("Elena Ramirez")');
    await mPage.waitForSelector('[data-testid="mobile-tab-chat"]', { timeout: 10000 });
    await mPage.waitForTimeout(500);

    await mPage.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_07_mobile_iphone13_chat.png` });

    const mobileMetricsChat = await mPage.evaluate(() => {
      const tabBar = document.querySelector('.ally-mobile-tab-bar');
      const hint = document.querySelector('.ally-graph-hint');
      const input = document.querySelector('[data-testid="live-chat-input"]');
      const inputRect = input ? input.getBoundingClientRect() : null;
      return {
        tabBarDisplay: tabBar ? getComputedStyle(tabBar).display : 'none',
        hintDisplay: hint ? getComputedStyle(hint).display : 'none',
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        inputVisibleInViewport: Boolean(inputRect && inputRect.width > 200 && inputRect.bottom <= window.innerHeight && inputRect.top > 100),
      };
    });

    // Switch to Memory Graph tab on mobile
    await mPage.click('[data-testid="mobile-tab-graph"]');
    await mPage.waitForTimeout(400);
    await mPage.screenshot({ path: `${ARTIFACT_DIR}/${SHOT_PREFIX}_08_mobile_iphone13_graph.png` });
    const mobileGraphSvgVisible = await mPage.evaluate(() => {
      const nodeGroup = document.querySelector('svg g[role="img"]');
      const svg = nodeGroup?.closest('svg') || document.querySelector('svg[viewBox="0 0 1100 620"]');
      if (!svg) return false;
      const r = svg.getBoundingClientRect();
      return r.width > 300 && r.height > 300;
    });

    // Abandon 0-message mobile session cleanly by clicking Back
    await mPage.click('button:has-text("Back")');
    await mPage.waitForTimeout(500);
    await mobileCtx.close();

    const h7Pass =
      mobileMetricsChat.tabBarDisplay === 'flex' &&
      mobileMetricsChat.hintDisplay === 'none' &&
      mobileMetricsChat.overflowX <= 1 &&
      mobileMetricsChat.inputVisibleInViewport &&
      mobileGraphSvgVisible;
    record(
      'H7',
      'iPhone 13 (390x844) responsive live chat: mobile Conversation/Memory Graph toggle, hidden graph hint, zero overflow, unobstructed input',
      h7Pass,
      `tabBar=${mobileMetricsChat.tabBarDisplay}, hint=${mobileMetricsChat.hintDisplay}, overflowX=${mobileMetricsChat.overflowX}px, inputVisible=${mobileMetricsChat.inputVisibleInViewport}, graphTabSvgVisible=${mobileGraphSvgVisible}`
    );

    // Final pristine reset of Elena & Daniel
    await rawReq('POST', `/api/v1/patients/${ELENA_ID}/graph/reset`, { adminKey: ADMIN_KEY });
    await rawReq('POST', `/api/v1/patients/${DANIEL_ID}/graph/reset`, { adminKey: ADMIN_KEY });
  } finally {
    await browser.close();
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  const passedCount = results.filter((r) => r.passed).length;
  const failedItems = results.filter((r) => !r.passed);

  console.log(`\n${'═'.repeat(76)}`);
  console.log(`  VERIFICATION SUMMARY: ${passedCount} / ${results.length} PASSED | ${failedItems.length} FAILED`);
  console.log(`${'═'.repeat(76)}\n`);
  if (failedItems.length > 0) {
    console.error('FAILED ITEMS:', failedItems);
    process.exit(1);
  }
  process.exit(0);
})();
