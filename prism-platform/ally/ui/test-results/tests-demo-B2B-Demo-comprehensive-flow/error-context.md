# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\demo.spec.js >> B2B Demo comprehensive flow
- Location: tests\demo.spec.js:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Begin Presentation')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Begin Presentation')

```

```yaml
- text: Castle Behavioral Health
- heading "Ally" [level=1]
- paragraph: Your patient companion that remembers, knows, cares, and collaborates.
- button "Demo Mode Guided 16-phase walkthrough of Elena & Daniel's stories. Perfect for presentations. Start Presentation →"
- button "Patient Chat Experience the companion from the patient's perspective. Talk to the AI directly. Start Chat →"
- button "Provider Dashboard Access the Neural Graph, clinical reasoning, and Interactive DDx Arena interface. Open Dashboard →"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('B2B Demo comprehensive flow', async ({ page }) => {
  4  |   const artifactDir = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';
  5  | 
  6  |   // 1. Navigate to the local server
  7  |   await page.goto('https://prism-platform-525536279111.us-central1.run.app');
  8  |   await page.waitForTimeout(2000);
  9  |   await page.screenshot({ path: `${artifactDir}/test_01_landing.png` });
  10 | 
  11 |   // 2. Start the presentation
  12 |   const demoButton = page.locator('text=Start Presentation');
  13 |   await expect(demoButton).toBeVisible();
  14 |   await demoButton.click();
  15 | 
  16 |   // 3. Verify IntroSequence starts playing
  17 |   const beginBtn = page.locator('text=Begin Presentation');
> 18 |   await expect(beginBtn).toBeVisible({ timeout: 5000 });
     |                          ^ Error: expect(locator).toBeVisible() failed
  19 |   await beginBtn.click();
  20 | 
  21 |   await page.waitForTimeout(2000);
  22 |   await page.screenshot({ path: `${artifactDir}/test_02_intro.png` });
  23 |   
  24 |   await page.locator('body').click(); // Focus body for keydown
  25 |   for(let i=0; i<15; i++) {
  26 |     await page.keyboard.press('ArrowRight');
  27 |     await page.waitForTimeout(400);
  28 |   }
  29 | 
  30 |   // 4. Wait for the main UI (Patient profile or Virtual Brain)
  31 |   await expect(page.locator('text=Patient profile')).toBeVisible({ timeout: 15000 });
  32 |   await page.screenshot({ path: `${artifactDir}/test_03_profile.png` });
  33 | 
  34 |   // 5. Click Next multiple times to traverse the phases until we see Adversarial Reasoning Layer
  35 |   const nextBtn = page.locator('button[title="Step Forward"]');
  36 |   
  37 |   // We need to click "Next" until the text "Adversarial Reasoning Layer" appears
  38 |   let foundReasoning = false;
  39 |   for(let i=0; i<30; i++) {
  40 |     await nextBtn.click();
  41 |     await page.waitForTimeout(400); // small delay to allow react to render
  42 |     
  43 |     const isVisible = await page.locator('text=Adversarial Reasoning Layer').isVisible();
  44 |     if(isVisible) {
  45 |       foundReasoning = true;
  46 |       break;
  47 |     }
  48 |   }
  49 | 
  50 |   expect(foundReasoning).toBeTruthy();
  51 | 
  52 |   // 6. Verify Proposer, Skeptic, and Arbiter are visible
  53 |   await expect(page.locator('text=Proposer Agent')).toBeVisible();
  54 |   await expect(page.locator('text=Skeptic Agent')).toBeVisible();
  55 |   await expect(page.locator('text=Arbiter Agent')).toBeVisible();
  56 |   await page.waitForTimeout(1000);
  57 |   await page.screenshot({ path: `${artifactDir}/test_04_reasoning.png` });
  58 | 
  59 |   // 7. Click next to see handoff
  60 |   await nextBtn.click();
  61 |   await expect(page.locator('text=Clinical Handoff Package')).toBeVisible();
  62 |   await page.waitForTimeout(1000);
  63 |   await page.screenshot({ path: `${artifactDir}/test_05_handoff.png` });
  64 |   
  65 |   console.log('✅ Browser test passed: Successfully navigated B2B Demo, reached Adversarial Reasoning Layer, and validated agents.');
  66 | });
  67 | 
```