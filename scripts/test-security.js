const assert = require('assert');
const bcrypt = require('bcryptjs');
const { createToken, verifyToken, requireAuth, verifyPassword } = require('../lib/auth');
const loginHandler = require('../lib/api-handlers/auth/login');
const apiRouter = require('../api/index');

async function runTests() {
    console.log('--- Running Security Verification Tests ---');

    // 1. Verify Backdoor Removal
    console.log('1. Testing backdoor removal in verifyPassword...');
    const testSecretPassword = 'mySecurePassword123!';
    const testHash = bcrypt.hashSync(testSecretPassword, 10);
    process.env.ADMIN_PASSWORD_HASH = testHash;
    process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

    const adminCheck = await verifyPassword('admin');
    assert.strictEqual(adminCheck, false, 'FAIL: "admin" should NOT be accepted as password!');
    console.log('  ✔ "admin" password rejected');

    const emptyCheck = await verifyPassword('');
    assert.strictEqual(emptyCheck, false, 'FAIL: empty password should NOT be accepted!');
    console.log('  ✔ empty password rejected');

    const invalidTypeCheck = await verifyPassword(null);
    assert.strictEqual(invalidTypeCheck, false, 'FAIL: null password should NOT be accepted!');
    console.log('  ✔ non-string password rejected');

    const validCheck = await verifyPassword(testSecretPassword);
    assert.strictEqual(validCheck, true, 'FAIL: real password should be accepted!');
    console.log('  ✔ valid password correctly accepted');

    // 2. Testing requireAuth and Cache-Control headers
    console.log('2. Testing requireAuth security and cache headers...');
    let headers = {};
    let statusSet = null;
    let jsonSent = null;

    const mockRes = {
        setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
        status: (code) => { statusSet = code; return mockRes; },
        json: (data) => { jsonSent = data; return mockRes; },
    };

    const unauthReq = { headers: {} };
    const authResult = requireAuth(unauthReq, mockRes);

    assert.strictEqual(authResult, false, 'FAIL: unauthenticated request should fail auth');
    assert.strictEqual(statusSet, 401, 'FAIL: status should be 401');
    assert.strictEqual(headers['cache-control'], 'private, no-cache, no-store, must-revalidate');
    assert.strictEqual(headers['pragma'], 'no-cache');
    console.log('  ✔ requireAuth rejects unauthenticated requests with 401 and sets no-cache headers');

    // With valid token
    headers = {};
    statusSet = null;
    jsonSent = null;
    const validToken = createToken();
    const authedReq = { headers: { cookie: `admin_session=${validToken}` } };
    const authedResult = requireAuth(authedReq, mockRes);

    assert.strictEqual(authedResult, true, 'FAIL: valid token should pass auth');
    assert.strictEqual(headers['cache-control'], 'private, no-cache, no-store, must-revalidate');
    console.log('  ✔ requireAuth permits valid token and sets no-cache headers');

    // 3. Testing Rate Limiting on loginHandler
    console.log('3. Testing login brute force rate limiting...');
    const testIp = '198.51.100.42';

    for (let i = 1; i <= 5; i++) {
        headers = {};
        statusSet = null;
        jsonSent = null;
        const fakeReq = {
            method: 'POST',
            headers: { 'x-forwarded-for': testIp },
            body: { password: 'wrongPassword' + i },
        };
        await loginHandler(fakeReq, mockRes);
        assert.strictEqual(statusSet, 401, `FAIL: attempt ${i} should return 401`);
        console.log(`  ✔ Attempt ${i} correctly rejected with 401`);
    }

    // 6th attempt should be rate limited with 429
    headers = {};
    statusSet = null;
    jsonSent = null;
    const rateLimitedReq = {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { password: 'wrongPassword6' },
    };
    await loginHandler(rateLimitedReq, mockRes);
    assert.strictEqual(statusSet, 429, 'FAIL: attempt 6 should be blocked with 429 Too Many Requests');
    assert.ok(jsonSent.error.includes('Too many failed login attempts'), 'FAIL: error message should indicate rate limit');
    console.log('  ✔ 6th attempt blocked with 429 Too Many Requests');

    // 4. Testing api/index.js global security headers
    console.log('4. Testing api/index.js global headers...');
    headers = {};
    statusSet = null;
    jsonSent = null;
    const routerReq = {
        url: '/api/budget/expenses',
        headers: { host: 'localhost' },
    };
    await apiRouter(routerReq, mockRes);
    assert.strictEqual(headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(headers['x-frame-options'], 'DENY');
    assert.strictEqual(headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.strictEqual(headers['cache-control'], 'private, no-cache, no-store, must-revalidate');
    console.log('  ✔ apiRouter sets security and cache headers on all API requests');

    console.log('\n✅ ALL SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
