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

async function inspectDatabase() {
    const db = await connectToDatabase();
    console.log('=== DATABASE AUDIT REPORT ===\n');

    // 1. Inspect Todos
    const todos = await db.collection('todos').find().toArray();
    console.log(`[todos] Total: ${todos.length}`);
    const completedTodos = todos.filter(t => t.completed);
    console.log(`  - Completed: ${completedTodos.length}, Active: ${todos.length - completedTodos.length}`);
    const duplicateTodoSerials = todos.map(t => t.serialNumber).filter((s, i, a) => a.indexOf(s) !== i && s != null);
    if (duplicateTodoSerials.length > 0) console.log(`  - Duplicate serialNumbers: ${duplicateTodoSerials}`);

    // 2. Inspect Notes
    const notes = await db.collection('notes').find().toArray();
    console.log(`\n[notes] Total: ${notes.length}`);
    const archivedNotes = notes.filter(n => n.archived);
    console.log(`  - Archived: ${archivedNotes.length}, Active: ${notes.length - archivedNotes.length}`);

    // 3. Inspect BudgetPlans
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const budgetColName = allCollections.includes('budget_plans') ? 'budget_plans' : 'budgetPlans';
    const plans = await db.collection(budgetColName).find().toArray();
    console.log(`\n[${budgetColName}] Total: ${plans.length}`);
    plans.forEach(p => console.log(`  - Ayana ${p.ayanaNumber}: budgeted ${p.ayanaBudgeted}`));

    // Dead Collections Check
    const deadAiCols = allCollections.filter(c => c.startsWith('ai_'));
    if (deadAiCols.length > 0) {
        console.log(`\n[WARNING] Found obsolete AI collections: ${deadAiCols.join(', ')}`);
    } else {
        console.log('\n[collections] Zero obsolete AI collections found (clean)');
    }

    // 4. Inspect Expenses
    const expenses = await db.collection('expenses').find().toArray();
    console.log(`\n[expenses] Total: ${expenses.length}`);
    const expSerials = expenses.map(e => e.serialNumber);
    const expDupes = expSerials.filter((s, i, a) => a.indexOf(s) !== i && s != null);
    console.log(`  - Duplicate serial numbers: ${expDupes.length}`);
    const invalidExp = expenses.filter(e => !e.item || typeof e.cost !== 'number' || isNaN(e.cost));
    console.log(`  - Invalid expenses (missing item/cost): ${invalidExp.length}`);

    // 5. Inspect Income
    const income = await db.collection('income').find().toArray();
    console.log(`\n[income] Total: ${income.length}`);
    const incSerials = income.map(i => i.no);
    const incDupes = incSerials.filter((s, i, a) => a.indexOf(s) !== i && s != null);
    console.log(`  - Duplicate 'no' values: ${incDupes.length}`);
    const invalidInc = income.filter(i => !i.item || typeof i.value !== 'number' || isNaN(i.value));
    console.log(`  - Invalid income (missing item/value): ${invalidInc.length}`);

    // 6. Inspect CMS Collections
    console.log('\n[CMS Collections]');
    const cmsCollections = ['cms_projects', 'cms_experiences', 'cms_blog', 'cms_quotes', 'cms_research', 'cms_photography'];
    for (const c of cmsCollections) {
        const count = await db.collection(c).countDocuments();
        const doc = await db.collection(c).findOne({ _id: 'current' });
        if (c === 'cms_blog' && doc && Array.isArray(doc.data)) {
            const withContent = doc.data.filter(p => p.content && p.content.length > 0);
            console.log(`  - ${c}: ${doc.data.length} post(s) (${withContent.length} with embedded markdown)`);
        } else if (c === 'cms_research' && doc && Array.isArray(doc.data)) {
            const withContent = doc.data.filter(p => p.content && p.content.length > 0);
            console.log(`  - ${c}: ${doc.data.length} publication(s) (${withContent.length} with embedded markdown)`);
        } else if (doc && Array.isArray(doc.data)) {
            console.log(`  - ${c}: ${doc.data.length} item(s)`);
        } else if (doc && doc.data && typeof doc.data === 'object') {
            console.log(`  - ${c}: 1 doc with sections & items`);
        } else {
            console.log(`  - ${c}: ${count} doc(s)`);
        }
    }

    // Check for dropped collections
    const droppedCols = ['cms_lexicon', 'cms_markdown'].filter(c => allCollections.includes(c));
    if (droppedCols.length > 0) {
        console.log(`\n[WARNING] Found legacy collections that should be dropped: ${droppedCols.join(', ')}`);
    } else {
        console.log('\n[CMS Architecture] cms_lexicon (local) and cms_markdown (unified) cleanly eliminated from DB');
    }

    process.exit(0);
}

inspectDatabase().catch(console.error);
