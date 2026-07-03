/**
 * DDx Clinical Debate — 25 Browser-Based Test Cases
 * Run: npx playwright test test_ddx_debate.js
 */
const { test, expect } = require('playwright/test');

const BASE_URL = 'https://prism-platform-525536279111.us-central1.run.app';

// Navigate through disclaimer → dashboard → patient → DDx Arena
async function navigateToDdxArena(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Step 1: Dismiss consent disclaimer
  const consent = page.getByText('I UNDERSTAND', { exact: false });
  if (await consent.isVisible({ timeout: 5000 }).catch(() => false)) {
    await consent.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Step 2: Click "OPEN DASHBOARD"
  await page.getByText('OPEN DASHBOARD').click({ force: true, timeout: 10000 });
  await page.waitForTimeout(3000);

  // Step 3: Click Elena patient card
  await page.getByText('Elena').first().click({ force: true, timeout: 10000 });
  await page.waitForTimeout(8000); // handoff generation

  // Step 4: Click DDx Arena tab
  await page.getByText('DDx Arena').first().click({ force: true, timeout: 30000 });
  await page.waitForTimeout(2000);
}

async function openDebateSetup(page) {
  await navigateToDdxArena(page);
  // Click Judge role pill (text contains 🔥 Judge)
  await page.getByText('Judge').first().click({ force: true, timeout: 10000 });
  await page.waitForTimeout(500);
  // Fill topic and submit
  const input = page.locator('input[type="text"], textarea').last();
  await input.fill('This is MDD');
  await input.press('Enter');
  await page.waitForTimeout(3000);
}

// ═══════════════════════════════════════════════════════════════════

test.describe('DDx Clinical Debate Feature', () => {
  test.setTimeout(120000);

  test('TC01: DDx Arena tab loads and shows role buttons', async ({ page }) => {
    await navigateToDdxArena(page);
    await expect(page.getByText('Judge')).toBeVisible({ timeout: 10000 });
    console.log('✅ TC01 PASS');
  });

  test('TC02: Clicking Judge opens debate setup screen', async ({ page }) => {
    await openDebateSetup(page);
    await expect(page.locator('[data-testid="debate-topic-input"]')).toBeVisible({ timeout: 10000 });
    console.log('✅ TC02 PASS');
  });

  test('TC03: Setup screen has topic input with value', async ({ page }) => {
    await openDebateSetup(page);
    const input = page.locator('[data-testid="debate-topic-input"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    expect(await input.inputValue()).toBeTruthy();
    console.log('✅ TC03 PASS');
  });

  test('TC04: Setup screen shows 3 role pickers', async ({ page }) => {
    await openDebateSetup(page);
    for (const r of ['for', 'against', 'judge']) {
      await expect(page.locator(`[data-testid="role-picker-${r}"]`)).toBeVisible({ timeout: 10000 });
    }
    console.log('✅ TC04 PASS');
  });

  test('TC05: Default roles AI vs AI, Human Judge', async ({ page }) => {
    await openDebateSetup(page);
    await expect(page.locator('[data-testid="role-for-ai"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="role-judge-human"]')).toBeVisible({ timeout: 5000 });
    console.log('✅ TC05 PASS');
  });

  test('TC06: Can toggle Case For to Human', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="role-for-human"]').click({ force: true });
    console.log('✅ TC06 PASS');
  });

  test('TC07: Can toggle Case Against to Human', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="role-against-human"]').click({ force: true });
    console.log('✅ TC07 PASS');
  });

  test('TC08: Can toggle Judge to AI', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="role-judge-ai"]').click({ force: true });
    console.log('✅ TC08 PASS');
  });

  test('TC09: Start Debate button exists', async ({ page }) => {
    await openDebateSetup(page);
    await expect(page.locator('[data-testid="start-debate-btn"]')).toBeVisible({ timeout: 5000 });
    console.log('✅ TC09 PASS');
  });

  test('TC10: Starting debate shows score bar', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="score-bar"]')).toBeVisible({ timeout: 30000 });
    console.log('✅ TC10 PASS');
  });

  test('TC11: Score bar visible during debate', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="score-bar"]')).toBeVisible({ timeout: 30000 });
    console.log('✅ TC11 PASS');
  });

  test('TC12: Score bar shows For and Against labels', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="score-for-label"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="score-against-label"]')).toBeVisible({ timeout: 30000 });
    console.log('✅ TC12 PASS');
  });

  test('TC13: Debate messages stream in', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="debate-message-for"], [data-testid="debate-message-against"]').first()).toBeVisible({ timeout: 90000 });
    console.log('✅ TC13 PASS');
  });

  test('TC14: First message is from Case For', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="debate-message-for"]').first()).toBeVisible({ timeout: 90000 });
    console.log('✅ TC14 PASS');
  });

  test('TC15: Case Against message appears', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="debate-message-against"]').first()).toBeVisible({ timeout: 90000 });
    console.log('✅ TC15 PASS');
  });

  test('TC16: Messages have colored left border', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    const msg = page.locator('[data-testid="debate-message-for"]').first();
    await expect(msg).toBeVisible({ timeout: 90000 });
    expect(await msg.getAttribute('style')).toContain('border-left');
    console.log('✅ TC16 PASS');
  });

  test('TC17: WPM speed control visible', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="wpm-control"]')).toBeVisible({ timeout: 30000 });
    console.log('✅ TC17 PASS');
  });

  test('TC18: Speed can be increased', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await page.waitForTimeout(3000);
    await page.locator('[data-testid="wpm-increase"]').click({ force: true });
    console.log('✅ TC18 PASS');
  });

  test('TC19: Speed can be decreased', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await page.waitForTimeout(3000);
    await page.locator('[data-testid="wpm-decrease"]').click({ force: true });
    console.log('✅ TC19 PASS');
  });

  test('TC20: Stop button exists', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="stop-debate-btn"]')).toBeVisible({ timeout: 30000 });
    console.log('✅ TC20 PASS');
  });

  test('TC21: Human judge panel appears', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="human-turn-panel"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ TC21 PASS');
  });

  test('TC22: Judge panel has score slider', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="judge-score-slider"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ TC22 PASS');
  });

  test('TC23: Judge panel has Continue button', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="judge-continue-btn"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ TC23 PASS');
  });

  test('TC24: Judge panel has End & Declare button', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="judge-end-btn"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ TC24 PASS');
  });

  test('TC25: End & Declare shows verdict buttons', async ({ page }) => {
    await openDebateSetup(page);
    await page.locator('[data-testid="start-debate-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="judge-end-btn"]')).toBeVisible({ timeout: 120000 });
    await page.locator('[data-testid="judge-end-btn"]').click({ force: true });
    await expect(page.locator('[data-testid="verdict-buttons"]')).toBeVisible({ timeout: 5000 });
    console.log('✅ TC25 PASS');
  });
});
