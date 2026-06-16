import type { Request, Response } from 'express';

export interface HealthPayload {
  status: 'healthy';
  server: string;
  version: string;
  uptime: number;
  timestamp: string;
  tools: number;
  memory?: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
  cache?: unknown;
  transport?: string;
}

export function buildHealthPayload(options: {
  startTime?: number;
  toolCount: number;
  memory?: NodeJS.MemoryUsage;
  cache?: unknown;
  transport?: string;
}): HealthPayload {
  const payload: HealthPayload = {
    status: 'healthy',
    server: 'ghl-mcp-server',
    version: '2.0.0',
    uptime: options.startTime ? Math.floor((Date.now() - options.startTime) / 1000) : 0,
    timestamp: new Date().toISOString(),
    tools: options.toolCount,
  };

  if (options.transport) payload.transport = options.transport;
  if (options.memory) {
    payload.memory = {
      rss: `${Math.round(options.memory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(options.memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(options.memory.heapTotal / 1024 / 1024)}MB`,
    };
  }
  if (options.cache) payload.cache = options.cache;

  return payload;
}

export function sendHealthResponse(req: Request, res: Response, payload: HealthPayload): void {
  res.setHeader('Cache-Control', 'no-store');
  if (!wantsHtml(req)) {
    res.json(payload);
    return;
  }
  res.type('html').send(renderHealthHtml(payload));
}

function wantsHtml(req: Request): boolean {
  const accept = String(req.get('accept') || '');
  return accept.includes('text/html') && !accept.includes('application/json');
}

function renderHealthHtml(payload: HealthPayload): string {
  const isHealthy = payload.status === 'healthy';
  const uptime = formatDuration(payload.uptime);
  const checkedAt = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'America/Bogota',
  }).format(new Date(payload.timestamp));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="Live health status for the MCP GoHighLevel server.">
  <title>MCP GoHighLevel Status</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="icon" type="image/png" href="/icon.png">
  <meta name="theme-color" content="${isHealthy ? '#147a42' : '#a33a2d'}">
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f4f7f8;color:#101820;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.wrap{min-height:100vh;display:grid;place-items:center;padding:28px}.card{width:min(920px,100%);background:#fff;border:1px solid #dce4e8;border-radius:10px;box-shadow:0 24px 70px rgba(16,24,32,.08);overflow:hidden}.hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:34px;border-bottom:1px solid #dce4e8}.brand{display:flex;align-items:center;gap:14px}.brand img{width:46px;height:46px;object-fit:contain}.eyebrow{margin:0 0 6px;color:#5a6874;font-size:12px;font-weight:850;text-transform:uppercase}.brand h1{margin:0;font-size:clamp(30px,5vw,46px);line-height:1}.status{display:inline-flex;align-items:center;gap:10px;padding:12px 15px;border-radius:999px;background:${isHealthy ? '#e8f7ef' : '#fff0ed'};color:${isHealthy ? '#147a42' : '#a33a2d'};font-weight:900}.dot{width:11px;height:11px;border-radius:50%;background:currentColor;box-shadow:0 0 0 6px ${isHealthy ? 'rgba(20,122,66,.12)' : 'rgba(163,58,45,.12)'}}.message{padding:28px 34px;border-bottom:1px solid #dce4e8}.message h2{margin:0 0 10px;font-size:25px}.message p{margin:0;color:#51606d;font-size:17px;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #dce4e8}.metric{padding:22px;border-right:1px solid #dce4e8}.metric:last-child{border-right:0}.metric span{display:block;color:#66737e;font-size:12px;font-weight:800;text-transform:uppercase}.metric strong{display:block;margin-top:7px;font-size:24px}.details{display:grid;grid-template-columns:1fr 1fr;gap:0}.panel{padding:28px 34px}.panel+.panel{border-left:1px solid #dce4e8}.panel h3{margin:0 0 14px;font-size:17px}.panel ul{margin:0;padding-left:20px;color:#51606d;line-height:1.75}.panel code{display:block;padding:13px;border:1px solid #dce4e8;border-radius:6px;background:#f7fafb;color:#25313b;overflow-wrap:anywhere}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 14px;border:1px solid #101820;border-radius:6px;color:#101820;text-decoration:none;font-weight:800}.actions a.primary{background:#101820;color:#fff}footer{display:flex;justify-content:space-between;gap:20px;padding:18px 34px;background:#f8fafb;color:#66737e;font-size:12px}@media(max-width:760px){.hero{grid-template-columns:1fr;align-items:start}.grid,.details{grid-template-columns:1fr}.metric{border-right:0;border-bottom:1px solid #dce4e8}.metric:last-child{border-bottom:0}.panel+.panel{border-left:0;border-top:1px solid #dce4e8}footer{flex-direction:column}.wrap{padding:14px}.hero,.message,.panel,footer{padding-left:22px;padding-right:22px}}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card" aria-labelledby="status-title">
      <div class="hero">
        <div class="brand"><img src="/assets/ghl-icon.png" alt=""><div><p class="eyebrow">MCP GoHighLevel</p><h1 id="status-title">Service Status</h1></div></div>
        <div class="status"><span class="dot"></span>${isHealthy ? 'Operational' : 'Service issue'}</div>
      </div>
      <div class="message">
        <h2>${isHealthy ? 'Everything is working normally.' : 'The service is reporting a problem.'}</h2>
        <p>${isHealthy ? 'The MCP server is online, responding, and ready for compatible AI agents. If your agent fails to connect, review credentials, permissions, or the client configuration first.' : 'The health endpoint is reachable, but the server status is not healthy. Check deployment logs, environment variables, and upstream services.'}</p>
      </div>
      <div class="grid" aria-label="Service metrics">
        <div class="metric"><span>Status</span><strong>${escapeHtml(payload.status)}</strong></div>
        <div class="metric"><span>Uptime</span><strong>${escapeHtml(uptime)}</strong></div>
        <div class="metric"><span>Tools</span><strong>${payload.tools}</strong></div>
        <div class="metric"><span>Checked</span><strong>${escapeHtml(checkedAt)}</strong></div>
      </div>
      <div class="details">
        <div class="panel"><h3>How to read this</h3><ul><li><strong>Operational</strong>: the server is online.</li><li><strong>Service issue</strong>: review deployment or logs.</li><li>Agent errors can still come from expired GHL tokens, wrong Location ID, missing scopes, or client-side configuration.</li></ul></div>
        <div class="panel"><h3>Useful links</h3><code>${escapeHtml(JSON.stringify(payload, null, 2))}</code><div class="actions"><a class="primary" href="/mcp">MCP endpoint</a><a href="/docs">Docs</a><a href="/">Landing</a></div></div>
      </div>
      <footer><span>Server: ${escapeHtml(payload.server)} v${escapeHtml(payload.version)}</span><span>JSON monitoring still works with curl or Accept: application/json.</span></footer>
    </section>
  </main>
</body>
</html>`;
}

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}
