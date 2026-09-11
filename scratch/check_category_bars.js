const React = require('react');
const ReactDOMServer = require('react-dom/server');
const fs = require('fs');

fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
});

const { connectToDatabase } = require('../lib/db');
const { computeBudgetStats } = require('../lib/budgetStats');

async function check() {
    const db = await connectToDatabase();
    const [expenses, income] = await Promise.all([
        db.collection('expenses').find().toArray(),
        db.collection('income').find().toArray(),
    ]);
    const stats = computeBudgetStats(expenses, income, {});

    console.log('Category breakdown chartData:', stats.chartData.categoryBreakdown);
    console.log('Category list:', stats.categories);
    
    // Check maxCategory calculation:
    const categoryList = Array.isArray(stats.categories) ? stats.categories : [];
    const maxCategory = categoryList.length > 0
        ? Math.max(...categoryList.map((cat) => Number(cat.spending) || 0))
        : 0;
    console.log('maxCategory:', maxCategory);

    categoryList.forEach(cat => {
        const val = Number(cat.spending) || 0;
        const width = maxCategory > 0 ? (val / maxCategory) * 100 : 0;
        console.log(`Category: ${cat.category}, value: ${val}, width: ${width.toFixed(1)}%`);
    });

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
