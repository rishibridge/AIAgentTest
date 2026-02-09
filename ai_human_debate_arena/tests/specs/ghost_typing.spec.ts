import { test, expect } from '@playwright/test';

test.describe('Ghost Typing Verification', () => {

    test('Pause should halt typing immediately', async ({ page }) => {
        // 1. Setup
        await page.goto('/');

        // Open settings and ensure audio is ON (to test audio sync path)
        await page.click('#settings-btn');
        const audioCheckbox = page.locator('#sound-toggle-checkbox');
        if (!(await audioCheckbox.isChecked())) {
            await audioCheckbox.check();
        }
        await page.click('#settings-modal button:has-text("Start")');

        // 2. Wait for Advocate to start typing
        const msgLocator = page.locator('.message.msg-for .typewriter-target');
        await expect(msgLocator).toBeVisible({ timeout: 10000 });

        // Wait for some text to appear
        await expect(msgLocator).not.toBeEmpty();

        // Allow a slight buffer for typing to proceed
        await page.waitForTimeout(1500);

        // 3. PAUSE
        console.log('Clicking PAUSE...');
        await page.click('.debate-btnGlass'); // Main button is now PAUSE

        // Calculate text length at pause moment
        const textAtPause = await msgLocator.innerText();
        console.log(`Text at pause: "${textAtPause}"`);

        // 4. Wait to ensure no ghost typing
        console.log('Waiting 3 seconds to check for ghost typing...');
        await page.waitForTimeout(3000);

        const textAfterWait = await msgLocator.innerText();
        console.log(`Text after wait: "${textAfterWait}"`);

        // 5. ASSERT
        expect(textAfterWait).toBe(textAtPause);
    });

});
