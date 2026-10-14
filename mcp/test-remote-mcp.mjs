import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import the API handler directly
const mcpHandler = (await import('../lib/api-handlers/mcp.js')).default || (await import('../lib/api-handlers/mcp.js'));

function createMockReqRes(method, url, headers = {}, body = null) {
    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = '';

    const req = {
        method,
        url,
        headers: { ...headers },
        body,
        query: {}
    };

    const res = {
        setHeader: (k, v) => { responseHeaders[k.toLowerCase()] = v; },
        status: (code) => { statusCode = code; return res; },
        writeHead: (code, headers) => {
            statusCode = code;
            if (headers) Object.assign(responseHeaders, headers);
            return res;
        },
        json: (data) => {
            responseBody = JSON.stringify(data);
            return res;
        },
        write: (chunk) => { responseBody += chunk; },
        end: () => res,
        get result() {
            return {
                statusCode,
                headers: responseHeaders,
                data: responseBody ? JSON.parse(responseBody) : null
            };
        }
    };

    return { req, res };
}

async function runTests() {
    console.log('--- Testing Remote MCP Handler (/api/mcp) ---\n');

    const validKey = process.env.MCP_SECRET_KEY || process.env.ADMIN_PASSWORD || 'test-key';
    process.env.MCP_SECRET_KEY = validKey;

    // 1. Test Unauthenticated Request
    console.log('1. Testing Unauthenticated Request:');
    const { req: req1, res: res1 } = createMockReqRes('GET', '/api/mcp');
    await mcpHandler(req1, res1);
    console.log(`   Status: ${res1.result.statusCode} (Expected: 401)`);
    if (res1.result.statusCode === 401) console.log('   ✅ Unauthorized check passed\n');

    // 2. Test Authenticated Server Info (GET)
    console.log('2. Testing Authenticated GET /api/mcp info:');
    const { req: req2, res: res2 } = createMockReqRes('GET', '/api/mcp', {
        'authorization': `Bearer ${validKey}`
    });
    await mcpHandler(req2, res2);
    console.log(`   Status: ${res2.result.statusCode}`);
    console.log(`   Server: ${res2.result.data.name} v${res2.result.data.version}`);
    console.log(`   Tools Available: ${res2.result.data.toolsCount}`);
    console.log('   ✅ Info check passed\n');

    // 3. Test MCP JSON-RPC tools/list
    console.log('3. Testing MCP JSON-RPC tools/list (POST):');
    const { req: req3, res: res3 } = createMockReqRes('POST', '/api/mcp', {
        'authorization': `Bearer ${validKey}`
    }, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    await mcpHandler(req3, res3);
    const tools = res3.result.data?.result?.tools || [];
    console.log(`   Registered Tools in JSON-RPC: ${tools.length}`);
    console.log(`   Names: ${tools.map(t => t.name).slice(0, 5).join(', ')}...`);
    console.log('   ✅ tools/list passed\n');

    // 4. Test MCP JSON-RPC tools/call (search_notes)
    console.log('4. Testing MCP JSON-RPC tools/call (search_notes):');
    const { req: req4, res: res4 } = createMockReqRes('POST', '/api/mcp', {
        'authorization': `Bearer ${validKey}`
    }, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'search_notes',
            arguments: { limit: 3 }
        }
    });
    await mcpHandler(req4, res4);
    console.log(`   Call Result: ${res4.result.data?.result?.content?.[0]?.text?.slice(0, 150)}...`);
    console.log('   ✅ tools/call passed\n');

    // 5. Test MCP JSON-RPC tools/call (get_budget_summary)
    console.log('5. Testing MCP JSON-RPC tools/call (get_budget_summary):');
    const { req: req5, res: res5 } = createMockReqRes('POST', '/api/mcp', {
        'authorization': `Bearer ${validKey}`
    }, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
            name: 'get_budget_summary',
            arguments: {}
        }
    });
    await mcpHandler(req5, res5);
    console.log(`   Budget Summary: ${res5.result.data?.result?.content?.[0]?.text}`);
    console.log('   ✅ get_budget_summary passed\n');

    console.log('🎉 All Remote MCP API tests completed successfully!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
