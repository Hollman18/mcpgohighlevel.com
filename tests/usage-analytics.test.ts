import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { UsageAnalytics } from '../src/usage-analytics';

describe('UsageAnalytics', () => {
  it('counts unique anonymized accounts and classifies activity', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ghl-mcp-usage-'));
    const filePath = path.join(directory, 'usage.json');
    try {
      const analytics = new UsageAnalytics(filePath, 30, 'test-salt');
      await analytics.recordAuthorization('location-one', 'claude');
      await analytics.recordActivity('location-one', 'claude');
      await analytics.recordAuthorization('location-two', 'codex');

      const summary = await analytics.getSummary(new Date());
      expect(summary.totalAccounts).toBe(2);
      expect(summary.activeAccounts).toBe(2);
      expect(summary.inactiveAccounts).toBe(0);
      expect(summary.totalAuthorizations).toBe(2);
      expect(summary.totalRequests).toBe(1);
      expect(summary.accounts[0].accountId).not.toContain('location');

      const stored = await readFile(filePath, 'utf8');
      expect(stored).not.toContain('location-one');
      expect(stored).not.toContain('location-two');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('marks accounts inactive outside the configured activity window', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ghl-mcp-usage-'));
    try {
      const analytics = new UsageAnalytics(path.join(directory, 'usage.json'), 30, 'test-salt');
      await analytics.recordAuthorization('location-one', 'client');
      const future = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      const summary = await analytics.getSummary(future);
      expect(summary.activeAccounts).toBe(0);
      expect(summary.inactiveAccounts).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
