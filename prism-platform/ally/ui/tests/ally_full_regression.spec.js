// tests/ally_full_regression.spec.js
import { test, expect } from '@playwright/test';

class AllyHelpers {
  constructor(page) { this.page = page; }
  async loginPatient(email) {
    await this.page.goto('http://localhost:5176/patient/login');
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', 'pass123');
    await this.page.click('[data-testid="login-submit"]');
    await this.page.waitForSelector('[data-testid="patient-chat-input"]');
  }
  async loginProvider(email) {
    await this.page.goto('http://localhost:5176/provider/login');
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', 'pass123');
    await this.page.click('[data-testid="login-submit"]');
  }
  async msg(text) {
    await this.page.fill('[data-testid="patient-chat-input"]', text);
    await this.page.click('[data-testid="patient-send-btn"]');
    await this.page.waitForSelector('[data-testid="typing-indicator"]', { state: 'hidden' });
  }
  async reply() {
    return await this.page.locator('[data-testid="ally-message-bubble"]').last().innerText();
  }
  async providerSelect(patient) {
    await this.page.click(`text=${patient}`);
  }
}

test.describe('Ally Full 200-Scenario Regression Suite', () => {
  let patientCtx, providerCtx, pPage, drPage, ally, dr;

  test.beforeEach(async ({ browser }) => {
    patientCtx = await browser.newContext({ timezoneId: 'America/New_York' });
    providerCtx = await browser.newContext();
    pPage = await patientCtx.newPage();
    drPage = await providerCtx.newPage();
    ally = new AllyHelpers(pPage);
    dr = new AllyHelpers(drPage);
  });
  test.afterEach(async () => { await patientCtx.close(); await providerCtx.close(); });

  test('001: Initial Trust Building', async () => {
    await ally.loginPatient('p1@test.com');
    await ally.msg("I don't know if I want to talk.");
    const res = await ally.reply();
    expect(res).toMatch(/That's completely okay/i);
  });
  test('002: First Threat Spike', async () => {
    await ally.loginPatient('p2@test.com');
    await ally.msg("I'm a total failure.");
    const res = await ally.reply();
    expect(res).not.toMatch(/you're great/i);
    expect(res).toMatch(/overwhelming/i);
  });
});
