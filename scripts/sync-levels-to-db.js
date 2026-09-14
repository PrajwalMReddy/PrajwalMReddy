const fs = require('fs');
const path = require('path');
const https = require('https');

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

function getPublicIp() {
    return new Promise((resolve) => {
        https.get('https://api.ipify.org', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', () => resolve('Unknown'));
    });
}

const { connectToDatabase } = require('../lib/db');

async function syncLevelsToDatabase() {
    console.log('======================================================');
    console.log('       SYNC KONAMI GAME TO MONGODB DATABASE           ');
    console.log('======================================================\n');

    const filePath = path.resolve(__dirname, '..', 'public', 'konami', 'levels.json');
    if (!fs.existsSync(filePath)) {
        console.error('❌ levels.json not found in public/konami/levels.json');
        process.exit(1);
    }

    const levels = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Found ${levels.length} custom level(s) in public/konami/levels.json.`);

    console.log('\nConnecting to MongoDB database...');
    try {
        const db = await connectToDatabase();
        console.log(`✔ Connected to database: "${db.databaseName}"`);

        await db.collection('cms_konami').updateOne(
            { _id: 'levels' },
            { $set: { levels, updatedAt: new Date() } },
            { upsert: true }
        );

        console.log(`\n🎉 SUCCESS: Successfully saved ${levels.length} level(s) to collection 'cms_konami' in MongoDB!`);
        process.exit(0);
    } catch (err) {
        console.error(`\n❌ Failed to connect to MongoDB: ${err.message}`);
        
        if (err.message.includes('SSL alert number 80') || err.message.includes('tlsv1 alert internal error')) {
            const ip = await getPublicIp();
            console.log('\n------------------------------------------------------');
            console.log('  WHY DID THIS HAPPEN & HOW TO FIX IT IN 1 MINUTE:    ');
            console.log('------------------------------------------------------');
            console.log('MongoDB Atlas drops connections with SSL Alert 80 when:');
            console.log('1. The connection limit (500) is exceeded, OR');
            console.log('2. The incoming public IP is not in your Atlas Network Access list.');
            console.log(`\nYour current public IP is: \x1b[36m${ip}\x1b[0m`);
            console.log('\nTo verify MongoDB Atlas access:');
            console.log('1. Open MongoDB Atlas (https://cloud.mongodb.com)');
            console.log('2. In the left menu, click "Network Access"');
            console.log('3. Click "+ Add IP Address"');
            console.log(`4. Add your IP (${ip}) or 0.0.0.0/0 (allow from anywhere)`);
            console.log('5. Re-run: npm run sync-db\n');
        }
        process.exit(1);
    }
}

syncLevelsToDatabase();

