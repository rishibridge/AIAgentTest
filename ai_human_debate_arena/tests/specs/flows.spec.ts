import { test, expect, Page } from '@playwright/test';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Set WPM to fastest (999) for quick test execution
 */
async function setFastestSpeed(page: Page) {
    // Click + button repeatedly until WPM is 999 (max speed)
    const wpmDisplay = page.locator('#wpm-display');
    const plusBtn = page.locator('.wpm-btn:has-text("+")');

    // Click + 30 times to max out (from any starting point)
    for (let i = 0; i < 30; i++) {
        await plusBtn.click();
        await page.waitForTimeout(50);
    }

    // Verify it's at max (shows infinity symbol)
    await expect(wpmDisplay).toHaveText('∞');
}

// ============================================
// FULL DEBATE FLOW TESTS
// ============================================

test.describe('Debate Flows', () => {

    test('@smoke SEQ-A01: Complete AI vs AI debate flow', async ({ page }) => {
        test.setTimeout(120000); // 2 min timeout for full debate

        await page.goto('/');

        // Set fastest speed for quick execution
        await setFastestSpeed(page);

        // Open settings via fire button
        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);

        // Settings should be open
        const settings = page.locator('#settings-modal');
        await expect(settings).toBeVisible();

        // Ensure AI vs AI config
        await page.selectOption('#advocate-model', 'kimi');
        await page.selectOption('#skeptic-model', 'gemini');
        await page.selectOption('#judge-model', 'deepseek');

        // Start debate
        await page.click('#settings-modal button:has-text("Start")');

        // Settings should close
        await expect(settings).not.toBeVisible();

        // For AI vs AI, prediction modal should appear
        const predictionModal = page.locator('#prediction-modal');
        const predictionVisible = await predictionModal.isVisible().catch(() => false);

        if (predictionVisible) {
            // Skip prediction for speed
            await page.click('#prediction-modal >> text=Skip');
        }

        // Wait for debate to start
        await page.waitForTimeout(3000);

        // Verify debate started:
        // 1. Button should say STOP
        const debateBtn = page.locator('.debate-btnGlass');
        await expect(debateBtn).toContainText('PAUSE');

        // 2. Scoreboard should be visible
        const scoreboard = page.locator('#score-container');
        await expect(scoreboard).toBeVisible();

        // 3. Discussion stream should have content
        await page.waitForTimeout(5000);
        const stream = page.locator('#discussion-stream');
        const messages = stream.locator('.message');
        const count = await messages.count();
        expect(count).toBeGreaterThan(0);

        // Stop the debate for test speed
        await page.click('#stop-btn');

        // Verify stopped
        await expect(debateBtn).toHaveText('DEBATE');
    });

    test('@regression STP-03: Stop button terminates debate', async ({ page }) => {
        await page.goto('/');

        // Start via fire button
        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);
        await page.click('#settings-modal button:has-text("Start")');

        // Handle prediction modal
        const predictionModal = page.locator('#prediction-modal');
        if (await predictionModal.isVisible().catch(() => false)) {
            await page.click('#prediction-modal >> text=Skip');
        }

        await page.waitForTimeout(3000);

        // Verify debate running
        const debateBtn = page.locator('.debate-btnGlass');
        await expect(debateBtn).toContainText('PAUSE');

        // Click STOP
        await page.click('#stop-btn');

        // Verify stopped
        await expect(debateBtn).toHaveText('DEBATE');

        // Verify "stopped by user" message
        const stoppedMsg = page.locator('.message:has-text("stopped")');
        await expect(stoppedMsg).toBeVisible({ timeout: 5000 });
    });

    test('@regression Controls disabled during debate', async ({ page }) => {
        await page.goto('/');

        // Start debate
        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);
        await page.click('#settings-modal button:has-text("Start")');

        // Handle prediction modal
        const predictionModal = page.locator('#prediction-modal');
        if (await predictionModal.isVisible().catch(() => false)) {
            await page.click('#prediction-modal >> text=Skip');
        }

        await page.waitForTimeout(2000);

        // Verify controls disabled
        const topicInput = page.locator('#topic-input');
        await expect(topicInput).toBeDisabled();

        const fireBtn = page.locator('.chaos-btnGlass');
        await expect(fireBtn).toBeDisabled();

        // Stop and verify re-enabled
        await page.click('#stop-btn');
        await page.waitForTimeout(1000);

        await expect(topicInput).toBeEnabled();
        await expect(fireBtn).toBeEnabled();
    });

    test('@smoke NDB-01: Factual question resets button to DEBATE', async ({ page }) => {
        await page.goto('/');

        // Type a factual question (not debatable)
        await page.fill('#topic-input', 'How many legs does a spider have?');

        // Click DEBATE to open settings
        await page.click('.debate-btnGlass');
        await page.waitForTimeout(500);

        // Settings should open
        const settings = page.locator('#settings-modal');
        await expect(settings).toBeVisible();

        // Start the "debate" (will be detected as factual)
        await page.click('#settings-modal button:has-text("Start")');

        // Wait for API response (factual answer)
        await page.waitForTimeout(5000);

        // Button should reset to DEBATE (not stuck on STOP)
        const debateBtn = page.locator('.debate-btnGlass');
        await expect(debateBtn).toHaveText('DEBATE', { timeout: 10000 });

        // Should show factual answer message
        const answerMsg = page.locator('.message:has-text("Answer")');
        await expect(answerMsg).toBeVisible({ timeout: 5000 });

        // Controls should be re-enabled
        const topicInput = page.locator('#topic-input');
        await expect(topicInput).toBeEnabled();
    });

    test('@regression NDB-02: Factual question shows no debate needed message', async ({ page }) => {
        await page.goto('/');

        await page.fill('#topic-input', 'What year did World War 2 end?');
        await page.click('.debate-btnGlass');
        await page.waitForTimeout(500);
        await page.click('#settings-modal button:has-text("Start")');

        await page.waitForTimeout(5000);

        // Should show "no debate needed" message
        const noDebateMsg = page.locator('.message:has-text("No debate needed")');
        await expect(noDebateMsg).toBeVisible({ timeout: 10000 });
    });

    test('@regression NDB-03: Factual question hides scoreboard', async ({ page }) => {
        await page.goto('/');

        await page.fill('#topic-input', 'When was the Declaration of Independence signed?');
        await page.click('.debate-btnGlass');
        await page.waitForTimeout(500);
        await page.click('#settings-modal button:has-text("Start")');

        await page.waitForTimeout(5000);

        // Scoreboard should be hidden (no debate = no scores)
        const scoreboard = page.locator('#score-container');
        await expect(scoreboard).toHaveCSS('display', 'none', { timeout: 10000 });

        // Fire button should be re-enabled
        const fireBtn = page.locator('.chaos-btnGlass');
        await expect(fireBtn).toBeEnabled();
    });

});

// ============================================
// PREDICTION MODAL TESTS
// ============================================

test.describe('Prediction Modal', () => {

    // SKIP: Prediction modal feature is implemented but not yet wired to debate flow
    test.skip('@regression PRD-01: Prediction modal shows for AI vs AI', async ({ page }) => {
        await page.goto('/');

        // Use explicit debatable topic (not random from chaos button)
        await page.fill('#topic-input', 'Should AI have rights?');
        await page.click('.debate-btnGlass');
        await page.waitForTimeout(500);

        // Ensure AI vs AI
        await page.selectOption('#advocate-model', 'kimi');
        await page.selectOption('#skeptic-model', 'kimi');

        await page.click('#settings-modal button:has-text("Start")');

        // Prediction modal should appear for AI vs AI
        const predictionModal = page.locator('#prediction-modal');
        await expect(predictionModal).toBeVisible({ timeout: 15000 });

        // Cleanup
        await page.click('#prediction-modal >> text=Skip');
        await page.waitForTimeout(1000);
        await page.click('.debate-btnGlass'); // Stop
    });

    test('@regression PRD-02: No prediction for Human vs AI', async ({ page }) => {
        await page.goto('/');

        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);

        // Set Human vs AI
        await page.selectOption('#advocate-model', 'human');
        await page.selectOption('#skeptic-model', 'kimi');

        await page.click('#settings-modal button:has-text("Start")');

        // Prediction modal should NOT appear
        await page.waitForTimeout(2000);
        const predictionModal = page.locator('#prediction-modal');
        await expect(predictionModal).not.toBeVisible();

        // Cleanup - stop debate
        await page.click('#stop-btn');
    });

});

// ============================================
// HUMAN INPUT DOCK TESTS
// ============================================

test.describe('Human Input Dock', () => {

    test('@regression SEQ-D02: Dock appears for human participant', async ({ page }) => {
        await page.goto('/');

        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);

        // Set Human as FOR
        await page.selectOption('#advocate-model', 'human');
        await page.selectOption('#skeptic-model', 'kimi');

        await page.click('#settings-modal button:has-text("Start")');

        await page.waitForTimeout(3000);

        // Human input dock should be visible (waiting state)
        const inputDock = page.locator('#user-input-container');
        await expect(inputDock).toBeVisible();

        // Cleanup
        await page.click('#stop-btn');
    });

});

// ============================================
// PAUSE/RESUME TESTS
// ============================================

test.describe('Debate Pause/Resume', () => {

    test('@regression PAUSE-01: Pause button shows during active debate', async ({ page }) => {
        await page.goto('/');

        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);
        await page.click('#settings-modal button:has-text("Start")');

        // Handle prediction modal
        const predictionModal = page.locator('#prediction-modal');
        if (await predictionModal.isVisible().catch(() => false)) {
            await page.click('#prediction-modal >> text=Skip');
        }

        await page.waitForTimeout(2000);

        // Verify button shows PAUSE
        const debateBtn = page.locator('.debate-btnGlass');
        await expect(debateBtn).toContainText('PAUSE');

        // Cleanup
        await page.click('#stop-btn');
    });

    test('@regression PAUSE-02: Stop button visible during debate', async ({ page }) => {
        await page.goto('/');

        await page.click('.chaos-btnGlass');
        await page.waitForTimeout(2000);
        await page.click('#settings-modal button:has-text("Start")');

        // Handle prediction modal  
        const predictionModal = page.locator('#prediction-modal');
        if (await predictionModal.isVisible().catch(() => false)) {
            await page.click('#prediction-modal >> text=Skip');
        }

        await page.waitForTimeout(2000);

        // Stop button should be visible
        const stopBtn = page.locator('#stop-btn');
        await expect(stopBtn).toBeVisible();

        // Cleanup
        await stopBtn.click();
    });

    test('@regression PAUSE-03: Stop button hidden when idle', async ({ page }) => {
        await page.goto('/');

        // Stop button should be hidden when not debating
        const stopBtn = page.locator('#stop-btn');
        await expect(stopBtn).not.toBeVisible();
    });

});

// ============================================
// AUDIO TESTS
// ============================================

test.describe('Audio Features', () => {

    test('@regression Voice sections hidden when audio off', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const audioToggle = page.locator('#sound-toggle-checkbox');
        await audioToggle.uncheck();

        const voiceSections = page.locator('.voice-section');
        await expect(voiceSections.first()).toHaveClass(/hidden/);
    });

    test('@regression Voice preview buttons exist', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const audioToggle = page.locator('#sound-toggle-checkbox');
        await audioToggle.check();

        const previewBtns = page.locator('.voice-preview-btn');
        const count = await previewBtns.count();
        expect(count).toBeGreaterThan(0);
    });

});
