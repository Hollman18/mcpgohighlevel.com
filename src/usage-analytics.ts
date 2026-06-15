import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AccountUsageRecord = {
  accountId: string;
  firstConnectedAt: string;
  lastConnectedAt: string;
  lastSeenAt: string;
  authorizationCount: number;
  requestCount: number;
  clients: string[];
};

type UsageDatabase = {
  version: 1;
  accounts: Record<string, AccountUsageRecord>;
};

export type UsageAccountSummary = AccountUsageRecord & {
  status: 'active' | 'inactive';
};

export type UsageSummary = {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  activeWindowDays: number;
  totalAuthorizations: number;
  totalRequests: number;
  generatedAt: string;
  accounts: UsageAccountSummary[];
};

const EMPTY_DATABASE: UsageDatabase = { version: 1, accounts: {} };

export class UsageAnalytics {
  private database: UsageDatabase = structuredClone(EMPTY_DATABASE);
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath = process.env.MCP_USAGE_DATA_PATH || path.resolve(process.cwd(), 'data/usage.json'),
    private readonly activeWindowDays = positiveInteger(process.env.MCP_USAGE_ACTIVE_DAYS, 30),
    private readonly hashSalt = process.env.MCP_USAGE_HASH_SALT || process.env.MCP_OAUTH_SECRET || 'ghl-mcp-usage',
  ) {}

  async recordAuthorization(locationId: string, clientId?: string): Promise<void> {
    await this.update(locationId, (record, now) => {
      record.lastConnectedAt = now;
      record.lastSeenAt = now;
      record.authorizationCount += 1;
      addClient(record, clientId);
    });
  }

  async recordActivity(locationId: string, clientId?: string): Promise<void> {
    await this.update(locationId, (record, now) => {
      record.lastSeenAt = now;
      record.requestCount += 1;
      addClient(record, clientId);
    });
  }

  async getSummary(now = new Date()): Promise<UsageSummary> {
    await this.ensureLoaded();
    const activeThreshold = now.getTime() - this.activeWindowDays * 24 * 60 * 60 * 1000;
    const accounts = Object.values(this.database.accounts)
      .map((record): UsageAccountSummary => ({
        ...record,
        status: new Date(record.lastSeenAt).getTime() >= activeThreshold ? 'active' : 'inactive',
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

    const activeAccounts = accounts.filter((account) => account.status === 'active').length;
    return {
      totalAccounts: accounts.length,
      activeAccounts,
      inactiveAccounts: accounts.length - activeAccounts,
      activeWindowDays: this.activeWindowDays,
      totalAuthorizations: accounts.reduce((total, account) => total + account.authorizationCount, 0),
      totalRequests: accounts.reduce((total, account) => total + account.requestCount, 0),
      generatedAt: now.toISOString(),
      accounts,
    };
  }

  private async update(
    locationId: string,
    updater: (record: AccountUsageRecord, now: string) => void,
  ): Promise<void> {
    if (!locationId) return;
    await this.ensureLoaded();
    const accountId = this.hashLocationId(locationId);
    const now = new Date().toISOString();
    const record = this.database.accounts[accountId] || {
      accountId,
      firstConnectedAt: now,
      lastConnectedAt: now,
      lastSeenAt: now,
      authorizationCount: 0,
      requestCount: 0,
      clients: [],
    };
    updater(record, now);
    this.database.accounts[accountId] = record;
    await this.persist();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as UsageDatabase;
      if (parsed.version === 1 && parsed.accounts && typeof parsed.accounts === 'object') {
        this.database = parsed;
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        process.stderr.write(`[UsageAnalytics] Could not read ${this.filePath}: ${error.message}\n`);
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.database, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    }).catch((error) => {
      process.stderr.write(`[UsageAnalytics] Could not persist usage data: ${error.message}\n`);
    });
    await this.writeChain;
  }

  private hashLocationId(locationId: string): string {
    return createHash('sha256')
      .update(`${this.hashSalt}:${locationId}`)
      .digest('hex')
      .slice(0, 16);
  }
}

function addClient(record: AccountUsageRecord, clientId?: string): void {
  const normalized = String(clientId || '').trim().slice(0, 80);
  if (!normalized || record.clients.includes(normalized)) return;
  record.clients = [...record.clients, normalized].slice(-10);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
