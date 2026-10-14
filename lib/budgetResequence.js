const { ObjectId } = require('mongodb');

function getInsertionTime(doc) {
    if (doc.createdAt) {
        const d = new Date(doc.createdAt);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    if (doc._id) {
        if (typeof doc._id.getTimestamp === 'function') {
            return doc._id.getTimestamp().getTime();
        }
        if (typeof doc._id === 'string' && ObjectId.isValid(doc._id)) {
            return new ObjectId(doc._id).getTimestamp().getTime();
        }
    }
    return 0;
}

function compareBudgetEntries(a, b) {
    const dA = a.date ? new Date(a.date).getTime() : 0;
    const dB = b.date ? new Date(b.date).getTime() : 0;
    const timeA = isNaN(dA) ? 0 : dA;
    const timeB = isNaN(dB) ? 0 : dB;
    if (timeA !== timeB) {
        return timeA - timeB;
    }
    // Tiebreaker: insertion order (earliest insertion first)
    const insertA = getInsertionTime(a);
    const insertB = getInsertionTime(b);
    if (insertA !== insertB) {
        return insertA - insertB;
    }
    const idA = String(a._id || '');
    const idB = String(b._id || '');
    return idA.localeCompare(idB);
}

/**
 * Resequences all expenses in chronological order (date ASC, insertion order ASC).
 * Assigns serialNumber: 1, 2, ..., N
 * Uses a two-phase update to guarantee zero unique-index collisions.
 */
async function resequenceExpenses(db) {
    const collection = db.collection('expenses');
    const docs = await collection.find({}).toArray();
    if (!docs || docs.length === 0) return [];

    docs.sort(compareBudgetEntries);

    let needsUpdate = false;
    for (let i = 0; i < docs.length; i++) {
        if (docs[i].serialNumber !== i + 1) {
            needsUpdate = true;
            break;
        }
    }

    if (!needsUpdate) return docs;

    // Phase 1: Set temporary negative serial numbers to clear unique index space
    const phase1Ops = docs.map((doc, index) => ({
        updateOne: {
            filter: { _id: doc._id },
            update: { $set: { serialNumber: -(index + 1) } },
        },
    }));
    await collection.bulkWrite(phase1Ops, { ordered: false });

    // Phase 2: Assign final sequential positive numbers 1..N
    const phase2Ops = docs.map((doc, index) => {
        const targetSerial = index + 1;
        doc.serialNumber = targetSerial;
        return {
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: { serialNumber: targetSerial } },
            },
        };
    });
    await collection.bulkWrite(phase2Ops, { ordered: false });

    return docs;
}

/**
 * Resequences all income entries in chronological order (date ASC, insertion order ASC).
 * Assigns no: 1, 2, ..., N
 * Uses a two-phase update to guarantee zero unique-index collisions.
 */
async function resequenceIncome(db) {
    const collection = db.collection('income');
    const docs = await collection.find({}).toArray();
    if (!docs || docs.length === 0) return [];

    docs.sort(compareBudgetEntries);

    let needsUpdate = false;
    for (let i = 0; i < docs.length; i++) {
        if (docs[i].no !== i + 1) {
            needsUpdate = true;
            break;
        }
    }

    if (!needsUpdate) return docs;

    // Phase 1: Set temporary negative numbers to clear unique index space
    const phase1Ops = docs.map((doc, index) => ({
        updateOne: {
            filter: { _id: doc._id },
            update: { $set: { no: -(index + 1) } },
        },
    }));
    await collection.bulkWrite(phase1Ops, { ordered: false });

    // Phase 2: Assign final sequential positive numbers 1..N
    const phase2Ops = docs.map((doc, index) => {
        const targetNo = index + 1;
        doc.no = targetNo;
        return {
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: { no: targetNo } },
            },
        };
    });
    await collection.bulkWrite(phase2Ops, { ordered: false });

    return docs;
}

module.exports = {
    getInsertionTime,
    compareBudgetEntries,
    resequenceExpenses,
    resequenceIncome,
};
