/**
 * Quick debug test — screenshot at each navigation step
 */
const { test } = require('playwright/test');
const BASE_URL = 'https://prism-platform-525536279111.us-central1.run.app';

test('DEBUG: screenshot navigation', async ({ page }) => {
  test.setTimeout(120000);
  
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'debug_01_landing.png', fullPage: true });

  // Try clicking Provider Dashboard
  const pdText = await page.getByText('Provider Dashboard', { exact: true }).count();
  console.log('Provider Dashboard count:', pdText);
  
  if (pdText > 0) {
    await page.getByText('Provider Dashboard', { exact: true }).click({ force: true });
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: 'debug_02_after_pd_click.png', fullPage: true });

  // List all visible text
  const allText = await page.locator('body').innerText();
  console.log('PAGE TEXT (first 2000 chars):', allText.substring(0, 2000));
  
  // Try clicking Elena
  const elenaCount = await page.getByText('Elena').count();
  console.log('Elena count:', elenaCount);
  
  if (elenaCount > 0) {
    await page.getByText('Elena').first().click({ force: true });
    await page.waitForTimeout(8000);
  }
  await page.screenshot({ path: 'debug_03_after_elena.png', fullPage: true });

  // Check for DDx Arena
  const ddxCount = await page.getByText('DDx Arena').count();
  console.log('DDx Arena count:', ddxCount);
  
  if (ddxCount > 0) {
    await page.getByText('DDx Arena').first().click({ force: true });
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'debug_04_ddx_arena.png', fullPage: true });

  // Check for Judge
  const judgeCount = await page.getByText('Judge').count();
  console.log('Judge count:', judgeCount);
  
  const bodyText2 = await page.locator('body').innerText();
  console.log('DDX TAB TEXT (first 2000):', bodyText2.substring(0, 2000));
});
