#!/usr/bin/env node
/**
 * LevelUp MCP server entrypoint.
 *
 * Two transports, chosen at startup:
 *   • stdio (default) — for Claude Desktop, which launches this as a child
 *     process and talks over stdin/stdout. No port, no URL.
 *   • http            — runs a Streamable-HTTP MCP endpoint at a real URL,
 *     e.g. http://localhost:3001/mcp. Enable with MCP_TRANSPORT=http (or the
 *     `--http` flag). Port comes from MCP_HTTP_PORT (default 3001).
 *
 * Either way it then makes outbound HTTP calls to the LevelUp backend
 * (API_BASE_URL + API_KEY).
 */

// Load a local .env if dotenv is available (optional — the MCP host can also
// inject env vars directly). Node 20.6+ also supports `node --env-file=.env`.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config();
} catch {
  /* dotenv not installed — rely on the process environment */
}

import { createServer as createHttpServer, type IncomingMessage } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

const MCP_PATH = '/mcp';

/** Run over stdio — the default for desktop hosts. */
async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[levelup-mcp] ready (stdio)\n');
}

/** Read and JSON-parse a request body. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Run over Streamable HTTP at http://<host>:<port>/mcp.
 *
 * Stateless mode: every request gets a fresh server + transport, which is
 * simple and perfectly fine for a personal single-user tool.
 */
async function runHttp(port: number): Promise<void> {
  const httpServer = createHttpServer(async (req, res) => {
    try {
      // Lightweight health check for sanity / uptime probes.
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { status: 'ok' } }));
        return;
      }

      if (req.url?.split('?')[0] !== MCP_PATH) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found. MCP endpoint is ${MCP_PATH}.` }));
        return;
      }

      if (req.method !== 'POST') {
        // Stateless mode has no standalone SSE stream to GET/DELETE.
        res.writeHead(405, { 'content-type': 'application/json', allow: 'POST' });
        res.end(JSON.stringify({ error: 'Method Not Allowed — POST JSON-RPC to this endpoint.' }));
        return;
      }

      const body = await readJsonBody(req);
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

      res.on('close', () => {
        void transport.close();
        void server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      process.stderr.write(`[levelup-mcp] request error: ${String(err)}\n`);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  httpServer.listen(port, () => {
    process.stderr.write(`[levelup-mcp] HTTP ready at http://localhost:${port}${MCP_PATH}\n`);
  });
}

async function main(): Promise<void> {
  const useHttp =
    process.argv.includes('--http') || (process.env.MCP_TRANSPORT ?? '').toLowerCase() === 'http';

  if (useHttp) {
    const port = Number(process.env.MCP_HTTP_PORT) || 3001;
    await runHttp(port);
  } else {
    await runStdio();
  }
}

main().catch((err) => {
  process.stderr.write(`[levelup-mcp] fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
