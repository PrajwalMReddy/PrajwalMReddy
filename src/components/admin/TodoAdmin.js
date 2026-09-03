import React, {useCallback, useEffect, useMemo, useState} from 'react';
import AdminLayout from './AdminLayout';

const TODO_API = '/api/todo';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a YYYY-MM-DD value as a LOCAL calendar date.
 *
 * Do NOT use new Date('2026-08-18') because ISO date-only strings
 * are interpreted as UTC by JavaScript.
 */
const parseDateOnly = (value) => {
    if (!value) return null;

    // Handle the normal API/input format first.
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
        const fallback = new Date(value);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    const [, year, month, day] = match;

    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    );

    // Protect against invalid dates such as 2026-02-31.
    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
    ) {
        return null;
    }

    date.setHours(0, 0, 0, 0);

    return date;
};

const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

/**
 * Convert a local calendar date to a stable integer day key.
 *
 * This avoids DST problems caused by comparing milliseconds between
 * midnight dates.
 */
const getDayKey = (date) =>
    Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ) / DAY_MS;

const getTodayKey = () => getDayKey(getToday());

const getDueDayKey = (todo) => {
    const due = parseDateOnly(todo?.dueDate);
    return due ? getDayKey(due) : null;
};

const isScheduledForFuture = (todo) => {
    const scheduled = parseDateOnly(todo?.scheduledAt);
    return scheduled && getDayKey(scheduled) > getTodayKey();
};

const getDueDifference = (todo) => {
    const dueKey = getDueDayKey(todo);

    if (dueKey === null) return null;

    return dueKey - getTodayKey();
};

const getDueState = (todo) => {
    if (!todo?.dueDate) return 'none';
    if (todo.completed) return 'done';

    const diffDays = getDueDifference(todo);

    if (diffDays === null) return 'none';
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'soon';

    return 'upcoming';
};

const getDueDateLabel = (todo) => {
    const date = parseDateOnly(todo?.dueDate);

    if (!date) return '';

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

/**
 * Returns the next 3 calendar days after TODAY.
 *
 * Today has its own column, so this range intentionally starts
 * tomorrow and ends three days from today.
 */
const getNextThreeDaysRange = () => {
    const today = getToday();

    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    end.setHours(0, 0, 0, 0);

    return {
        startKey: getDayKey(today),
        endKey: getDayKey(end),
    };
};

const PRIORITY_LABEL = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const RECURRENCE_DAYS = [
    ['sun', 'Sun'],
    ['mon', 'Mon'],
    ['tue', 'Tue'],
    ['wed', 'Wed'],
    ['thu', 'Thu'],
    ['fri', 'Fri'],
    ['sat', 'Sat'],
];

const formatRecurrence = (todo) => {
    if (!todo.recurrence || todo.recurrence === 'none') return '';
    if (todo.recurrence === 'weekly') {
        const days = RECURRENCE_DAYS
            .filter(([value]) => (todo.recurrenceDays || []).includes(value))
            .map(([, label]) => label);
        return days.length > 0 ? `Weekly: ${days.join(', ')}` : 'Weekly';
    }
    return todo.recurrence === 'daily' ? 'Every day' : 'Every month';
};

const TodoModal = ({ todo, isOpen, onClose, onSave }) => {
    const [draft, setDraft] = useState({});

    useEffect(() => {
        if (todo) {
            setDraft({ ...todo });
        }
    }, [todo]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!draft.title?.trim()) {
            alert('Please enter a task title.');
            return;
        }
        await onSave(draft);
        onClose();
    };

    const updateSubtask = (index, updates) => {
        const next = [...(draft.subtasks || [])];
        next[index] = { ...next[index], ...updates };
        setDraft({ ...draft, subtasks: next });
    };

    const addSubtask = () => {
        const next = [...(draft.subtasks || []), { id: Date.now(), title: '', completed: false }];
        setDraft({ ...draft, subtasks: next });
    };

    const removeSubtask = (index) => {
        const next = [...(draft.subtasks || [])];
        next.splice(index, 1);
        setDraft({ ...draft, subtasks: next });
    };

    return (
        <div className="admin-todo-modal-overlay">
            <div className="admin-todo-modal-card">
                <div className="admin-todo-modal-header">
                    <h3 className="admin-todo-modal-title">Edit Task</h3>
                    <button className="admin-todo-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="admin-todo-modal-body">
                    <form className="admin-todo-modal-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="admin-todo-modal-field">
                            <label>Title</label>
                            <input type="text" value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                        </div>
                        <div className="admin-todo-modal-field">
                            <label>Description</label>
                            <textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                        </div>
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>Due Date</label>
                                <input type="date" value={draft.dueDate || ''} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
                            </div>
                            <div className="admin-todo-modal-field">
                                <label>Priority</label>
                                <select value={draft.priority || 'medium'} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>Estimated Time (min)</label>
                                <input type="number" value={draft.estimatedTime || ''} onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })} />
                            </div>
                            <div className="admin-todo-modal-field">
                                <label>Recurrence</label>
                                <select value={draft.recurrence || 'none'} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value, recurrenceDays: e.target.value === 'weekly' ? (draft.recurrenceDays || []) : [] })}>
                                    <option value="none">None</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                        </div>
                        {draft.recurrence && draft.recurrence !== 'none' && (
                            <div className="admin-todo-recurrence-options">
                                {draft.recurrence === 'weekly' && <div className="admin-todo-modal-field">
                                    <label>Repeat on these weekdays</label>
                                    <div className="admin-todo-day-picker">
                                        {RECURRENCE_DAYS.map(([value, label]) => {
                                            const selected = (draft.recurrenceDays || []).includes(value);
                                            return (
                                                <label key={value} className={`admin-todo-day-option ${selected ? 'selected' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected}
                                                        onChange={() => setDraft({
                                                            ...draft,
                                                            recurrenceDays: selected
                                                                ? (draft.recurrenceDays || []).filter((day) => day !== value)
                                                                : [...(draft.recurrenceDays || []), value],
                                                        })}
                                                    />
                                                    <span>{label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>}
                                <div className="admin-todo-modal-field">
                                    <label>Repeat until <span className="admin-todo-optional">(optional)</span></label>
                                    <input type="date" value={draft.recurrenceUntil || ''} onChange={(e) => setDraft({ ...draft, recurrenceUntil: e.target.value })} />
                                </div>
                            </div>
                        )}
                        <div className="admin-todo-modal-field">
                            <label>Show task on <span className="admin-todo-optional">(optional)</span></label>
                            <input type="date" value={draft.scheduledAt ? draft.scheduledAt.slice(0, 10) : ''} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} />
                            <span className="admin-todo-field-help">The task stays in Other until this day.</span>
                        </div>
                        <div className="admin-todo-subtasks-section">
                            <div className="admin-todo-subtasks-header">
                                <div>
                                    <h4>Subtasks</h4>
                                    <span>{(draft.subtasks || []).length} items</span>
                                </div>
                                <button type="button" className="admin-todo-subtask-add" onClick={addSubtask}>+ Add subtask</button>
                            </div>
                            {(draft.subtasks || []).length === 0 ? <p className="admin-todo-subtasks-empty">Break this task into smaller steps.</p> : (
                                <div className="admin-todo-subtask-list">
                                    {(draft.subtasks || []).map((st, i) => (
                                        <div key={st.id || i} className="admin-todo-subtask-row">
                                            <input type="checkbox" checked={Boolean(st.completed)} onChange={(e) => updateSubtask(i, {completed: e.target.checked})} aria-label={`Complete subtask ${i + 1}`} />
                                            <input type="text" value={st.title || ''} onChange={(e) => updateSubtask(i, {title: e.target.value})} placeholder="Subtask name" aria-label={`Subtask ${i + 1}`} />
                                            <button type="button" className="admin-todo-subtask-remove" onClick={() => removeSubtask(i)} aria-label={`Remove subtask ${i + 1}`} title="Remove subtask">✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                <div className="admin-todo-modal-footer">
                    <button className="admin-todo-modal-btn admin-todo-modal-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="admin-todo-modal-btn admin-todo-modal-btn-save" onClick={handleSave}>Save Changes</button>
                </div>
            </div>
        </div>
    );
};

const TodoAdmin = () => {
    const [todos, setTodos] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('medium');
    const [draggedId, setDraggedId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [activeTodo, setActiveTodo] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedSubtasks, setExpandedSubtasks] = useState(new Set());

    const loadTodos = useCallback(async () => {
        try {
            setError('');

            const res = await fetch(TODO_API, {
                credentials: 'include',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load todos');
            }

            setTodos(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTodos();
    }, [loadTodos]);

    const pendingCount = useMemo(
        () => todos.filter((todo) => !todo.completed).length,
        [todos]
    );

    const doneCount = useMemo(
        () => todos.filter((todo) => todo.completed).length,
        [todos]
    );

    const priorityOrder = {
        high: 0,
        medium: 1,
        low: 2,
    };

    const sortByPriority = (a, b) =>
        (priorityOrder[a.priority] ?? 1) -
        (priorityOrder[b.priority] ?? 1);

    const overdueTodos = useMemo(
        () =>
            todos
                .filter(
                    (todo) =>
                        !todo.completed &&
                        !isScheduledForFuture(todo) &&
                        getDueState(todo) === 'overdue'
                )
                .sort((a, b) => {
                    const priorityDiff = sortByPriority(a, b);

                    if (priorityDiff !== 0) {
                        return priorityDiff;
                    }

                    // Oldest overdue first.
                    return (
                        getDueDayKey(a) -
                        getDueDayKey(b)
                    );
                }),
        [todos]
    );

    const todayTodos = useMemo(
        () =>
            todos
                .filter(
                    (todo) =>
                        !todo.completed &&
                        !isScheduledForFuture(todo) &&
                        getDueState(todo) === 'today'
                )
                .sort(sortByPriority),
        [todos]
    );

    const nextThreeDaysTodos = useMemo(() => {
        const {startKey, endKey} =
            getNextThreeDaysRange();

        return todos
            .filter((todo) => {
                if (todo.completed) return false;
                if (isScheduledForFuture(todo)) return false;

                const dueKey = getDueDayKey(todo);

                if (dueKey === null) return false;

                /*
                 * Exclude:
                 * - overdue
                 * - today
                 *
                 * Those have their own semantic categories.
                 */
                return (
                    dueKey > startKey &&
                    dueKey <= endKey
                );
            })
            .sort((a, b) => {
                const priorityDiff =
                    sortByPriority(a, b);

                if (priorityDiff !== 0) {
                    return priorityDiff;
                }

                return (
                    getDueDayKey(a) -
                    getDueDayKey(b)
                );
            });
    }, [todos]);

    const upcomingTodos = useMemo(() => {
        const {endKey} = getNextThreeDaysRange();
        return todos
            .filter((todo) => {
                if (todo.completed) return false;
                if (isScheduledForFuture(todo)) return false;

                const dueKey = getDueDayKey(todo);

                if (dueKey === null) return false;

                /*
                 * "Upcoming" means after the current week.
                 *
                 * This prevents the same todo from appearing in
                 * both "This Week" and "Upcoming".
                 */
                return dueKey > endKey;
            })
            .sort((a, b) => {
                const dateDiff =
                    getDueDayKey(a) - getDueDayKey(b);

                if (dateDiff !== 0) {
                    return dateDiff;
                }

                return sortByPriority(a, b);
            });
    }, [todos]);

    const noDueDateTodos = useMemo(
        () =>
            todos
                .filter(
                    (todo) =>
                        !todo.completed &&
                        !isScheduledForFuture(todo) &&
                        getDueDayKey(todo) === null
                )
                .sort(sortByPriority),
        [todos]
    );

    const scheduledTodos = useMemo(() => {
        return todos
            .filter((todo) => {
                return isScheduledForFuture(todo) && !todo.completed;
            })
            .sort((a, b) => {
                return getDayKey(parseDateOnly(a.scheduledAt)) - getDayKey(parseDateOnly(b.scheduledAt));
            });
    }, [todos]);

    const completedTodos = useMemo(
        () =>
            todos
                .filter((todo) => todo.completed)
                .sort((a, b) => {
                    if (a.updatedAt && b.updatedAt) {
                        return (
                            new Date(b.updatedAt) -
                            new Date(a.updatedAt)
                        );
                    }

                    return (
                        (a.order ?? a.serialNumber ?? 0) -
                        (b.order ?? b.serialNumber ?? 0)
                    );
                }),
        [todos]
    );

    const highPriorityTodos = useMemo(
        () =>
            todos.filter(
                (todo) =>
                    !todo.completed &&
                    todo.priority === 'high'
            ),
        [todos]
    );

    const persistTodoUpdate = async (todoId, updates) => {
        const res = await fetch(`${TODO_API}/${todoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(updates),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(
                data.error || 'Failed to update todo'
            );
        }

        return data;
    };

    const handleSaveTodo = async (updates) => {
        if (!activeTodo) return;
        try {
            const updatedTodo = await persistTodoUpdate(activeTodo.id, updates);
            setTodos((currentTodos) =>
                currentTodos.map((todo) =>
                    todo.id === activeTodo.id ? updatedTodo : todo
                )
            );
        } catch (err) {
            setError(err.message);
        }
    };

    const handleAddTodo = async (event) => {
        event.preventDefault();

        const trimmedTodo = newTodo.trim();

        if (!trimmedTodo) {
            setError('Please enter a task title.');
            return;
        }

        try {
            setError('');

            const res = await fetch(TODO_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: trimmedTodo,
                    completed: false,

                    // A date input produces YYYY-MM-DD.
                    // Keep it as a date-only value.
                    dueDate: dueDate || null,

                    priority,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || 'Failed to create todo'
                );
            }

            setTodos((currentTodos) => [
                ...currentTodos,
                data,
            ]);

            setNewTodo('');
            setDueDate('');
            setPriority('medium');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleToggleTodo = async (
        todoId,
        completed
    ) => {
        const previousTodos = todos;
        const nextCompleted = !completed;

        setTodos((currentTodos) =>
            currentTodos.map((todo) =>
                todo.id === todoId
                    ? {
                        ...todo,
                        completed: nextCompleted,
                    }
                    : todo
            )
        );

        try {
            const updatedTodo =
                await persistTodoUpdate(todoId, {
                    completed: nextCompleted,
                });

            setTodos((currentTodos) =>
                currentTodos.map((todo) =>
                    todo.id === todoId
                        ? updatedTodo
                        : todo
                )
            );
        } catch (err) {
            setTodos(previousTodos);
            setError(err.message);
        }
    };

    const handleChangePriority = async (
        todoId,
        newPriority
    ) => {
        const previousTodos = todos;

        setTodos((currentTodos) =>
            currentTodos.map((todo) =>
                todo.id === todoId
                    ? {
                        ...todo,
                        priority: newPriority,
                    }
                    : todo
            )
        );

        try {
            const updatedTodo =
                await persistTodoUpdate(todoId, {
                    priority: newPriority,
                });

            setTodos((currentTodos) =>
                currentTodos.map((todo) =>
                    todo.id === todoId
                        ? updatedTodo
                        : todo
                )
            );
        } catch (err) {
            setTodos(previousTodos);
            setError(err.message);
        }
    };

    const handleDeleteTodo = async (todoId) => {
        try {
            const res = await fetch(
                `${TODO_API}/${todoId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || 'Failed to delete todo'
                );
            }

            setTodos((currentTodos) =>
                currentTodos.filter(
                    (todo) => todo.id !== todoId
                )
            );
        } catch (err) {
            setError(err.message);
        }
    };

    const moveTodo = async (dragId, targetId) => {
        if (
            !dragId ||
            !targetId ||
            dragId === targetId
        ) {
            return;
        }

        const reordered = [...todos];

        const dragIndex = reordered.findIndex(
            (todo) => todo.id === dragId
        );

        const targetIndex = reordered.findIndex(
            (todo) => todo.id === targetId
        );

        if (
            dragIndex === -1 ||
            targetIndex === -1
        ) {
            return;
        }

        const [movedItem] = reordered.splice(
            dragIndex,
            1
        );

        reordered.splice(
            targetIndex,
            0,
            movedItem
        );

        const nextTodos = reordered.map(
            (todo, index) => ({
                ...todo,
                serialNumber: index + 1,
                order: index + 1,
            })
        );

        setTodos(nextTodos);

        try {
            await Promise.all(
                nextTodos.map((todo) =>
                    persistTodoUpdate(todo.id, {
                        serialNumber:
                        todo.serialNumber,
                        order: todo.order,
                    })
                )
            );
        } catch (err) {
            setError(err.message);
            loadTodos();
        }
    };

    const toggleSubtasksExpanded = (todoId) => {
        const newExpanded = new Set(expandedSubtasks);
        if (newExpanded.has(todoId)) {
            newExpanded.delete(todoId);
        } else {
            newExpanded.add(todoId);
        }
        setExpandedSubtasks(newExpanded);
    };

    const handleDrop = async (
        event,
        targetId
    ) => {
        event.preventDefault();
        setDragOverId(null);

        if (draggedId) {
            await moveTodo(
                draggedId,
                targetId
            );

            setDraggedId(null);
        }
    };

    const renderTodoCard = (todo) => {
        const dueState = getDueState(todo);
        const dueDateLabel =
            getDueDateLabel(todo);

        const tone = todo.completed
            ? 'done'
            : dueState === 'overdue' ||
            todo.priority === 'high'
                ? 'urgent'
                : 'normal';

        const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;
        const isExpanded = expandedSubtasks.has(todo.id);

        return (
            <div
                key={todo.id}
                className={`admin-todo-card tone-${tone} ${
                    todo.completed
                        ? 'complete'
                        : ''
                } ${
                    draggedId === todo.id
                        ? 'dragging'
                        : ''
                } ${
                    dragOverId === todo.id
                        ? 'drag-over'
                        : ''
                }`}
                draggable
                onDragStart={(event) => {
                    event.dataTransfer.effectAllowed =
                        'move';

                    event.dataTransfer.setData(
                        'text/plain',
                        String(todo.id)
                    );

                    setDraggedId(todo.id);
                }}
                onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                }}
                onDragOver={(event) => {
                    event.preventDefault();

                    if (
                        draggedId &&
                        draggedId !== todo.id
                    ) {
                        setDragOverId(todo.id);
                    }
                }}
                onDragLeave={() => {
                    if (
                        dragOverId === todo.id
                    ) {
                        setDragOverId(null);
                    }
                }}
                onDrop={(event) =>
                    handleDrop(
                        event,
                        todo.id
                    )
                }
            >
                <div className="admin-todo-card-top">
    <span
        className={`admin-todo-card-avatar priority-${todo.priority}`}
        title={`Priority: ${PRIORITY_LABEL[todo.priority] || todo.priority}`}
    />

                    <div className="admin-todo-card-check">
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() =>
                                handleToggleTodo(
                                    todo.id,
                                    todo.completed
                                )
                            }
                        />

                        <span className="admin-todo-card-title">
            {todo.title}
        </span>
                    </div>

                    {hasSubtasks && (
                        <button
                            type="button"
                            className="admin-todo-card-subtasks-toggle"
                            onClick={() => toggleSubtasksExpanded(todo.id)}
                            title={isExpanded ? 'Hide subtasks' : 'Show subtasks'}
                        >
                            {isExpanded ? '▼' : '▶'} ({todo.subtasks.filter(st => st.completed).length}/{todo.subtasks.length})
                        </button>
                    )}

                    <button
                        type="button"
                        className="admin-todo-card-edit"
                        onClick={() => {
                            setActiveTodo(todo);
                            setIsModalOpen(true);
                        }}
                        aria-label={`Edit task: ${todo.title}`}
                        title="Edit task"
                    >
                        ✎
                    </button>

                    <button
                        type="button"
                        className="admin-todo-card-delete"
                        onClick={() => {
                            const confirmed = window.confirm(
                                `Are you sure you want to delete "${todo.title}"?`
                            );

                            if (confirmed) {
                                handleDeleteTodo(todo.id);
                            }
                        }}
                        aria-label={`Delete task: ${todo.title}`}
                    >
                        ✕
                    </button>
                </div>

                <div className="admin-todo-card-bottom">
                    <div className="admin-todo-card-info">
                        {dueDateLabel && (
                            <span
                                className={`admin-todo-card-due due-${dueState}`}
                            >
                                <span className="admin-todo-card-due-date">
                                    📅 {dueDateLabel}
                                </span>
                            </span>
                        )}

                        {todo.estimatedTime && (
                            <span className="admin-todo-card-time" title="Estimated time">
                                ⏱️ {todo.estimatedTime}min
                            </span>
                        )}

                        {todo.recurrence && todo.recurrence !== 'none' && (
                            <span className="admin-todo-card-recurrence" title="Recurrence">
                                🔄 {formatRecurrence(todo)}
                            </span>
                        )}
                    </div>

                    {!todo.completed && (
                        <select
                            className="admin-todo-card-priority"
                            value={
                                todo.priority
                            }
                            onChange={(e) =>
                                handleChangePriority(
                                    todo.id,
                                    e.target.value
                                )
                            }
                            title="Change priority"
                        >
                            <option value="low">
                                Low
                            </option>
                            <option value="medium">
                                Medium
                            </option>
                            <option value="high">
                                High
                            </option>
                        </select>
                    )}
                </div>

                {isExpanded && hasSubtasks && (
                    <div className="admin-todo-card-subtasks">
                        {todo.subtasks.map((subtask, idx) => (
                            <div key={subtask.id || idx} className="admin-todo-card-subtask">
                                <input 
                                    type="checkbox" 
                                    checked={subtask.completed} 
                                    onChange={() => {
                                        const updated = [...todo.subtasks];
                                        updated[idx] = { ...subtask, completed: !subtask.completed };
                                        handleSaveTodo({ subtasks: updated });
                                    }}
                                />
                                <span className={subtask.completed ? 'completed' : ''}>
                                    {subtask.title}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderColumn = (
        title,
        items
    ) => {
        return (
            <div
                className="admin-todo-column"
                key={title}
            >
                <div className="admin-todo-column-header">
                    <span className="admin-todo-column-title">
                        {title}
                    </span>

                    <span className="admin-todo-column-count">
                        {items.length}
                    </span>
                </div>

                <div className="admin-todo-column-body">
                    {items.map(renderTodoCard)}
                </div>
            </div>
        );
    };

    return (
        <AdminLayout title="To-Do Manager">
            <div className="admin-todo-top-dashboard">
                <form
                    className="admin-form admin-todo-form"
                    onSubmit={handleAddTodo}
                >
                    <h3>Add a task</h3>

                    <div className="admin-todo-form-row">
                        <label className="admin-todo-title-field">
                            <span>Task title</span>

                            <input
                                type="text"
                                value={newTodo}
                                onChange={(event) =>
                                    setNewTodo(event.target.value)
                                }
                                placeholder="Write a new item"
                            />
                        </label>

                        <label className="admin-todo-date-field">
                            <span>Due date</span>

                            <input
                                type="date"
                                value={dueDate}
                                onChange={(event) =>
                                    setDueDate(event.target.value)
                                }
                            />
                        </label>
                        
                        <label className="admin-todo-priority-field">
                            <span>Priority</span>

                            <select
                                value={priority}
                                onChange={(event) =>
                                    setPriority(event.target.value)
                                }
                            >
                                <option value="low">
                                    🟢 Low
                                </option>

                                <option value="medium">
                                    🟡 Medium
                                </option>

                                <option value="high">
                                    🔴 High
                                </option>
                            </select>
                        </label>

                        <button
                            type="submit"
                            className="admin-todo-submit"
                            disabled={loading}
                        >
                            Add task
                        </button>
                    </div>

                    {error && (
                        <p className="admin-error">
                            {error}
                        </p>
                    )}
                </form>

                <div className="admin-todo-overview">
                    <div className="admin-todo-stat">
                        <span>Pending</span>
                        <strong>{pendingCount}</strong>
                    </div>

                    <div className="admin-todo-stat admin-todo-stat-urgent">
                        <span>🔴 Urgent</span>
                        <strong>{highPriorityTodos.length}</strong>
                    </div>

                    <div className="admin-todo-stat">
                        <span>Completed</span>
                        <strong>{doneCount}</strong>
                    </div>

                    <div className="admin-todo-stat">
                        <span>Total</span>
                        <strong>{todos.length}</strong>
                    </div>
                </div>
            </div>

            <div className="admin-tabs">
                <button
                    type="button"
                    className={`admin-tab ${
                        activeTab === 'all'
                            ? 'active'
                            : ''
                    }`}
                    onClick={() =>
                        setActiveTab('all')
                    }
                >
                    All Tasks
                </button>

                <button
                    type="button"
                    className={`admin-tab ${
                        activeTab === 'other'
                            ? 'active'
                            : ''
                    }`}
                    onClick={() =>
                        setActiveTab(
                            'other'
                        )
                    }
                >
                    Other
                </button>
            </div>

            {loading ? (
                <p className="admin-loading-text">
                    Loading tasks...
                </p>
            ) : todos.length === 0 ? (
                <p className="admin-empty">
                    No tasks yet. Add your first one
                    above.
                </p>
            ) : (
                <div className="admin-todo-board">
                    {activeTab ===
                        'other' &&
                        renderColumn(
                            'Scheduled',
                            scheduledTodos
                        )}

                    {activeTab ===
                        'other' &&
                        renderColumn(
                            'Completed',
                            completedTodos
                        )}

                    {activeTab === 'all' && (
                        <>
                            {renderColumn(
                                'Overdue',
                                overdueTodos
                            )}

                            {renderColumn(
                                'Today',
                                todayTodos
                            )}

                            {renderColumn(
                                'Next 3 Days',
                                nextThreeDaysTodos
                            )}

                            {renderColumn(
                                'Upcoming',
                                upcomingTodos
                            )}

                            {renderColumn(
                                'No Due Date',
                                noDueDateTodos
                            )}
                        </>
                    )}
                </div>
            )}

            <TodoModal
                todo={activeTodo}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setActiveTodo(null);
                }}
                onSave={handleSaveTodo}
            />
        </AdminLayout>
    );
};

export default TodoAdmin;
