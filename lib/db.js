const { MongoClient } = require('mongodb');
const dns = require('dns');

// On Windows, some local network resolvers refuse SRV lookups (querySrv ECONNREFUSED).
// Setting reliable DNS servers ensures MongoDB SRV seedlists resolve correctly.
try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

// Store connection cache on global so it survives dev-api.js require.cache invalidations
if (!global.__mongoState) {
    global.__mongoState = {
        cachedClient: null,
        cachedDb: null,
        connectingPromise: null,
        lastConnectError: null,
        lastConnectErrorTime: 0,
    };
}

const RETRY_COOLDOWN_MS = 2000; // 2 seconds cooldown between connection attempts if failed

function isMongoInCooldown() {
    const { lastConnectError, lastConnectErrorTime } = global.__mongoState;
    return Boolean(lastConnectError && (Date.now() - lastConnectErrorTime < RETRY_COOLDOWN_MS));
}

async function connectToDatabase() {
    const state = global.__mongoState;

    // 1. If already connected and ready, reuse cachedDb immediately (zero overhead)
    if (state.cachedDb && state.cachedClient) {
        return state.cachedDb;
    }

    // 2. If a connection is currently being established, all concurrent callers share the same promise
    // (Prevents race condition where concurrent requests create multiple distinct MongoClient instances)
    if (state.connectingPromise) {
        return await state.connectingPromise;
    }

    // 3. Fast-fail in 0ms if recent connection attempt failed within cooldown period
    if (isMongoInCooldown()) {
        throw state.lastConnectError;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    const client = new MongoClient(uri, {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000,
        socketTimeoutMS: 20000,
    });

    state.connectingPromise = (async () => {
        try {
            await client.connect();
            state.cachedClient = client;
            state.cachedDb = client.db(process.env.MONGODB_DB || 'personal_dashboard');
            state.lastConnectError = null;
            state.lastConnectErrorTime = 0;
            state.connectingPromise = null;
            return state.cachedDb;
        } catch (err) {
            state.cachedClient = null;
            state.cachedDb = null;
            state.connectingPromise = null;
            state.lastConnectError = err;
            state.lastConnectErrorTime = Date.now();
            try {
                await client.close();
            } catch (_) {}
            throw err;
        }
    })();

    return await state.connectingPromise;
}

module.exports = { connectToDatabase, isMongoInCooldown };

