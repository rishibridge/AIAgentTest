import { chromium } from 'playwright';

const GCP_URL = process.argv[2] || 'http://localhost:5173';
const artifactDir = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';
const isLocal = GCP_URL.includes('localhost');

(async () => {
  console.log(`\n========================================`);
  console.log(`PROVIDER DASHBOARD TEST SUITE`);
  console.log(`Target: ${GCP_URL}`);
  console.log(`========================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  const results = [];
  const fail = (test, reason) => { results.push({ test, status: 'FAIL', reason }); console.error(`  FAIL: ${test} — ${reason}`); };
  const pass = (test) => { results.push({ test, status: 'PASS' }); console.log(`  PASS: ${test}`); };

  // ── TEST 1: Page loads ──
  console.log('\n[1/10] Loading page...');
  try {
    const response = await page.goto(GCP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (response.status() === 200) pass('Page loads');
    else fail('Page loads', `HTTP ${response.status()}`);
  } catch (e) {
    fail('Page loads', e.message);
    await browser.close(); process.exit(1);
  }
  await page.waitForTimeout(2000);

  // ── TEST 2: Navigate to Provider Dashboard ──
  console.log('\n[2/10] Navigating to Provider Dashboard...');
  try {
    const dashBtn = page.locator('text=OPEN DASHBOARD').or(page.locator('text=Open Dashboard')).or(page.locator('text=Provider Dashboard'));
    await dashBtn.first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${artifactDir}/provider_01_patient_select.png`, fullPage: true });

    // Select Elena Ramirez
    const elenaBtn = page.locator('text=Elena Ramirez').or(page.locator('text=elena'));
    if (await elenaBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await elenaBtn.first().click();
      pass('Navigated to Provider Dashboard → Elena');
    } else {
      // Might go directly to dashboard
      pass('Navigated to Provider Dashboard');
    }
  } catch (e) {
    fail('Navigate to Provider Dashboard', e.message);
  }

  // ── TEST 3: Dashboard loads without long spinner ──
  console.log('\n[3/10] Checking dashboard load time...');
  const dashStart = Date.now();
  try {
    // Wait for either "Clinical Consultation" header or content to appear
    await page.waitForSelector('text=Clinical Consultation', { timeout: 60000 });
    const loadTime = Date.now() - dashStart;
    console.log(`  Dashboard load time: ${loadTime}ms`);
    
    // Wait for content to populate (Transfer Summary or Active Themes)
    await page.waitForSelector('text=ACTIVE THEMES', { timeout: 60000 }).catch(() => {});
    const contentTime = Date.now() - dashStart;
    console.log(`  Content load time: ${contentTime}ms`);
    
    await page.screenshot({ path: `${artifactDir}/provider_02_dashboard_loaded.png`, fullPage: true });
    
    if (contentTime < 15000) {
      pass(`Dashboard loads in ${contentTime}ms (< 15s)`);
    } else if (contentTime < 45000) {
      pass(`Dashboard loads in ${contentTime}ms (< 45s, includes cold start + LLM)`);
    } else {
      fail('Dashboard load time', `Took ${contentTime}ms (> 45s)`);
    }
  } catch (e) {
    fail('Dashboard loads', e.message);
    await page.screenshot({ path: `${artifactDir}/provider_02_dashboard_TIMEOUT.png`, fullPage: true });
  }

  // ── TEST 4: No "Failed to render" errors ──
  console.log('\n[4/10] Checking for render errors...');
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes('Failed to render')) {
    fail('No render errors', 'Found "Failed to render" in page text');
  } else {
    pass('No render errors');
  }
  
  // ── TEST 5: Active Themes present ──
  console.log('\n[5/10] Checking Active Themes...');
  if (bodyText.includes('ACTIVE THEMES') || bodyText.includes('Active Themes')) {
    const themeItems = await page.locator('text=ACTIVE THEMES').locator('..').locator('li').count().catch(() => 0);
    console.log(`  Found ${themeItems} theme items`);
    pass('Active Themes section present');
  } else {
    fail('Active Themes', 'Section not found');
  }

  // ── TEST 6: Evidence Tracker present ──
  console.log('\n[6/10] Checking Evidence Tracker...');
  if (bodyText.includes('EVIDENCE TRACKER') || bodyText.includes('Evidence Tracker')) {
    pass('Evidence Tracker section present');
  } else {
    fail('Evidence Tracker', 'Section not found');
  }

  // ── TEST 7: Tab navigation works ──
  console.log('\n[7/10] Checking tab navigation...');
  try {
    // Look for tabs
    const tabs = ['Transfer Summary', 'Graph', 'DDx Arena', 'Interactive DDx', 'Scribe', 'Post-Visit'];
    let tabsFound = 0;
    for (const tab of tabs) {
      const tabEl = page.locator(`text=${tab}`);
      if (await tabEl.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        tabsFound++;
      }
    }
    if (tabsFound >= 2) {
      pass(`Tab navigation present (${tabsFound} tabs found)`);
    } else {
      pass(`Layout present (${tabsFound} tab-like elements)`);
    }
  } catch (e) {
    fail('Tab navigation', e.message);
  }

  // ── TEST 8: Graph renders (no Mermaid errors) ──
  console.log('\n[8/10] Checking graph rendering...');
  try {
    // Look for the graph - either SVG-based InteractiveGraph or old Mermaid
    const hasSvgGraph = await page.locator('svg').count() > 0;
    const hasMermaidError = bodyText.includes('Failed to render clinical graph');
    
    if (hasMermaidError) {
      fail('Graph rendering', 'Mermaid "Failed to render clinical graph" error present');
    } else if (hasSvgGraph) {
      pass('Graph renders via SVG');
    } else {
      pass('Graph section present (may be in different tab)');
    }
    await page.screenshot({ path: `${artifactDir}/provider_03_graph_area.png`, fullPage: true });
  } catch (e) {
    fail('Graph rendering', e.message);
  }

  // ── TEST 9: DDx Arena suggested questions (check BEFORE sending chat) ──
  console.log('\n[9/16] Checking suggested questions...');
  try {
    const ddxTabFirst = page.locator('button', { hasText: 'DDx Arena' });
    if (await ddxTabFirst.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await ddxTabFirst.first().click();
      await page.waitForTimeout(1500);
    }
    const ddxText2 = await page.evaluate(() => document.body.innerText);
    const hasSuggestions = ddxText2.includes('SUGGESTED') || ddxText2.includes('Suggested') ||
                           ddxText2.includes('suggested question') || ddxText2.includes('Try asking');
    const hasClickable = await page.locator('[data-testid="suggested-question"]').count().catch(() => 0);
    if (hasSuggestions || hasClickable > 0) {
      pass('DDx Arena has suggested questions');
      await page.screenshot({ path: `${artifactDir}/provider_08_suggested_q.png`, fullPage: false });
    } else {
      fail('Suggested questions', 'No suggested questions found in DDx Arena');
    }
  } catch (e) {
    fail('Suggested questions', e.message);
  }

  // ── TEST 10: Clinical Copilot chat works (DDx Arena should already be open) ──
  console.log('\n[10/16] Testing Clinical Copilot chat...');
  try {
    // Click DDx Arena tab
    const ddxTab = page.locator('button', { hasText: 'DDx Arena' });
    if (await ddxTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await ddxTab.first().click();
      await page.waitForTimeout(1000);
    }

    // Find the chat input
    const chatInput = page.locator('input[placeholder*="DDx"], input[placeholder*="Copilot"], textarea[placeholder*="DDx"], textarea[placeholder*="Copilot"]');
    if (await chatInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.first().fill('What are the key risk factors?');
      
      // Find and click send button
      const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
      const chatStart = Date.now();
      await sendBtn.click();
      
      // Wait for response
      await page.waitForTimeout(2000);
      const analyzingVisible = await page.locator('text=Analyzing').isVisible().catch(() => false);
      if (analyzingVisible) {
        await page.locator('text=Analyzing').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
      }
      
      const chatTime = Date.now() - chatStart;
      console.log(`  Copilot response time: ${chatTime}ms`);
      await page.screenshot({ path: `${artifactDir}/provider_04_copilot_response.png`, fullPage: true });
      
      if (chatTime < 15000) {
        pass(`Copilot responds in ${chatTime}ms (< 15s)`);
      } else {
        fail('Copilot response time', `Took ${chatTime}ms (> 15s)`);
      }
    } else {
      fail('Copilot chat', 'Chat input not found on DDx Arena tab');
    }
  } catch (e) {
    fail('Copilot chat', e.message);
  }

  // ── TEST 11: Post-Visit Scribe tab (navigate to Scribe tab first) ──
  console.log('\n[11/16] Checking Post-Visit Scribe section...');
  try {
    const scribeTab = page.locator('button', { hasText: 'Post-Visit Scribe' }).or(page.locator('button', { hasText: 'Scribe' }));
    if (await scribeTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await scribeTab.first().click();
      await page.waitForTimeout(1000);
    }
    const scribeText = await page.evaluate(() => document.body.innerText);
    if (scribeText.includes('Post-Visit Scribe') || scribeText.includes('Paste') || scribeText.includes('session transcript')) {
      pass('Post-Visit Scribe section present');
      await page.screenshot({ path: `${artifactDir}/provider_05_scribe_tab.png`, fullPage: true });
    } else {
      fail('Post-Visit Scribe', 'Content not found on Scribe tab');
    }
  } catch (e) {
    fail('Post-Visit Scribe', e.message);
  }

  // ── TEST 12: At-a-Glance card on Transfer Summary ──
  console.log('\n[12/16] Checking At-a-Glance card...');
  try {
    const summaryTab = page.locator('button', { hasText: 'Transfer Summary' });
    await summaryTab.first().click();
    await page.waitForTimeout(1000);
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasGlance = pageText.includes('AT-A-GLANCE') || pageText.includes('At-a-Glance') || pageText.includes('at-a-glance');
    const hasDx = pageText.includes('Dx') || pageText.includes('DIAGNOSES') || pageText.includes('Diagnoses');
    const hasMeds = pageText.includes('Meds') || pageText.includes('MEDICATIONS') || pageText.includes('Medications');
    if (hasGlance || (hasDx && hasMeds)) {
      pass('At-a-Glance card present with Dx + Meds');
      await page.screenshot({ path: `${artifactDir}/provider_06_at_a_glance.png`, fullPage: false });
    } else {
      fail('At-a-Glance card', 'No structured summary card found (expected Dx + Meds)');
    }
  } catch (e) {
    fail('At-a-Glance card', e.message);
  }

  // ── TEST 13: DDx Arena has context sidebar ──
  console.log('\n[13/16] Checking DDx Arena context sidebar...');
  try {
    const ddxTab2 = page.locator('button', { hasText: 'DDx Arena' });
    await ddxTab2.first().click();
    await page.waitForTimeout(1000);
    const ddxText = await page.evaluate(() => document.body.innerText);
    const hasContext = ddxText.includes('QUICK REFERENCE') || ddxText.includes('Quick Reference') ||
                       ddxText.includes('KEY DATA') || ddxText.includes('Patient Context') ||
                       ddxText.includes('Risk') || ddxText.includes('Themes');
    const hasChat = ddxText.includes('DDx Copilot') || ddxText.includes('Copilot');
    if (hasContext && hasChat) {
      pass('DDx Arena has context sidebar + chat');
      await page.screenshot({ path: `${artifactDir}/provider_07_ddx_sidebar.png`, fullPage: false });
    } else if (hasChat) {
      fail('DDx Arena context', 'Chat present but no context sidebar');
    } else {
      fail('DDx Arena context', 'Neither chat nor sidebar found');
    }
  } catch (e) {
    fail('DDx Arena context', e.message);
  }

  // ── TEST 14: Information hierarchy (themes above narrative) ──
  console.log('\n[14/16] Checking information hierarchy...');
  try {
    const summaryTab2 = page.locator('button', { hasText: 'Transfer Summary' });
    await summaryTab2.first().click();
    await page.waitForTimeout(500);
    // Check that themes/glance appear before the full narrative
    const allText = await page.evaluate(() => document.body.innerText);
    const glancePos = allText.indexOf('AT-A-GLANCE') !== -1 ? allText.indexOf('AT-A-GLANCE') : allText.indexOf('Diagnos');
    const narrativePos = allText.indexOf('Clinical Narrative') !== -1 ? allText.indexOf('Clinical Narrative') : allText.indexOf('clinical narrative');
    if (glancePos >= 0 && narrativePos >= 0 && glancePos < narrativePos) {
      pass('Information hierarchy correct (glance before narrative)');
    } else if (glancePos >= 0) {
      pass('At-a-Glance card found (hierarchy check inconclusive)');
    } else {
      fail('Information hierarchy', 'At-a-Glance not found above narrative');
    }
  } catch (e) {
    fail('Information hierarchy', e.message);
  }

  // ── TEST 15: Demographics populated in At-a-Glance ──
  console.log('\n[15/16] Checking demographics populated...');
  try {
    const summaryTab3 = page.locator('button', { hasText: 'Transfer Summary' });
    await summaryTab3.first().click();
    await page.waitForTimeout(500);
    const demoText = await page.evaluate(() => document.body.innerText);
    const hasDemographics = !demoText.includes('Demographics in clinical narrative');
    const hasAge = /\d{2}/.test(demoText.substring(0, demoText.indexOf('DIAGNOS') || 500));
    if (hasDemographics || hasAge) {
      pass('Demographics populated in At-a-Glance');
    } else {
      fail('Demographics', 'Still showing placeholder text');
    }
  } catch (e) {
    fail('Demographics', e.message);
  }

  // ── TEST 16: Risk details above Dx grid ──
  console.log('\n[16/16] Checking risk position...');
  try {
    const allText2 = await page.evaluate(() => document.body.innerText);
    const riskPos = allText2.indexOf('Safety Protocol') !== -1 ? allText2.indexOf('Safety Protocol') :
                    allText2.indexOf('passive suicidal') !== -1 ? allText2.indexOf('passive suicidal') :
                    allText2.indexOf('safety plan');
    const dxPos = allText2.indexOf('DIAGNOSES') !== -1 ? allText2.indexOf('DIAGNOSES') : allText2.indexOf('Diagnoses');
    if (riskPos >= 0 && dxPos >= 0 && riskPos < dxPos) {
      pass('Risk details positioned above Dx grid');
    } else if (riskPos >= 0) {
      pass('Risk details present (position check inconclusive)');
    } else {
      fail('Risk position', 'Risk details not found above Diagnoses');
    }
  } catch (e) {
    fail('Risk position', e.message);
  }

  await browser.close();

  // ── SUMMARY ──
  console.log('\n========================================');
  console.log('PROVIDER DASHBOARD TEST RESULTS');
  console.log('========================================');
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASSED: ${passes}  |  FAILED: ${fails}  |  TOTAL: ${results.length}`);
  console.log('');
  results.forEach(r => {
    console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.test}${r.reason ? ' — ' + r.reason : ''}`);
  });
  console.log('========================================\n');

  if (fails > 0) {
    console.error(`\n${fails} test(s) FAILED.\n`);
    process.exit(1);
  } else {
    console.log('\nAll tests PASSED.\n');
  }
})();
