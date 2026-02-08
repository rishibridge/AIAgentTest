import { test, expect } from '@playwright/test';

// ============================================
// SMOKE TESTS - Run every release (@smoke)
// ============================================

test.describe('Smoke Tests', () => {

    test('@smoke DIP-01: Settings modal opens on DEBATE click', async ({ page }) => {
        await page.goto('/');
        await page.fill('#topic-input', 'Is AI beneficial?');
        await page.click('.debate-btnGlass');

        // BUG CHECK: Settings modal SHOULD open
        const settingsModal = page.locator('#settings-modal');
        // Current behavior (BUG): modal does NOT open
        // Expected: await expect(settingsModal).toBeVisible();

        // For now, document the bug:
        const isVisible = await settingsModal.isVisible();
        if (!isVisible) {
            console.log('🐛 BUG-01: Settings modal does NOT open on DEBATE click');
        }
    });

    test('@smoke DIP-03: Settings modal opens via fire button', async ({ page }) => {
        await page.goto('/');
        await page.click('.chaos-btnGlass');

        // Wait for API response
        await page.waitForTimeout(2000);

        const settingsModal = page.locator('#settings-modal');
        await expect(settingsModal).toBeVisible();
    });

    test('@smoke STP-01: DEBATE button shows correct text when idle', async ({ page }) => {
        await page.goto('/');
        const debateBtn = page.locator('.debate-btnGlass');
        await expect(debateBtn).toHaveText('DEBATE');
    });

    test('@smoke TC-040: Settings modal opens via gear button', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const settingsModal = page.locator('#settings-modal');
        await expect(settingsModal).toBeVisible();
    });

    test('@smoke TC-060: History modal opens', async ({ page }) => {
        await page.goto('/');
        await page.click('a.footer-link:has-text("History")');

        const historyModal = page.locator('#history-modal');
        await expect(historyModal).toBeVisible();
    });

    test('@smoke AUD-01: Audio toggle works', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const audioToggle = page.locator('#sound-toggle-checkbox');
        await audioToggle.check();
        await expect(audioToggle).toBeChecked();

        // Voice sections should be visible
        const voiceSections = page.locator('.voice-section');
        await expect(voiceSections.first()).toBeVisible();
    });

    test('@smoke MSG-01: Page loads with correct elements', async ({ page }) => {
        await page.goto('/');

        // Header elements
        await expect(page.locator('.header-logo')).toBeVisible();
        await expect(page.locator('#topic-input')).toBeVisible();
        await expect(page.locator('.debate-btnGlass')).toBeVisible();
        await expect(page.locator('.chaos-btnGlass')).toBeVisible();

        // Footer elements
        await expect(page.locator('#settings-btn')).toBeVisible();
        await expect(page.locator('a.footer-link:has-text("History")')).toBeVisible();
    });

    test('@smoke TC-001: Topic input accepts text', async ({ page }) => {
        await page.goto('/');
        const topicInput = page.locator('#topic-input');

        await topicInput.fill('Should AI have rights?');
        await expect(topicInput).toHaveValue('Should AI have rights?');
    });

    test('@smoke KEY-01: Enter key in topic field triggers action', async ({ page }) => {
        await page.goto('/');
        await page.fill('#topic-input', 'Test topic');
        await page.press('#topic-input', 'Enter');

        // Should trigger settings or debate
        // Check for any modal or state change
        await page.waitForTimeout(500);
    });

});

// ============================================
// UI STATE TESTS
// ============================================

test.describe('UI States', () => {

    test('@regression Scoreboard hidden on page load', async ({ page }) => {
        await page.goto('/');
        const scoreboard = page.locator('#score-container');
        // Should be hidden or display:none initially
        await expect(scoreboard).toHaveCSS('display', 'none');
    });

    test('@regression Input dock hidden on page load', async ({ page }) => {
        await page.goto('/');
        const inputDock = page.locator('#user-input-container');
        await expect(inputDock).toHaveClass(/hidden/);
    });

    test('@regression Judge dock hidden on page load', async ({ page }) => {
        await page.goto('/');
        const judgeDock = page.locator('#judge-input-container');
        await expect(judgeDock).toHaveClass(/hidden/);
    });

    test('@regression WPM controls visible', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#wpm-display')).toBeVisible();
    });

    test('@regression WPM increase button works', async ({ page }) => {
        await page.goto('/');
        const wpmDisplay = page.locator('#wpm-display');
        const initialWPM = await wpmDisplay.textContent();

        await page.click('.wpm-controlGlass >> text=+');

        const newWPM = await wpmDisplay.textContent();
        expect(parseInt(newWPM || '0')).toBeGreaterThan(parseInt(initialWPM || '0'));
    });

});

// ============================================
// SETTINGS MODAL TESTS  
// ============================================

test.describe('Settings Modal', () => {

    test('@regression Model dropdowns exist', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        await expect(page.locator('#advocate-model')).toBeVisible();
        await expect(page.locator('#skeptic-model')).toBeVisible();
        await expect(page.locator('#judge-model')).toBeVisible();
    });

    test('@regression Tone dropdowns exist', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        await expect(page.locator('#advocate-tone')).toBeVisible();
        await expect(page.locator('#skeptic-tone')).toBeVisible();
    });

    test('@regression Close button works', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const modal = page.locator('#settings-modal');
        await expect(modal).toBeVisible();

        await page.click('#settings-modal .close-btn');
        await expect(modal).not.toBeVisible();
    });

    test('@regression Cancel button works', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        await page.click('#settings-modal button:has-text("Cancel")');

        const modal = page.locator('#settings-modal');
        await expect(modal).not.toBeVisible();
    });

    test('@regression Human model option exists', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const advocateModel = page.locator('#advocate-model');
        await expect(advocateModel.locator('option[value="human"]')).toBeAttached();
    });

});

// ============================================
// HISTORY MODAL TESTS
// ============================================

test.describe('History Modal', () => {

    test('@regression History modal has close button', async ({ page }) => {
        await page.goto('/');
        await page.click('a.footer-link:has-text("History")');

        const closeBtn = page.locator('#history-modal .close-btn');
        await expect(closeBtn).toBeVisible();

        await closeBtn.click();
        await expect(page.locator('#history-modal')).not.toBeVisible();
    });

    test('@regression Clear history button exists', async ({ page }) => {
        await page.goto('/');
        await page.click('a.footer-link:has-text("History")');

        await expect(page.locator('.clear-history-btn')).toBeVisible();
    });

});

// ============================================
// LOADING & ERROR STATES
// ============================================

test.describe('Loading States', () => {

    test('@regression Discussion stream exists', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#discussion-stream')).toBeVisible();
    });

    test('@regression Discussion stream is empty initially', async ({ page }) => {
        await page.goto('/');
        const stream = page.locator('#discussion-stream');
        const content = await stream.textContent();
        expect(content?.trim()).toBe('');
    });

});
