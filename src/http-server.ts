/**
 * GoHighLevel MCP HTTP Server — legacy SSE transport.
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

import { GHLApiClient } from './clients/ghl-api-client.js';
import { ToolRegistry } from './tool-registry.js';
import { GHLConfig } from './types/ghl-types.js';
import { buildHealthPayload, sendHealthResponse } from './health-response.js';

dotenv.config();

class GHLMCPHttpServer {
  private app: express.Application;
  private ghlClient: GHLApiClient;
  private registry: ToolRegistry;
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || process.env.MCP_SERVER_PORT || '8000', 10);
    this.app = express();
    this.setupExpress();
    this.ghlClient = this.initializeGHLClient();
    this.registry = new ToolRegistry(this.ghlClient);
    this.setupRoutes();
  }

  private setupExpress(): void {
    this.app.disable('x-powered-by');
    this.app.use((_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    });
    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        if ((process.env.MCP_CORS_MODE || 'agent').toLowerCase() !== 'strict') {
          try {
            if (new URL(origin).protocol === 'https:') {
              return callback(null, true);
            }
          } catch {
            // Fall through to configured strict-origin check.
          }
        }
        const allowedOrigins = new Set(
          [
            'https://claude.ai',
            'https://claude.com',
            'https://console.anthropic.com',
            'https://chatgpt.com',
            'https://chat.openai.com',
            'https://platform.openai.com',
            ...(process.env.MCP_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
          ].map((value) => {
            try {
              const url = new URL(value);
              return `${url.protocol}//${url.host}`;
            } catch {
              return value.replace(/\/$/, '');
            }
          })
        );
        callback(null, allowedOrigins.has(origin.replace(/\/$/, '')));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'mcp-session-id', 'Mcp-Session-Id', 'MCP-Protocol-Version', 'Last-Event-ID', 'X-Requested-With'],
      exposedHeaders: ['mcp-session-id', 'Mcp-Session-Id'],
      credentials: true
    }));
    this.app.use(express.json({ limit: process.env.MCP_JSON_LIMIT || '1mb' }));
  }

  private initializeGHLClient(): GHLApiClient {
    const config: GHLConfig = {
      accessToken: process.env.GHL_API_KEY || '',
      baseUrl: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
      version: process.env.GHL_API_VERSION || '2023-02-21',
      locationId: process.env.GHL_LOCATION_ID || ''
    };

    if (!config.accessToken) throw new Error('GHL_API_KEY environment variable is required');
    if (!config.locationId) throw new Error('GHL_LOCATION_ID environment variable is required');
    return new GHLApiClient(config);
  }

  private createSSEServer(): Server {
    const server = new Server(
      { name: 'ghl-mcp-server', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );
    const allTools = this.registry.getAllToolDefinitions();

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await this.registry.callTool(name, args || {});
        if (result === undefined) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof McpError) throw error;
        const msg = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${msg}`);
      }
    });

    return server;
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      sendHealthResponse(req, res, buildHealthPayload({
        toolCount: this.registry.getToolCount(),
        transport: 'sse',
      }));
    });

    this.app.get('/capabilities', (_req, res) => {
      res.json({
        capabilities: { tools: {} },
        server: { name: 'ghl-mcp-server', version: '2.0.0' }
      });
    });

    this.app.get('/tools', (_req, res) => {
      res.json({ tools: this.registry.getAllToolDefinitions(), count: this.registry.getToolCount() });
    });

    this.app.post('/tools/call', async (req, res) => {
      const { name, arguments: args } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Missing tool name' });
        return;
      }

      try {
        const result = await this.registry.callTool(name, args || {});
        if (result === undefined) {
          res.status(404).json({ error: `Unknown tool: ${name}` });
          return;
        }
        res.json({ result });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[legacy-http] POST /tools/call tool=${name} error:`, msg);
        res.status(500).json({ error: 'Tool execution failed' });
      }
    });

    const handleSSE = async (req: express.Request, res: express.Response) => {
      try {
        const server = this.createSSEServer();
        const transport = new SSEServerTransport('/sse', res);
        await server.connect(transport);
        req.on('close', () => {
          server.close().catch(() => {});
        });
      } catch {
        if (!res.headersSent) res.status(500).json({ error: 'Failed to establish SSE connection' });
        else res.end();
      }
    };

    this.app.get('/sse', handleSSE);
    this.app.post('/sse', handleSSE);

    this.app.get('/', (_req, res) => {
      res.json({
        name: 'GoHighLevel MCP Server (Legacy SSE)',
        version: '2.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          capabilities: '/capabilities',
          tools: '/tools',
          sse: '/sse'
        },
        tools: this.registry.getToolCount()
      });
    });

  }

  async start(): Promise<void> {
    await this.ghlClient.testConnection();
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`GoHighLevel MCP legacy SSE server listening on ${this.port}`);
    });
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main(): Promise<void> {
  const server = new GHLMCPHttpServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
