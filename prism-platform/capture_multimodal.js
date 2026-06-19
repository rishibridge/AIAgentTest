const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Go to Prism UI
  console.log("Navigating to http://localhost:5173");
  await page.goto('http://localhost:5173');
  
  // Wait for React to render
  await page.waitForSelector('.chat-input');
  
  // Upload PDF Document
  console.log("Uploading PDF document...");
  await page.setInputFiles('input[type="file"]', 'medical_chart.pdf');
  
  // Wait for extraction to complete
  await page.waitForTimeout(8000); // Give LLM time to extract via File API
  
  // Type question
  await page.fill('.chat-input', 'Did the hospital team give the patient Aspirin despite the allergy?');
  
  // Click analyze
  await page.click('.analyze-btn');
  
  // Wait for result
  console.log("Waiting for analysis results...");
  await page.waitForSelector('.adjudication-result', { timeout: 60000 });
  
  // Save playground screenshot
  await page.screenshot({ path: 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\ca2ff006-9702-45ed-926b-7e662a586bfb\\multimodal_playground.png' });
  console.log("Multimodal Playground screenshot saved.");

  // Test Memory Inspector
  console.log("Navigating to Memory Inspector...");
  await page.click('text="Memory Inspector"');
  await page.waitForTimeout(2000); // let it fetch
  await page.screenshot({ path: 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\ca2ff006-9702-45ed-926b-7e662a586bfb\\multimodal_memory.png' });
  console.log("Multimodal Memory Inspector screenshot saved.");

  await browser.close();
})();
