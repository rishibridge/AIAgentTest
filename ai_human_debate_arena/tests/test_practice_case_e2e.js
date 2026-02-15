const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CASES = [
  {
    name: 'UBI Case - Watch Mode',
    file: 'sample_cases/ubi_case.txt',
    mode: 'watch', // AI vs AI
    keyTerms: ['Universal Basic Income', 'UBI', 'Alaska Permanent Fund', 'Roosevelt Institute', 'automation', 'McKinsey'],
    keyClaims: ['$1,000/month', '73 million US jobs', 'Finland', '47% of US employment'],
    topic: 'universal basic income'
  },
  {
    name: 'UBI Case - Defend Mode',
    file: 'sample_cases/ubi_case.txt',
    mode: 'defend', // Human defends, AI attacks
    keyTerms: ['Universal Basic Income', 'UBI', 'Alaska Permanent Fund', 'Roosevelt Institute', 'automation', 'McKinsey'],
    keyClaims: ['$1,000/month', '73 million US jobs', 'Finland', '47% of US employment'],
    topic: 'universal basic income'
  },
  {
    name: 'Carbon Tax Case - Watch Mode',
    file: 'sample_cases/carbon_tax_case.txt',
    mode: 'watch',
    keyTerms: ['carbon tax', 'IPCC', 'British Columbia', 'emissions', 'climate'],
    keyClaims: ['1.5°C', 'Sweden', '$75/ton', '8.7 million deaths'],
    topic: 'carbon pricing'
  }
];

async function runTest(testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testCase.name}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to main page
    console.log('1. Loading main page...');
    await page.goto('http://127.0.0.1:8081');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Practice button
    console.log('2. Opening Practice modal...');
    await page.click('#practice-btn');
    await page.waitForTimeout(500);

    // Verify modal is visible
    const modalVisible = await page.isVisible('#practice-modal.visible');
    if (!modalVisible) {
      throw new Error('Practice modal did not open');
    }
    console.log('   ✓ Practice modal opened');

    // Read case file
    const caseFilePath = path.join(__dirname, testCase.file);
    const caseContent = fs.readFileSync(caseFilePath, 'utf-8');
    const wordCount = caseContent.split(/\s+/).length;
    console.log(`3. Loading case file: ${testCase.file} (${wordCount} words)`);

    // Upload case file via file input
    const fileInput = await page.$('#case-file-input');
    await fileInput.setInputFiles(caseFilePath);
    await page.waitForTimeout(500);

    // Verify case loaded in textarea
    await page.waitForTimeout(1000); // Wait for file to be processed
    const textareaContent = await page.inputValue('#practice-case-text');
    if (textareaContent.length === 0) {
      throw new Error('Case file was not loaded into textarea');
    }
    console.log(`   ✓ Case loaded (${textareaContent.split(/\s+/).length} words in textarea)`);

    // Select practice mode from test case config
    const modeLabels = {
      watch: 'Watch (AI vs AI)',
      defend: 'Defend (Human FOR, AI AGAINST)',
      attack: 'Attack (Human AGAINST, AI FOR)'
    };
    console.log(`4. Selecting practice mode: ${modeLabels[testCase.mode]}...`);
    await page.click(`label.practice-mode-card:has(input[value="${testCase.mode}"])`);
    await page.waitForTimeout(300);

    // AI opponent is auto-selected (default in dropdown)
    console.log('   ✓ Mode selected');

    // Click "Start Practice Round" button
    console.log('5. Clicking Start Practice Round...');
    await page.click('#start-practice-btn');
    await page.waitForTimeout(1000);

    // Practice modal should close and Settings modal should open
    const practiceModalClosed = !await page.isVisible('#practice-modal.visible');
    if (!practiceModalClosed) {
      throw new Error('Practice modal did not close');
    }
    console.log('   ✓ Practice modal closed');

    // Wait for Settings modal to appear
    console.log('6. Waiting for Settings modal...');
    await page.waitForSelector('#settings-modal.visible', { timeout: 5000 });
    console.log('   ✓ Settings modal opened');

    // Set debate speed to maximum (999 WPM = instant)
    console.log('   Setting speed to maximum (instant)...');
    await page.evaluate(() => {
      window.currentSpeedIndex = 12; // Max speed (999 WPM)
      const display = document.getElementById('wpm-display');
      if (display) display.textContent = '∞';
    });
    console.log('   ✓ Speed set to instant');

    // Click "Start Debate" button in Settings modal
    console.log('7. Clicking Start Debate button...');
    await page.click('#settings-start-btn');
    await page.waitForTimeout(2000);

    // Settings modal should close
    const settingsModalClosed = !await page.isVisible('#settings-modal.visible');
    if (!settingsModalClosed) {
      throw new Error('Settings modal did not close after starting debate');
    }
    console.log('   ✓ Settings modal closed, debate starting...');

    // Wait for debate to complete (until "Session closed" or max time)
    console.log('8. Waiting for debate to complete (max 5 minutes)...');
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    let turns = [];
    let debateComplete = false;
    let lastMessageCount = 0;

    while (Date.now() - startTime < maxWaitTime && !debateComplete) {
      // LIVE debate uses #discussion-stream with .message class (not .transcript-msg!)
      turns = await page.$$eval('#discussion-stream .message', elements =>
        elements.map(el => {
          // Extract role from class (msg-for, msg-against, msg-judge)
          const classes = el.className;
          let role = 'Unknown';
          if (classes.includes('msg-for')) role = 'FOR';
          else if (classes.includes('msg-against')) role = 'AGAINST';
          else if (classes.includes('msg-judge')) role = 'Judge';

          // Get text from bubble
          const bubble = el.querySelector('.bubble');
          const content = bubble ? bubble.textContent : '';

          return { speaker: role, content: content.trim() };
        })
      );

      // Check if debate ended
      const lastMessage = turns[turns.length - 1];
      if (lastMessage && lastMessage.content.includes('Session closed')) {
        debateComplete = true;
        console.log(`   ✓ Debate completed with ${turns.length} messages`);
        break;
      }

      // Progress update
      if (turns.length > lastMessageCount) {
        console.log(`   ... ${turns.length} messages captured...`);
        lastMessageCount = turns.length;
      }

      await page.waitForTimeout(10000); // Check every 10 seconds
    }

    if (!debateComplete && turns.length > 0) {
      console.log(`   ⚠ Debate timed out after ${turns.length} messages`);
    }

    if (turns.length === 0) {
      console.log('   ❌ No debate messages captured');
      // Fallback: get raw stream text for debugging
      const fullStream = await page.$eval('#discussion-stream', el => el.textContent || '').catch(() => '');
      turns = [{ speaker: 'Unknown', content: fullStream }];
    }

    // Analyze debate content
    console.log('\n9. Analyzing debate content...');
    const debateTranscript = turns.map(t => t.content).join(' ').toLowerCase();

    // Check for case-specific terms
    const termsFound = [];
    const termsMissing = [];

    for (const term of testCase.keyTerms) {
      if (debateTranscript.includes(term.toLowerCase())) {
        termsFound.push(term);
      } else {
        termsMissing.push(term);
      }
    }

    // Check for specific claims/numbers
    const claimsFound = [];
    const claimsMissing = [];

    for (const claim of testCase.keyClaims) {
      if (debateTranscript.includes(claim.toLowerCase())) {
        claimsFound.push(claim);
      } else {
        claimsMissing.push(claim);
      }
    }

    // Print results
    console.log('\n' + '─'.repeat(60));
    console.log('ANALYSIS RESULTS');
    console.log('─'.repeat(60));

    console.log(`\n📊 Debate Turns: ${turns.length}`);
    turns.forEach((turn, i) => {
      console.log(`   Turn ${i + 1}: ${turn.speaker} (${turn.content.split(/\s+/).length} words)`);
    });

    console.log(`\n🔍 Key Terms Referenced: ${termsFound.length}/${testCase.keyTerms.length}`);
    if (termsFound.length > 0) {
      console.log(`   ✓ Found: ${termsFound.join(', ')}`);
    }
    if (termsMissing.length > 0) {
      console.log(`   ✗ Missing: ${termsMissing.join(', ')}`);
    }

    console.log(`\n📋 Specific Claims/Data Referenced: ${claimsFound.length}/${testCase.keyClaims.length}`);
    if (claimsFound.length > 0) {
      console.log(`   ✓ Found: ${claimsFound.join(', ')}`);
    }
    if (claimsMissing.length > 0) {
      console.log(`   ✗ Missing: ${claimsMissing.join(', ')}`);
    }

    // Overall assessment
    const termsCoverage = termsFound.length / testCase.keyTerms.length;
    const claimsCoverage = claimsFound.length / testCase.keyClaims.length;

    console.log('\n' + '─'.repeat(60));
    console.log('VERDICT');
    console.log('─'.repeat(60));

    if (termsCoverage >= 0.5 && claimsCoverage >= 0.3) {
      console.log('✅ PASS: Case content is being picked up and debated effectively');
      console.log(`   - ${Math.round(termsCoverage * 100)}% of key terms referenced`);
      console.log(`   - ${Math.round(claimsCoverage * 100)}% of specific claims referenced`);
    } else if (termsCoverage >= 0.3 || claimsCoverage >= 0.2) {
      console.log('⚠️  PARTIAL: Case content partially referenced but could be better');
      console.log(`   - ${Math.round(termsCoverage * 100)}% of key terms referenced`);
      console.log(`   - ${Math.round(claimsCoverage * 100)}% of specific claims referenced`);
    } else {
      console.log('❌ FAIL: Case content not being effectively picked up');
      console.log(`   - Only ${Math.round(termsCoverage * 100)}% of key terms referenced`);
      console.log(`   - Only ${Math.round(claimsCoverage * 100)}% of specific claims referenced`);
    }

    // Save transcript
    const transcriptPath = `transcript_${testCase.name.replace(/\s+/g, '_')}.txt`;
    const transcript = turns.map((t, i) =>
      `TURN ${i + 1} - ${t.speaker}\n${t.content}\n\n`
    ).join('');
    fs.writeFileSync(transcriptPath, transcript);
    console.log(`\n📄 Full transcript saved: ${transcriptPath}`);

    // Take final screenshot
    const screenshotPath = `practice_${testCase.name.replace(/\s+/g, '_')}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: `error_${testCase.name.replace(/\s+/g, '_')}.png` });
  } finally {
    await browser.close();
  }
}

(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Practice with Case - End-to-End Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Run Watch mode tests only (Defend/Attack require human input)
  for (const testCase of TEST_CASES) {
    if (testCase.mode === 'watch') {
      await runTest(testCase);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('All tests completed!');
  console.log('='.repeat(60));
})();
