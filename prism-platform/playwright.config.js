const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 30000,
  },
});
