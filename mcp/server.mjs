#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerNotesTools } from './tools/notes.mjs';
import { registerTodoTools } from './tools/todos.mjs';
import { registerBudgetTools } from './tools/budget.mjs';
import { registerNetworkingTools } from './tools/networking.mjs';
import { registerCmsTools } from './tools/cms.mjs';
import { registerResources } from './resources.mjs';
import { registerPrompts } from './prompts.mjs';
import { closeDatabase } from './db.mjs';

// Create the MCP Server instance
const server = new McpServer({
    name: 'prajwal-website-mcp',
    version: '1.0.0',
    description: 'Model Context Protocol server for Prajwal\'s personal website, notes, tasks, finances, and CRM'
});

// Register all modular tools
registerNotesTools(server);
registerTodoTools(server);
registerBudgetTools(server);
registerNetworkingTools(server);
registerCmsTools(server);

// Register resources and prompts
registerResources(server);
registerPrompts(server);

// Graceful cleanup
async function cleanup() {
    try {
        await closeDatabase();
    } catch (_) {}
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start communication over Stdio
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 Prajwal Website MCP Server running successfully on stdio');
}

main().catch((err) => {
    console.error('Fatal MCP Server Error:', err);
    process.exit(1);
});
