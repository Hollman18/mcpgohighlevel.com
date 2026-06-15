# GoHighLevel MCP Server

Production-ready Model Context Protocol server for GoHighLevel. It exposes GoHighLevel/LeadConnector CRM capabilities to MCP-compatible AI agents over Streamable HTTP, stdio, legacy SSE, and optional MCP Apps.

Use it locally with desktop agents, deploy it as a remote connector, or publish a hosted endpoint where each user connects with their own GoHighLevel Private Integration Token and Location ID.

## About

GoHighLevel MCP Server is a community-built connector that helps AI agents read, analyze, and orchestrate GoHighLevel CRM data without every agent needing to understand the GoHighLevel API surface directly.

The project is designed for agencies, SaaS sales teams, appointment-setting teams, consultants, operators, and builders who want a safer and more structured way to connect GoHighLevel with modern AI workflows.

Highlights:

- Remote MCP endpoint: `https://go.mcpgohighlevel.com/mcp`
- Streamable HTTP MCP at `/mcp`
- Legacy SSE at `/sse`
- REST bridge endpoints for tool discovery and execution
- BYO-GHL OAuth-style connector flow for public multi-user installs
- Full official GoHighLevel API coverage from generated OpenAPI tools
- Curated CRM workflows for agent-friendly daily use
- Business reporting tools for sellers, setters, closers, managers, and executives
- Privacy-conscious adoption dashboard for connected, active, and inactive accounts
- MCP Apps onboarding screen with GoHighLevel branding
- CI/CD deployment flow for Hostinger VPS
- Security-focused defaults for auth, CORS, request limits, Docker, and secret handling

This project is not affiliated with or endorsed by GoHighLevel. GoHighLevel, HighLevel, and LeadConnector are trademarks of their respective owners.

## Current Status

- Official GHL endpoints parsed: `590`
- Official endpoint coverage: `590 / 590`
- Generated official OpenAPI tools: `234`
- Live-docs supplemental tools: `14`
- MCP tools in registry: `867`
- Reporting and analytics tools: `23`
- Node.js: `>=20`, tested with Node 22
- License: see [LICENSE](LICENSE)

## Core Use Cases

- Connect Claude, ChatGPT, Codex, Cursor, Windsurf, n8n, OpenAI Playground, and other MCP-compatible clients to GoHighLevel.
- Search contacts, conversations, opportunities, calendars, tasks, payments, forms, funnels, workflows, users, products, and more.
- Generate seller and manager reports from real source records: contacts, opportunities, exported messages, calls, SMS, WhatsApp, and email.
- Prepare safe CRM actions with confirmation queues before write operations.
- Host a public connector where each user authorizes with their own GoHighLevel credentials.
- Keep API coverage aligned with upstream GoHighLevel docs through generated inventory and coverage reports.

## Security Model

This server can access sensitive CRM data. Treat it as production infrastructure.

Security features included:

- Hosted MCP routes can require `Authorization: Bearer <token>`.
- Public multi-user mode stores user-provided GHL credentials in encrypted sealed tokens.
- CORS defaults to public-agent mode for HTTPS MCP clients and can be locked down with `MCP_CORS_MODE=strict` plus `MCP_ALLOWED_ORIGINS`.
- Express disables `x-powered-by`.
- HTTP responses include basic hardening headers.
- JSON and form bodies have size limits.
- REST execution errors are logged server-side but returned as generic client errors.
- Docker runtime runs as the non-root `node` user.
- `.env`, keys, logs, build output, and backup files are ignored from git/Docker context.
- Write/destructive tools remain discoverable but should be gated by confirmation in agent workflows.

Security docs:

- [SECURITY.md](SECURITY.md)
- [Safety](docs/SAFETY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Hostinger CI/CD](docs/HOSTINGER-CICD.md)

## Quickstart

Requirements:

- Node.js 20+
- A GoHighLevel Private Integration Token or OAuth access token
- A GoHighLevel Location ID

```bash
npm install
cp .env.example .env
npm run build
npm run doctor
```

Add your credentials to `.env`:

```bash
GHL_API_KEY=your_private_integration_api_key
GHL_LOCATION_ID=your_location_id
GHL_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2023-02-21
```

`GHL_API_VERSION=2023-02-21` is the GoHighLevel API `Version` header used by the current docs. It is not the project year; do not change it unless GoHighLevel publishes a new required API version.

Verify auth:

```bash
npm run auth-check
```

## Run Modes

```bash
npm run start:stdio       # Desktop MCP clients
npm run start:http        # Streamable HTTP at /mcp
npm run start:legacy      # Legacy SSE at /sse
```

HTTP endpoints:

- `GET /`
- `GET /health`
- `GET /capabilities`
- `GET /tools`
- `GET /tool-inventory`
- `POST /execute`
- `POST /tools/call`
- `POST /mcp`
- `GET /sse`

For hosted HTTP deployments, set `MCP_AUTH_TOKEN` and send:

```http
Authorization: Bearer <token>
```

`GET /` and `GET /health` remain public for discovery and uptime checks.

## Landing And Adoption Dashboard

- Public landing page: `https://mcpgohighlevel.com`
- Technical documentation and searchable endpoint catalog: `https://mcpgohighlevel.com/docs`
- Remote MCP endpoint: `https://go.mcpgohighlevel.com/mcp`
- Private adoption dashboard: `https://mcpgohighlevel.com/admin/usage`

The dashboard counts unique connected GoHighLevel Location IDs using one-way hashes. It does not store raw Location IDs, Private Integration Tokens, OAuth access tokens, contact data, or report contents.

An account is active when it authorized or used the MCP within the last 30 days. Configure the window and dashboard password with:

```bash
MCP_ADMIN_TOKEN=your_private_dashboard_password
MCP_USAGE_ACTIVE_DAYS=30
MCP_USAGE_HASH_SALT=your_random_hash_salt
MCP_USAGE_DATA_PATH=/app/data/usage.json
```

The dashboard accepts HTTP Basic authentication. Use `admin` as the username and `MCP_ADMIN_TOKEN` as the password. When `MCP_ADMIN_TOKEN` is omitted, the server uses `MCP_AUTH_TOKEN`.

## Public Multi-User Connector

For a shared hosted connector, prefer BYO-GHL mode:

```bash
MCP_AUTH_MODE=byo-ghl-oauth
MCP_PUBLIC_BASE_URL=https://go.mcpgohighlevel.com
MCP_OAUTH_SECRET=your_long_random_encryption_secret
MCP_AUTH_TOKEN=your_remote_mcp_bearer_token
```

In this mode, users connect to the same remote MCP URL and authorize with their own:

- Private Integration Token
- Location ID

The connector validates those credentials and returns a sealed token to the MCP client.

## MCP Client Setup

Generate client configs:

```bash
npm run configure:codex
npm run configure:claude
npm run configure:cursor
npm run configure:windsurf
```

Recommended beginner profile:

```bash
GHL_TOOL_PROFILE=curated
```

Advanced examples:

```bash
node scripts/ghl-mcp.mjs configure codex --profile stable
node scripts/ghl-mcp.mjs configure codex --profile full
node scripts/ghl-mcp.mjs configure codex --profile curated --json
```

## Tool Profiles

- `curated`: recommended for agents; high-level CRM workflows with safer confirmation queues.
- `stable`: production-friendly; official, supplemental, curated, and legacy-compatible tools.
- `full`: every available tool.
- `official`: generated tools from official OpenAPI and live-docs supplemental sources.
- `raw`: endpoint-level tools without curated workflows.

## Business Reporting

The reporting layer is designed for real business questions, not just raw endpoint calls.

Key tools:

- `get_user_business_report`
- `get_saas_subscription_report`
- `get_value_ladder_info_product_report`
- `get_pipeline_activity_by_user`
- `get_contact_ownership_report`
- `get_call_activity_by_user`
- `get_sms_activity_by_user`
- `get_whatsapp_activity_by_user`
- `get_email_activity_by_user`
- `get_message_activity_by_user`
- `generate_historical_activity_report`

Reports include:

- Calls by user: total, effective, non-effective, inbound, outbound, daily/monthly/yearly totals and averages.
- SMS by user: total, effective, non-effective, delivered, failed, inbound, outbound, samples, and periods.
- WhatsApp by user: activity, delivery/failure proxy, inbound/outbound, samples, and periods.
- Email by user: activity, delivery/failure proxy, inbound/outbound, samples, and periods.
- Contacts by user: assigned contacts, contacts with email, contacts with phone, missing data, and unassigned records.
- Pipeline by user: open, won, lost, abandoned, stage distribution, pipeline distribution, value, and sample opportunities.
- Historical activity exports: automatic pagination for larger date ranges, seller/leader rollups, call duration metrics, optional detail rows, and CSV-ready output.

For large historical questions, prefer `generate_historical_activity_report` instead of asking the agent to print every raw record in one response. Example prompt:

```text
Use generate_historical_activity_report to scan all calls from 2026-06-01 to 2026-06-30.
Group by seller and leader, include call duration, answered/no-answer totals, unique contacts,
and return summary CSV plus up to 500 detail rows.
```

Vertical report models:

- SaaS subscription sales: setters, closers, sales leaders, and management.
- Value Ladder info-products: lead magnet, masterclass/webinar, workshop, application, high ticket, upsell/continuity.

See [Business Reporting](docs/GHL-BUSINESS-REPORTING.md).

## MCP Apps

```bash
npm run apps:setup
npm run apps:preview
```

Open `http://localhost:3001/preview`.

Without GHL credentials, the app shows preview/demo states and explains which environment variables are missing.

## Tool Discovery

```bash
npm run tools:list
npm run tools:list -- --search contacts
npm run tools:list -- --category analytics
npm run tools:list -- --stability official
npm run tools:list -- --access read
npm run tools:list -- --access write
npm run tools:list -- --destructive
npm run tools:explorer
```

The static explorer is [docs/tool-explorer.html](docs/tool-explorer.html).

## Maintenance

```bash
npm run build
npm test -- --runInBand
npm audit
npm audit --prefix mcp-apps
npm run tools:report
npm run validate:api-lock
```

Refresh upstream API coverage intentionally:

```bash
npm run scan:ghl-api
```

Generated coverage artifacts live in `docs/`.

## Deployment

Docker:

```bash
docker compose up --build -d
```

Hostinger VPS CI/CD:

- [Hostinger CI/CD](docs/HOSTINGER-CICD.md)
- [Deployment](docs/DEPLOYMENT.md)

The production deployment used by this project runs behind Traefik and exposes:

```text
https://go.mcpgohighlevel.com/mcp
```

## Documentation

- [Quickstart](QUICKSTART.md)
- [Agent Setup](AGENT_SETUP.md)
- [Setup](docs/SETUP.md)
- [Usage](docs/USAGE.md)
- [Clients](docs/CLIENTS.md)
- [Tool Profiles](docs/TOOL-PROFILES.md)
- [Business Reporting](docs/GHL-BUSINESS-REPORTING.md)
- [Recipes](docs/RECIPES.md)
- [Safety](docs/SAFETY.md)
- [Security](SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Coverage](docs/API-COVERAGE.md)
- [Companion Tooling](docs/TOOLING.md)
- [Update Log](UPDATE_LOG.md)

## License

This project is distributed under the [GoHighLevel MCP Server Community License](LICENSE). It allows personal, educational, internal, and non-commercial use. Commercial resale, sublicensing, or paid managed-service use requires separate written permission from the copyright holders.

## Responsible Use

Agents connected to this server can access CRM records and may be able to execute write operations depending on the exposed profile and credentials. Use least-privilege GoHighLevel tokens, prefer `curated` or `stable` profiles, keep hosted endpoints authenticated, and rotate credentials immediately if exposure is suspected.
