const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Go to the page
  await page.goto('http://127.0.0.1:8081');
  await page.waitForLoadState('networkidle');

  console.log('Taking screenshot 1: Initial page load');
  await page.screenshot({ path: 'screenshot-1-initial.png', fullPage: true });

  // Wait a moment
  await page.waitForTimeout(1000);

  // Click the Practice button
  console.log('Clicking Practice button...');
  await page.click('#practice-btn');

  // Wait for modal animation
  await page.waitForTimeout(500);

  console.log('Taking screenshot 2: After clicking Practice button');
  await page.screenshot({ path: 'screenshot-2-after-click.png', fullPage: true });

  // Check if modal is visible
  const modalVisible = await page.isVisible('#practice-modal');
  const modalHasVisibleClass = await page.evaluate(() => {
    const modal = document.getElementById('practice-modal');
    return modal && modal.classList.contains('visible');
  });

  console.log('Modal visible:', modalVisible);
  console.log('Modal has "visible" class:', modalHasVisibleClass);

  console.log('\nScreenshots saved:');
  console.log('  - screenshot-1-initial.png');
  console.log('  - screenshot-2-after-click.png');

  await browser.close();
})();
