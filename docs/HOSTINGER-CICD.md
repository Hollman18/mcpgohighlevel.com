# Hostinger VPS CI/CD

This guide turns the repository into a remotely hosted GoHighLevel MCP server.

## What This Deploys

- GitHub fork as the source of truth.
- GitHub Actions on every push to `main`.
- Hostinger VPS running Docker Compose.
- Caddy reverse proxy with automatic HTTPS when `MCP_DOMAIN` is set.
- Streamable HTTP MCP endpoint at `https://your-domain.example/mcp`.
- Bearer-token protection for hosted MCP routes via `MCP_AUTH_TOKEN`.
- Optional public BYO mode where each user authorizes with their own GoHighLevel token.
- Public landing page on the root domain and a protected adoption dashboard.

## Required GitHub Secrets

Create these in GitHub: `Settings` -> `Secrets and variables` -> `Actions`.

| Secret | Required | Example |
| --- | --- | --- |
| `HOSTINGER_DEPLOY_PATH` | No | `/opt/ghl-mcp` |
| `MCP_DOMAIN` | Recommended | `mcp.example.com` |
| `MCP_SITE_DOMAIN` | Recommended | `example.com` |
| `CADDY_EMAIL` | No | `admin@example.com` |
| `GHL_API_KEY` | Yes | HighLevel Private Integration or OAuth access token |
| `GHL_LOCATION_ID` | Yes | HighLevel sub-account/location ID |
| `GHL_BASE_URL` | No | `https://services.leadconnectorhq.com` |
| `GHL_API_VERSION` | No | `2023-02-21` |
| `GHL_TOOL_PROFILE` | No | `curated` |
| `MCP_AUTH_MODE` | No | `static` or `byo-ghl-oauth` |
| `MCP_AUTH_TOKEN` | Yes | long random token for remote MCP clients |
| `MCP_ADMIN_TOKEN` | No | private password for `/admin/usage`; falls back to `MCP_AUTH_TOKEN` |
| `MCP_USAGE_HASH_SALT` | Recommended | random secret used to anonymize Location IDs |
| `MCP_USAGE_ACTIVE_DAYS` | No | `30` |
| `MCP_PUBLIC_BASE_URL` | Required for BYO mode | `https://go.mcpgohighlevel.com` |
| `MCP_OAUTH_SECRET` | Recommended for BYO mode | long random encryption secret |
| `OPENAI_API_KEY` | No | optional future AI-assisted features |

`GHL_API_VERSION=2023-02-21` is the HighLevel API `Version` header, not the project year.

## VPS Prerequisites

The deploy script can install Git, Docker, UFW, and Caddy on Ubuntu/Debian. Use a fresh VPS or a VPS dedicated to this service, because the script manages `/etc/caddy/Caddyfile` when `MCP_DOMAIN` is set.

Point DNS before the first deploy:

```text
Type: A
Name: mcp
Value: your VPS public IP
```

For the public landing page, also add:

```text
Type: A
Name: @
Value: your VPS public IP
```

Configure `www` with a `CNAME` record whose name is `www` and target is `mcpgohighlevel.com`. Traefik serves both hostnames, while `mcpgohighlevel.com` remains the canonical public URL.

## GitHub Actions Runner

The production deploy job uses a self-hosted GitHub Actions runner installed on the VPS. Register it for this repository with these labels:

```text
self-hosted, linux, x64, hostinger, production
```

Run the runner as a dedicated non-root account with passwordless `sudo` only for the deployment operations required by this repository. The runner connects outbound to GitHub, so the workflow does not require inbound SSH access from changing GitHub-hosted runner addresses.

## First Deployment

Push to `main`, or run the workflow manually:

```text
Actions -> Deploy to Hostinger -> Run workflow
```

On normal pushes, the deploy job skips itself until required secrets are configured. On manual runs, missing secrets fail loudly so setup issues are visible.

The workflow will:

1. Install dependencies.
2. Build the server.
3. Run tests.
4. Generate the production `.env` inside the self-hosted runner workspace.
5. Clone or update the fork in `HOSTINGER_DEPLOY_PATH`.
6. Run `docker compose up -d --build --remove-orphans`.
7. Configure Caddy for `MCP_DOMAIN` when provided.

## Hosted URL

Recommended production subdomain:

```text
go.mcpgohighlevel.com
```

Keep `mcpgohighlevel.com` available for a public install page, documentation, and support. If `MCP_DOMAIN=go.mcpgohighlevel.com`, the remote MCP endpoint is:

```text
https://go.mcpgohighlevel.com/mcp
```

Set `MCP_SITE_DOMAIN=mcpgohighlevel.com`. The landing page and private usage dashboard will be available at:

```text
https://mcpgohighlevel.com
https://mcpgohighlevel.com/admin/usage
```

The browser asks for credentials on the dashboard. Use username `admin` and the value of `MCP_ADMIN_TOKEN` as the password. Adoption records are persisted in the Docker-mounted `data/usage.json` file and contain only anonymized account identifiers and timestamps.

Health check:

```bash
curl https://mcp.example.com/health
```

Protected tools check:

```bash
curl -H "Authorization: Bearer $MCP_AUTH_TOKEN" https://mcp.example.com/tools
```

## Client Install Snippet

### Private/team mode

Use the URL plus the bearer token in clients that support remote Streamable HTTP MCP servers:

```json
{
  "mcpServers": {
    "ghl": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Keep `MCP_AUTH_TOKEN` private. If you publish the URL without a token, anyone who can reach it may be able to execute MCP tools against the configured GoHighLevel account.

### Public BYO GoHighLevel mode

Use this when the connector should be installable by many people without sharing your GoHighLevel account:

```text
MCP_AUTH_MODE=byo-ghl-oauth
MCP_PUBLIC_BASE_URL=https://go.mcpgohighlevel.com
MCP_OAUTH_SECRET=long_random_secret
MCP_AUTH_TOKEN=long_random_fallback_secret
```

In this mode, users install:

```text
https://go.mcpgohighlevel.com/mcp
```

The MCP server exposes OAuth discovery, authorization, dynamic registration, and token exchange endpoints. During the OAuth flow, each user enters their own HighLevel API token and Location ID. The server verifies the credentials, encrypts them into the MCP access token, and uses those credentials for that user's tool calls.

## Updating Production

Commit to `main`. GitHub Actions deploys automatically.

To redeploy manually:

```text
Actions -> Deploy to Hostinger -> Run workflow
```

To inspect the VPS:

```bash
ssh root@YOUR_VPS_IP
cd /opt/ghl-mcp
docker compose ps
docker compose logs -f --tail=100
```

## Public Distribution Options

For a private/team server, use one shared `MCP_AUTH_TOKEN`.

For a public product, use `MCP_AUTH_MODE=byo-ghl-oauth` so every user brings their own GoHighLevel token and Location ID. Do not reuse your own GoHighLevel token for everyone.
