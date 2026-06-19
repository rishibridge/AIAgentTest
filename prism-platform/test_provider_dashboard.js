const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  const artifactDir = 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\3b03917f-6614-4476-a5db-517ccfe72059\\';

  try {
    console.log("1. Navigating to http://localhost:5173");
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(artifactDir, 'test01_hub.png') });

    console.log("2. Clicking Provider Dashboard...");
    await page.click('text="Provider Dashboard"');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'test02_patient_picker.png') });

    console.log("3. Selecting Elena Ramirez...");
    await page.click('text="Elena Ramirez"');
    
    console.log("4. Capturing loading state...");
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'test03_loading.png') });
    
    console.log("Waiting for Clinical Profile to load...");
    await page.waitForSelector('text="Demographics"', { timeout: 45000 });
    await page.waitForTimeout(2000); // give mermaid time to render

    console.log("5. Capturing profile top (Privacy Flag, Demographics, Graph)...");
    await page.screenshot({ path: path.join(artifactDir, 'test04_profile_top.png') });

    console.log("6. Clicking AI Reasoning Transcript toggle...");
    await page.click('text="View AI Reasoning Transcript"');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'test05_transcript.png') });

    console.log("7. Scrolling left panel to bottom (SOAP Note)...");
    await page.evaluate(() => {
      // Find the scrollable div containing the clinical profile
      const scrollable = Array.from(document.querySelectorAll('div')).find(el => el.style.overflowY === 'auto' && el.innerHTML.includes('SOAP Note'));
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'test06_soap.png') });

    console.log("8. Testing DDx Arena Defend Mode...");
    await page.click('text="[Defend a Diagnosis]"');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'test07_defend_mode.png') });

    console.log("9. Typing clinical reasoning and sending...");
    await page.fill('input[placeholder="Message the DDx Copilot..."]', 'I believe this is Major Depressive Disorder based on the sleep disruption.');
    await page.keyboard.press('Enter');
    
    console.log("10. Waiting for response...");
    await page.waitForTimeout(10000); // Wait for LLM to stream back
    await page.screenshot({ path: path.join(artifactDir, 'test08_llm_response.png') });

    console.log("All tests completed successfully.");
  } catch (err) {
    console.error("Test failed:", err);
    await page.screenshot({ path: path.join(artifactDir, 'error_state.png') });
  } finally {
    await browser.close();
  }
})();
