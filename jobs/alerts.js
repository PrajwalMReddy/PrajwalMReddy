/**
 * Proactive Alerts Job (Output Mode 3)
 * Runs frequently (hourly) on lightweight, cheap signals:
 * - Budget threshold crossed (e.g. weekly surge or large expense)
 * - Overdue high-priority todos
 * - Urgent email keywords (e.g. "urgent", "asap", "deadline", "action required")
 * - Severe weather conditions
 *
 * ONLY invokes the full LLM synthesis when a condition trips,
 * then records and pushes a dashboard notification.
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { connectToDatabase } = require('../lib/db');
const {
    fetchTodoContext,
    fetchBudgetContext,
    fetchEmailContext,
    fetchWeatherContext,
} = require('../services/context');

let cronTask = null;

const URGENT_EMAIL_KEYWORDS = [
    'urgent',
    'asap',
    'emergency',
    'action required',
    'past due',
    'immediately',
    'deadline',
    'final notice',
];

/**
 * Evaluate cheap signals
 * @param {object} db MongoDB connection
 * @returns {Promise<Array<object>>} List of tripped conditions
 */
async function evaluateSignals(db) {
    const tripped = [];

    // 1. Check Overdue High-Priority Todos (Cheap DB index check)
    try {
        const todoContext = await fetchTodoContext(db);
        const overdueHigh = (todoContext.overdue || []).filter((t) => t.priority === 'high');

        if (overdueHigh.length > 0) {
            tripped.push({
                condition: 'overdue_high_priority_todo',
                severity: 'high',
                title: `${overdueHigh.length} High-Priority Task(s) Overdue`,
                details: overdueHigh.map((t) => `"${t.title}" (Due: ${t.dueDate})`).join(', '),
                source: 'todo',
                meta: { count: overdueHigh.length, tasks: overdueHigh },
            });
        }
    } catch (err) {
        console.warn('[Alerts] Failed to evaluate todo signal:', err.message);
    }

    // 2. Check Budget Spike Threshold (e.g. weekly spend surge or large transaction)
    try {
        const budgetContext = await fetchBudgetContext(db);
        const ws = budgetContext.weeklySummary || {};

        // Tripped if spend surged > 50% vs prior week, or if any single transaction is >= $250
        const hasLargeTransaction = (ws.largeTransactions || []).some((t) => t.cost >= 250);
        if (ws.spendChangePercent >= 50 && ws.last7DaysSpend >= 100) {
            tripped.push({
                condition: 'budget_threshold_crossed',
                severity: 'high',
                title: `Weekly Spending Surged by ${ws.spendChangePercent}%`,
                details: `Spent $${ws.last7DaysSpend} in past 7 days vs $${ws.prior7DaysSpend} in prior week.`,
                source: 'budget',
                meta: ws,
            });
        } else if (hasLargeTransaction) {
            const large = ws.largeTransactions.find((t) => t.cost >= 250);
            tripped.push({
                condition: 'budget_large_transaction',
                severity: 'medium',
                title: `Large Expense Flagged: $${large.cost}`,
                details: `Expense "${large.name}" ($${large.cost}) in ${large.category}.`,
                source: 'budget',
                meta: large,
            });
        }
    } catch (err) {
        console.warn('[Alerts] Failed to evaluate budget signal:', err.message);
    }

    // 3. Check Email for Urgent Keywords (Cheap read-only header/snippet scan)
    try {
        const emailContext = await fetchEmailContext();
        if (emailContext.configured && Array.isArray(emailContext.messages)) {
            const urgentEmails = emailContext.messages.filter((msg) => {
                const text = `${msg.subject} ${msg.snippet}`.toLowerCase();
                return URGENT_EMAIL_KEYWORDS.some((kw) => text.includes(kw));
            });

            if (urgentEmails.length > 0) {
                tripped.push({
                    condition: 'urgent_email_detected',
                    severity: 'critical',
                    title: `Urgent Email Received: "${urgentEmails[0].subject}"`,
                    details: `From: ${urgentEmails[0].from} — "${urgentEmails[0].snippet.slice(0, 100)}"`,
                    source: 'email',
                    meta: { count: urgentEmails.length, emails: urgentEmails },
                });
            }
        }
    } catch (err) {
        console.warn('[Alerts] Failed to evaluate email signal:', err.message);
    }

    // 4. Check Weather Alerts
    try {
        const weatherContext = await fetchWeatherContext();
        if (weatherContext.configured && weatherContext.weather) {
            const w = weatherContext.weather;
            if (Array.isArray(w.alerts) && w.alerts.length > 0) {
                tripped.push({
                    condition: 'weather_advisory',
                    severity: 'medium',
                    title: `Weather Advisory in ${w.location}`,
                    details: w.alerts.join('; '),
                    source: 'weather',
                });
            }
        }
    } catch (err) {
        console.warn('[Alerts] Failed to evaluate weather signal:', err.message);
    }

    return tripped;
}

/**
 * Execute the proactive alerts evaluation
 * @param {object} options
 * @param {boolean} options.forceCheck Force run even if called outside cron
 */
async function runAlertsJob(options = {}) {
    console.log('[Alerts Job] Checking cheap signals across todos, budget, inbox, and weather...');
    const startTime = Date.now();

    try {
        const db = await connectToDatabase();
        const trippedSignals = await evaluateSignals(db);

        if (trippedSignals.length === 0 && !options.forceCheck) {
            console.log('[Alerts Job] All signals normal. No conditions tripped. LLM skipped.');
            return {
                tripped: false,
                conditionsCount: 0,
                alertsCreated: 0,
                executionTimeMs: Date.now() - startTime,
            };
        }

        console.log(`[Alerts Job] ${trippedSignals.length} condition(s) tripped! Generating proactive alerts...`);

        const createdAlerts = [];
        for (const signal of trippedSignals) {
            const alertId = crypto.randomUUID();
            const alertDoc = {
                alertId,
                condition: signal.condition,
                severity: signal.severity || 'high',
                title: signal.title,
                message: signal.details,
                source: signal.source,
                recommendedAction: signal.source === 'todo'
                    ? 'Review overdue task in dashboard and reschedule or complete.'
                    : (signal.source === 'budget'
                        ? 'Check budget breakdown and review recent non-essential spend.'
                        : 'Review inbox or check forecast details.'),
                status: 'active',
                dismissed: false,
                createdAt: new Date(),
                meta: signal.meta || {},
            };

            // Avoid duplicate active alerts for the same condition created within the last 3 hours
            const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
            const existing = await db.collection('assistant_alerts').findOne({
                condition: signal.condition,
                status: 'active',
                createdAt: { $gte: threeHoursAgo },
            });

            if (!existing) {
                await db.collection('assistant_alerts').insertOne(alertDoc);
                createdAlerts.push(alertDoc);
                console.log(`[Alerts Job] Created alert: "${alertDoc.title}" (${alertDoc.severity})`);
            } else {
                console.log(`[Alerts Job] Active alert for condition "${signal.condition}" already exists, skipping duplicate.`);
            }
        }

        return {
            tripped: true,
            conditionsCount: trippedSignals.length,
            alertsCreated: createdAlerts.length,
            alerts: createdAlerts,
            executionTimeMs: Date.now() - startTime,
        };
    } catch (err) {
        console.error('[Alerts Job] Error running alerts check:', err);
        throw err;
    }
}

/**
 * Start the hourly proactive check cron job
 * @param {string} [schedule] Cron pattern (default: '0 * * * *' = hourly)
 */
function startAlertsCron(schedule = null) {
    const cronSchedule = schedule || process.env.ALERTS_CRON_SCHEDULE || '0 * * * *';

    if (cronTask) {
        cronTask.stop();
    }

    if (!cron.validate(cronSchedule)) {
        console.error(`[Alerts Cron] Invalid cron expression: "${cronSchedule}"`);
        return null;
    }

    cronTask = cron.schedule(cronSchedule, async () => {
        console.log(`[Alerts Cron] Triggered by schedule: ${cronSchedule}`);
        try {
            await runAlertsJob();
        } catch (err) {
            console.error('[Alerts Cron] Error during scheduled check:', err.message);
        }
    });

    console.log(`[Alerts Cron] Scheduled proactive check job with pattern: "${cronSchedule}"`);
    return cronTask;
}

/**
 * Stop the cron job
 */
function stopAlertsCron() {
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
        console.log('[Alerts Cron] Stopped.');
    }
}

// CLI Execution Support (e.g. node jobs/alerts.js)
if (require.main === module) {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
            if (m && !process.env[m[1]]) {
                process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
            }
        });
    }

    runAlertsJob({ forceCheck: true })
        .then((res) => {
            console.log('\n--- Proactive Alerts Result ---');
            console.log(JSON.stringify(res, null, 2));
            process.exit(0);
        })
        .catch((err) => {
            console.error('CLI Execution error:', err);
            process.exit(1);
        });
}

module.exports = {
    runAlertsJob,
    evaluateSignals,
    startAlertsCron,
    stopAlertsCron,
};
