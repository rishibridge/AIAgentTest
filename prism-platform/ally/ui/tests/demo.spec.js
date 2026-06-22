import { test, expect } from '@playwright/test';

test('B2B Demo comprehensive flow', async ({ page }) => {
  const artifactDir = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';

  // 1. Navigate to the local server
  await page.goto('https://prism-platform-525536279111.us-central1.run.app');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${artifactDir}/test_01_landing.png` });

  // 2. Start the presentation
  const demoButton = page.locator('text=Start Presentation');
  await expect(demoButton).toBeVisible();
  await demoButton.click();

  // 3. Verify IntroSequence starts playing
  const beginBtn = page.locator('text=Begin Presentation');
  await expect(beginBtn).toBeVisible({ timeout: 5000 });
  await beginBtn.click();

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${artifactDir}/test_02_intro.png` });
  
  await page.locator('body').click(); // Focus body for keydown
  for(let i=0; i<15; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
  }

  // 4. Wait for the main UI (Patient profile or Virtual Brain)
  await expect(page.locator('text=Patient profile')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${artifactDir}/test_03_profile.png` });

  // 5. Click Next multiple times to traverse the phases until we see Adversarial Reasoning Layer
  const nextBtn = page.locator('button[title="Step Forward"]');
  
  // We need to click "Next" until the text "Adversarial Reasoning Layer" appears
  let foundReasoning = false;
  for(let i=0; i<30; i++) {
    await nextBtn.click();
    await page.waitForTimeout(400); // small delay to allow react to render
    
    const isVisible = await page.locator('text=Adversarial Reasoning Layer').isVisible();
    if(isVisible) {
      foundReasoning = true;
      break;
    }
  }

  expect(foundReasoning).toBeTruthy();

  // 6. Verify Proposer, Skeptic, and Arbiter are visible
  await expect(page.locator('text=Proposer Agent')).toBeVisible();
  await expect(page.locator('text=Skeptic Agent')).toBeVisible();
  await expect(page.locator('text=Arbiter Agent')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/test_04_reasoning.png` });

  // 7. Click next to see handoff
  await nextBtn.click();
  await expect(page.locator('text=Clinical Handoff Package')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/test_05_handoff.png` });
  
  console.log('✅ Browser test passed: Successfully navigated B2B Demo, reached Adversarial Reasoning Layer, and validated agents.');
});
