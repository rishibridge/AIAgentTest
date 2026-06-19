const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to Vite app
  console.log("Navigating to http://localhost:5173");
  await page.goto('http://localhost:5173');
  
  // Wait for React to render
  await page.waitForSelector('.chat-input');
  
  // Upload Document
  console.log("Uploading document...");
  await page.setInputFiles('input[type="file"]', 'patient_note.txt');
  
  // Wait for extraction to complete (uploadStatus should update)
  await page.waitForTimeout(6000); // Give LLM time to extract
  
  // Type question
  await page.fill('.chat-input', 'Did the PCP breach the standard of care based on the uploaded document?');
  
  // Click analyze
  await page.click('.analyze-btn');
  
  // Wait for result
  console.log("Waiting for analysis results...");
  await page.waitForSelector('.adjudication-result', { timeout: 60000 });
  
  // Save playground screenshot
  await page.screenshot({ path: 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\ca2ff006-9702-45ed-926b-7e662a586bfb\\prism_ui_screenshot.png' });
  console.log("Playground screenshot saved.");

  // Test Memory Inspector
  console.log("Navigating to Memory Inspector...");
  await page.click('text="Memory Inspector"');
  await page.waitForTimeout(2000); // let it fetch
  await page.screenshot({ path: 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\ca2ff006-9702-45ed-926b-7e662a586bfb\\memory_inspector_screenshot.png' });
  console.log("Memory Inspector screenshot saved.");

  // Test Reasoning Viewer
  console.log("Navigating to Reasoning Viewer...");
  await page.click('text="Reasoning Viewer"');
  await page.waitForTimeout(2000); // let it fetch
  await page.screenshot({ path: 'C:\\Users\\rishi\\.gemini\\antigravity\\brain\\ca2ff006-9702-45ed-926b-7e662a586bfb\\reasoning_viewer_screenshot.png' });
  console.log("Reasoning Viewer screenshot saved.");

  await browser.close();
})();
