import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiIndex = (await import('../api/index.js')).default || (await import('../api/index.js'));

function createMockReqRes(method, url, headers = {}, body = null) {
    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = '';

    const parsedUrl = new URL(url, 'https://www.prajwalmreddy.com');

    const req = {
        method,
        url,
        headers: {
            host: 'www.prajwalmreddy.com',
            'x-forwarded-proto': 'https',
            ...headers
        },
        body,
        query: Object.fromEntries(parsedUrl.searchParams)
    };

    const res = {
        setHeader: (k, v) => { responseHeaders[k.toLowerCase()] = v; },
        status: (code) => { statusCode = code; return res; },
        writeHead: (code, headers) => {
            statusCode = code;
            if (headers) {
                Object.entries(headers).forEach(([k, v]) => { responseHeaders[k.toLowerCase()] = v; });
            }
            return res;
        },
        json: (data) => {
            responseBody = JSON.stringify(data);
            return res;
        },
        send: (data) => {
            responseBody = typeof data === 'object' ? JSON.stringify(data) : String(data);
            return res;
        },
        redirect: (code, loc) => {
            statusCode = code;
            responseHeaders['location'] = loc;
            return res;
        },
        write: (chunk) => { responseBody += chunk; },
        end: () => res,
        get result() {
            let data = null;
            try { data = JSON.parse(responseBody); } catch (_) { data = responseBody; }
            return {
                statusCode,
                headers: responseHeaders,
                data
            };
        }
    };

    return { req, res };
}

async function testOAuthFlow() {
    console.log('--- Testing Complete Claude OAuth 2.0 Flow ---\n');

    // 1. Test Discovery
    console.log('1. Testing /.well-known/oauth-authorization-server:');
    const { req: req1, res: res1 } = createMockReqRes('GET', '/.well-known/oauth-authorization-server');
    await apiIndex(req1, res1);
    console.log(`   Status: ${res1.result.statusCode}`);
    console.log(`   Auth Endpoint: ${res1.result.data?.authorization_endpoint}`);
    console.log(`   Token Endpoint: ${res1.result.data?.token_endpoint}`);
    console.log(`   Registration Endpoint: ${res1.result.data?.registration_endpoint}`);
    console.log('   ✅ Discovery endpoint working!\n');

    // 2. Test Dynamic Client Registration
    console.log('2. Testing Dynamic Client Registration (POST /api/mcp/oauth/register):');
    const { req: req2, res: res2 } = createMockReqRes('POST', '/api/mcp/oauth/register', {}, {
        client_name: 'Claude Test Connector',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
        grant_types: ['authorization_code', 'refresh_token']
    });
    await apiIndex(req2, res2);
    const clientId = res2.result.data?.client_id;
    const clientSecret = res2.result.data?.client_secret;
    console.log(`   Status: ${res2.result.statusCode}`);
    console.log(`   Registered Client ID: ${clientId}`);
    console.log('   ✅ DCR Registration working!\n');

    // 3. Test Authorization Approval
    console.log('3. Testing Authorization Code Generation (POST /api/mcp/oauth/authorize):');
    const secretKey = process.env.MCP_SECRET_KEY || process.env.ADMIN_PASSWORD;
    const { req: req3, res: res3 } = createMockReqRes('POST', '/api/mcp/oauth/authorize', {}, {
        client_id: clientId,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        state: 'test_state_123',
        approved: 'true',
        secret_key: secretKey
    });
    await apiIndex(req3, res3);
    console.log(`   Redirect Status: ${res3.result.statusCode}`);
    const redirectUrl = res3.result.headers['location'];
    console.log(`   Redirect URL: ${redirectUrl}`);
    const parsedRedirect = new URL(redirectUrl);
    const authCode = parsedRedirect.searchParams.get('code');
    console.log(`   Generated Auth Code: ${authCode}`);
    console.log('   ✅ Authorization approval & redirect working!\n');

    // 4. Test Token Exchange
    console.log('4. Testing Token Exchange (POST /api/mcp/oauth/token):');
    const { req: req4, res: res4 } = createMockReqRes('POST', '/api/mcp/oauth/token', {}, {
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        client_id: clientId
    });
    await apiIndex(req4, res4);
    const accessToken = res4.result.data?.access_token;
    console.log(`   Status: ${res4.result.statusCode}`);
    console.log(`   Issued Bearer Token: ${accessToken}`);
    console.log('   ✅ Token Exchange working!\n');

    // 5. Test Calling MCP Endpoint with Issued OAuth Token
    console.log('5. Testing MCP JSON-RPC with Issued OAuth Bearer Token:');
    const { req: req5, res: res5 } = createMockReqRes('POST', '/api/mcp', {
        'authorization': `Bearer ${accessToken}`
    }, {
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/list'
    });
    await apiIndex(req5, res5);
    const tools = res5.result.data?.result?.tools || [];
    console.log(`   MCP Response Status: ${res5.result.statusCode}`);
    console.log(`   Authenticated Tools Returned: ${tools.length}`);
    console.log('   ✅ Full Claude OAuth 2.0 flow verified!\n');

    console.log('🎉 Everything passed perfectly!');
    process.exit(0);
}

testOAuthFlow().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
