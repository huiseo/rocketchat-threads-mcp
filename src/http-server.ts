#!/usr/bin/env node
/**
 * Rocket.Chat MCP Server - HTTP/SSE Mode
 *
 * This runs the MCP server over HTTP for remote access.
 * Use this when Claude Desktop is on a different machine.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ErrorCode,
    McpError
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { loadConfig } from './config/config.js';
import { toolRegistry } from './tools/index.js';
import { getClient } from './api/client.js';

// Server metadata
const SERVER_NAME = 'mcp-rocketchat';
const SERVER_VERSION = '0.1.0';

// Store transports by session ID for multi-session support
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Create and configure the MCP server
 */
function createMcpServer(): Server {
    const server = new Server(
        {
            name: SERVER_NAME,
            version: SERVER_VERSION
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // Handle list tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = toolRegistry.getSchemas();
        return { tools };
    });

    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{
        content: Array<{ type: 'text'; text: string }>;
        isError?: boolean;
    }> => {
        const { name, arguments: args } = request.params;

        const tool = toolRegistry.get(name);
        if (!tool) {
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${name}`
            );
        }

        try {
            const result = await tool.handler(args || {});
            return {
                content: result.content,
                isError: result.isError
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: {
                            code: 'EXECUTION_ERROR',
                            message: `Tool execution failed: ${message}`
                        }
                    }, null, 2)
                }],
                isError: true
            };
        }
    });

    return server;
}

/**
 * Handle HTTP requests for MCP
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION }));
        return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // For new sessions (POST without session ID or initialization)
        if (req.method === 'POST' && !sessionId) {
            // Create new transport and server
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
            });

            const server = createMcpServer();

            // Store transport
            transport.onclose = () => {
                if (transport.sessionId) {
                    transports.delete(transport.sessionId);
                }
            };

            await server.connect(transport);

            if (transport.sessionId) {
                transports.set(transport.sessionId, transport);
            }

            await transport.handleRequest(req, res);
            return;
        }

        // For existing sessions
        if (sessionId) {
            const transport = transports.get(sessionId);
            if (transport) {
                await transport.handleRequest(req, res);
                return;
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Session not found' }));
                return;
            }
        }

        // GET request for SSE stream without session
        if (req.method === 'GET') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session ID required for GET requests' }));
            return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
        return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    // Load and validate configuration
    const config = loadConfig();

    // Validate required configuration
    if (!config.rocketchat.url) {
        console.error('Error: ROCKETCHAT_URL environment variable is required');
        process.exit(1);
    }
    if (!config.rocketchat.authToken) {
        console.error('Error: ROCKETCHAT_AUTH_TOKEN environment variable is required');
        process.exit(1);
    }
    if (!config.rocketchat.userId) {
        console.error('Error: ROCKETCHAT_USER_ID environment variable is required');
        process.exit(1);
    }

    // Test connection
    const client = getClient();
    const connected = await client.testConnection();
    if (!connected) {
        console.error('Error: Failed to connect to Rocket.Chat server');
        console.error(`URL: ${config.rocketchat.url}`);
        process.exit(1);
    }

    // Get port from environment or default
    const port = parseInt(process.env.MCP_HTTP_PORT || '3456', 10);

    // Create HTTP server
    const httpServer = createServer(handleRequest);

    httpServer.listen(port, '0.0.0.0', () => {
        console.error(`${SERVER_NAME} v${SERVER_VERSION} HTTP server started`);
        console.error(`Listening on http://0.0.0.0:${port}`);
        console.error(`MCP endpoint: http://0.0.0.0:${port}/mcp`);
        console.error(`Health check: http://0.0.0.0:${port}/health`);
        console.error(`Connected to: ${config.rocketchat.url}`);
        console.error(`Write operations: ${config.write.enabled ? 'enabled' : 'disabled'}`);
    });
}

// Run the server
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
