import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import express from 'express';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { GHLConfig } from './types/ghl-types.js';
import { EnhancedGHLClient } from './enhanced-ghl-client.js';
import { extractBearerToken } from './http-auth.js';
import type { UsageAnalytics } from './usage-analytics.js';

type StoredAuthorizationCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  payload: ByoGhlTokenPayload;
  expiresAt: number;
};

export type ByoGhlTokenPayload = GHLConfig & {
  iat: number;
  exp: number;
  clientId?: string;
};

export type ByoGhlOAuthOptions = {
  baseConfig: GHLConfig;
  publicBaseUrl?: string;
  secret: string;
  tokenTtlSeconds?: number;
  usageAnalytics?: UsageAnalytics;
};

export type RequestWithGhlConfig = Request & {
  ghlConfig?: GHLConfig;
};

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_ASSETS_PATH = path.resolve(process.cwd(), 'public');
const codes = new Map<string, StoredAuthorizationCode>();

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function getPublicBaseUrl(req: Request, configured?: string): string {
  if (configured) return configured.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function oauthParamsFromRecord(record: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource']) {
    const value = record[key];
    if (typeof value === 'string') params.set(key, value);
  }
  return params;
}

function friendlyGhlAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const status = raw.match(/GHL API Error \((\d+)\)/)?.[1];

  if (status === '401' || status === '403') {
    return 'No se pudo validar el Private Integration Token. Revisa que el PIT sea correcto, que pertenezca a este sub-account y que incluya permisos para leer la Location.';
  }
  if (status === '404') {
    return 'No se encontro ese Location ID. Revisa que el Location ID pertenezca al mismo sub-account del PIT.';
  }
  if (/timeout|network|ENOTFOUND|ECONN/i.test(raw)) {
    return 'HighLevel no respondio a tiempo. Intenta de nuevo en unos segundos.';
  }
  return 'No se pudo validar HighLevel con esos datos. Revisa el PIT, el Location ID y los permisos seleccionados.';
}

export function sealByoGhlToken(payload: ByoGhlTokenPayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `bghl.${base64Url(iv)}.${base64Url(tag)}.${base64Url(encrypted)}`;
}

export function unsealByoGhlToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): ByoGhlTokenPayload {
  const [prefix, ivPart, tagPart, encryptedPart] = token.split('.');
  if (prefix !== 'bghl' || !ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid BYO GHL token format');
  }

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);
  const payload = JSON.parse(decrypted.toString('utf8')) as ByoGhlTokenPayload;
  if (!payload.accessToken || !payload.locationId || !payload.baseUrl || !payload.version) {
    throw new Error('Invalid BYO GHL token payload');
  }
  if (payload.exp <= nowSeconds) {
    throw new Error('BYO GHL token expired');
  }
  return payload;
}

export function verifyPkce(codeVerifier: string | undefined, codeChallenge?: string, method?: string): boolean {
  if (!codeChallenge) return true;
  if (!codeVerifier) return false;
  if ((method || 'plain') === 'S256') {
    return safeEqual(base64Url(createHash('sha256').update(codeVerifier).digest()), codeChallenge);
  }
  return safeEqual(codeVerifier, codeChallenge);
}

function cleanupCodes(): void {
  const now = Date.now();
  for (const [code, record] of codes) {
    if (record.expiresAt <= now) codes.delete(code);
  }
}

function metadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    display_name: 'GoHighLevel MCP',
    organization_name: 'GoHighLevel',
    description: 'Connect any MCP-compatible AI agent to a GoHighLevel sub-account with your Private Integration Token.',
    logo_uri: `${baseUrl}/logo.png`,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['ghl:read', 'ghl:write'],
  };
}

function protectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/mcp`,
    resource_name: 'GoHighLevel MCP',
    organization_name: 'GoHighLevel',
    description: 'Remote MCP connector for GoHighLevel sub-accounts.',
    logo_uri: `${baseUrl}/logo.png`,
    resource_documentation: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ['ghl:read', 'ghl:write'],
    bearer_methods_supported: ['header'],
  };
}

function renderAuthorizeForm(params: URLSearchParams, error?: string): string {
  const hidden = Array.from(params.entries())
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Conectar GoHighLevel con tu agente IA</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="icon" type="image/png" href="/assets/ghl-icon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      background: #f4f7fb;
      color: #15171a;
    }
    main {
      width: min(1040px, calc(100vw - 32px));
      margin: 6vh auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 20px;
      align-items: start;
    }
    section {
      background: #fff;
      border: 1px solid #dfe4ec;
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(20, 32, 54, 0.08);
    }
    .form-panel { padding: 34px; }
    .guide-panel { padding: 22px; }
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 22px;
    }
    .brand img { width: 210px; max-width: 68%; height: auto; display: block; }
    .badge {
      border: 1px solid #dfe4ec;
      border-radius: 999px;
      padding: 7px 11px;
      color: #465162;
      background: #f6f8fb;
      font-size: 13px;
      font-weight: 650;
      white-space: nowrap;
    }
    h1 { font-size: 28px; line-height: 1.1; margin: 0 0 10px; letter-spacing: 0; }
    h2 { font-size: 18px; line-height: 1.2; margin: 0 0 8px; letter-spacing: 0; }
    p { color: #596273; line-height: 1.55; margin: 0; }
    .intro { max-width: 660px; margin-bottom: 24px; }
    .field { margin-top: 18px; }
    label { display: block; font-weight: 750; margin-bottom: 7px; }
    input {
      width: 100%;
      padding: 13px 13px;
      border: 1px solid #c9d1dc;
      border-radius: 7px;
      font-size: 15px;
      color: #15171a;
      background: #fff;
    }
    input:focus {
      border-color: #1f8ef1;
      box-shadow: 0 0 0 3px rgba(31, 142, 241, 0.16);
      outline: none;
    }
    .hint { display: block; margin-top: 7px; color: #6b7482; font-size: 13px; line-height: 1.45; }
    button {
      margin-top: 24px;
      width: 100%;
      padding: 14px 16px;
      border: 0;
      border-radius: 7px;
      background: #111;
      color: #fff;
      font-weight: 800;
      font-size: 15px;
      cursor: pointer;
    }
    button:hover { background: #252525; }
    .error { border: 1px solid #e3a1a1; background: #fff1f1; color: #8b1d1d; padding: 11px 12px; border-radius: 7px; margin: 18px 0; }
    .security-note {
      margin-top: 18px;
      padding: 12px 13px;
      border: 1px solid #dfe4ec;
      border-radius: 7px;
      background: #f8fafc;
      color: #596273;
      font-size: 13px;
      line-height: 1.45;
    }
    .guide-panel img {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid #dfe4ec;
      border-radius: 8px;
      background: #f6f8fb;
      margin: 14px 0 18px;
    }
    ol { margin: 12px 0 0; padding-left: 22px; color: #465162; }
    li { margin: 10px 0; line-height: 1.45; }
    code {
      background: #eef2f7;
      border: 1px solid #dfe4ec;
      border-radius: 5px;
      padding: 1px 5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    @media (max-width: 860px) {
      main { grid-template-columns: 1fr; margin: 20px auto; }
      .form-panel { padding: 24px; }
      .brand { align-items: flex-start; flex-direction: column; }
      .brand img { max-width: 240px; width: 72%; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="form-panel">
      <div class="brand">
        <img src="/assets/ghl-logo.png" alt="HighLevel">
        <span class="badge">MCP Connector</span>
      </div>
      <h1>Conecta GoHighLevel con tu agente IA</h1>
      <p class="intro">Pega 2 datos de tu sub-account: <strong>Private Integration Token</strong> y <strong>Location ID</strong>. Tu agente recibir&aacute; un token cifrado para conectarse.</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="/oauth/authorize">
        ${hidden}
        <div class="field">
          <label for="ghl_api_key">Private Integration Token (PIT)</label>
          <input id="ghl_api_key" name="ghl_api_key" type="password" required autocomplete="off" placeholder="Pega el PIT de HighLevel">
          <span class="hint"><code>Settings</code> > <code>Private Integrations</code> > <code>Create New Integration</code>.</span>
        </div>

        <div class="field">
          <label for="ghl_location_id">Location ID / Sub-account ID</label>
          <input id="ghl_location_id" name="ghl_location_id" type="text" required autocomplete="off" placeholder="Pega el Location ID">
          <span class="hint"><code>Settings</code> > <code>Business Profile</code>, o copia el valor despu&eacute;s de <code>/location/</code> en la URL.</span>
        </div>

        <button type="submit">Autorizar conector GoHighLevel</button>
      </form>
      <p class="security-note">Usa un PIT con solo los permisos necesarios para ese sub-account.</p>
    </section>
    <section class="guide-panel" aria-label="HighLevel setup guide">
      <h2>Gu&iacute;a r&aacute;pida</h2>
      <p>D&oacute;nde encontrar cada dato en HighLevel.</p>
      <img src="/assets/ghl-setup-guide.gif?v=agent-mcp" alt="Guia animada para encontrar el Location ID y el Private Integration Token en HighLevel">
      <ol>
        <li>Abre el sub-account que usar&aacute; tu agente.</li>
        <li>Copia el <strong>Location ID</strong> en <code>Business Profile</code>.</li>
        <li>Crea el <strong>PIT</strong> en <code>Private Integrations</code>.</li>
      </ol>
    </section>
  </main>
</body>
</html>`;
}

export function createByoGhlOAuthRouter(options: ByoGhlOAuthOptions): Router {
  const router = express.Router();

  router.use('/assets', express.static(PUBLIC_ASSETS_PATH, {
    immutable: true,
    maxAge: '7d',
  }));

  router.get('/favicon.ico', (_req, res) => {
    res.sendFile(path.join(PUBLIC_ASSETS_PATH, 'favicon.ico'));
  });

  router.get(['/logo.png', '/icon.png', '/apple-touch-icon.png'], (_req, res) => {
    res.sendFile(path.join(PUBLIC_ASSETS_PATH, 'ghl-icon.png'));
  });

  router.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.json(metadata(getPublicBaseUrl(req, options.publicBaseUrl)));
  });

  router.get('/.well-known/openid-configuration', (req, res) => {
    res.json(metadata(getPublicBaseUrl(req, options.publicBaseUrl)));
  });

  router.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.json(protectedResourceMetadata(getPublicBaseUrl(req, options.publicBaseUrl)));
  });

  router.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
    res.json(protectedResourceMetadata(getPublicBaseUrl(req, options.publicBaseUrl)));
  });

  router.post('/oauth/register', (req, res) => {
    const clientId = `mcp-client-${randomBytes(12).toString('hex')}`;
    res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: req.body?.redirect_uris ?? [],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  });

  router.get('/oauth/authorize', (req, res) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') params.set(key, value);
    }
    res.type('html').send(renderAuthorizeForm(params));
  });

  router.post('/oauth/authorize', async (req, res) => {
    cleanupCodes();
    const oauthParams = oauthParamsFromRecord(req.body ?? {});
    const redirectUri = String(req.body.redirect_uri || '');
    const state = String(req.body.state || '');
    const clientId = String(req.body.client_id || 'dynamic-client');
    const responseType = String(req.body.response_type || '');
    const codeChallenge = req.body.code_challenge ? String(req.body.code_challenge) : undefined;
    const codeChallengeMethod = req.body.code_challenge_method ? String(req.body.code_challenge_method) : undefined;
    const accessToken = String(req.body.ghl_api_key || '');
    const locationId = String(req.body.ghl_location_id || '');

    if (responseType && responseType !== 'code') {
      res.status(400).type('html').send(renderAuthorizeForm(oauthParams, 'Unsupported OAuth response type.'));
      return;
    }
    if (!redirectUri || !accessToken || !locationId) {
      res.status(400).type('html').send(renderAuthorizeForm(oauthParams, 'Falta el redirect URI, el PIT o el Location ID.'));
      return;
    }

    const config: GHLConfig = {
      ...options.baseConfig,
      accessToken,
      locationId,
    };

    try {
      await new EnhancedGHLClient(config).testConnection();
    } catch (error) {
      res.status(400).type('html').send(renderAuthorizeForm(oauthParams, friendlyGhlAuthError(error)));
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const code = randomBytes(24).toString('base64url');
    codes.set(code, {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      payload: {
        ...config,
        iat: nowSeconds,
        exp: nowSeconds + (options.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS),
        clientId,
      },
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    });

    try {
      const redirect = new URL(redirectUri);
      redirect.searchParams.set('code', code);
      if (state) redirect.searchParams.set('state', state);
      res.redirect(302, redirect.toString());
    } catch {
      codes.delete(code);
      res.status(400).type('html').send(renderAuthorizeForm(oauthParams, 'El redirect URI enviado por el cliente MCP no es valido.'));
    }
  });

  router.post('/oauth/token', async (req, res) => {
    cleanupCodes();
    const grantType = String(req.body.grant_type || '');
    const code = String(req.body.code || '');
    const redirectUri = String(req.body.redirect_uri || '');
    const codeVerifier = req.body.code_verifier ? String(req.body.code_verifier) : undefined;

    if (grantType !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' });
      return;
    }

    const record = codes.get(code);
    if (!record || record.redirectUri !== redirectUri) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (!verifyPkce(codeVerifier, record.codeChallenge, record.codeChallengeMethod)) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }

    codes.delete(code);
    const accessToken = sealByoGhlToken(record.payload, options.secret);
    await options.usageAnalytics?.recordAuthorization(record.payload.locationId, record.payload.clientId);
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.max(0, record.payload.exp - Math.floor(Date.now() / 1000)),
      scope: 'ghl:read ghl:write',
    });
  });

  return router;
}

export function createByoGhlResourceMiddleware(options: ByoGhlOAuthOptions): RequestHandler {
  return (req: RequestWithGhlConfig, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || req.path === '/' || req.path === '/health') {
      next();
      return;
    }

    const token = extractBearerToken(req.get('authorization'));
    if (!token) {
      const baseUrl = getPublicBaseUrl(req, options.publicBaseUrl);
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource", scope="ghl:read ghl:write"`);
      res.status(401).json({ error: 'Authorization required' });
      return;
    }

    try {
      const payload = unsealByoGhlToken(token, options.secret);
      req.ghlConfig = {
        accessToken: payload.accessToken,
        locationId: payload.locationId,
        baseUrl: payload.baseUrl,
        version: payload.version,
      };
      void options.usageAnalytics?.recordActivity(payload.locationId, payload.clientId);
      next();
    } catch (error) {
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      res.status(401).json({ error: error instanceof Error ? error.message : 'Invalid token' });
    }
  };
}
