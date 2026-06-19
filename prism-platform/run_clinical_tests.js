const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const testCases = [
  {
    patient: 'Elena Ramirez',
    mode: 'Defend a Diagnosis',
    input: 'I suspect MDD with psychotic features based on her isolation. Rule it out using graph evidence.',
    name: 'test_01_elena_mdd_psychotic'
  },
  {
    patient: 'Elena Ramirez',
    mode: 'Challenge a Diagnosis',
    input: 'The primary issue is generalized anxiety, not depression. Prove me wrong using her direct quotes.',
    name: 'test_02_elena_gad_vs_mdd'
  },
  {
    patient: 'Elena Ramirez',
    mode: 'Compare A vs B',
    input: 'Compare Major Depressive Disorder versus Adjustment Disorder with Depressed Mood for this patient.',
    name: 'test_03_elena_mdd_vs_adjustment'
  },
  {
    patient: 'Elena Ramirez',
    mode: 'Copilot Mode',
    input: 'Summarize Elena compliance with her Metformin and Sertraline regimen based on the notes.',
    name: 'test_04_elena_med_compliance'
  },
  {
    patient: 'Elena Ramirez',
    mode: 'Defend a Diagnosis',
    input: 'I am diagnosing her with substance use disorder. Rule it out based on the graph.',
    name: 'test_05_elena_sud'
  },
  {
    patient: 'Elena Ramirez',
    mode: 'Compare A vs B',
    input: 'Compare Diabetic Neuropathy vs Sciatica for her chronic back pain.',
    name: 'test_06_elena_neuropathy_vs_sciatica'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Defend a Diagnosis',
    input: 'I believe Daniel has Generalized Anxiety Disorder, not OCD. Rule it out.',
    name: 'test_07_daniel_gad_vs_ocd'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Challenge a Diagnosis',
    input: 'You suggested caregiver burnout. Defend that using his relationship data with Marco.',
    name: 'test_08_daniel_caregiver_burnout'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Compare A vs B',
    input: 'Compare Obsessive-Compulsive Personality Disorder versus Obsessive-Compulsive Disorder for Daniel.',
    name: 'test_09_daniel_ocpd_vs_ocd'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Copilot Mode',
    input: 'What are the key risk factors for Daniel right now?',
    name: 'test_10_daniel_risk_factors'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Defend a Diagnosis',
    input: 'I think Daniel is at imminent risk for self-harm. Rule it out.',
    name: 'test_11_daniel_self_harm'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Copilot Mode',
    input: 'Generate a 3-step treatment plan focusing on his immediate stressors.',
    name: 'test_12_daniel_treatment_plan'
  },
  {
    patient: 'Daniel Ramirez',
    mode: 'Post-Visit Scribe', // Not a button, but used to flag the test script logic
    input: 'Transcript of session 4: Daniel reported feeling overwhelmed by Marco\'s behavior this week. We discussed using a time-out strategy.',
    name: 'test_13_daniel_post_visit_scribe'
  }
];

(async () => {
  const artifactDir = 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\3b03917f-6614-4476-a5db-517ccfe72059\\';
  const results = [];

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  try {
    let currentPatient = null;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      console.log(`\nExecuting Test ${i + 1}/12: ${tc.name}`);

      if (currentPatient !== tc.patient) {
        console.log(`Navigating to Hub to select ${tc.patient}...`);
        await page.goto('http://localhost:5173');
        await page.waitForTimeout(1000);
        await page.click('text="Provider Dashboard"');
        await page.waitForTimeout(1000);
        await page.click(`text="${tc.patient}"`);
        
        console.log("Waiting for Clinical Profile to load (synthesizing graph)...");
        await page.waitForSelector('text=Demographics', { timeout: 15000 });
        await page.waitForTimeout(2000); // let graph render
        currentPatient = tc.patient;
      }

      console.log(`Setting Mode: [${tc.mode}]`);
      if (tc.mode === 'Post-Visit Scribe') {
        await page.click('text="Post-Visit Scribe"');
        await page.waitForTimeout(500);
        
        console.log(`Pasting transcript: "${tc.input}"`);
        await page.fill('textarea[placeholder="Paste session transcript here..."]', tc.input);
        await page.click('text="Generate Session Notes & Consolidate"');
        
        console.log("Waiting for Post-Visit Scribe response...");
        await page.waitForSelector('text="Generated Session Notes"', { timeout: 60000 });
        await page.waitForTimeout(2000); // Wait for rendering
      } else {
        await page.click('text="Interactive DDx"');
        await page.waitForTimeout(500);
        if (tc.mode !== 'Copilot Mode') {
          await page.click(`text="[${tc.mode}]"`);
        } else {
          await page.click('text="Copilot Mode"');
        }
        await page.waitForTimeout(500);

        console.log(`Typing prompt: "${tc.input}"`);
        await page.fill('input[placeholder="Message the DDx Copilot..."]', tc.input);
        await page.keyboard.press('Enter');

        console.log("Waiting for LLM response...");
        const msgsBefore = await page.$$eval('div.fade-enter-active', els => els.length);
        await page.waitForFunction((beforeCount) => {
          const els = document.querySelectorAll('div.fade-enter-active');
          return els.length > beforeCount;
        }, msgsBefore, { timeout: 60000 });
        await page.waitForTimeout(2000);
      }

      const screenshotPath = path.join(artifactDir, `${tc.name}.png`);
      console.log(`Saving screenshot to ${screenshotPath}`);
      await page.screenshot({ path: screenshotPath });

      results.push({ ...tc, screenshot: `${tc.name}.png` });
    }

    fs.writeFileSync(path.join(artifactDir, 'clinical_test_results.json'), JSON.stringify(results, null, 2));
    console.log("All 12 clinical tests completed successfully.");

  } catch (err) {
    console.error("Test execution failed:", err);
    await page.screenshot({ path: path.join(artifactDir, 'error_state_clinical.png') });
  } finally {
    await browser.close();
  }
})();
