const { ObjectId } = require('mongodb');

const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

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

function buildResponse(doc) {
    return {
        id: doc._id.toString(),
        ayanaNumber: doc.ayanaNumber,
        monthlyItems: doc.monthlyItems || [],
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

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({
            error: 'Invalid plan id',
        });
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);
        const _id = new ObjectId(id);

        if (req.method === 'PUT') {
            const {
                ayanaNumber,
                monthlyItems,
                ayanaBudgeted,
                monthlyBudgeted,
            } = req.body || {};

            const update = {};

            if (ayanaNumber !== undefined) {
                const normalizedAyanaNumber =
                    Number(ayanaNumber);

                if (
                    !Number.isFinite(
                        normalizedAyanaNumber
                    )
                ) {
                    return res.status(400).json({
                        error:
                            'Invalid ayanaNumber',
                    });
                }

                const duplicate =
                    await collection.findOne({
                        ayanaNumber:
                        normalizedAyanaNumber,
                        _id: { $ne: _id },
                    });

                if (duplicate) {
                    return res.status(409).json({
                        error: `A plan for Ayana ${normalizedAyanaNumber} already exists`,
                    });
                }

                update.ayanaNumber =
                    normalizedAyanaNumber;
            }

            if (monthlyItems !== undefined) {
                update.monthlyItems =
                    sanitizeItems(monthlyItems);
            }

            if (ayanaBudgeted !== undefined) {
                update.ayanaBudgeted =
                    sanitizeAyanaBudgeted(
                        ayanaBudgeted
                    );
            }

            if (monthlyBudgeted !== undefined) {
                update.monthlyBudgeted =
                    sanitizeMonthlyBudgeted(
                        monthlyBudgeted
                    );
            }

            // Remove the old field from existing documents.
            update.$unset = {
                ayanaItems: '',
            };

            const result =
                await collection.findOneAndUpdate(
                    { _id },
                    {
                        $set: update,
                    },
                    {
                        returnDocument: 'after',
                    }
                );

            const updatedDoc =
                result &&
                result.value !== undefined
                    ? result.value
                    : result;

            if (!updatedDoc) {
                return res.status(404).json({
                    error:
                        'Budget plan not found',
                });
            }

            return res.status(200).json(
                buildResponse(updatedDoc)
            );
        }

        if (req.method === 'DELETE') {
            const result =
                await collection.deleteOne({
                    _id,
                });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    error:
                        'Budget plan not found',
                });
            }

            return res.status(200).json({
                id,
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
