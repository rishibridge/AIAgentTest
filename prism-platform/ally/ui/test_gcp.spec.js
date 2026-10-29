import { test, expect } from '@playwright/test';

test('Dashboard loads instantly and displays correct medication status', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const startTime = Date.now();
    await page.goto('https://prism-platform-525536279111.us-central1.run.app/');
    
    console.log("Accepting Disclaimer...");
    await page.getByText(/I UNDERSTAND/i).first().click();

    console.log("Navigating to Provider Dashboard...");
    await page.getByText(/Provider Dashboard/i).first().click({ force: true });
    
    // Wait a moment for network
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'debug_gcp_patient_picker.png' });

    console.log("Selecting Daniel Ramirez...");
    const danielBtn = page.getByText(/Daniel Ramirez/i).first();
    await danielBtn.waitFor({ state: 'visible', timeout: 10000 });
    await danielBtn.click({ force: true });


    // Wait for AT-A-GLANCE with a strict timeout (e.g., 5 seconds) to prove it didn't do the 30-60s generation
    await page.waitForSelector('text=AT-A-GLANCE', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    console.log(`Dashboard loaded in ${loadTime}ms`);

    // Verify "See narrative" is present in the Medications section
    const seeNarrative = page.getByText('See narrative');
    await expect(seeNarrative.first()).toBeVisible();

    await page.screenshot({ path: 'gcp_daniel_dashboard.png' });
});
