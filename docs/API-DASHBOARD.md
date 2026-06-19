# GoHighLevel MCP API Dashboard

Generated from official GHL docs commit: 0af86a4

## Coverage

- Official GHL docs source: https://github.com/GoHighLevel/highlevel-api-docs.git
- Official docs commit: 0af86a4
- Official endpoints parsed: 590
- Official endpoints covered: 590
- Coverage: 100%
- MCP tools in registry: 867
- Read tools: 432
- Write tools: 327
- Delete/destructive tools: 108
- Local-only endpoint references tracked: 253

## Stability Tiers

- Official OpenAPI tools: 234
- Live-docs supplemental tools: 14
- Legacy-compatible tools: 507
- Private/internal unstable tools: 88
- Deprecated/compatibility tools: 24

## Largest Tool Categories

| Category | Tools |
| --- | ---: |
| official-ad-manager | 94 |
| agent-workspace | 43 |
| calendar | 39 |
| courses | 32 |
| contacts | 31 |
| locations | 27 |
| official-social-media-posting | 24 |
| analytics | 23 |
| payments | 22 |
| official-saas-api | 21 |
| conversations | 20 |
| phone-numbers | 20 |
| social-media | 19 |
| invoices | 18 |
| templates | 18 |
| stores | 17 |
| affiliates | 17 |
| reputation | 15 |
| phone-system | 15 |
| official-calendars | 15 |

## Maintenance Commands

```bash
npm run tools:doctor
npm run tools:report
npm run scan:ghl-api
npm run ci:ghl-api-drift
```

The daily API drift workflow refreshes the official GoHighLevel docs snapshot and opens a PR when generated MCP artifacts change.
