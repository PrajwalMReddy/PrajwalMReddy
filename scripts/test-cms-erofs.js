const assert = require('assert');
const fs = require('fs');
const contentHandler = require('../lib/api-handlers/cms/content');
const markdownHandler = require('../lib/api-handlers/cms/markdown');
const uploadHandler = require('../lib/api-handlers/cms/upload');
const { createToken } = require('../lib/auth');
const { connectToDatabase } = require('../lib/db');

// Mock response object
function createMockRes() {
    let statusCode = 200;
    let jsonBody = null;
    let headers = {};
    let sendBody = null;

    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        setHeader: (k, v) => {
            headers[k.toLowerCase()] = v;
            return res;
        },
        json: (data) => {
            jsonBody = data;
            return res;
        },
        send: (data) => {
            sendBody = data;
            return res;
        },
        getStatus: () => statusCode,
        getJson: () => jsonBody,
        getHeaders: () => headers,
        getSend: () => sendBody,
    };
    return res;
}

const path = require('path');

function loadEnvironment() {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
    }
}
loadEnvironment();

// In-memory collection fallback if MongoDB connection fails or is offline
const inMemoryCollections = new Map();
function getMockCollection(name) {
    if (!inMemoryCollections.has(name)) {
        inMemoryCollections.set(name, new Map());
    }
    const store = inMemoryCollections.get(name);
    return {
        findOne: async (query) => {
            if (query._id) return store.get(query._id) || null;
            for (const doc of store.values()) {
                let match = true;
                for (const k of Object.keys(query)) {
                    if (doc[k] !== query[k]) match = false;
                }
                if (match) return doc;
            }
            return null;
        },
        find: (query = {}) => ({
            toArray: async () => {
                const results = [];
                for (const doc of store.values()) {
                    let match = true;
                    for (const k of Object.keys(query)) {
                        if (doc[k] !== query[k]) match = false;
                    }
                    if (match) results.push(doc);
                }
                return results;
            },
        }),
        updateOne: async (query, update, options) => {
            const key = query._id;
            const existing = store.get(key) || { _id: key };
            const updated = { ...existing, ...update.$set };
            store.set(key, updated);
            return { acknowledged: true, upsertedCount: 1 };
        },
        deleteOne: async (query) => {
            store.delete(query._id);
            return { acknowledged: true, deletedCount: 1 };
        },
    };
}

async function runTests() {
    console.log('======================================================');
    console.log('  TESTING CMS EROFS & CLOUD PERSISTENCE HANDLERS       ');
    console.log('======================================================\n');

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_cms_tests_12345';
    const validToken = createToken();
    const authCookie = `admin_session=${validToken}`;

    // Test real MongoDB if available, otherwise intercept connectToDatabase with in-memory DB
    let isMock = false;
    try {
        await connectToDatabase();
        console.log('✔ Connected to live MongoDB for verification tests');
    } catch (err) {
        console.log('ℹ Using in-memory database mock for isolated test verification:', err.message);
        isMock = true;
        const dbModule = require('../lib/db');
        dbModule.connectToDatabase = async () => ({
            collection: (name) => getMockCollection(name),
        });
    }

    // 1. Intercept fs.writeFileSync to simulate EROFS (read-only filesystem)
    const originalWriteFileSync = fs.writeFileSync;
    const originalMkdirSync = fs.mkdirSync;

    let erofsSimulationActive = true;

    fs.mkdirSync = function (...args) {
        if (erofsSimulationActive) {
            const err = new Error("EROFS: read-only file system, mkdir '/var/task/public/blog'");
            err.code = 'EROFS';
            throw err;
        }
        return originalMkdirSync.apply(this, args);
    };

    fs.writeFileSync = function (...args) {
        if (erofsSimulationActive) {
            const err = new Error("EROFS: read-only file system, open '/var/task/public/blog/_metadata.json'");
            err.code = 'EROFS';
            throw err;
        }
        return originalWriteFileSync.apply(this, args);
    };

    try {
        let originalBlogData = [];
        let originalResearchData = [];
        try {
            const db = await connectToDatabase();
            const existing = await db.collection('cms_blog').findOne({ _id: 'current' });
            if (existing && Array.isArray(existing.data)) {
                originalBlogData = existing.data;
            }
            const existingRes = await db.collection('cms_research').findOne({ _id: 'current' });
            if (existingRes && Array.isArray(existingRes.data)) {
                originalResearchData = existingRes.data;
            }
        } catch {}

        console.log('\n1. Testing POST /api/cms/content under simulated EROFS...');
        const testBlogData = [
            ...originalBlogData.filter((p) => p.slug !== 'test-erofs-post'),
            {
                slug: 'test-erofs-post',
                title: 'Test Post During Read-Only Filesystem',
                description: 'Post should save to MongoDB without EROFS crash',
                date: '2026-09-11',
                visibility: 'public',
                source: 'local',
            },
        ];

        const reqPost = {
            method: 'POST',
            headers: { cookie: authCookie },
            body: { type: 'blog', data: testBlogData },
        };
        const resPost = createMockRes();

        await contentHandler(reqPost, resPost);

        assert.strictEqual(
            resPost.getStatus(),
            200,
            `Expected 200 OK under EROFS, got ${resPost.getStatus()}: ${JSON.stringify(resPost.getJson())}`
        );
        assert.strictEqual(resPost.getJson().success, true, 'Response should indicate success');
        assert.strictEqual(resPost.getJson().storage.database, true, 'Storage should show database: true');
        assert.strictEqual(resPost.getJson().storage.filesystem, false, 'Storage should show filesystem: false');
        console.log('  ✔ POST /api/cms/content succeeded under EROFS with MongoDB persistence!');

        console.log('\n2. Testing GET /api/cms/content (unauthenticated caller)...');
        const reqGetPublic = {
            method: 'GET',
            headers: {},
            query: { type: 'blog' },
        };
        const resGetPublic = createMockRes();
        await contentHandler(reqGetPublic, resGetPublic);

        assert.strictEqual(resGetPublic.getStatus(), 200, 'Public GET should return 200 without auth');
        const publicData = resGetPublic.getJson();
        assert(Array.isArray(publicData), 'Public content should be an array');
        assert(publicData.some((p) => p.slug === 'test-erofs-post'), 'Public data should contain MongoDB saved post');
        console.log('  ✔ Public GET /api/cms/content successfully returned MongoDB persisted post without auth');

        console.log('\n3. Testing POST /api/cms/markdown under simulated EROFS...');
        const testMarkdown = '# EROFS Success Title\n\nThis content was saved to MongoDB even when disk is read-only.';
        const reqMdPost = {
            method: 'POST',
            headers: { cookie: authCookie },
            body: {
                type: 'blog',
                slug: 'test-erofs-post',
                content: testMarkdown,
            },
        };
        const resMdPost = createMockRes();
        await markdownHandler(reqMdPost, resMdPost);

        assert.strictEqual(
            resMdPost.getStatus(),
            200,
            `Expected 200 OK under EROFS for markdown, got ${resMdPost.getStatus()}: ${JSON.stringify(resMdPost.getJson())}`
        );
        assert.strictEqual(resMdPost.getJson().success, true, 'Markdown response should indicate success');
        console.log('  ✔ POST /api/cms/markdown succeeded under EROFS with MongoDB persistence!');

        console.log('\n4. Testing GET /api/cms/markdown for saved post...');
        const reqMdGet = {
            method: 'GET',
            headers: {},
            query: { type: 'blog', slug: 'test-erofs-post' },
        };
        const resMdGet = createMockRes();
        await markdownHandler(reqMdGet, resMdGet);

        assert.strictEqual(resMdGet.getStatus(), 200, 'GET markdown should return 200');
        assert.strictEqual(resMdGet.getJson().exists, true, 'Markdown exists should be true');
        assert.strictEqual(resMdGet.getJson().content, testMarkdown, 'Markdown content should match saved content');
        console.log('  ✔ GET /api/cms/markdown successfully retrieved blog content from MongoDB');

        console.log('\n4b. Testing POST /api/cms/markdown for research article under simulated EROFS...');
        const testResearchMarkdown = '# Research EROFS Success Title\n\nResearch article saved to MongoDB.';
        const reqResMdPost = {
            method: 'POST',
            headers: { cookie: authCookie },
            body: {
                type: 'research',
                slug: 'test-erofs-research',
                content: testResearchMarkdown,
            },
        };
        const resResMdPost = createMockRes();
        await markdownHandler(reqResMdPost, resResMdPost);

        assert.strictEqual(
            resResMdPost.getStatus(),
            200,
            `Expected 200 OK under EROFS for research markdown, got ${resResMdPost.getStatus()}: ${JSON.stringify(resResMdPost.getJson())}`
        );
        assert.strictEqual(resResMdPost.getJson().success, true, 'Research markdown response should indicate success');
        console.log('  ✔ POST /api/cms/markdown succeeded for research under EROFS with MongoDB persistence!');

        console.log('\n4c. Testing GET /api/cms/markdown for saved research article...');
        const reqResMdGet = {
            method: 'GET',
            headers: {},
            query: { type: 'research', slug: 'test-erofs-research' },
        };
        const resResMdGet = createMockRes();
        await markdownHandler(reqResMdGet, resResMdGet);

        assert.strictEqual(resResMdGet.getStatus(), 200, 'GET research markdown should return 200');
        assert.strictEqual(resResMdGet.getJson().exists, true, 'Research markdown exists should be true');
        assert.strictEqual(resResMdGet.getJson().content, testResearchMarkdown, 'Research markdown content should match saved content');
        console.log('  ✔ GET /api/cms/markdown successfully retrieved research content from MongoDB');

        console.log('\n5. Testing POST /api/cms/upload under simulated EROFS...');
        const sampleBase64 = Buffer.from('fake-image-bytes-12345').toString('base64');
        const reqUploadPost = {
            method: 'POST',
            headers: { cookie: authCookie },
            body: {
                folder: 'photography',
                filename: 'erofs-test.jpeg',
                data: `data:image/jpeg;base64,${sampleBase64}`,
            },
        };
        const resUploadPost = createMockRes();
        await uploadHandler(reqUploadPost, resUploadPost);

        // In read-only cloud deployment, upload returns helpful advice to use Image URL (zero database bloat)
        assert.strictEqual(
            resUploadPost.getStatus(),
            400,
            `Expected 400 with helpful guidance under EROFS, got ${resUploadPost.getStatus()}`
        );
        assert(resUploadPost.getJson().error.includes('Image URL'), 'Response directs user to use Image URL tab');
        console.log('  ✔ POST /api/cms/upload correctly prevented database bloat under EROFS and suggested Image URL');

        console.log('\n6. Testing GET /api/cms/upload static image listing...');
        const reqUploadGet = {
            method: 'GET',
            headers: { cookie: authCookie },
            query: { folder: 'photography' },
        };
        const resUploadGet = createMockRes();
        await uploadHandler(reqUploadGet, resUploadGet);

        assert.strictEqual(resUploadGet.getStatus(), 200, 'Image listing should return 200');
        assert(Array.isArray(resUploadGet.getJson().images), 'Images should be an array');
        console.log('  ✔ GET /api/cms/upload successfully listed static images without database media bloat');

        console.log('\n7. Testing POST without authentication...');
        const reqUnauth = {
            method: 'POST',
            headers: {},
            body: { type: 'blog', data: [] },
        };
        const resUnauth = createMockRes();
        await contentHandler(reqUnauth, resUnauth);
        assert.strictEqual(resUnauth.getStatus(), 401, 'Unauthenticated POST must be rejected with 401');
        console.log('  ✔ Unauthenticated POST /api/cms/content rejected with 401');

        // Cleanup test data from MongoDB
        try {
            const db = await connectToDatabase();
            await db.collection('cms_blog').updateOne({ _id: 'current' }, { $set: { data: originalBlogData } });
            await db.collection('cms_research').updateOne({ _id: 'current' }, { $set: { data: originalResearchData } });
            console.log('  ✔ Cleaned up test artifacts and restored live blog and research data');
        } catch {
            // ignore cleanup errors
        }
    } finally {
        // Restore original fs functions
        erofsSimulationActive = false;
        fs.writeFileSync = originalWriteFileSync;
        fs.mkdirSync = originalMkdirSync;
    }

    console.log('\n======================================================');
    console.log('  ALL CMS EROFS TESTS PASSED SUCCESSFULLY! (100%)      ');
    console.log('======================================================\n');
}

runTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ CMS EROFS Test failed:', err);
        process.exit(1);
    });
