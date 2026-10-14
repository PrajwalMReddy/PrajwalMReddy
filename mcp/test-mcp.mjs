import { connectToDatabase, closeDatabase } from './db.mjs';

async function testConnection() {
    console.log('--- Testing MCP Database & Server Connectivity ---');
    try {
        const db = await connectToDatabase();
        console.log('✅ Successfully connected to MongoDB database:', db.databaseName);

        const collections = await db.listCollections().toArray();
        console.log('✅ Available collections:', collections.map(c => c.name).join(', '));

        const notesCount = await db.collection('notes').countDocuments();
        const todosCount = await db.collection('todos').countDocuments();
        const expensesCount = await db.collection('expenses').countDocuments();
        const contactsCount = await db.collection('networking_people').countDocuments();

        console.log(`📊 Statistics:`);
        console.log(`   - Notes: ${notesCount}`);
        console.log(`   - Todos: ${todosCount}`);
        console.log(`   - Expenses: ${expensesCount}`);
        console.log(`   - Contacts: ${contactsCount}`);

        console.log('✅ All MCP data sources accessible!');
    } catch (err) {
        console.error('❌ Error during test:', err.message);
    } finally {
        await closeDatabase();
    }
}

testConnection();
