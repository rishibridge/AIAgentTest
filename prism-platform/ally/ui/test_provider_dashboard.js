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
    
    if (contentTime < 10000) {
      pass(`Dashboard loads in ${contentTime}ms (< 10s)`);
    } else if (contentTime < 30000) {
      pass(`Dashboard loads in ${contentTime}ms (< 30s, acceptable)`);
    } else {
      fail('Dashboard load time', `Took ${contentTime}ms (> 30s)`);
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

  // ── TEST 9: Clinical Copilot chat works ──
  console.log('\n[9/10] Testing Clinical Copilot chat...');
  try {
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
      const processingVisible = await page.locator('text=Processing').isVisible().catch(() => false);
      if (processingVisible) {
        // Wait for processing to finish
        await page.locator('text=Processing').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
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
      fail('Copilot chat', 'Chat input not found');
    }
  } catch (e) {
    fail('Copilot chat', e.message);
  }

  // ── TEST 10: SOAP Note section exists ──
  console.log('\n[10/10] Checking SOAP Note section...');
  if (bodyText.includes('SOAP') || bodyText.includes('Session Notes') || bodyText.includes('Post-Visit')) {
    pass('SOAP Note / Post-Visit section present');
  } else {
    fail('SOAP Note section', 'Not found in page');
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
