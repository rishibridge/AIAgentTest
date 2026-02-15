const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Testing changelog modal...');
  await page.goto('http://127.0.0.1:8081');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  console.log('Taking screenshot 1: Main page with version link');
  await page.screenshot({ path: 'changelog-1-main.png', fullPage: true });

  // Click the version link in footer
  console.log('Clicking version link...');
  await page.click('.version-link');

  // Wait for modal animation
  await page.waitForTimeout(500);

  console.log('Taking screenshot 2: Changelog modal opened');
  await page.screenshot({ path: 'changelog-2-modal.png', fullPage: true });

  // Check if changelog modal is visible
  const modalVisible = await page.isVisible('#changelog-modal');

  // Check if version 1.45.0 is shown
  const bodyText = await page.textContent('body');
  const hasVersion1_45 = bodyText.includes('1.45.0');
  const hasPracticeFeature = bodyText.includes('Practice with Case Modal');
  const hasTwoColumnUX = bodyText.includes('Two-column modal layout');

  console.log('\n✅ Test Results:');
  console.log(`  - Changelog modal visible: ${modalVisible ? '✓ YES' : '✗ NO'}`);
  console.log(`  - Version 1.45.0 shown: ${hasVersion1_45 ? '✓ YES' : '✗ NO'}`);
  console.log(`  - Practice feature in changelog: ${hasPracticeFeature ? '✓ YES' : '✗ NO'}`);
  console.log(`  - Two-column UX in changelog: ${hasTwoColumnUX ? '✓ YES' : '✗ NO'}`);

  console.log('\nScreenshots saved:');
  console.log('  - changelog-1-main.png');
  console.log('  - changelog-2-modal.png');

  await browser.close();
})();
