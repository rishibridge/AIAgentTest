const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Log console messages from the page
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('1. Loading page...');
    await page.goto('http://127.0.0.1:8081');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('2. Opening Practice modal...');
    await page.click('#practice-btn');
    await page.waitForTimeout(500);

    console.log('3. Uploading case file...');
    const caseFilePath = path.join(__dirname, 'sample_cases/ubi_case.txt');
    const fileInput = await page.$('#case-file-input');
    await fileInput.setInputFiles(caseFilePath);
    await page.waitForTimeout(1500);

    const textareaContent = await page.inputValue('#practice-case-text');
    console.log(`   Case loaded: ${textareaContent.split(/\s+/).length} words`);

    console.log('4. Selecting Attack mode...');
    await page.click('label.practice-mode-card:has(input[value="attack"])');
    await page.waitForTimeout(300);

    console.log('5. Taking screenshot before clicking Start...');
    await page.screenshot({ path: 'debug-before-start.png', fullPage: true });

    console.log('6. Clicking Start Practice Round...');
    await page.click('#start-practice-btn');

    console.log('7. Waiting 10 seconds...');
    await page.waitForTimeout(10000);

    console.log('8. Taking screenshot after start...');
    await page.screenshot({ path: 'debug-after-start.png', fullPage: true });

    // Check various elements
    const modalVisible = await page.isVisible('#practice-modal.visible');
    const transcriptContent = await page.$eval('#transcript-container', el => el.textContent || '');
    const transcriptHTML = await page.$eval('#transcript-container', el => el.innerHTML);

    console.log('\nDEBUG INFO:');
    console.log('  Modal still visible:', modalVisible);
    console.log('  Transcript text length:', transcriptContent.length);
    console.log('  Transcript HTML length:', transcriptHTML.length);
    console.log('\nTranscript HTML (first 500 chars):');
    console.log(transcriptHTML.substring(0, 500));

    console.log('\n9. Waiting 20 more seconds for debate to proceed...');
    await page.waitForTimeout(20000);

    console.log('10. Final screenshot...');
    await page.screenshot({ path: 'debug-final.png', fullPage: true });

    const finalTranscript = await page.$eval('#transcript-container', el => el.textContent || '');
    console.log('\nFinal transcript length:', finalTranscript.length);
    if (finalTranscript.length > 0) {
      console.log('First 500 chars:', finalTranscript.substring(0, 500));
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    await page.screenshot({ path: 'debug-error.png' });
  } finally {
    console.log('\nPress Enter to close browser...');
    // await browser.close();
  }
})();
