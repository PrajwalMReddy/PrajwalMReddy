const fs = require('fs');
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

const { connectToDatabase } = require('../lib/db');
const { resequenceExpenses, resequenceIncome } = require('../lib/budgetResequence');

async function main() {
    console.log('Connecting to database...');
    const db = await connectToDatabase();

    console.log('\n--- Syncing Expenses Sequential Serial Numbers ---');
    const expenses = await resequenceExpenses(db);
    console.log(`Resequenced ${expenses.length} expenses chronologically (tiebreaker: insertion order).`);
    if (expenses.length > 0) {
        console.log(`Range: #1 (${expenses[0].date?.toISOString?.()?.slice(0, 10) || expenses[0].date} - "${expenses[0].item}") to #${expenses.length} (${expenses[expenses.length - 1].date?.toISOString?.()?.slice(0, 10) || expenses[expenses.length - 1].date} - "${expenses[expenses.length - 1].item}")`);
    }

    console.log('\n--- Syncing Income Sequential Numbers ---');
    const income = await resequenceIncome(db);
    console.log(`Resequenced ${income.length} income entries chronologically (tiebreaker: insertion order).`);
    if (income.length > 0) {
        console.log(`Range: #1 (${income[0].date?.toISOString?.()?.slice(0, 10) || income[0].date} - "${income[0].item}") to #${income.length} (${income[income.length - 1].date?.toISOString?.()?.slice(0, 10) || income[income.length - 1].date} - "${income[income.length - 1].item}")`);
    }

    console.log('\nSync completed successfully!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Error syncing budget serial numbers:', err);
    process.exit(1);
});
