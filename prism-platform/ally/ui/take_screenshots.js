import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  const artifactDir = 'C:/Users/rishi/.gemini/antigravity/brain/3b03917f-6614-4476-a5db-517ccfe72059';

  console.log("Navigating to local preview URL...");
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${artifactDir}/test_01_landing.png` });
  
  console.log("Clicking 'Start Presentation' button...");
  await page.click('text=START PRESENTATION');
  await page.waitForTimeout(2000);
  const html = await page.content();
  await page.screenshot({ path: `${artifactDir}/test_debug.png` });
  if (!html.includes('Begin Presentation')) {
    console.error("ERROR: 'Begin Presentation' not found in HTML. Body text: ");
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(bodyText);
    await browser.close();
    process.exit(1);
  }

  console.log("Clicking 'Begin Presentation'...");
  await page.click('text=Begin Presentation');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${artifactDir}/test_02_intro.png` });

  console.log("Clicking 'Skip Hook'...");
  await page.click('text=Skip Hook');
  await page.waitForTimeout(2000);

  console.log("Waiting for Patient Profile...");
  try {
    await page.waitForSelector('text=Patient profile', { timeout: 15000 });
  } catch(e) {
    console.log("Could not find Patient Profile. HTML Dump:");
    console.log(await page.content());
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${artifactDir}/test_03_profile.png` });

  console.log("Navigating to Adversarial Reasoning Layer...");
  const nextBtn = page.locator('button[title="Step Forward"]');
  let found = false;
  for (let i = 0; i < 30; i++) {
    await nextBtn.click();
    await page.waitForTimeout(600);
    const isVisible = await page.locator('text=Adversarial Reasoning Layer').isVisible().catch(() => false);
    if (isVisible) {
      found = true;
      break;
    }
  }

  if(!found) {
    console.error("Could not find Adversarial Reasoning Layer!");
  } else {
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${artifactDir}/test_04_reasoning.png` });
    console.log("Took screenshot of reasoning layer.");
  }

  console.log("Clicking next to see handoff...");
  await nextBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${artifactDir}/test_05_handoff.png` });

  await browser.close();
  console.log("Done successfully.");
})();
