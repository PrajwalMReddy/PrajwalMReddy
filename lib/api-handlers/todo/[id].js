const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');
const { createDueInstances } = require('../todo');

const COLLECTION = 'todos';
const VALID_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const normalizeDateOnly = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toISOString() : null;
};

function normalizeTodo(doc) {
    const serialNumber = Number(doc.serialNumber ?? doc.order ?? 1);
    const order = Number(doc.order ?? serialNumber ?? 1);
    const priority = ['high', 'medium', 'low'].includes(doc.priority) ? doc.priority : 'medium';
    const isRecurringMaster = Boolean(doc.isRecurringMaster);

    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        completed: Boolean(doc.completed),
        completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : null,
        dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : null,
        priority,
        serialNumber: Number.isFinite(serialNumber) ? serialNumber : 1,
        order: Number.isFinite(order) ? order : 1,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
        description: doc.description || '',
        link: doc.link ? String(doc.link).trim() : '',
        subtasks: Array.isArray(doc.subtasks) ? doc.subtasks : [],
        estimatedTime: doc.estimatedTime ? Number(doc.estimatedTime) : null,
        recurrence: doc.recurrence || 'none',
        scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString().slice(0, 10) : null,
        recurrenceDays: Array.isArray(doc.recurrenceDays) ? doc.recurrenceDays : [],
        recurrenceUntil: doc.recurrenceUntil ? new Date(doc.recurrenceUntil).toISOString().slice(0, 10) : null,
        tags: Array.isArray(doc.tags) ? doc.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        recurrenceSeriesId: doc.recurrenceSeriesId ? doc.recurrenceSeriesId.toString() : null,
        seriesTitle: doc.seriesTitle ? String(doc.seriesTitle).trim() : null,
        isRecurringMaster,
        personId: doc.personId ? doc.personId.toString() : null,
        personName: doc.personName ? String(doc.personName).trim() : null,
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    const { id } = req.query;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid todo id' });
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);
        const _id = new ObjectId(id);

        if (req.method === 'PUT') {
            const { title, completed, dueDate, order, serialNumber, priority, description, link, subtasks, estimatedTime, recurrence, recurrenceDays, recurrenceUntil, scheduledAt, tags, personId, personName } = req.body || {};
            const existingTodo = await collection.findOne({_id});
            const update = {
                updatedAt: new Date(),
            };

            if (title !== undefined) {
                const trimmedTitle = String(title || '').trim();
                if (!trimmedTitle) {
                    return res.status(400).json({ error: 'Task title is required' });
                }
                update.title = trimmedTitle;
            }

            if (completed !== undefined) {
                update.completed = Boolean(completed);
                if (update.completed) {
                    update.completedAt = new Date();
                } else {
                    update.completedAt = null;
                }
            }

            if (dueDate !== undefined) {
                const normalizedDate = dueDate ? new Date(dueDate) : null;
                update.dueDate = normalizedDate && !Number.isNaN(normalizedDate.getTime()) ? normalizedDate.toISOString() : null;
            }

            if (priority !== undefined) {
                const normalizedPriority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
                update.priority = normalizedPriority;
            }

            if (order !== undefined) {
                const normalizedOrder = Number(order);
                if (!Number.isFinite(normalizedOrder)) {
                    return res.status(400).json({ error: 'Invalid todo order' });
                }
                update.order = normalizedOrder;
            }

            if (serialNumber !== undefined) {
                const normalizedSerialNumber = Number(serialNumber);
                if (!Number.isFinite(normalizedSerialNumber)) {
                    return res.status(400).json({ error: 'Invalid todo serial number' });
                }
                update.serialNumber = normalizedSerialNumber;
            }

            if (description !== undefined) {
                update.description = String(description || '').trim();
            }

            if (link !== undefined) {
                update.link = String(link || '').trim();
            }

            if (subtasks !== undefined) {
                update.subtasks = Array.isArray(subtasks) ? subtasks : [];
            }

            if (estimatedTime !== undefined) {
                const estTime = Number(estimatedTime);
                if (!Number.isFinite(estTime)) {
                    return res.status(400).json({ error: 'Invalid estimated time' });
                }
                update.estimatedTime = estTime;
            }

            if (recurrence !== undefined) {
                update.recurrence = ['daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none';
                if (update.recurrence === 'none') {
                    update.recurrenceDays = [];
                    update.recurrenceLastDate = null;
                    update.recurrenceMonthDay = null;
                    update.isRecurringMaster = false;
                }
            }

            if (recurrenceDays !== undefined) {
                update.recurrenceDays = update.recurrence === 'weekly' || recurrence === undefined
                    ? (Array.isArray(recurrenceDays) ? recurrenceDays.filter((day) => VALID_WEEKDAYS.includes(day)) : [])
                    : [];
            }

            if (recurrenceUntil !== undefined) {
                const normalizedRecurrenceUntil = recurrenceUntil ? new Date(recurrenceUntil) : null;
                update.recurrenceUntil = normalizedRecurrenceUntil && !Number.isNaN(normalizedRecurrenceUntil.getTime()) ? normalizedRecurrenceUntil.toISOString() : null;
            }

            if (scheduledAt !== undefined) {
                update.scheduledAt = normalizeDateOnly(scheduledAt);
            }

            if (tags !== undefined) {
                update.tags = Array.isArray(tags)
                    ? tags.map((t) => String(t).trim()).filter(Boolean)
                    : [];
            }

            if (personId !== undefined) {
                update.personId = personId ? String(personId) : null;
            }

            if (personName !== undefined) {
                update.personName = personName ? String(personName).trim() : null;
            }

            const applyToSeries = Boolean(req.body?.applyToSeries);
            let seriesMasterId = existingTodo?.recurrenceSeriesId || _id;
            const isExistingRecurring = Boolean((existingTodo?.recurrence && existingTodo.recurrence !== 'none') || existingTodo?.recurrenceSeriesId || existingTodo?.isRecurringMaster);

            if (!isExistingRecurring && update.recurrence && update.recurrence !== 'none') {
                // Converting a non-recurring task into a recurring series.
                // "The due date in the add task should be for the first task only"
                // The current task is the FIRST task and retains its due date.
                // We create a master template for the series with dueDate: null.
                const anchorDate = update.dueDate !== undefined ? update.dueDate : existingTodo?.dueDate;
                const anchorStr = anchorDate ? String(anchorDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
                const masterDoc = {
                    title: update.title || existingTodo.title,
                    seriesTitle: update.title || existingTodo.title,
                    completed: false,
                    isRecurringMaster: true,
                    dueDate: null, // Master recurring template has no due date; due date belongs to first task only
                    recurrenceStartDate: anchorStr,
                    priority: update.priority || existingTodo.priority || 'medium',
                    order: existingTodo.order || 1,
                    serialNumber: existingTodo.serialNumber || 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    description: update.description !== undefined ? update.description : (existingTodo.description || ''),
                    link: update.link !== undefined ? update.link : (existingTodo.link || ''),
                    subtasks: Array.isArray(update.subtasks)
                        ? update.subtasks.map((st) => ({
                            id: st.id || Date.now() + Math.random(),
                            title: st.title || '',
                            completed: false,
                        }))
                        : (Array.isArray(existingTodo.subtasks) ? existingTodo.subtasks : []),
                    estimatedTime: update.estimatedTime !== undefined ? update.estimatedTime : existingTodo.estimatedTime,
                    recurrence: update.recurrence,
                    recurrenceDays: Array.isArray(update.recurrenceDays) ? update.recurrenceDays : (existingTodo.recurrenceDays || []),
                    recurrenceUntil: update.recurrenceUntil !== undefined ? update.recurrenceUntil : (existingTodo.recurrenceUntil || null),
                    recurrenceLastDate: anchorStr,
                    recurrenceMonthDay: update.recurrence === 'monthly' ? Number(anchorStr.slice(8, 10)) : null,
                    scheduledAt: null,
                    tags: update.tags !== undefined ? update.tags : (existingTodo.tags || []),
                    personId: update.personId !== undefined ? update.personId : (existingTodo.personId || null),
                    personName: update.personName !== undefined ? update.personName : (existingTodo.personName || null),
                };

                const masterInsert = await collection.insertOne(masterDoc);
                seriesMasterId = masterInsert.insertedId;

                // The existing task becomes the first child instance of this series
                update.recurrenceSeriesId = seriesMasterId;
                update.isRecurringMaster = false;
            } else if (isExistingRecurring && !applyToSeries && existingTodo?.recurrenceSeriesId) {
                // When editing only a specific child instance, keep the recurrence series settings intact on the master
                delete update.recurrence;
                delete update.recurrenceDays;
                delete update.recurrenceUntil;
                delete update.recurrenceMonthDay;
                delete update.recurrenceLastDate;
            } else if (existingTodo?.isRecurringMaster) {
                // Editing master template directly in recurring tasks column
                if (update.recurrence === 'none') {
                    update.isRecurringMaster = false;
                } else {
                    update.dueDate = null; // Master template task always has dueDate: null
                }
                if (applyToSeries) {
                    update.seriesTitle = update.title || existingTodo?.seriesTitle || existingTodo?.title;
                }
                if ((dueDate !== undefined || recurrence !== undefined) && (update.recurrence || existingTodo?.recurrence) !== 'none') {
                    const anchorDate = dueDate !== undefined ? update.dueDate : existingTodo?.dueDate;
                    if (anchorDate) {
                        update.recurrenceLastDate = anchorDate.slice(0, 10);
                        if ((update.recurrence || existingTodo?.recurrence) === 'monthly') {
                            update.recurrenceMonthDay = Number(anchorDate.slice(8, 10));
                        }
                    }
                }
            }

            const result = await collection.findOneAndUpdate(
                { _id },
                { $set: update },
                { returnDocument: 'after' }
            );

            // Handle both direct document return and result.value structure
            const updatedDoc = (result && result.value) || result;
            if (!updatedDoc) {
                return res.status(404).json({ error: 'Todo not found' });
            }

            if (applyToSeries && (existingTodo?.recurrence !== 'none' || update.recurrence !== 'none')) {
                const childUpdate = {};
                if (update.title !== undefined) childUpdate.title = update.title;
                if (update.priority !== undefined) childUpdate.priority = update.priority;
                if (update.description !== undefined) childUpdate.description = update.description;
                if (update.link !== undefined) childUpdate.link = update.link;
                if (update.estimatedTime !== undefined) childUpdate.estimatedTime = update.estimatedTime;
                if (update.tags !== undefined) childUpdate.tags = update.tags;
                if (update.recurrence !== undefined) childUpdate.recurrence = update.recurrence;
                if (update.recurrenceDays !== undefined) childUpdate.recurrenceDays = update.recurrenceDays;
                if (update.recurrenceUntil !== undefined) childUpdate.recurrenceUntil = update.recurrenceUntil;
                if (update.subtasks !== undefined) {
                    childUpdate.subtasks = update.subtasks.map((st) => ({
                        id: st.id || Date.now() + Math.random(),
                        title: st.title || '',
                        completed: false,
                    }));
                }

                if (Object.keys(childUpdate).length > 0) {
                    childUpdate.updatedAt = new Date();
                    await collection.updateOne(
                        { _id: seriesMasterId },
                        { $set: { seriesTitle: update.title || existingTodo.title, ...childUpdate, dueDate: null } }
                    );

                    // Affect all current and future uncompleted child instances
                    const childFilter = {
                        recurrenceSeriesId: seriesMasterId,
                        _id: { $ne: _id },
                        completed: false,
                    };
                    await collection.updateMany(childFilter, { $set: childUpdate });
                }
            }

            // If marking the master recurring task complete, complete all pending tasks in the series
            if (update.completed === true && !existingTodo.recurrenceSeriesId && (existingTodo.isRecurringMaster || (existingTodo.recurrence && existingTodo.recurrence !== 'none'))) {
                await collection.updateMany(
                    { recurrenceSeriesId: _id, completed: false },
                    { $set: { completed: true, updatedAt: new Date() } }
                );
            }

            // If this todo is part of a recurring series, ensure future instances are generated
            const seriesMasterQuery = ObjectId.isValid(seriesMasterId)
                ? { _id: { $in: [new ObjectId(seriesMasterId), seriesMasterId.toString()] } }
                : { _id: seriesMasterId };
            const seriesMaster = await collection.findOne(seriesMasterQuery);
            if (seriesMaster && seriesMaster.recurrence && seriesMaster.recurrence !== 'none' && !seriesMaster.completed) {
                await createDueInstances(collection, seriesMaster);
            }

            // Sync changes to networking_people if this todo is linked to a person
            const targetPersonId = updatedDoc.personId || existingTodo?.personId;
            if (targetPersonId && ObjectId.isValid(targetPersonId)) {
                try {
                    const peopleColl = db.collection('networking_people');
                    const personUpdate = { updatedAt: new Date() };

                    if (update.title !== undefined) {
                        personUpdate.followUpNotes = update.title;
                    }
                    if (update.scheduledAt !== undefined) {
                        personUpdate.followUpScheduledDate = update.scheduledAt ? update.scheduledAt.slice(0, 10) : null;
                    }
                    if (update.dueDate !== undefined) {
                        personUpdate.followUpDueDate = update.dueDate ? update.dueDate.slice(0, 10) : null;
                        personUpdate.nextFollowUpAt = update.dueDate ? update.dueDate.slice(0, 10) : null;
                    }
                    if (update.completed !== undefined) {
                        personUpdate.followUpStatus = update.completed ? 'completed' : 'pending';
                    }

                    await peopleColl.updateOne(
                        { _id: new ObjectId(targetPersonId) },
                        { $set: personUpdate }
                    );
                } catch (syncErr) {
                    console.error('Error syncing todo update to person:', syncErr);
                }
            }

            return res.status(200).json(normalizeTodo(updatedDoc));
        }

        if (req.method === 'DELETE') {
            const todo = await collection.findOne({ _id });
            if (!todo) {
                return res.status(404).json({ error: 'Todo not found' });
            }

            // If linked to a person in networking, remove the link from person
            if (todo.personId && ObjectId.isValid(todo.personId)) {
                try {
                    const peopleColl = db.collection('networking_people');
                    await peopleColl.updateOne(
                        { _id: new ObjectId(todo.personId) },
                        {
                            $set: {
                                syncTodo: false,
                                todoId: null,
                                updatedAt: new Date(),
                            }
                        }
                    );
                } catch (delSyncErr) {
                    console.error('Error syncing todo delete to person:', delSyncErr);
                }
            }

            // 1. If this task is completed, delete ONLY this specific task!
            // Deleting a completed task (even if it was the initial series task) must never delete other tasks in the series.
            if (todo.completed) {
                await collection.deleteOne({ _id });
                return res.status(200).json({ id });
            }

            // 2. If this is a recurring child instance, delete only this specific instance
            if (todo.recurrenceSeriesId) {
                await collection.deleteOne({ _id });
                return res.status(200).json({ id });
            }

            // 3. If this is the recurring series template:
            // Delete the recurring task itself and ONLY upcoming uncompleted child instances.
            // NEVER delete past, present, or completed tasks!
            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            const tomorrowIso = tomorrow.toISOString().slice(0, 10);
            const seriesIdQuery = ObjectId.isValid(_id)
                ? { $in: [_id, _id.toString(), new ObjectId(_id)] }
                : _id;
            await collection.deleteMany({
                recurrenceSeriesId: seriesIdQuery,
                completed: false,
                $or: [
                    { dueDate: { $gte: tomorrowIso } },
                    { dueDate: null, scheduledAt: { $gte: tomorrowIso } },
                ],
            });
            await collection.deleteOne({ _id });

            return res.status(200).json({ id });
        }


        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Todo item API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
