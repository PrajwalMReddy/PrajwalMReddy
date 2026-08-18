const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const COLLECTION = 'budgetPlans';

function sanitizeItems(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .filter(
            (item) =>
                item &&
                item.item &&
                item.amount !== undefined
        )
        .map((item) => {
            const amount = Number(item.amount);

            return {
                id: item.id || undefined,
                month: item.month
                    ? String(item.month)
                    : undefined,
                item: String(item.item).trim(),
                category: item.category
                    ? String(item.category).trim()
                    : 'Miscellaneous',
                amount:
                    Number.isFinite(amount) &&
                    amount >= 0
                        ? amount
                        : 0,
            };
        })
        .filter(
            (item) =>
                item.month &&
                /^\d{4}-\d{2}$/.test(item.month)
        );
}

function sanitizeAyanaBudgeted(value) {
    const number = Number(value);

    return Number.isFinite(number) && number >= 0
        ? number
        : 0;
}

function sanitizeMonthlyBudgeted(obj) {
    if (
        !obj ||
        typeof obj !== 'object' ||
        Array.isArray(obj)
    ) {
        return {};
    }

    const clean = {};

    Object.keys(obj).forEach((month) => {
        const amount = Number(obj[month]);

        if (
            /^\d{4}-\d{2}$/.test(month) &&
            Number.isFinite(amount) &&
            amount >= 0
        ) {
            clean[month] = amount;
        }
    });

    return clean;
}

function serializePlan(doc) {
    return {
        id: doc._id.toString(),
        ayanaNumber: doc.ayanaNumber,
        monthlyItems: Array.isArray(doc.monthlyItems)
            ? doc.monthlyItems
            : [],
        ayanaBudgeted:
            Number(doc.ayanaBudgeted) || 0,
        monthlyBudgeted:
            doc.monthlyBudgeted || {},
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) {
        return;
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);

        if (req.method === 'GET') {
            const plans = await collection
                .find()
                .sort({ ayanaNumber: -1 })
                .toArray();

            return res.status(200).json(
                plans.map(serializePlan)
            );
        }

        if (req.method === 'POST') {
            const {
                ayanaNumber,
                monthlyItems,
                ayanaBudgeted,
                monthlyBudgeted,
            } = req.body || {};

            if (
                ayanaNumber === undefined ||
                ayanaNumber === null ||
                !Number.isFinite(Number(ayanaNumber))
            ) {
                return res.status(400).json({
                    error:
                        'A valid ayanaNumber is required',
                });
            }

            const normalizedAyanaNumber =
                Number(ayanaNumber);

            const existing =
                await collection.findOne({
                    ayanaNumber:
                    normalizedAyanaNumber,
                });

            if (existing) {
                return res.status(409).json({
                    error: `A plan for Ayana ${normalizedAyanaNumber} already exists`,
                });
            }

            const doc = {
                ayanaNumber:
                normalizedAyanaNumber,

                monthlyItems:
                    sanitizeItems(monthlyItems),

                ayanaBudgeted:
                    sanitizeAyanaBudgeted(
                        ayanaBudgeted
                    ),

                monthlyBudgeted:
                    sanitizeMonthlyBudgeted(
                        monthlyBudgeted
                    ),
            };

            const result =
                await collection.insertOne(doc);

            return res.status(201).json({
                id: result.insertedId.toString(),
                ...doc,
            });
        }

        return res.status(405).json({
            error: 'Method not allowed',
        });
    } catch (error) {
        console.error(
            'Budget planner API error:',
            error
        );

        return res.status(500).json({
            error: 'Internal server error',
        });
    }
};
