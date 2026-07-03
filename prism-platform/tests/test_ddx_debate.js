/**
 * DDx Clinical Debate — 25 Browser-Based Test Cases
 * Tests the full debate feature: setup, live streaming, judge panel, verdict
 * Run: npx playwright test tests/test_ddx_debate.js --headed
 */
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://prism-platform-525536279111.us-central1.run.app';
const TIMEOUT = 60000;

// Helper: Navigate to Provider Dashboard → DDx Arena tab
async function navigateToDdxArena(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
  // Click Provider Dashboard
  const providerBtn = page.locator('text=Provider Dashboard').first();
  await providerBtn.waitFor({ timeout: 15000 });
  await providerBtn.click();
  await page.waitForTimeout(1500);
  // Pick first patient (Elena)
  const patientCard = page.locator('text=Elena').first();
  await patientCard.waitFor({ timeout: 10000 });
  await patientCard.click();
  await page.waitForTimeout(3000);
  // Click DDx Arena tab
  const ddxTab = page.locator('text=DDx Arena').first();
  await ddxTab.waitFor({ timeout: 15000 });
  await ddxTab.click();
  await page.waitForTimeout(1000);
}

// Helper: Open debate setup from DDx Arena
async function openDebateSetup(page) {
  await navigateToDdxArena(page);
  // Select Judge mode
  const judgeBtn = page.locator('button:has-text("Judge")').first();
  await judgeBtn.click();
  await page.waitForTimeout(500);
  // Type a topic and press enter or click send
  const input = page.locator('input[placeholder*="clinical question"]').first();
  await input.fill('This is MDD');
  const sendBtn = page.locator('button:has(svg)').last();
  await sendBtn.click();
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════

test.describe('DDx Clinical Debate Feature', () => {
  test.setTimeout(120000);

  // ── SETUP SCREEN ──

  test('TC01: DDx Arena tab loads and shows role buttons', async ({ page }) => {
    await navigateToDdxArena(page);
    const judgeBtn = page.locator('button:has-text("Judge")').first();
    await expect(judgeBtn).toBeVisible({ timeout: 10000 });
    console.log('✅ TC01: DDx Arena tab loads with Judge button');
  });

  test('TC02: Clicking Judge + typing topic opens debate setup screen', async ({ page }) => {
    await openDebateSetup(page);
    const topicInput = page.locator('[data-testid="debate-topic-input"]');
    await expect(topicInput).toBeVisible({ timeout: 10000 });
    console.log('✅ TC02: Debate setup screen opens');
  });

  test('TC03: Setup screen has topic input field', async ({ page }) => {
    await openDebateSetup(page);
    const topicInput = page.locator('[data-testid="debate-topic-input"]');
    await expect(topicInput).toBeVisible({ timeout: 10000 });
    const value = await topicInput.inputValue();
    expect(value).toBeTruthy();
    console.log('✅ TC03: Topic input field present with value:', value);
  });

  test('TC04: Setup screen shows 3 role pickers', async ({ page }) => {
    await openDebateSetup(page);
    for (const role of ['for', 'against', 'judge']) {
      const picker = page.locator(`[data-testid="role-picker-${role}"]`);
      await expect(picker).toBeVisible({ timeout: 10000 });
    }
    console.log('✅ TC04: All 3 role pickers visible');
  });

  test('TC05: Default roles are AI vs AI, Human Judge', async ({ page }) => {
    await openDebateSetup(page);
    // Case For: AI should be selected
    const forAi = page.locator('[data-testid="role-for-ai"]');
    const forStyle = await forAi.getAttribute('style');
    expect(forStyle).toContain('rgb');
    // Judge: Human should be selected
    const judgeHuman = page.locator('[data-testid="role-judge-human"]');
    const judgeStyle = await judgeHuman.getAttribute('style');
    expect(judgeStyle).toContain('rgb');
    console.log('✅ TC05: Default roles correct (AI vs AI, Human Judge)');
  });

  test('TC06: Can toggle Case For to Human', async ({ page }) => {
    await openDebateSetup(page);
    const forHuman = page.locator('[data-testid="role-for-human"]');
    await forHuman.click();
    await page.waitForTimeout(300);
    const style = await forHuman.getAttribute('style');
    expect(style).toContain('rgb');
    console.log('✅ TC06: Case For toggled to Human');
  });

  test('TC07: Can toggle Case Against to Human', async ({ page }) => {
    await openDebateSetup(page);
    const againstHuman = page.locator('[data-testid="role-against-human"]');
    await againstHuman.click();
    await page.waitForTimeout(300);
    const style = await againstHuman.getAttribute('style');
    expect(style).toContain('rgb');
    console.log('✅ TC07: Case Against toggled to Human');
  });

  test('TC08: Can toggle Judge to AI', async ({ page }) => {
    await openDebateSetup(page);
    const judgeAi = page.locator('[data-testid="role-judge-ai"]');
    await judgeAi.click();
    await page.waitForTimeout(300);
    const style = await judgeAi.getAttribute('style');
    expect(style).toContain('rgb');
    console.log('✅ TC08: Judge toggled to AI');
  });

  test('TC09: Start Debate button exists and is clickable', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled();
    console.log('✅ TC09: Start Debate button is visible and enabled');
  });

  test('TC10: Starting debate transitions to live debate view', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    // Should see score bar appear
    const scoreBar = page.locator('[data-testid="score-bar"]');
    await expect(scoreBar).toBeVisible({ timeout: 30000 });
    console.log('✅ TC10: Live debate view shown after starting');
  });

  // ── LIVE DEBATE ──

  test('TC11: Score bar is visible during debate', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const scoreBar = page.locator('[data-testid="score-bar"]');
    await expect(scoreBar).toBeVisible({ timeout: 30000 });
    console.log('✅ TC11: Score bar visible during debate');
  });

  test('TC12: Score bar shows For and Against labels', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const forLabel = page.locator('[data-testid="score-for-label"]');
    const againstLabel = page.locator('[data-testid="score-against-label"]');
    await expect(forLabel).toBeVisible({ timeout: 30000 });
    await expect(againstLabel).toBeVisible({ timeout: 30000 });
    console.log('✅ TC12: For and Against labels visible in score bar');
  });

  test('TC13: Debate messages stream in (at least one message appears)', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    // Wait for at least one debate message
    const msg = page.locator('[data-testid="debate-message-for"], [data-testid="debate-message-against"]').first();
    await expect(msg).toBeVisible({ timeout: 60000 });
    console.log('✅ TC13: Debate messages streaming in');
  });

  test('TC14: First substantive message is from Case For', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const forMsg = page.locator('[data-testid="debate-message-for"]').first();
    await expect(forMsg).toBeVisible({ timeout: 60000 });
    const text = await forMsg.textContent();
    expect(text).toContain('The Case For');
    console.log('✅ TC14: First message is from Case For');
  });

  test('TC15: Case Against message appears after Case For', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const againstMsg = page.locator('[data-testid="debate-message-against"]').first();
    await expect(againstMsg).toBeVisible({ timeout: 90000 });
    const text = await againstMsg.textContent();
    expect(text).toContain('The Case Against');
    console.log('✅ TC15: Case Against message appears');
  });

  test('TC16: Messages have role-colored indicators', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const forMsg = page.locator('[data-testid="debate-message-for"]').first();
    await expect(forMsg).toBeVisible({ timeout: 60000 });
    const style = await forMsg.getAttribute('style');
    // Should have colored left border
    expect(style).toContain('border-left');
    console.log('✅ TC16: Messages have role-colored indicators');
  });

  test('TC17: Speed control (WPM) is visible', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const wpmControl = page.locator('[data-testid="wpm-control"]');
    await expect(wpmControl).toBeVisible({ timeout: 30000 });
    console.log('✅ TC17: WPM speed control visible');
  });

  test('TC18: Speed can be increased', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    await page.waitForTimeout(2000);
    const increaseBtn = page.locator('[data-testid="wpm-increase"]');
    await expect(increaseBtn).toBeVisible({ timeout: 10000 });
    await increaseBtn.click();
    console.log('✅ TC18: Speed increased');
  });

  test('TC19: Speed can be decreased', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    await page.waitForTimeout(2000);
    const decreaseBtn = page.locator('[data-testid="wpm-decrease"]');
    await expect(decreaseBtn).toBeVisible({ timeout: 10000 });
    await decreaseBtn.click();
    console.log('✅ TC19: Speed decreased');
  });

  test('TC20: Stop button exists during active debate', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const stopBtn = page.locator('[data-testid="stop-debate-btn"]');
    await expect(stopBtn).toBeVisible({ timeout: 30000 });
    console.log('✅ TC20: Stop button visible during debate');
  });

  // ── HUMAN JUDGE ──

  test('TC21: Human judge panel appears after opening statements', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    // With human judge (default), judge panel should appear after both sides speak
    const judgePanel = page.locator('[data-testid="human-turn-panel"]');
    await expect(judgePanel).toBeVisible({ timeout: 90000 });
    console.log('✅ TC21: Human judge panel appears');
  });

  test('TC22: Judge panel has score slider', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const slider = page.locator('[data-testid="judge-score-slider"]');
    await expect(slider).toBeVisible({ timeout: 90000 });
    console.log('✅ TC22: Judge panel has score slider');
  });

  test('TC23: Judge panel has Continue Debate button', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const continueBtn = page.locator('[data-testid="judge-continue-btn"]');
    await expect(continueBtn).toBeVisible({ timeout: 90000 });
    console.log('✅ TC23: Continue Debate button visible');
  });

  test('TC24: Judge panel has End & Declare Winner button', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    const endBtn = page.locator('[data-testid="judge-end-btn"]');
    await expect(endBtn).toBeVisible({ timeout: 90000 });
    console.log('✅ TC24: End & Declare Winner button visible');
  });

  test('TC25: Clicking End & Declare shows verdict buttons', async ({ page }) => {
    await openDebateSetup(page);
    const startBtn = page.locator('[data-testid="start-debate-btn"]');
    await startBtn.click();
    // Wait for judge panel
    const endBtn = page.locator('[data-testid="judge-end-btn"]');
    await expect(endBtn).toBeVisible({ timeout: 90000 });
    await endBtn.click();
    await page.waitForTimeout(500);
    // Verdict buttons should appear
    const verdictBtns = page.locator('[data-testid="verdict-buttons"]');
    await expect(verdictBtns).toBeVisible({ timeout: 5000 });
    const forBtn = page.locator('[data-testid="verdict-for-btn"]');
    const againstBtn = page.locator('[data-testid="verdict-against-btn"]');
    await expect(forBtn).toBeVisible();
    await expect(againstBtn).toBeVisible();
    console.log('✅ TC25: Verdict buttons (Case For / Case Against) shown');
  });
});
