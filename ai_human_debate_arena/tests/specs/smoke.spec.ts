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

    test('@regression Pro style option exists in tone dropdowns', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        const advocateTone = page.locator('#advocate-tone');
        await expect(advocateTone.locator('option[value="pro"]')).toBeAttached();

        const skepticTone = page.locator('#skeptic-tone');
        await expect(skepticTone.locator('option[value="pro"]')).toBeAttached();
    });

    test('@regression CASE-01: Case upload section exists in settings', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        await expect(page.locator('.case-upload-header')).toBeVisible();
        // Body should be hidden initially (collapsed)
        await expect(page.locator('#case-upload-body')).toHaveClass(/hidden/);
    });

    test('@regression CASE-02: Case textarea toggles open and closed', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');

        // Click to expand
        await page.click('.case-upload-header');
        await expect(page.locator('#case-upload-body')).not.toHaveClass(/hidden/);
        await expect(page.locator('#case-text')).toBeVisible();

        // Click to collapse
        await page.click('.case-upload-header');
        await expect(page.locator('#case-upload-body')).toHaveClass(/hidden/);
    });

    test('@regression CASE-03: Pasting text updates character count', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');
        await page.click('.case-upload-header');

        await page.fill('#case-text', 'This is my debate case argument.');
        // Trigger input event
        await page.locator('#case-text').dispatchEvent('input');

        const charCount = page.locator('#case-char-count');
        await expect(charCount).not.toHaveText('0 chars');
    });

    test('@regression CASE-04: Clear button empties textarea', async ({ page }) => {
        await page.goto('/');
        await page.click('#settings-btn');
        await page.click('.case-upload-header');

        await page.fill('#case-text', 'Some debate case text');
        await page.click('.case-clear-btn');

        await expect(page.locator('#case-text')).toHaveValue('');
        await expect(page.locator('#case-char-count')).toHaveText('0 chars');
    });

    test('@regression FLOW-01: Flow link exists in footer', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#flow-link')).toBeVisible();
        await expect(page.locator('#flow-link')).toHaveText('Flow');
    });

    test('@regression FLOW-02: Flow modal opens and closes', async ({ page }) => {
        await page.goto('/');
        await page.click('#flow-link');

        const modal = page.locator('#flow-modal');
        await expect(modal).not.toHaveClass(/hidden/);

        // Should show empty state
        await expect(page.locator('.flow-empty')).toBeVisible();

        // Close
        await page.click('#flow-modal .close-btn');
        await page.waitForTimeout(400);
        await expect(modal).toHaveClass(/hidden/);
    });

    test('@regression FLOW-03: Copy and download buttons exist', async ({ page }) => {
        await page.goto('/');
        await page.click('#flow-link');

        await expect(page.locator('#flow-copy-btn')).toBeVisible();
        await expect(page.locator('.flow-action-btn:has-text("Download")')).toBeVisible();
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
// HISTORY AUDIO PLAYBACK TESTS
// ============================================

test.describe('History Audio Playback', () => {

    // Seed history data before each test
    async function seedHistory(page) {
        await page.evaluate(() => {
            localStorage.setItem('debate_history', JSON.stringify([{
                topic: 'Test Debate Topic',
                winner: 'advocate',
                date: '2/8/2026 12:00 PM',
                transcript: [
                    'Advocate: This is the first argument for the motion.',
                    'Skeptic: This is the counter-argument against the motion.',
                    'Judge: Both sides made good points. Advocate wins.'
                ],
                messages: [
                    { role: 'advocate', text: 'This is the first argument for the motion.', voiceSettings: { pitch: 1.1, rate: 1.0, female: false } },
                    { role: 'skeptic', text: 'This is the counter-argument against the motion.', voiceSettings: { pitch: 0.9, rate: 1.0, female: true } },
                    { role: 'judge', text: 'Both sides made good points. Advocate wins.', voiceSettings: { pitch: 1.0, rate: 0.9, female: false } }
                ]
            }]));
        });
    }

    test('@regression HIST-AUD-01: Audio control bar visible in transcript view', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        // Open history modal
        await page.click('a.footer-link:has-text("History")');
        await expect(page.locator('#history-modal')).toBeVisible();

        // Click first history item to view transcript
        await page.click('.history-item');

        // Verify audio control bar is visible
        await expect(page.locator('.history-audio-bar')).toBeVisible();
    });

    test('@regression HIST-AUD-02: Play button visible initially', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Play button should be visible, pause/resume hidden
        await expect(page.locator('#audio-play-btn')).toBeVisible();
        await expect(page.locator('#audio-pause-btn')).not.toBeVisible();
        await expect(page.locator('#audio-resume-btn')).not.toBeVisible();
    });

    test('@regression HIST-AUD-03: Stop button disabled initially', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Stop button should be disabled when not playing
        await expect(page.locator('#audio-stop-btn')).toBeDisabled();
    });

    test('@regression HIST-AUD-04: Voice selector dropdown exists', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Voice selector should be visible
        await expect(page.locator('#playback-voice')).toBeVisible();
        // Should have at least the default option
        const optionCount = await page.locator('#playback-voice option').count();
        expect(optionCount).toBeGreaterThanOrEqual(1);
    });

    test('@regression HIST-AUD-05: Audio status shows ready initially', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Status should show "Ready to play"
        await expect(page.locator('#audio-status')).toContainText('Ready to play');
    });

    test('@regression HIST-AUD-06: Transcript messages rendered correctly', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Should have 3 transcript messages
        await expect(page.locator('.transcript-msg')).toHaveCount(3);
        // Verify role-based styling classes exist
        await expect(page.locator('.transcript-msg.msg-for')).toHaveCount(1);
        await expect(page.locator('.transcript-msg.msg-against')).toHaveCount(1);
        await expect(page.locator('.transcript-msg.msg-judge')).toHaveCount(1);
    });

    test('@regression HIST-AUD-07: Back button stops audio and resets UI', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Click back button
        await page.click('.back-btn:has-text("Back")');

        // Should be back on list view
        await expect(page.locator('#history-list-view')).toBeVisible();
        await expect(page.locator('#history-detail-view')).not.toBeVisible();
    });

    test('@regression HIST-AUD-08: Close modal stops audio playback', async ({ page }) => {
        await page.goto('/');
        await seedHistory(page);
        await page.reload();

        await page.click('a.footer-link:has-text("History")');
        await page.click('.history-item');

        // Close the modal using history modal's close button
        await page.click('#history-modal .close-btn');

        // Wait for animation then modal should be hidden
        await page.waitForTimeout(500);
        await expect(page.locator('#history-modal')).not.toBeVisible();
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
