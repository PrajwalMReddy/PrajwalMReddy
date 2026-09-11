const fs = require('fs');
fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
});

const { connectToDatabase } = require('../lib/db');
const { computeBudgetStats } = require('../lib/budgetStats');

async function test() {
    const db = await connectToDatabase();
    const [expenses, income] = await Promise.all([
        db.collection('expenses').find().toArray(),
        db.collection('income').find().toArray(),
    ]);
    console.log('Expenses count:', expenses.length, 'Income count:', income.length);
    const stats = computeBudgetStats(expenses, income, {});
    console.log('Categories length:', stats.categories ? stats.categories.length : 0);
    console.log('First 5 categories:', stats.categories ? stats.categories.slice(0, 5) : null);
    console.log('Transaction stats:', stats.transactionStats);
    console.log('MonthlyTrend length:', stats.chartData && stats.chartData.monthlyTrend ? stats.chartData.monthlyTrend.length : 0);
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
