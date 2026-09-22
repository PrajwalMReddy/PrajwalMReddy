/**
 * Scheduled Digest Job (Output Mode 1)
 * Runs every morning via node-cron (and on-demand or after notable events).
 * Builds complete context snapshot, calls LLM synthesis, and persists structured
 * digest in the MongoDB `assistant_digests` collection with timestamps for memory across runs.
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { connectToDatabase } = require('../lib/db');
const { buildPersonalContext } = require('../services/context');
const { generateDigest } = require('../services/assistant');

let cronTask = null;

/**
 * Execute the digest synthesis job
 * @param {object} options
 * @param {string} options.trigger 'cron' | 'manual' | 'expense' | 'cli'
 * @param {object} [options.contextOverride] Optional pre-built context
 * @returns {Promise<object>} The stored digest record
 */
async function runDigestJob(options = {}) {
    const trigger = options.trigger || 'manual';
    console.log(`[Digest Job] Starting digest generation (trigger: ${trigger})...`);
    const startTime = Date.now();

    try {
        const db = await connectToDatabase();
        // 1. Build personal context (strictly personal data: todos, calendar, emails, budget, notes)
        const context = options.contextOverride || (await buildPersonalContext());

        // 2. Synthesize via Claude LLM layer
        const synthesis = await generateDigest(context);

        // 3. Persist digest record in MongoDB
        const now = new Date();
        const dateKey = now.toISOString().slice(0, 10);

        const digestDoc = {
            createdAt: now,
            dateKey,
            trigger,
            digest: synthesis.digest,
            metrics: synthesis.metrics || {},
            source: synthesis.source,
            model: synthesis.model,
            executionTimeMs: Date.now() - startTime,
        };

        const result = await db.collection('assistant_digests').insertOne(digestDoc);
        digestDoc._id = result.insertedId;

        console.log(`[Digest Job] Completed in ${digestDoc.executionTimeMs}ms. ID: ${result.insertedId}`);
        return digestDoc;
    } catch (err) {
        console.error('[Digest Job] Failed to generate digest:', err);
        throw err;
    }
}

/**
 * Start the daily morning cron job
 * @param {string} [schedule] Cron expression (default: '0 7 * * *' = 7:00 AM daily)
 */
function startDigestCron(schedule = null) {
    const cronSchedule = schedule || process.env.DIGEST_CRON_SCHEDULE || '0 7 * * *';

    if (cronTask) {
        cronTask.stop();
    }

    if (!cron.validate(cronSchedule)) {
        console.error(`[Digest Cron] Invalid cron expression: "${cronSchedule}"`);
        return null;
    }

    cronTask = cron.schedule(cronSchedule, async () => {
        console.log(`[Digest Cron] Triggered by schedule: ${cronSchedule}`);
        try {
            await runDigestJob({ trigger: 'cron' });
        } catch (err) {
            console.error('[Digest Cron] Error during scheduled digest:', err.message);
        }
    });

    console.log(`[Digest Cron] Scheduled morning digest job with pattern: "${cronSchedule}"`);
    return cronTask;
}

/**
 * Stop the cron job
 */
function stopDigestCron() {
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
        console.log('[Digest Cron] Stopped.');
    }
}

// CLI Execution Support (e.g. node jobs/digest.js)
if (require.main === module) {
    // Helper to ensure .env is loaded when run directly
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
            if (m && !process.env[m[1]]) {
                process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
            }
        });
    }

    runDigestJob({ trigger: 'cli_manual' })
        .then((doc) => {
            console.log('\n--- Generated Digest ---');
            console.log(JSON.stringify(doc.digest, null, 2));
            process.exit(0);
        })
        .catch((err) => {
            console.error('CLI Execution error:', err);
            process.exit(1);
        });
}

module.exports = {
    runDigestJob,
    startDigestCron,
    stopDigestCron,
};
