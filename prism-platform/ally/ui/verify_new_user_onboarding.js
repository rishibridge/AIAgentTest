/**
 * VERIFY NEW USER ONBOARDING, BJ FOGG (B=MAP) CONVERSATION, EMAIL-HASH DECOUPLING,
 * RETURNING USER RESUME & FEEDBACK FLOW (TC-NU-01 through TC-NU-10)
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || process.env.ALLY_BASE_URL || 'http://127.0.0.1:8089';
const API = URL.replace(/\/$/, '');
const ARTIFACT_DIR = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';
const PREFIX = URL.includes('run.app') ? 'gcp_nu' : 'local_nu';

(async () => {
  console.log(`\n${'═'.repeat(76)}`);
  console.log(`  VERIFYING NEW USER ONBOARDING & BJ FOGG FLOW ON: ${URL}`);
  console.log(`${'═'.repeat(76)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  const page = await context.newPage();

  const checks = [];
  const record = (id, title, pass, detail) => {
    checks.push({ id, title, pass, detail });
    console.log(`  ${pass ? '✅' : '❌'} [${id}] ${title} — ${detail}`);
  };

  let createdPatientId = null;
  const uniqueSuffix = Date.now().toString().slice(-6);
  const testName = 'Alex';
  const testEmail = `alex.${uniqueSuffix}@example.com`;
  const testPass = 'allyPass2026';

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);

    // Accept Entry Gate
    const gateBtn = page.locator('[data-testid="accept-disclaimer-btn"]');
    if ((await gateBtn.count()) > 0) {
      await gateBtn.click();
      await page.waitForTimeout(1000);
    }

    // Acquire session token for direct API assertions
    const authRes = await page.evaluate(async (apiBase) => {
      const r = await fetch(`${apiBase}/api/v1/auth/accept-terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      });
      return r.json();
    }, API);
    const token = authRes.token;

    // Navigate to Patient Picker
    const startSandboxBtn = page.locator('button', { hasText: 'Patient Chat' });
    await startSandboxBtn.click();
    await page.waitForTimeout(1200);

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_01_patient_picker.png` });

    // TC-NU-01: PatientPicker shows "Try Ally as a New User" card + Feedback button, while public GET /api/v1/patients only lists canonical patients
    const newUserCard = page.locator('[data-testid="try-ally-new-user-card"]');
    const openFeedbackBtn = page.locator('[data-testid="open-feedback-btn"]');
    const publicPatients = await page.evaluate(async ({ apiBase, tok }) => {
      const r = await fetch(`${apiBase}/api/v1/patients`, {
        headers: { 'X-Ally-Token': tok },
      });
      return r.json();
    }, { apiBase: API, tok: token });
    const onlyCanonicalPublic = Array.isArray(publicPatients) &&
      publicPatients.length === 2 &&
      publicPatients.every(p => !p.is_custom_private);

    record(
      'TC-NU-01',
      'PatientPicker New User Card + Public Privacy Isolation',
      (await newUserCard.count()) === 1 && (await openFeedbackBtn.count()) === 1 && onlyCanonicalPublic,
      `newUserCard=${await newUserCard.count()}, feedbackBtn=${await openFeedbackBtn.count()}, publicPatients=${publicPatients.map(p => p.name).join(', ')}`
    );

    // TC-NU-02: API Security Gates (onboard requires demo_terms_acknowledged=true; raw POST /api/v1/patients requires admin)
    const gateChecks = await page.evaluate(async ({ apiBase, tok }) => {
      const rUnchecked = await fetch(`${apiBase}/api/v1/patients/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ally-Token': tok },
        body: JSON.stringify({ name: 'Test', email: 't@example.com', password: 'abcd', demo_terms_acknowledged: false }),
      });
      const rRawCreate = await fetch(`${apiBase}/api/v1/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ally-Token': tok },
        body: JSON.stringify({ name: 'Unauthorized Raw Create' }),
      });
      return { uncheckedStatus: rUnchecked.status, rawCreateStatus: rRawCreate.status };
    }, { apiBase: API, tok: token });

    record(
      'TC-NU-02',
      'Onboarding Terms Gate (400) & Raw Create RBAC Gate (403)',
      gateChecks.uncheckedStatus === 400 && gateChecks.rawCreateStatus === 403,
      `onboard(unacknowledged)=${gateChecks.uncheckedStatus}, raw POST /patients=${gateChecks.rawCreateStatus}`
    );

    // TC-NU-03: Open NewUserModal, verify fields & checkbox gating
    await newUserCard.click();
    await page.waitForTimeout(600);
    const modal = page.locator('[data-testid="new-user-modal"]');
    const nameInput = page.locator('[data-testid="new-user-name-input"]');
    const emailInput = page.locator('[data-testid="new-user-email-input"]');
    const passInput = page.locator('[data-testid="new-user-password-input"]');
    const termsCheckbox = page.locator('[data-testid="new-user-terms-checkbox"]');
    const submitBtn = page.locator('[data-testid="new-user-submit-btn"]');

    await nameInput.fill(testName);
    await emailInput.fill(testEmail);
    await passInput.fill(testPass);
    const disabledBeforeCheck = await submitBtn.isDisabled();
    await termsCheckbox.check();
    const enabledAfterCheck = !(await submitBtn.isDisabled());

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_02_new_user_modal.png` });

    record(
      'TC-NU-03',
      'NewUserModal 3 Fields + Plain-English 18+ Checkbox Gating',
      (await modal.count()) === 1 && disabledBeforeCheck && enabledAfterCheck,
      `disabledBeforeCheck=${disabledBeforeCheck}, enabledAfterCheck=${enabledAfterCheck}`
    );

    // TC-NU-04: Submit NewUserModal -> Verify blank-slate creation + Email-Hash Decoupling (zero plaintext email in patient record) + Decoupled Acknowledgement log
    await submitBtn.click();
    await page.waitForSelector('[data-testid="live-chat-input"]', { timeout: 20000 });
    await page.waitForTimeout(1200);

    const unlockedIds = await page.evaluate(() => (localStorage.getItem('ally_unlocked_patients') || '').split(',').filter(Boolean));
    createdPatientId = unlockedIds[unlockedIds.length - 1];

    const decouplingAudit = await page.evaluate(async ({ apiBase, tok, pid, rawEmail }) => {
      const pRes = await fetch(`${apiBase}/api/v1/patients/${pid}`, {
        headers: { 'X-Ally-Token': tok },
      });
      const pData = await pRes.json();
      const pText = JSON.stringify(pData);
      const ackRes = await fetch(`${apiBase}/api/v1/phi-acknowledgements`, {
        headers: { 'X-Ally-Token': tok },
      });
      const ackData = await ackRes.json();
      const matchingAck = (ackData.acknowledgements || []).find(a => a.email === rawEmail);
      return {
        nodeCount: pData?.graph?.node_count,
        edgeCount: pData?.graph?.edge_count,
        hasEmailHash: Boolean(pData?.patient?.email_hash && pData.patient.email_hash.length === 64),
        leaksPlaintextEmail: pText.includes(rawEmail),
        leaksPasswordHash: Boolean(pData?.patient?.password_hash),
        ackRecorded: Boolean(matchingAck && matchingAck.acknowledged === true),
      };
    }, { apiBase: API, tok: token, pid: createdPatientId, rawEmail: testEmail });

    record(
      'TC-NU-04',
      'Blank-Slate 1-Node Creation & SHA-256 Email-Hash Decoupling',
      decouplingAudit.nodeCount === 1 &&
        decouplingAudit.edgeCount === 0 &&
        decouplingAudit.hasEmailHash &&
        !decouplingAudit.leaksPlaintextEmail &&
        !decouplingAudit.leaksPasswordHash &&
        decouplingAudit.ackRecorded,
      `pid=${createdPatientId}, nodes=${decouplingAudit.nodeCount}, emailHash=64chars, leaksPlainEmail=${decouplingAudit.leaksPlaintextEmail}, ackLogged=${decouplingAudit.ackRecorded}`
    );

    // TC-NU-05: Verify Ally's Turn 0 Seeded Greeting in LiveChat & 1 Central Self Node at (550, 310)
    const chatText = await page.locator('body').innerText();
    const hasSeededGreeting = chatText.includes(`Hi ${testName} — I'm Ally. Tell me a little about yourself, or whatever's on your mind today.`);
    const posCheck = await page.evaluate(async ({ apiBase, tok, pid }) => {
      const r = await fetch(`${apiBase}/api/v1/patients/${pid}/graph/positions`, {
        headers: { 'X-Ally-Token': tok },
      });
      return r.json();
    }, { apiBase: API, tok: token, pid: createdPatientId });
    const selfPos = posCheck.alex || Object.values(posCheck)[0] || {};

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_03_session1_seeded_greeting.png` });

    record(
      'TC-NU-05',
      'Turn 0 Seeded 16-Word Greeting & Centered Self Node (550, 310)',
      hasSeededGreeting && selfPos.x === 550 && selfPos.y === 310,
      `greetingFound=${hasSeededGreeting}, selfPos=(${selfPos.x}, ${selfPos.y})`
    );

    // TC-NU-06: Multi-Turn Live Session #1 Discovery (BJ Fogg High-Patient-Talk + Golden-Angle Radial Graph Growth + Shine Pill)
    const chatInput = page.locator('[data-testid="live-chat-input"]');
    const sendBtn = page.locator('[data-testid="live-chat-send"]');

    await chatInput.fill("I just started leading a new engineering team and I've been waking up at 3 a.m. worrying about our launch.");
    await sendBtn.click();
    await page.waitForSelector('[data-testid="shine-memory-pill"]', { timeout: 45000 });
    await page.waitForTimeout(1000);

    await chatInput.fill("My partner Maya notices I'm exhausted, and I took an old anxiety pill from a friend last week — please keep it between us.");
    await sendBtn.click();
    await page.waitForTimeout(8000);
    // Wait until loading spinner disappears
    await page.waitForFunction(() => !document.body.innerText.includes('Ally is thinking...'), { timeout: 45000 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_04_session1_live_discovery.png` });

    const postTurnsGraph = await page.evaluate(async ({ apiBase, tok, pid }) => {
      const r = await fetch(`${apiBase}/api/v1/patients/${pid}/graph`, {
        headers: { 'X-Ally-Token': tok },
      });
      return r.json();
    }, { apiBase: API, tok: token, pid: createdPatientId });

    const shineCount = await page.locator('[data-testid="shine-memory-pill"]').count();
    const nonZeroRadialNodes = (postTurnsGraph.nodes || []).filter(n => n.x > 0 && n.y > 0).length;
    const liveDomText = await page.locator('body').innerText();
    const noRawLlmError = !liveDomText.includes('_llm_error') && !liveDomText.includes('RESOURCE_EXHAUSTED');

    record(
      'TC-NU-06',
      'Multi-Turn Live Graph Growth, Golden-Angle Radial Coordinates, Clean BJ Fogg Reply & Shine Pill',
      postTurnsGraph.node_count >= 3 && shineCount >= 1 && nonZeroRadialNodes === postTurnsGraph.node_count && noRawLlmError,
      `nodes=${postTurnsGraph.node_count}, edges=${postTurnsGraph.edge_count}, shinePills=${shineCount}, radialPositioned=${nonZeroRadialNodes}/${postTurnsGraph.node_count}, noRawLlmError=${noRawLlmError}`
    );

    // TC-NU-07: End & Consolidate Session #1 -> Verify Scanning Ritual HUD + Consolidation Complete Card + 5 Rich Step Cards + Replay Ritual
    const endConsolidateBtn = page.locator('[data-testid="end-consolidate-btn"]');
    await endConsolidateBtn.click();

    // Capture the live scanning ritual state while consolidation is in flight
    let scanningHudSeen = false;
    let dynamicPatientHeaderSeen = false;
    try {
      await page.waitForSelector('[data-testid="consolidation-ritual-panel"]', { timeout: 5000 });
      await page.waitForTimeout(1400);
      const panelText = await page.locator('[data-testid="consolidation-ritual-panel"]').innerText();
      dynamicPatientHeaderSeen = panelText.toUpperCase().includes(testName.toUpperCase()) && !panelText.includes('Daniel Ramirez');
      scanningHudSeen = (await page.locator('[data-testid="ritual-scanning-hud"]').count()) >= 1;
      await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_04b_consolidation_scanning_ritual.png` });
    } catch {
      // If fast completion, we still verify post-consolidation ritual below
    }

    await page.waitForSelector('[data-testid="consolidation-complete-card"]', { timeout: 90000 });
    await page.waitForTimeout(800);

    // Open Advocate/Skeptic reasoning on Step 2 (index 1: Significance filtering) before taking screenshot
    const debateToggle1 = page.locator('[data-testid="step-debate-toggle-1"]');
    if ((await debateToggle1.count()) === 1) {
      await debateToggle1.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_05_consolidation_complete.png` });

    const nextSessionBtn = page.locator('[data-testid="start-next-session-btn"]');
    const consolFeedbackBtn = page.locator('[data-testid="consolidation-feedback-btn"]');
    const deltaSummary = page.locator('[data-testid="consolidation-delta-summary"]');
    const integrationPill = page.locator('[data-testid="integration-summary-pill"]');
    const replayBtn = page.locator('[data-testid="replay-ritual-btn"]');
    const step0Changes = page.locator('[data-testid="step-changes-0"]');
    const step4Changes = page.locator('[data-testid="step-changes-4"]');
    const debateBody1 = page.locator('[data-testid="step-debate-body-1"]');

    // Trigger Replay Ritual button to verify re-triggering cortical crystallization
    if ((await replayBtn.count()) === 1) {
      await replayBtn.click();
      await page.waitForTimeout(300);
    }

    const ritualChecksPass =
      scanningHudSeen &&
      dynamicPatientHeaderSeen &&
      (await nextSessionBtn.count()) === 1 &&
      (await consolFeedbackBtn.count()) === 1 &&
      (await deltaSummary.count()) === 1 &&
      (await integrationPill.count()) === 1 &&
      (await replayBtn.count()) === 1 &&
      (await step0Changes.count()) === 1 &&
      (await step4Changes.count()) === 1 &&
      (await debateBody1.count()) === 1;

    record(
      'TC-NU-07',
      'Session #1 Memory Integration Ritual (Scanning HUD + Cortical Crystallization + 5 Rich Step Cards + Advocate/Skeptic Debate + Replay Ritual)',
      ritualChecksPass,
      `scanningHud=${scanningHudSeen}, dynamicHeader=${dynamicPatientHeaderSeen}, deltaSummary=${await deltaSummary.count()}, integrationPill=${await integrationPill.count()}, step0Changes=${await step0Changes.count()}, step4Changes=${await step4Changes.count()}, debateBody1=${await debateBody1.count()}`
    );

    // TC-NU-08: Click "Start Next Session (See What Ally Remembers)" -> Verify Session #2 "Welcome back, Alex" Continuity Greeting
    await nextSessionBtn.click();
    await page.waitForSelector('[data-testid="live-chat-input"]', { timeout: 20000 });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_06_session2_welcome_back.png` });

    const session2Text = await page.locator('body').innerText();
    const hasWelcomeBack = session2Text.includes(`Welcome back, ${testName}. Last time we talked, we mapped`);

    record(
      'TC-NU-08',
      'Session #2 Longitudinal Continuity Greeting ("Welcome back, Alex...")',
      hasWelcomeBack,
      `hasWelcomeBack=${hasWelcomeBack}`
    );

    // TC-NU-09: Returning User Sign-In (Wrong Password -> 401; Correct Email + Password in Fresh Context -> Resumes Profile)
    const resumeAudit = await page.evaluate(async ({ apiBase, tok, email, pass }) => {
      const rWrong = await fetch(`${apiBase}/api/v1/patients/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ally-Token': tok },
        body: JSON.stringify({ email, password: 'wrongPassword999' }),
      });
      const rRight = await fetch(`${apiBase}/api/v1/patients/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ally-Token': tok },
        body: JSON.stringify({ email, password: pass }),
      });
      const rightData = await rRight.json();
      return {
        wrongStatus: rWrong.status,
        rightStatus: rRight.status,
        resumedId: rightData.id,
        resumedNodes: rightData.node_count,
      };
    }, { apiBase: API, tok: token, email: testEmail, pass: testPass });

    record(
      'TC-NU-09',
      'Returning User Sign-In (Wrong Password 401 + Valid Resume 200)',
      resumeAudit.wrongStatus === 401 &&
        resumeAudit.rightStatus === 200 &&
        resumeAudit.resumedId === createdPatientId &&
        resumeAudit.resumedNodes >= 3,
      `wrongPass=${resumeAudit.wrongStatus}, validResume=${resumeAudit.rightStatus}, resumedId=${resumeAudit.resumedId}, nodes=${resumeAudit.resumedNodes}`
    );

    // TC-NU-10: Give Feedback Modal Submission & Persistence via GET /api/v1/feedback
    const liveFeedbackBtn = page.locator('[data-testid="live-feedback-btn"]');
    await liveFeedbackBtn.click();
    await page.waitForSelector('[data-testid="feedback-modal"]', { timeout: 10000 });

    const fbComment = `Automated E2E feedback check ${uniqueSuffix}: BJ Fogg onboarding felt natural and concise.`;
    await page.locator('[data-testid="feedback-rating-5"]').click();
    await page.locator('[data-testid="feedback-comment-input"]').fill(fbComment);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${PREFIX}_07_feedback_modal.png` });

    await page.locator('[data-testid="submit-feedback-btn"]').click();
    await page.waitForSelector('[data-testid="feedback-success-msg"]', { timeout: 15000 });

    const fbVerify = await page.evaluate(async ({ apiBase, tok, expectedComment }) => {
      const r = await fetch(`${apiBase}/api/v1/feedback`, {
        headers: { 'X-Ally-Token': tok },
      });
      const data = await r.json();
      const found = (data.feedback || []).some(item => item.comment === expectedComment && item.rating === 5);
      return { count: data.count, found };
    }, { apiBase: API, tok: token, expectedComment: fbComment });

    record(
      'TC-NU-10',
      'Give Feedback Modal Submission & Persistence Audit',
      fbVerify.found === true,
      `feedbackSaved=${fbVerify.found}, totalFeedbackCount=${fbVerify.count}`
    );

  } catch (err) {
    console.error('Fatal test error:', err);
    record('FATAL', 'Unhandled test exception', false, err.message);
  } finally {
    // Clean up the test custom patient via Admin DELETE so we leave the store clean
    if (createdPatientId) {
      try {
        await page.evaluate(async ({ apiBase, pid }) => {
          const auth = await fetch(`${apiBase}/api/v1/auth/accept-terms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accepted: true, admin_key: 'ally-local-admin-2026' }),
          }).then(r => r.json());
          if (auth?.token) {
            await fetch(`${apiBase}/api/v1/patients/${pid}`, {
              method: 'DELETE',
              headers: { 'X-Ally-Token': auth.token, 'X-Ally-Admin-Key': 'ally-local-admin-2026' },
            });
          }
        }, { apiBase: API, pid: createdPatientId });
      } catch {
        // ignore cleanup error
      }
    }
    await browser.close();
  }

  const passed = checks.filter(c => c.pass).length;
  console.log(`\n${'═'.repeat(76)}`);
  console.log(`  SUMMARY: ${passed}/${checks.length} NEW USER ONBOARDING CHECKS PASSED`);
  console.log(`${'═'.repeat(76)}\n`);

  if (passed !== checks.length) {
    process.exit(1);
  }
})();
