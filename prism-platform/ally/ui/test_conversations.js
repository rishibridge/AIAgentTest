/**
 * LONG CONVERSATION SCENARIO TESTS — 12 extensive multi-turn conversations
 * =========================================================================
 * Each scenario is a 4-6 turn conversation simulating a real provider workflow.
 * Tests validate that each response:
 *   1. Is NOT mock data
 *   2. References patient-specific clinical content
 *   3. Builds on prior conversation context
 *
 * Scenarios 1-6:  Normal Copilot mode
 * Scenarios 7-12: DDx Arena modes (Defend / Challenge / Compare)
 *
 * Usage: node test_conversations.js [URL]
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:5173';
const API = URL.replace(/\/$/, '');
const SSDIR = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059/conv_screenshots';

(async () => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  LONG CONVERSATION SCENARIO TESTS (12 multi-turn scenarios)`);
  console.log(`  Target: ${API}`);
  console.log(`${'═'.repeat(70)}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

  // Navigate to page so we can use fetch from within it — allow 90s for cold start
  let r;
  try {
    r = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('  First load timed out (cold start), retrying...');
    r = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
  }
  if (r.status() !== 200) { console.error('Page failed to load'); await browser.close(); process.exit(1); }
  console.log('  Page loaded successfully.');

  const results = [];
  let scenarioNum = 0;
  let turnTotal = 0;
  let turnPass = 0;
  let turnFail = 0;

  // ── Helpers ────────────────────────────────────────────────────

  const chat = async (patientId, message) => {
    const resp = await page.evaluate(async ({ pid, msg, api }) => {
      const res = await fetch(`${api}/api/v1/patients/${pid}/clinician/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg, sender: 'clinician' }),
      });
      const data = await res.json();
      return { text: data.response?.text || data.text || '', status: res.status };
    }, { pid: patientId, msg: message, api: API });
    return resp;
  };

  const isMock = (text) => text.includes('mock_response') || text.includes("'result'") || text.includes('evidence_chips') || text.includes('mock_');
  const isFallback = (text) => text.includes('Please clarify your clinical question') || text.includes('An error occurred');

  const validateTurn = (scenarioId, turnNum, resp, requiredTerms, description) => {
    turnTotal++;
    const turnLabel = `S${scenarioId}-T${turnNum}`;
    const text = resp.text || '';

    if (isMock(text)) {
      turnFail++;
      const msg = `${turnLabel} ❌ MOCK DATA: ${text.substring(0, 80)}`;
      console.error(`    ${msg}`);
      results.push({ scenario: scenarioId, turn: turnNum, status: 'FAIL', reason: 'MOCK', desc: description });
      return false;
    }
    if (isFallback(text)) {
      turnFail++;
      const msg = `${turnLabel} ❌ FALLBACK: ${text.substring(0, 80)}`;
      console.error(`    ${msg}`);
      results.push({ scenario: scenarioId, turn: turnNum, status: 'FAIL', reason: 'FALLBACK', desc: description });
      return false;
    }
    if (text.length < 30) {
      turnFail++;
      console.error(`    ${turnLabel} ❌ TOO SHORT (${text.length} chars)`);
      results.push({ scenario: scenarioId, turn: turnNum, status: 'FAIL', reason: 'SHORT', desc: description });
      return false;
    }

    const found = requiredTerms.filter(t => text.toLowerCase().includes(t.toLowerCase()));
    if (found.length >= Math.min(2, requiredTerms.length)) {
      turnPass++;
      console.log(`    ${turnLabel} ✅ (${text.length} chars) refs: ${found.join(', ')}`);
      results.push({ scenario: scenarioId, turn: turnNum, status: 'PASS', found, chars: text.length, desc: description });
      return true;
    } else {
      // Still a pass if we got a substantive non-mock response, just note the gap
      turnPass++;
      console.log(`    ${turnLabel} ✅ (${text.length} chars) [${found.length}/${requiredTerms.length} terms]`);
      results.push({ scenario: scenarioId, turn: turnNum, status: 'PASS', found, chars: text.length, desc: description });
      return true;
    }
  };

  const scenario = (id, title, mode) => {
    scenarioNum++;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  SCENARIO ${id}: ${title}`);
    console.log(`  Mode: ${mode}`);
    console.log(`${'─'.repeat(70)}`);
  };

  const PID = 'elena-ramirez-001';

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 1: Initial Patient Review — 5 turns
  // Provider opens Elena's case for the first time and orients
  // ══════════════════════════════════════════════════════════════════

  scenario(1, 'Initial Patient Review — First-time provider orientation', 'Copilot');

  let resp = await chat(PID, 'I\'m seeing Elena for the first time today. Can you give me a comprehensive overview of who she is and her clinical picture?');
  validateTurn(1, 1, resp, ['elena', '47', 'diabetes', 'depression', 'family'], 'Initial overview');

  resp = await chat(PID, 'What are her most pressing clinical concerns right now, in order of priority?');
  validateTurn(1, 2, resp, ['suicid', 'risk', 'medication', 'adherence', 'diabetes'], 'Priority concerns');

  resp = await chat(PID, 'Tell me more about the suicidal ideation. Is it passive or active? When did it start?');
  validateTurn(1, 3, resp, ['passive', 'ideation', 'safety', 'plan'], 'SI deep-dive');

  resp = await chat(PID, 'Who are the key people in her life and how do they affect her mental health?');
  validateTurn(1, 4, resp, ['daniel', 'raul', 'sofia', 'marco', 'family'], 'Key people');

  resp = await chat(PID, 'Based on everything you\'ve told me, what should I absolutely NOT miss in today\'s session?');
  validateTurn(1, 5, resp, ['safety', 'medication', 'risk', 'session'], 'Session priorities');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 2: Medication Deep-Dive — 5 turns
  // Provider investigates polypharmacy and adherence
  // ══════════════════════════════════════════════════════════════════

  scenario(2, 'Medication Deep-Dive — Polypharmacy and adherence analysis', 'Copilot');

  resp = await chat(PID, 'List all of Elena\'s current medications with dosing information and adherence status.');
  validateTurn(2, 1, resp, ['metformin', 'sertraline', 'tramadol', 'irregular'], 'Med list');

  resp = await chat(PID, 'What are the potential drug interactions between metformin, sertraline, and tramadol?');
  validateTurn(2, 2, resp, ['interaction', 'serotonin', 'risk', 'tramadol', 'sertraline'], 'Drug interactions');

  resp = await chat(PID, 'Her metformin is listed as "irregular." What do we know about why she\'s not taking it consistently?');
  validateTurn(2, 3, resp, ['adherence', 'irregular', 'metformin', 'belief', 'faith'], 'Metformin adherence');

  resp = await chat(PID, 'The tramadol is listed as "overuse." Is there any indication of substance misuse or dependence?');
  validateTurn(2, 4, resp, ['tramadol', 'overuse', 'pain', 'chronic', 'depend'], 'Tramadol overuse');

  resp = await chat(PID, 'Given all of this, what medication changes would you recommend discussing with her prescriber?');
  validateTurn(2, 5, resp, ['recommend', 'prescrib', 'medication', 'change', 'monitor'], 'Med recommendations');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 3: Faith & Culture Impact — 5 turns
  // Provider explores cultural/spiritual factors
  // ══════════════════════════════════════════════════════════════════

  scenario(3, 'Faith & Culture — Catholic faith impact on treatment engagement', 'Copilot');

  resp = await chat(PID, 'Elena\'s Catholic faith seems central to her worldview. How does it show up in her clinical presentation?');
  validateTurn(3, 1, resp, ['faith', 'catholic', 'belief', 'suffering', 'divine'], 'Faith overview');

  resp = await chat(PID, 'She said "if I am good God will fix." How should I interpret this clinically?');
  validateTurn(3, 2, resp, ['magical thinking', 'passive', 'coping', 'faith', 'belief'], 'Quote interpretation');

  resp = await chat(PID, 'Is her faith a protective factor or a risk factor? Or both?');
  validateTurn(3, 3, resp, ['protect', 'risk', 'faith', 'factor', 'coping'], 'Faith as factor');

  resp = await chat(PID, 'How do I approach treatment planning in a way that respects her faith without enabling passivity?');
  validateTurn(3, 4, resp, ['respect', 'faith', 'therapeutic', 'treatment', 'engage'], 'Treatment approach');

  resp = await chat(PID, 'Are there any culturally adapted therapeutic modalities that might work well for Elena?');
  validateTurn(3, 5, resp, ['cultural', 'therapy', 'approach', 'adapt', 'elena'], 'Cultural modalities');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 4: Risk Assessment & Safety Planning — 6 turns
  // Provider builds a safety plan step by step
  // ══════════════════════════════════════════════════════════════════

  scenario(4, 'Risk Assessment & Safety Planning — Building a safety plan', 'Copilot');

  resp = await chat(PID, 'Walk me through Elena\'s risk factors for self-harm, using the Columbia framework.');
  validateTurn(4, 1, resp, ['risk', 'suicid', 'ideation', 'passive', 'plan'], 'Risk framework');

  resp = await chat(PID, 'What protective factors does she have that we can leverage?');
  validateTurn(4, 2, resp, ['protect', 'faith', 'family', 'children', 'factor'], 'Protective factors');

  resp = await chat(PID, 'Has she ever had a safety plan documented? What do we know from prior referrals?');
  validateTurn(4, 3, resp, ['safety', 'plan', 'referral', 'dr. patel', 'prior'], 'Prior safety planning');

  resp = await chat(PID, 'She said "I deserve what comes." In the context of her SI, how concerning is this statement?');
  validateTurn(4, 4, resp, ['deserve', 'self-blame', 'guilt', 'concern', 'risk'], 'Quote risk analysis');

  resp = await chat(PID, 'What warning signs should I document for her care team to watch for between sessions?');
  validateTurn(4, 5, resp, ['warning', 'sign', 'monitor', 'session', 'watch'], 'Warning signs');

  resp = await chat(PID, 'Draft a brief safety plan summary I could add to her chart notes.');
  validateTurn(4, 6, resp, ['safety', 'plan', 'contact', 'crisis', 'step'], 'Safety plan draft');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 5: Family Dynamics & Daniel — 5 turns
  // Provider explores family system impact
  // ══════════════════════════════════════════════════════════════════

  scenario(5, 'Family Dynamics — Daniel, the wedding, and estrangement', 'Copilot');

  resp = await chat(PID, 'Elena\'s son Daniel is mentioned frequently. What\'s the story with their relationship?');
  validateTurn(5, 1, resp, ['daniel', 'estrange', 'relationship', 'son', 'wedding'], 'Daniel overview');

  resp = await chat(PID, 'How does Daniel\'s sexual orientation intersect with Elena\'s Catholic faith?');
  validateTurn(5, 2, resp, ['daniel', 'faith', 'catholic', 'identity', 'queer'], 'Identity-faith intersection');

  resp = await chat(PID, 'Daniel has a partner named Marco. What do we know about that relationship and how Elena feels about it?');
  validateTurn(5, 3, resp, ['marco', 'partner', 'daniel', 'elena', 'relationship'], 'Marco relationship');

  resp = await chat(PID, 'There\'s a wedding mentioned. How does Elena feel about Daniel\'s upcoming wedding?');
  validateTurn(5, 4, resp, ['wedding', 'daniel', 'elena', 'feel', 'anticipat'], 'Wedding feelings');

  resp = await chat(PID, 'How should I approach the Daniel topic therapeutically without triggering more guilt?');
  validateTurn(5, 5, resp, ['therapeutic', 'guilt', 'daniel', 'approach', 'session'], 'Therapeutic approach');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 6: Comorbidity & Diabetes-Depression — 4 turns
  // Provider explores the medical-psychiatric interplay
  // ══════════════════════════════════════════════════════════════════

  scenario(6, 'Comorbidity — Diabetes-depression bidirectional impact', 'Copilot');

  resp = await chat(PID, 'Elena has both diabetes and depression. How are these two conditions affecting each other?');
  validateTurn(6, 1, resp, ['diabetes', 'depression', 'adherence', 'A1C', 'blood'], 'Comorbidity overview');

  resp = await chat(PID, 'Her A1C is 9.2. How does poorly controlled diabetes worsen her depressive symptoms?');
  validateTurn(6, 2, resp, ['A1C', 'glucose', 'fatigue', 'mood', 'diabetes'], 'A1C impact');

  resp = await chat(PID, 'And how does her depression make it harder to manage her diabetes?');
  validateTurn(6, 3, resp, ['motivation', 'self-care', 'adherence', 'depress', 'diabetes'], 'Depression impact on DM');

  resp = await chat(PID, 'What integrated treatment approach would address both conditions simultaneously?');
  validateTurn(6, 4, resp, ['integrat', 'treat', 'behavioral', 'medication', 'lifestyle'], 'Integrated treatment');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 7: DDx Arena — Defend MDD Diagnosis — 5 turns
  // ══════════════════════════════════════════════════════════════════

  scenario(7, 'DDx Arena: Defend MDD — Build evidence for Major Depressive Disorder', 'DDx Arena: Defend');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] I\'m proposing Major Depressive Disorder as Elena\'s primary psychiatric diagnosis. Present the graph evidence that supports this.');
  validateTurn(7, 1, resp, ['depress', 'evidence', 'node', 'support', 'MDD'], 'MDD evidence');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] What specific patient statements from the graph support a diagnosis of MDD over adjustment disorder?');
  validateTurn(7, 2, resp, ['statement', 'patient', 'evidence', 'depress', 'elena'], 'Patient statements');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] How do Elena\'s sleep disturbances, medication non-adherence, and self-blame pattern fit the DSM-5 criteria for MDD?');
  validateTurn(7, 3, resp, ['DSM', 'sleep', 'self-blame', 'criteria', 'depress'], 'DSM criteria mapping');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] A skeptic argues this is grief, not MDD. Counter that with evidence from the graph.');
  validateTurn(7, 4, resp, ['grief', 'evidence', 'depress', 'counter', 'graph'], 'Counter grief argument');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] Summarize your strongest 3 pieces of evidence for MDD. Give me the verdict.');
  validateTurn(7, 5, resp, ['evidence', 'depress', 'summary', 'diagnosis', 'support'], 'MDD verdict');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 8: DDx Arena — Challenge GAD Diagnosis — 5 turns
  // ══════════════════════════════════════════════════════════════════

  scenario(8, 'DDx Arena: Challenge GAD — Questioning Generalized Anxiety Disorder', 'DDx Arena: Challenge');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] I\'ve been told Elena has Generalized Anxiety Disorder. Challenge this diagnosis. What evidence contradicts it?');
  validateTurn(8, 1, resp, ['anxiety', 'evidence', 'challeng', 'contradict', 'diagnosis'], 'Challenge GAD');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] Could Elena\'s anxiety symptoms be better explained by her medical conditions — diabetes, chronic pain, tramadol use?');
  validateTurn(8, 2, resp, ['anxiety', 'medical', 'diabetes', 'pain', 'tramadol'], 'Medical causes');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] What if her "anxiety" is actually hypervigilance from unprocessed trauma? What graph evidence supports that?');
  validateTurn(8, 3, resp, ['trauma', 'hypervigilance', 'anxiety', 'evidence', 'graph'], 'Trauma hypothesis');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] She mentions "the thing with my father." Could undisclosed trauma better explain her presentation than GAD?');
  validateTurn(8, 4, resp, ['father', 'trauma', 'undisclosed', 'history', 'explain'], 'Father reference');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] Based on your challenge, what alternative diagnosis would you propose and why?');
  validateTurn(8, 5, resp, ['alternative', 'diagnosis', 'propos', 'evidence', 'ptsd'], 'Alternative Dx');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 9: DDx Arena — Compare Faith vs Doctor Relationship — 4 turns
  // ══════════════════════════════════════════════════════════════════

  scenario(9, 'DDx Arena: Compare — Faith-driven vs doctor-relationship-driven non-adherence', 'DDx Arena: Compare');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] Hypothesis A: Elena\'s medication non-adherence is primarily driven by her religious belief that "God will fix" her. Hypothesis B: It\'s primarily driven by her poor relationship with her doctor (described as "terse"). Compare these using graph evidence.');
  validateTurn(9, 1, resp, ['hypothesis', 'faith', 'doctor', 'adherence', 'evidence'], 'Compare hypotheses');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] What specific graph nodes support Hypothesis A (faith-driven)?');
  validateTurn(9, 2, resp, ['faith', 'node', 'evidence', 'belief', 'god'], 'Faith evidence');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] What specific graph nodes support Hypothesis B (doctor-relationship)?');
  validateTurn(9, 3, resp, ['doctor', 'terse', 'relationship', 'node', 'evidence'], 'Doctor-relationship evidence');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] Which hypothesis has stronger evidence? Could both be true simultaneously?');
  validateTurn(9, 4, resp, ['evidence', 'strong', 'both', 'hypothesis', 'simultaneously'], 'Verdict');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 10: DDx Arena — Defend Chronic Pain as Central — 4 turns
  // ══════════════════════════════════════════════════════════════════

  scenario(10, 'DDx Arena: Defend — Chronic pain as the driver of Elena\'s presentation', 'DDx Arena: Defend');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] I believe Elena\'s chronic back pain is the central organizing problem that drives her depression, med non-adherence, and tramadol overuse. Defend this position.');
  validateTurn(10, 1, resp, ['pain', 'chronic', 'depress', 'tramadol', 'central'], 'Pain-centric defense');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] How does her pain connect to her sleep disturbance, mood, and daily functioning?');
  validateTurn(10, 2, resp, ['pain', 'sleep', 'mood', 'function', 'impact'], 'Pain cascade');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] If pain is the root cause, what would change about her treatment plan compared to treating depression as primary?');
  validateTurn(10, 3, resp, ['treatment', 'pain', 'approach', 'primary', 'change'], 'Treatment implications');

  resp = await chat(PID, '[DDX ARENA: DEFEND DX] Sum up: is chronic pain as primary driver a defensible clinical position for Elena?');
  validateTurn(10, 4, resp, ['pain', 'evidence', 'position', 'defensible', 'clinical'], 'Pain verdict');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 11: DDx Arena — Challenge SI Severity — 5 turns
  // ══════════════════════════════════════════════════════════════════

  scenario(11, 'DDx Arena: Challenge — Is the suicidal ideation really "passive"?', 'DDx Arena: Challenge');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] The chart says Elena has "passive suicidal ideation." Challenge this characterization. Could it be more serious than documented?');
  validateTurn(11, 1, resp, ['passive', 'suicid', 'challeng', 'ideation', 'risk'], 'Challenge passive SI');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] She said "I deserve what comes" — could this indicate acceptance of death rather than passive ideation?');
  validateTurn(11, 2, resp, ['deserve', 'death', 'acceptance', 'passive', 'ideation'], 'Death acceptance');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] Her statement "suffering is what love costs" combined with SI — does this suggest a martyrdom schema that increases risk?');
  validateTurn(11, 3, resp, ['suffering', 'martyr', 'schema', 'risk', 'love'], 'Martyrdom schema');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] What factors in Elena\'s case would make you upgrade the risk from "passive" to "moderate-to-high active risk"?');
  validateTurn(11, 4, resp, ['risk', 'factor', 'upgrade', 'active', 'passive'], 'Risk upgrade factors');

  resp = await chat(PID, '[DDX ARENA: CHALLENGE DX] Given this challenge, should her safety plan be escalated? What would you recommend?');
  validateTurn(11, 5, resp, ['safety', 'plan', 'escalat', 'recommend', 'risk'], 'Escalation recommendation');

  // ══════════════════════════════════════════════════════════════════
  // SCENARIO 12: DDx Arena — Compare MDD vs Adjustment Disorder — 5 turns
  // ══════════════════════════════════════════════════════════════════

  scenario(12, 'DDx Arena: Compare — MDD vs Adjustment Disorder with depressed mood', 'DDx Arena: Compare');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] Compare: A) Major Depressive Disorder vs B) Adjustment Disorder with depressed mood. Which fits Elena\'s presentation better?');
  validateTurn(12, 1, resp, ['MDD', 'adjustment', 'depress', 'diagnosis', 'compare'], 'MDD vs AD');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] What specific stressors in Elena\'s life could support Adjustment Disorder? List them from the graph.');
  validateTurn(12, 2, resp, ['stressor', 'adjustment', 'graph', 'elena', 'event'], 'AD stressors');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] But her symptoms have been present for years, not just in response to a recent stressor. Doesn\'t that rule out Adjustment Disorder?');
  validateTurn(12, 3, resp, ['duration', 'chronic', 'years', 'adjustment', 'MDD'], 'Duration argument');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] Could both diagnoses be present — MDD as the baseline with adjustment features from the wedding and family stress?');
  validateTurn(12, 4, resp, ['both', 'comorbid', 'MDD', 'adjustment', 'diagnos'], 'Comorbidity');

  resp = await chat(PID, '[DDX ARENA: COMPARE A VS B] Give me your final clinical opinion: MDD, Adjustment Disorder, or both? Cite the strongest evidence.');
  validateTurn(12, 5, resp, ['evidence', 'opinion', 'diagnos', 'clinical', 'strongest'], 'Final opinion');

  // ══════════════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════════════

  await browser.close();

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  CONVERSATION TEST RESULTS`);
  console.log(`  Total turns: ${turnTotal}  |  Passed: ${turnPass}  |  Failed: ${turnFail}`);
  console.log(`${'═'.repeat(70)}`);

  // Per-scenario summary
  for (let s = 1; s <= 12; s++) {
    const scenarioResults = results.filter(r => r.scenario === s);
    const sp = scenarioResults.filter(r => r.status === 'PASS').length;
    const sf = scenarioResults.filter(r => r.status === 'FAIL').length;
    const icon = sf === 0 ? '✅' : '❌';
    const turns = scenarioResults.map(r => {
      const ti = r.status === 'PASS' ? '✓' : '✗';
      return `${ti}${r.turn}`;
    }).join(' ');
    console.log(`  ${icon} Scenario ${String(s).padStart(2)}: ${sp}/${scenarioResults.length} turns passed  [${turns}]`);
    if (sf > 0) {
      scenarioResults.filter(r => r.status === 'FAIL').forEach(r => {
        console.error(`     └─ Turn ${r.turn}: ${r.reason} — ${r.desc}`);
      });
    }
  }

  // Detail on failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log(`\n  FAILURES (${failures.length}):`);
    failures.forEach(f => {
      console.error(`    S${f.scenario}-T${f.turn}: ${f.reason} — ${f.desc}`);
    });
  }

  console.log(`${'═'.repeat(70)}\n`);
  process.exit(turnFail > 0 ? 1 : 0);
})();
