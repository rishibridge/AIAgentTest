import { test, expect } from '@playwright/test';

test('Local Dashboard loads instantly and displays correct medication status', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:5173/');
    
    console.log("Accepting Disclaimer...");
    await page.getByText(/I UNDERSTAND/i).first().click();

    console.log("Navigating to Provider Dashboard...");
    await page.getByText(/Provider Dashboard/i).first().click({ force: true });

    console.log("Selecting Daniel Ramirez...");
    await page.getByText(/Daniel Ramirez/i).first().click({ force: true });

    // Wait for AT-A-GLANCE with a strict timeout (e.g., 5 seconds) to prove it didn't do the 30-60s generation
    await page.waitForSelector('text=AT-A-GLANCE', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    console.log(`Local Dashboard loaded in ${loadTime}ms`);

    // Verify "See narrative" is present in the Medications section
    const seeNarrative = page.getByText('See narrative');
    await expect(seeNarrative.first()).toBeVisible();

    await page.screenshot({ path: 'local_daniel_dashboard.png' });
});
