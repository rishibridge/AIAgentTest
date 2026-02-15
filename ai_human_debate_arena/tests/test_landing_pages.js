const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Test 1: Main landing page
  console.log('Testing main landing page...');
  await page.goto('http://127.0.0.1:8081/landing');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('  → Taking screenshot: landing-main.png');
  await page.screenshot({ path: 'landing-main.png', fullPage: true });

  // Test 2: Debater landing page
  console.log('Testing debater landing page...');
  await page.goto('http://127.0.0.1:8081/debaters');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('  → Taking screenshot: landing-debaters.png');
  await page.screenshot({ path: 'landing-debaters.png', fullPage: true });

  // Test 3: Verify Practice feature is mentioned
  const practiceText = await page.textContent('body');
  const hasPracticeFeature = practiceText.includes('Practice with') && practiceText.includes('case');

  console.log('\n✅ Test Results:');
  console.log(`  - Main landing page: Captured`);
  console.log(`  - Debater landing page: Captured`);
  console.log(`  - Practice feature mentioned: ${hasPracticeFeature ? '✓ YES' : '✗ NO'}`);

  console.log('\nScreenshots saved:');
  console.log('  - landing-main.png');
  console.log('  - landing-debaters.png');

  await browser.close();
})();
