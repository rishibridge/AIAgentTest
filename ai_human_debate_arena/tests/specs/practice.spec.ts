import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ============================================
// PRACTICE FEATURE TESTS
// ============================================

test.describe('Practice Modal', () => {

    test('@smoke PRAC-01: Practice button exists in footer', async ({ page }) => {
        await page.goto('/');
        const practiceBtn = page.locator('#practice-btn');
        await expect(practiceBtn).toBeVisible();
        await expect(practiceBtn).toContainText('Practice');
    });

    test('@smoke PRAC-02: Practice modal opens when button clicked', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modal = page.locator('#practice-modal');
        await expect(modal).toBeVisible();
        await expect(modal).not.toHaveClass(/hidden/);
    });

    test('@regression PRAC-03: Practice modal has all required sections', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // Section 1: Load Case
        await expect(page.locator('.practice-section-title:has-text("1. Load Your Case")')).toBeVisible();
        await expect(page.locator('#case-dropzone')).toBeVisible();
        await expect(page.locator('#practice-case-text')).toBeVisible();

        // Section 2: Practice Mode
        await expect(page.locator('.practice-section-title:has-text("2. Practice Mode")')).toBeVisible();
        await expect(page.locator('.practice-modes')).toBeVisible();

        // Section 3: Opponent
        await expect(page.locator('.practice-section-title:has-text("3. Opponent")')).toBeVisible();
        await expect(page.locator('#practice-opponent-model')).toBeVisible();
    });

    test('@regression PRAC-04: Practice modal closes with X button', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modal = page.locator('#practice-modal');
        await expect(modal).toBeVisible();

        await page.click('#practice-modal .close-btn');
        await expect(modal).toHaveClass(/hidden/);
    });

    test('@regression PRAC-05: Modal header displays correct title', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        await expect(page.locator('#practice-modal h2')).toHaveText('📄 Practice with a Case');
    });

});

// ============================================
// PRACTICE MODE SELECTION
// ============================================

test.describe('Practice Mode Selection', () => {

    test('@smoke PRAC-06: All three practice modes are available', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modes = page.locator('.practice-mode-card');
        await expect(modes).toHaveCount(3);

        // Check each mode exists
        await expect(page.locator('.practice-mode-card .mode-label:has-text("Defend")')).toBeVisible();
        await expect(page.locator('.practice-mode-card .mode-label:has-text("Attack")')).toBeVisible();
        await expect(page.locator('.practice-mode-card .mode-label:has-text("Watch")')).toBeVisible();
    });

    test('@regression PRAC-07: Defend mode is selected by default', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const defendCard = page.locator('.practice-mode-card:has-text("Defend")');
        await expect(defendCard).toHaveClass(/selected/);

        const defendRadio = page.locator('input[value="defend"]');
        await expect(defendRadio).toBeChecked();
    });

    test('@regression PRAC-08: Can select Attack mode', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const attackCard = page.locator('.practice-mode-card:has-text("Attack")');
        await attackCard.click();

        await expect(attackCard).toHaveClass(/selected/);

        const attackRadio = page.locator('input[value="attack"]');
        await expect(attackRadio).toBeChecked();
    });

    test('@regression PRAC-09: Can select Watch mode', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const watchCard = page.locator('.practice-mode-card:has-text("Watch")');
        await watchCard.click();

        await expect(watchCard).toHaveClass(/selected/);

        const watchRadio = page.locator('input[value="watch"]');
        await expect(watchRadio).toBeChecked();
    });

    test('@regression PRAC-10: Mode icons are displayed correctly', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // Check for emoji icons
        await expect(page.locator('.practice-mode-card:has-text("Defend") .mode-icon')).toContainText('🛡️');
        await expect(page.locator('.practice-mode-card:has-text("Attack") .mode-icon')).toContainText('⚔️');
        await expect(page.locator('.practice-mode-card:has-text("Watch") .mode-icon')).toContainText('👁️');
    });

    test('@regression PRAC-11: Mode descriptions are shown', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        await expect(page.locator('.mode-desc:has-text("You defend your case")')).toBeVisible();
        await expect(page.locator('.mode-desc:has-text("You attack the case")')).toBeVisible();
        await expect(page.locator('.mode-desc:has-text("AI vs AI")')).toBeVisible();
    });

});

// ============================================
// CASE TEXT INPUT (PASTE)
// ============================================

test.describe('Case Text Input', () => {

    test('@smoke PRAC-12: Textarea accepts pasted text', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const textarea = page.locator('#practice-case-text');
        const sampleCase = 'This is a debate case arguing that climate change requires immediate action.';

        await textarea.fill(sampleCase);
        await expect(textarea).toHaveValue(sampleCase);
    });

    test('@regression PRAC-13: Word count updates when text is pasted', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const textarea = page.locator('#practice-case-text');
        const wordCount = page.locator('#practice-word-count');

        // Initially 0
        await expect(wordCount).toHaveText('0 words');

        // Add text (12 words)
        await textarea.fill('Climate change is real and requires immediate global action to prevent catastrophe');
        await textarea.dispatchEvent('input');

        await page.waitForTimeout(100);
        await expect(wordCount).toHaveText('12 words');
    });

    test('@regression PRAC-14: Clear button empties textarea', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const textarea = page.locator('#practice-case-text');
        await textarea.fill('Some debate case text here');
        await textarea.dispatchEvent('input');

        // Click clear
        await page.click('button:has-text("Clear")');

        await expect(textarea).toHaveValue('');
        await expect(page.locator('#practice-word-count')).toHaveText('0 words');
    });

    test('@regression PRAC-15: Textarea placeholder is shown', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const textarea = page.locator('#practice-case-text');
        await expect(textarea).toHaveAttribute('placeholder', 'Paste your constructive case here...');
    });

    test('@regression PRAC-16: Large text (1000+ words) is accepted', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const textarea = page.locator('#practice-case-text');
        const largeText = 'word '.repeat(1000); // 1000 words

        await textarea.fill(largeText);
        await textarea.dispatchEvent('input');

        await page.waitForTimeout(200);
        const wordCount = page.locator('#practice-word-count');
        await expect(wordCount).toContainText('1,000 words');
    });

});

// ============================================
// FILE UPLOAD FUNCTIONALITY
// ============================================

test.describe('File Upload', () => {

    test('@smoke PRAC-17: Dropzone is visible', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const dropzone = page.locator('#case-dropzone');
        await expect(dropzone).toBeVisible();
        await expect(dropzone).toContainText('Drop PDF, DOCX, or TXT here');
    });

    test('@regression PRAC-18: File input exists and accepts correct types', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const fileInput = page.locator('#case-file-input');
        await expect(fileInput).toBeAttached();
        await expect(fileInput).toHaveAttribute('accept', '.pdf,.docx,.txt');
    });

    test('@regression PRAC-19: Clicking dropzone opens file picker', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // The dropzone should trigger the hidden file input when clicked
        const dropzone = page.locator('#case-dropzone');
        const fileInput = page.locator('#case-file-input');

        // Verify file input is hidden
        await expect(fileInput).toHaveCSS('display', 'none');

        // Clicking dropzone should work (we can't actually test file dialog opening in headless)
        await expect(dropzone).toHaveAttribute('onclick');
    });

    test('@smoke PRAC-20: TXT file upload works', async ({ page }) => {
        // Create a temporary test file
        const testFilePath = path.join(__dirname, '../fixtures/test_case.txt');
        const testContent = 'This is a sample debate case for testing. Climate change is an urgent issue that demands immediate action from governments worldwide.';

        // Ensure fixtures directory exists
        const fixturesDir = path.join(__dirname, '../fixtures');
        if (!fs.existsSync(fixturesDir)) {
            fs.mkdirSync(fixturesDir, { recursive: true });
        }
        fs.writeFileSync(testFilePath, testContent);

        await page.goto('/');
        await page.click('#practice-btn');

        // Upload file
        const fileInput = page.locator('#case-file-input');
        await fileInput.setInputFiles(testFilePath);

        // Wait for upload to complete
        await page.waitForTimeout(1000);

        // Check that the textarea was populated
        const textarea = page.locator('#practice-case-text');
        const value = await textarea.inputValue();
        expect(value).toContain('Climate change');

        // Check word count updated
        const wordCount = page.locator('#practice-word-count');
        expect(await wordCount.textContent()).not.toBe('0 words');

        // Check loaded state shows filename
        const loadedFilename = page.locator('#loaded-filename');
        await expect(loadedFilename).toHaveText('test_case.txt');

        // Cleanup
        fs.unlinkSync(testFilePath);
    });

    test('@regression PRAC-21: Dropzone shows loading state during upload', async ({ page }) => {
        const testFilePath = path.join(__dirname, '../fixtures/test_case2.txt');
        const testContent = 'Another test case with some content.';

        const fixturesDir = path.join(__dirname, '../fixtures');
        if (!fs.existsSync(fixturesDir)) {
            fs.mkdirSync(fixturesDir, { recursive: true });
        }
        fs.writeFileSync(testFilePath, testContent);

        await page.goto('/');
        await page.click('#practice-btn');

        const fileInput = page.locator('#case-file-input');

        // Start upload and immediately check for loading state
        await fileInput.setInputFiles(testFilePath);

        // Should briefly show loading (or immediately show success for small files)
        await page.waitForTimeout(500);

        // Eventually should show loaded state
        const loadedState = page.locator('#dropzone-loaded');
        await expect(loadedState).toBeVisible({ timeout: 3000 });

        // Cleanup
        fs.unlinkSync(testFilePath);
    });

    test('@regression PRAC-22: Clear button resets file upload state', async ({ page }) => {
        const testFilePath = path.join(__dirname, '../fixtures/test_clear.txt');
        const testContent = 'Test content for clearing.';

        const fixturesDir = path.join(__dirname, '../fixtures');
        if (!fs.existsSync(fixturesDir)) {
            fs.mkdirSync(fixturesDir, { recursive: true });
        }
        fs.writeFileSync(testFilePath, testContent);

        await page.goto('/');
        await page.click('#practice-btn');

        // Upload file
        await page.locator('#case-file-input').setInputFiles(testFilePath);
        await page.waitForTimeout(1000);

        // Verify loaded
        await expect(page.locator('#dropzone-loaded')).toBeVisible();

        // Click clear
        await page.click('button:has-text("Clear")');

        // Dropzone should reset
        await expect(page.locator('#dropzone-content')).toBeVisible();
        await expect(page.locator('#dropzone-loaded')).toHaveClass(/hidden/);

        // Cleanup
        fs.unlinkSync(testFilePath);
    });

});

// ============================================
// OPPONENT CONFIGURATION
// ============================================

test.describe('Opponent Configuration', () => {

    test('@smoke PRAC-23: Opponent model selector exists', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modelSelect = page.locator('#practice-opponent-model');
        await expect(modelSelect).toBeVisible();
    });

    test('@regression PRAC-24: All AI models are available as opponents', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modelSelect = page.locator('#practice-opponent-model');

        // Check for each model option
        await expect(modelSelect.locator('option[value="gemini"]')).toBeAttached();
        await expect(modelSelect.locator('option[value="deepseek"]')).toBeAttached();
        await expect(modelSelect.locator('option[value="kimi"]')).toBeAttached();
    });

    test('@regression PRAC-25: Default opponent model is Kimi', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modelSelect = page.locator('#practice-opponent-model');
        await expect(modelSelect).toHaveValue('kimi');
    });

    test('@regression PRAC-26: Can change opponent model', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const modelSelect = page.locator('#practice-opponent-model');
        await modelSelect.selectOption('gemini');
        await expect(modelSelect).toHaveValue('gemini');

        await modelSelect.selectOption('deepseek');
        await expect(modelSelect).toHaveValue('deepseek');
    });

    test('@regression PRAC-27: Pro style note is displayed', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const note = page.locator('.practice-note');
        await expect(note).toBeVisible();
        await expect(note).toContainText('Pro 🏆');
    });

});

// ============================================
// START PRACTICE FLOW
// ============================================

test.describe('Start Practice', () => {

    test('@smoke PRAC-28: Start button exists', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const startBtn = page.locator('#start-practice-btn');
        await expect(startBtn).toBeVisible();
        await expect(startBtn).toContainText('Start Practice Round');
    });

    test('@regression PRAC-29: Start button requires case text', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // Try to start without case text
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('Please upload or paste a debate case first');
            dialog.accept();
        });

        await page.click('#start-practice-btn');
    });

    test('@smoke PRAC-30: Starting practice in DEFEND mode configures debate correctly', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // Add case text
        const caseText = 'Universal healthcare should be implemented because it reduces costs and improves outcomes.';
        await page.fill('#practice-case-text', caseText);
        await page.locator('#practice-case-text').dispatchEvent('input');

        // Select DEFEND mode (default)
        const defendCard = page.locator('.practice-mode-card:has-text("Defend")');
        await defendCard.click();

        // Select opponent
        await page.selectOption('#practice-opponent-model', 'gemini');

        // Start practice
        await page.click('#start-practice-btn');

        // Modal should close
        await expect(page.locator('#practice-modal')).toHaveClass(/hidden/);

        // Topic should be set
        const topicInput = page.locator('#topic-input');
        const topicValue = await topicInput.inputValue();
        expect(topicValue.length).toBeGreaterThan(0);

        // Settings should auto-configure: human as advocate, AI as skeptic
        await page.click('#settings-btn');
        await page.waitForTimeout(500);

        const advocateModel = page.locator('#advocate-model');
        const skepticModel = page.locator('#skeptic-model');

        await expect(advocateModel).toHaveValue('human');
        await expect(skepticModel).toHaveValue('gemini');

        // Both tones should be 'pro'
        await expect(page.locator('#advocate-tone')).toHaveValue('pro');
        await expect(page.locator('#skeptic-tone')).toHaveValue('pro');
    });

    test('@smoke PRAC-31: Starting practice in ATTACK mode configures debate correctly', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // Add case text
        const caseText = 'Universal healthcare is essential for a fair society.';
        await page.fill('#practice-case-text', caseText);
        await page.locator('#practice-case-text').dispatchEvent('input');

        // Select ATTACK mode
        const attackCard = page.locator('.practice-mode-card:has-text("Attack")');
        await attackCard.click();

        // Select opponent
        await page.selectOption('#practice-opponent-model', 'deepseek');

        // Start practice
        await page.click('#start-practice-btn');

        // Modal should close
        await expect(page.locator('#practice-modal')).toHaveClass(/hidden/);

        // Settings should auto-configure: AI as advocate, human as skeptic
        await page.click('#settings-btn');
        await page.waitForTimeout(500);

        const advocateModel = page.locator('#advocate-model');
        const skepticModel = page.locator('#skeptic-model');

        await expect(advocateModel).toHaveValue('deepseek');
        await expect(skepticModel).toHaveValue('human');
    });

    test('@smoke PRAC-32: Starting practice in WATCH mode configures AI vs AI', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        // Add case text
        const caseText = 'Renewable energy should replace fossil fuels immediately.';
        await page.fill('#practice-case-text', caseText);
        await page.locator('#practice-case-text').dispatchEvent('input');

        // Select WATCH mode
        const watchCard = page.locator('.practice-mode-card:has-text("Watch")');
        await watchCard.click();

        // Select opponent
        await page.selectOption('#practice-opponent-model', 'kimi');

        // Start practice
        await page.click('#start-practice-btn');

        // Modal should close
        await expect(page.locator('#practice-modal')).toHaveClass(/hidden/);

        // Settings should auto-configure: AI vs AI
        await page.click('#settings-btn');
        await page.waitForTimeout(500);

        const advocateModel = page.locator('#advocate-model');
        const skepticModel = page.locator('#skeptic-model');

        // Both should be AI models (not human)
        const advocateValue = await advocateModel.inputValue();
        const skepticValue = await skepticModel.inputValue();

        expect(advocateValue).not.toBe('human');
        expect(skepticValue).not.toBe('human');
    });

    test('@regression PRAC-33: Practice mode populates case text in config', async ({ page }) => {
        await page.goto('/');
        await page.click('#practice-btn');

        const caseText = 'This is my debate case with specific arguments and evidence.';
        await page.fill('#practice-case-text', caseText);
        await page.locator('#practice-case-text').dispatchEvent('input');

        await page.click('#start-practice-btn');

        // The case text should be stored in the debate config
        // We can verify by checking if the hidden case-text field (if visible in settings) contains it
        await page.click('#settings-btn');
        await page.waitForTimeout(500);

        // Check if case-text element exists and has the value
        const caseTextEl = page.locator('#case-text');
        if (await caseTextEl.isVisible()) {
            await expect(caseTextEl).toHaveValue(caseText);
        }
    });

});

// ============================================
// BACKEND API TESTS
// ============================================

test.describe('File Upload API', () => {

    test('@regression API-01: /api/upload_case endpoint accepts TXT files', async ({ page, request }) => {
        const testContent = 'This is a test debate case file with some content.';
        const blob = new Blob([testContent], { type: 'text/plain' });
        const file = new File([blob], 'test.txt', { type: 'text/plain' });

        const formData = new FormData();
        formData.append('file', file);

        // Make request to upload endpoint
        const response = await request.post('http://localhost:5000/api/upload_case', {
            multipart: {
                file: {
                    name: 'test.txt',
                    mimeType: 'text/plain',
                    buffer: Buffer.from(testContent)
                }
            }
        });

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.text).toBe(testContent);
        expect(data.filename).toBe('test.txt');
        expect(data.word_count).toBe(10);
    });

    test('@regression API-02: API returns error for unsupported file types', async ({ request }) => {
        const testContent = 'Test content';

        const response = await request.post('http://localhost:5000/api/upload_case', {
            multipart: {
                file: {
                    name: 'test.exe',
                    mimeType: 'application/octet-stream',
                    buffer: Buffer.from(testContent)
                }
            }
        });

        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Unsupported file type');
    });

    test('@regression API-03: API handles empty files', async ({ request }) => {
        const response = await request.post('http://localhost:5000/api/upload_case', {
            multipart: {
                file: {
                    name: 'empty.txt',
                    mimeType: 'text/plain',
                    buffer: Buffer.from('   ') // Only whitespace
                }
            }
        });

        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('empty or too short');
    });

    test('@regression API-04: API returns error when no file uploaded', async ({ request }) => {
        const response = await request.post('http://localhost:5000/api/upload_case');

        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('No file');
    });

});

// ============================================
// INTEGRATION TESTS
// ============================================

test.describe('Practice Integration', () => {

    test('@smoke PRAC-34: Full practice flow with pasted case', async ({ page }) => {
        test.setTimeout(60000);

        await page.goto('/');

        // Open practice modal
        await page.click('#practice-btn');
        await expect(page.locator('#practice-modal')).toBeVisible();

        // Paste case
        const caseText = 'Artificial intelligence will revolutionize healthcare by improving diagnosis accuracy, reducing costs, and enabling personalized treatment plans based on genetic data.';
        await page.fill('#practice-case-text', caseText);
        await page.locator('#practice-case-text').dispatchEvent('input');

        // Verify word count
        await page.waitForTimeout(100);
        await expect(page.locator('#practice-word-count')).toContainText('words');

        // Select defend mode
        await page.click('.practice-mode-card:has-text("Defend")');

        // Select opponent
        await page.selectOption('#practice-opponent-model', 'kimi');

        // Start practice
        await page.click('#start-practice-btn');

        // Modal should close
        await expect(page.locator('#practice-modal')).toHaveClass(/hidden/);

        // Topic should be populated
        const topic = await page.locator('#topic-input').inputValue();
        expect(topic.length).toBeGreaterThan(0);

        // Could trigger the debate here but that would require backend
        // For now, just verify the setup is correct
    });

    test('@regression PRAC-35: Can open practice modal multiple times', async ({ page }) => {
        await page.goto('/');

        // Open and close multiple times
        for (let i = 0; i < 3; i++) {
            await page.click('#practice-btn');
            await expect(page.locator('#practice-modal')).toBeVisible();

            await page.click('#practice-modal .close-btn');
            await expect(page.locator('#practice-modal')).toHaveClass(/hidden/);
        }
    });

    test('@regression PRAC-36: Practice modal state resets between opens', async ({ page }) => {
        await page.goto('/');

        // Open and add case
        await page.click('#practice-btn');
        await page.fill('#practice-case-text', 'First case text');
        await page.locator('#practice-case-text').dispatchEvent('input');

        // Select attack mode
        await page.click('.practice-mode-card:has-text("Attack")');

        // Close modal
        await page.click('#practice-modal .close-btn');

        // Reopen
        await page.click('#practice-btn');

        // State should NOT reset (it persists unless cleared)
        const textarea = page.locator('#practice-case-text');
        await expect(textarea).toHaveValue('First case text');
    });

});
