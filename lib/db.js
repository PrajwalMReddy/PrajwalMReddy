const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    const client = cachedClient || new MongoClient(uri);
    if (!cachedClient) {
        await client.connect();
        cachedClient = client;
    }

    cachedDb = client.db(process.env.MONGODB_DB || 'personal_dashboard');
    return cachedDb;
}

module.exports = { connectToDatabase };
