import { MongoClient } from 'mongodb';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Setup reliable DNS servers for Windows SRV seedlists
try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (_) {}

let cachedClient = null;
let cachedDb = null;
let connectingPromise = null;

export async function connectToDatabase() {
    if (cachedDb && cachedClient) {
        return cachedDb;
    }

    if (connectingPromise) {
        return await connectingPromise;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not defined in the environment or .env file');
    }

    const client = new MongoClient(uri, {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });

    connectingPromise = (async () => {
        try {
            await client.connect();
            cachedClient = client;
            cachedDb = client.db(process.env.MONGODB_DB || 'personal_dashboard');
            connectingPromise = null;
            return cachedDb;
        } catch (err) {
            cachedClient = null;
            cachedDb = null;
            connectingPromise = null;
            try {
                await client.close();
            } catch (_) {}
            throw err;
        }
    })();

    return await connectingPromise;
}

export async function closeDatabase() {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
        cachedDb = null;
    }
}
