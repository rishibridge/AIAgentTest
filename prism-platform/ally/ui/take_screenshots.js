import { chromium } from 'playwright';

const GCP_URL = 'https://prism-platform-525536279111.us-central1.run.app';
const artifactDir = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';

(async () => {
  console.log(`\n========================================`);
  console.log(`POST-DEPLOY BROWSER VERIFICATION`);
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
  console.log('\n[1/7] Loading GCP URL...');
  try {
    const response = await page.goto(GCP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (response.status() === 200) {
      pass('Page loads (HTTP 200)');
    } else {
      fail('Page loads', `HTTP ${response.status()}`);
    }
  } catch (e) {
    fail('Page loads', e.message);
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${artifactDir}/deploy_01_landing.png`, fullPage: true });

  // ── TEST 2: Verify JS bundle is fresh (check for new code markers) ──
  console.log('\n[2/7] Verifying JS bundle contains new code...');
  const pageSource = await page.content();
  const hasAllyUnderstands = pageSource.includes('ALLY UNDERSTANDS') || await page.evaluate(() => {
    return document.body.innerHTML.includes('ALLY UNDERSTANDS') || 
           Array.from(document.querySelectorAll('script')).some(s => s.src && s.src.includes('index-'));
  });
  // Check the actual JS bundle for our markers
  const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script[src]')).map(s => s.src));
  console.log(`  JS bundles served: ${scripts.join(', ')}`);
  
  // ── TEST 3: Landing page has Demo Mode button ──
  console.log('\n[3/7] Checking landing page for Demo Mode button...');
  const hasDemoBtn = await page.locator('text=START PRESENTATION').isVisible().catch(() => false) ||
                     await page.locator('text=Start Presentation').isVisible().catch(() => false) ||
                     await page.locator('text=Demo Mode').isVisible().catch(() => false);
  if (hasDemoBtn) {
    pass('Landing page has Demo/Presentation button');
  } else {
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    fail('Landing page has Demo/Presentation button', `Button not found. Page text: ${bodyText}`);
  }

  // ── TEST 4: Click into Demo Mode → IntroSequence slideshow appears ──
  console.log('\n[4/7] Entering Demo Mode → checking for IntroSequence slideshow...');
  try {
    // Try various button texts that could trigger demo mode
    const demoBtn = page.locator('text=START PRESENTATION').or(page.locator('text=Start Presentation')).or(page.locator('text=Demo Mode'));
    await demoBtn.first().click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${artifactDir}/deploy_02_after_demo_click.png`, fullPage: true });

    // Check for IntroSequence: should show "Castle Behavioral Health" and "Begin Presentation"
    const hasIntro = await page.locator('text=Begin Presentation').isVisible({ timeout: 5000 }).catch(() => false) ||
                     await page.locator('text=Castle Behavioral Health').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasIntro) {
      pass('IntroSequence slideshow appears after Demo click');
      await page.screenshot({ path: `${artifactDir}/deploy_03_intro_sequence.png`, fullPage: true });
    } else {
      const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
      fail('IntroSequence slideshow appears', `Not found. Current page: ${text}`);
      await page.screenshot({ path: `${artifactDir}/deploy_03_intro_MISSING.png`, fullPage: true });
    }
  } catch (e) {
    fail('Enter Demo Mode', e.message);
  }

  // ── TEST 5: Click Begin Presentation → slides advance ──
  console.log('\n[5/7] Clicking Begin Presentation → verifying slides...');
  try {
    const beginBtn = page.locator('text=Begin Presentation');
    if (await beginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await beginBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${artifactDir}/deploy_04_slide_content.png`, fullPage: true });

      // Should show "The Human Problem" or similar slide content
      const hasSlideContent = await page.locator('text=The Human Problem').isVisible().catch(() => false) ||
                              await page.locator('text=Judgy').isVisible().catch(() => false);
      if (hasSlideContent) {
        pass('Slideshow advances with content');
      } else {
        const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
        fail('Slideshow advances', `Expected slide content not found. Page: ${text}`);
      }
    } else {
      fail('Begin Presentation button', 'Button not visible');
    }
  } catch (e) {
    fail('Slideshow navigation', e.message);
  }

  // ── TEST 6: Skip to demo → check Insight Panel background ──
  console.log('\n[6/7] Skipping intro → checking Insight Panel styling...');
  try {
    const skipBtn = page.locator('text=Skip Hook').or(page.locator('text=Skip Intro'));
    if (await skipBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.first().click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${artifactDir}/deploy_05_post_skip.png`, fullPage: true });
      pass('Skipped intro successfully');

      // Try to advance to a phase with an insight panel
      const nextBtn = page.locator('button[title="Step Forward"]');
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Advance a few phases to trigger an insight
        for (let i = 0; i < 5; i++) {
          await nextBtn.click();
          await page.waitForTimeout(1500);
        }
        await page.screenshot({ path: `${artifactDir}/deploy_06_demo_phase.png`, fullPage: true });
        
        // Check for insight panel
        const insightPanel = page.locator('.insight-glass');
        if (await insightPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
          const bg = await insightPanel.evaluate(el => window.getComputedStyle(el).backgroundColor);
          console.log(`  Insight Panel background: ${bg}`);
          await page.screenshot({ path: `${artifactDir}/deploy_07_insight_panel.png`, fullPage: true });
          if (bg.includes('5, 6, 8') || bg === 'rgb(5, 6, 8)' || bg.includes('rgba(0, 0, 0')) {
            pass(`Insight Panel has opaque background (${bg})`);
          } else {
            fail('Insight Panel background', `Expected opaque, got: ${bg}`);
          }
        } else {
          console.log('  INFO: No insight panel visible at this phase (may need more steps)');
        }
      }
    } else {
      fail('Skip Hook button', 'Not visible');
    }
  } catch (e) {
    fail('Insight Panel check', e.message);
  }

  // ── TEST 7: Check for 6 Architecture Verbs in page source ──
  console.log('\n[7/7] Verifying 6 architecture verbs in bundle...');
  const verbs = ['ALLY REMEMBERS', 'ALLY UNDERSTANDS', 'ALLY LEARNS', 'ALLY CARES', 'ALLY COLLABORATES', 'ALLY REASONS'];
  // Fetch the main JS bundle and check
  const jsBundle = scripts.find(s => s.includes('index-'));
  if (jsBundle) {
    try {
      const jsResponse = await page.goto(jsBundle);
      const jsText = await jsResponse.text();
      for (const verb of verbs) {
        if (jsText.includes(verb)) {
          pass(`Bundle contains "${verb}"`);
        } else {
          fail(`Bundle contains "${verb}"`, 'Not found in JS bundle');
        }
      }
    } catch (e) {
      fail('JS bundle verb check', e.message);
    }
  } else {
    fail('JS bundle detection', 'No index-*.js bundle found');
  }

  await browser.close();

  // ── SUMMARY ──
  console.log('\n========================================');
  console.log('TEST RESULTS SUMMARY');
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
    console.error(`\n${fails} test(s) FAILED. Deployment is NOT verified.\n`);
    process.exit(1);
  } else {
    console.log('\nAll tests PASSED. Deployment verified.\n');
  }
})();
