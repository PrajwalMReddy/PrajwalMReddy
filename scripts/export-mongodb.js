const fs = require('fs');
const path = require('path');
const { connectToDatabase } = require('../lib/db');

// Load environment variables from .env if present
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

async function exportMongoDB() {
    console.log('======================================================');
    console.log('  EXPORTING ALL MONGODB DATA TO LOCAL FOLDER           ');
    console.log('======================================================\n');

    const db = await connectToDatabase();
    const dbName = db.databaseName || process.env.MONGODB_DB || 'personal_dashboard';
    console.log(`✔ Connected to database: "${dbName}"\n`);

    // Create timestamped backup directory
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupDirName = `mongodb-backup-${timestamp}`;
    const targetDir = path.resolve(__dirname, '..', 'backups', backupDirName);
    const latestDir = path.resolve(__dirname, '..', 'backups', 'latest');

    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(latestDir, { recursive: true });

    // Fetch all collections in the database
    const collections = await db.listCollections().toArray();
    collections.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${collections.length} collections. Downloading data...\n`);

    const manifest = {
        exportedAt: now.toISOString(),
        database: dbName,
        totalCollections: collections.length,
        totalDocuments: 0,
        collections: {},
    };

    for (const col of collections) {
        const colName = col.name;
        const docs = await db.collection(colName).find({}).toArray();
        const jsonContent = JSON.stringify(docs, null, 2);

        // Write to timestamped folder
        const filePath = path.join(targetDir, `${colName}.json`);
        fs.writeFileSync(filePath, jsonContent, 'utf8');

        // Also write to latest folder for convenience
        const latestFilePath = path.join(latestDir, `${colName}.json`);
        fs.writeFileSync(latestFilePath, jsonContent, 'utf8');

        const fileSizeKB = (Buffer.byteLength(jsonContent, 'utf8') / 1024).toFixed(2);
        manifest.totalDocuments += docs.length;
        manifest.collections[colName] = {
            count: docs.length,
            fileSizeKB: Number(fileSizeKB),
            file: `${colName}.json`,
        };

        console.log(`  ✔ [${colName}] -> ${docs.length} documents (${fileSizeKB} KB)`);
    }

    // Write manifest to both locations
    const manifestJson = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(path.join(targetDir, 'manifest.json'), manifestJson, 'utf8');
    fs.writeFileSync(path.join(latestDir, 'manifest.json'), manifestJson, 'utf8');

    console.log('\n======================================================');
    console.log('  EXPORT COMPLETE!');
    console.log(`  - Total Collections: ${collections.length}`);
    console.log(`  - Total Documents:   ${manifest.totalDocuments}`);
    console.log(`  - Backup Location:   ${targetDir}`);
    console.log(`  - Latest Shortcut:   ${latestDir}`);
    console.log('======================================================\n');
}

exportMongoDB()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Export failed:', err);
        process.exit(1);
    });
