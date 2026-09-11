const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb && cachedClient) {
        try {
            await cachedDb.command({ ping: 1 });
            return cachedDb;
        } catch (err) {
            cachedDb = null;
            try {
                await cachedClient.close();
            } catch (_) {}
            cachedClient = null;
        }
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });

    try {
        await client.connect();
        cachedClient = client;
        cachedDb = client.db(process.env.MONGODB_DB || 'personal_dashboard');
        return cachedDb;
    } catch (err) {
        cachedClient = null;
        cachedDb = null;
        try {
            await client.close();
        } catch (_) {}
        throw err;
    }
}

module.exports = { connectToDatabase };
