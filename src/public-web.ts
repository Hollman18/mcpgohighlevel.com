import type { Application, Request, Response } from 'express';
import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { safeTokenEquals } from './http-auth.js';
import type { UsageAnalytics, UsageSummary } from './usage-analytics.js';

const PUBLIC_PATH = path.resolve(process.cwd(), 'public');
const COVERAGE_PATH = path.resolve(process.cwd(), 'docs', 'ghl-api-coverage.json');

interface PublicEndpoint {
  key: string;
  method: string;
  path: string;
  app: string;
  summary: string;
  versions: string[];
  scopes: string[];
}

interface EndpointCatalog {
  generatedAt: string;
  coveragePercent: number;
  officialCount: number;
  coveredCount: number;
  localImplementationCount: number;
  apps: string[];
  endpoints: PublicEndpoint[];
}

export function registerPublicWebRoutes(
  app: Application,
  usageAnalytics: UsageAnalytics,
  options: { adminToken?: string; toolCount: number; mcpUrl: string },
): void {
  app.use('/assets', express.static(PUBLIC_PATH, { maxAge: '7d' }));
  app.get('/favicon.ico', (_req, res) => res.sendFile(path.join(PUBLIC_PATH, 'favicon.ico')));
  app.get(['/logo.png', '/icon.png', '/apple-touch-icon.png'], (_req, res) => {
    res.sendFile(path.join(PUBLIC_PATH, 'ghl-icon.png'));
  });

  app.get('/', (req, res) => {
    if (!String(req.get('accept') || '').includes('text/html')) {
      res.json({
        name: 'GoHighLevel MCP Server',
        version: '2.0.0',
        status: 'running',
        tools: options.toolCount,
        endpoints: { health: '/health', mcp: options.mcpUrl, sse: '/sse' },
      });
      return;
    }
    res.sendFile(path.join(PUBLIC_PATH, 'index.html'));
  });

  app.get('/site-config.json', (_req, res) => {
    res.json({ toolCount: options.toolCount, mcpUrl: options.mcpUrl, free: true });
  });

  app.get('/docs', (_req, res) => {
    res.sendFile(path.join(PUBLIC_PATH, 'docs.html'));
  });

  app.get('/api/endpoints', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(loadEndpointCatalog());
  });

  app.get('/admin/usage', requireAdmin(options.adminToken), async (_req, res) => {
    const summary = await usageAnalytics.getSummary();
    res.type('html').send(renderUsageDashboard(summary));
  });

  app.get('/admin/usage.json', requireAdmin(options.adminToken), async (_req, res) => {
    res.json(await usageAnalytics.getSummary());
  });
}

export function loadEndpointCatalog(): EndpointCatalog {
  const coverage = JSON.parse(readFileSync(COVERAGE_PATH, 'utf8')) as {
    official: { endpoints: PublicEndpoint[] };
    local: { endpoints: unknown[] };
    comparison: { coveredCount: number; officialUniqueCount: number; coveragePercent: number };
  };
  const endpoints = coverage.official.endpoints.map((endpoint) => ({
    key: endpoint.key,
    method: endpoint.method,
    path: endpoint.path,
    app: endpoint.app,
    summary: endpoint.summary || endpoint.key,
    versions: endpoint.versions || [],
    scopes: endpoint.scopes || [],
  }));

  return {
    generatedAt: new Date().toISOString(),
    coveragePercent: coverage.comparison.coveragePercent,
    officialCount: coverage.comparison.officialUniqueCount,
    coveredCount: coverage.comparison.coveredCount,
    localImplementationCount: coverage.local.endpoints.length,
    apps: [...new Set(endpoints.map((endpoint) => endpoint.app))].sort(),
    endpoints,
  };
}

function requireAdmin(adminToken?: string) {
  return (req: Request, res: Response, next: () => void) => {
    if (!adminToken) {
      res.status(503).send('Admin dashboard is not configured. Set MCP_ADMIN_TOKEN.');
      return;
    }
    const authorization = req.get('authorization') || '';
    const basic = authorization.match(/^Basic\s+(.+)$/i)?.[1];
    let supplied: string | undefined;
    if (basic) {
      try {
        const decoded = Buffer.from(basic, 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        supplied = separator >= 0 ? decoded.slice(separator + 1) : undefined;
      } catch {
        supplied = undefined;
      }
    }
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!safeTokenEquals(supplied || bearer, adminToken)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="MCP Usage Dashboard", charset="UTF-8"');
      res.status(401).send('Authentication required');
      return;
    }
    next();
  };
}

function renderUsageDashboard(summary: UsageSummary): string {
  const rows = summary.accounts.map((account) => `
    <tr>
      <td><code>${escapeHtml(account.accountId)}</code></td>
      <td><span class="status ${account.status}">${account.status === 'active' ? 'Activa' : 'Inactiva'}</span></td>
      <td>${formatDate(account.firstConnectedAt)}</td>
      <td>${formatDate(account.lastSeenAt)}</td>
      <td>${account.authorizationCount}</td>
      <td>${account.requestCount}</td>
      <td>${escapeHtml(account.clients.join(', ') || 'Sin identificar')}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Uso | MCP GoHighLevel</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f3f5f8;color:#17191d}main{width:min(1180px,calc(100% - 32px));margin:40px auto}header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}.brand{display:flex;align-items:center;gap:14px}.brand img{width:46px;height:46px;object-fit:contain}.brand h1{font-size:22px;margin:0;letter-spacing:0}.brand p{margin:4px 0 0;color:#667080}.updated{color:#667080;font-size:13px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:26px}.metric{background:#fff;border:1px solid #dfe4ea;border-radius:8px;padding:20px}.metric span{display:block;color:#667080;font-size:13px;font-weight:700;text-transform:uppercase}.metric strong{display:block;font-size:38px;margin-top:8px}.metric.active strong{color:#16855b}.metric.inactive strong{color:#a55810}.table-wrap{overflow:auto;background:#fff;border:1px solid #dfe4ea;border-radius:8px}table{width:100%;border-collapse:collapse;min-width:850px}th,td{text-align:left;padding:13px 15px;border-bottom:1px solid #edf0f3;font-size:14px}th{background:#f8fafb;color:#586170;font-size:12px;text-transform:uppercase}.status{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:750}.status.active{background:#e6f6ef;color:#11704b}.status.inactive{background:#fff0df;color:#8a4a0a}code{font-size:12px}.empty{padding:36px;color:#667080;text-align:center}@media(max-width:700px){header{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:1fr}.metric strong{font-size:32px}}
  </style>
</head>
<body><main>
  <header><div class="brand"><img src="/assets/ghl-icon.png" alt=""><div><h1>Adopción del MCP</h1><p>Una cuenta corresponde a un Location ID único anonimizado.</p></div></div><div class="updated">Actualizado ${formatDate(summary.generatedAt)}<br>Activa = uso en ${summary.activeWindowDays} días</div></header>
  <section class="stats"><div class="metric"><span>Cuentas conectadas</span><strong>${summary.totalAccounts}</strong></div><div class="metric active"><span>Activas</span><strong>${summary.activeAccounts}</strong></div><div class="metric inactive"><span>Inactivas</span><strong>${summary.inactiveAccounts}</strong></div></section>
  <div class="table-wrap">${rows ? `<table><thead><tr><th>Cuenta anónima</th><th>Estado</th><th>Primera conexión</th><th>Última actividad</th><th>Conexiones</th><th>Solicitudes</th><th>Clientes</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">Todavía no hay cuentas registradas.</div>'}</div>
</main></body></html>`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}
