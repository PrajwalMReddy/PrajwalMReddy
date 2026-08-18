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

const getDueCaption = (todo) => {
    if (todo.completed) return 'Completed';

    const diffDays = getDueDifference(todo);

    if (diffDays === null) return '';

    if (diffDays < 0) {
        const days = Math.abs(diffDays);

        return `Overdue by ${days} day${days === 1 ? '' : 's'}`;
    }

    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';

    return `${diffDays} days left`;
};

/**
 * Returns the current calendar week from TODAY through Sunday.
 *
 * Since overdue items have their own column, Monday/earlier dates
 * aren't relevant here.
 */
const getThisWeekRange = () => {
    const today = getToday();

    const end = new Date(today);

    const daysUntilSunday = 7 - end.getDay();

    end.setDate(end.getDate() + daysUntilSunday);
    end.setHours(0, 0, 0, 0);

    return {
        startKey: getDayKey(today),
        endKey: getDayKey(end),
    };
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
                        getDueState(todo) === 'today'
                )
                .sort(sortByPriority),
        [todos]
    );

    const thisWeekTodos = useMemo(() => {
        const {startKey, endKey} = getThisWeekRange();

        return todos
            .filter((todo) => {
                if (todo.completed) return false;

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
                const priorityDiff = sortByPriority(a, b);

                if (priorityDiff !== 0) {
                    return priorityDiff;
                }

                return getDueDayKey(a) - getDueDayKey(b);
            });
    }, [todos]);

    const upcomingTodos = useMemo(() => {
        const {endKey} = getThisWeekRange();

        return todos
            .filter((todo) => {
                if (todo.completed) return false;

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
                        getDueDayKey(todo) === null
                )
                .sort(sortByPriority),
        [todos]
    );

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
        const dueCaption = getDueCaption(todo);
        const dueDateLabel =
            getDueDateLabel(todo);

        const tone = todo.completed
            ? 'done'
            : dueState === 'overdue' ||
            todo.priority === 'high'
                ? 'urgent'
                : 'normal';

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
                        className="admin-todo-card-avatar"
                        title={`Priority: ${todo.priority}`}
                    >
                        {todo.priority === 'high'
                            ? '🔴'
                            : todo.priority === 'medium'
                                ? '🟡'
                                : '🟢'}
                    </span>
                    <label className="admin-todo-card-check">
                        <input
                            type="checkbox"
                            checked={
                                todo.completed
                            }
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
                    </label>

                    <button
                        type="button"
                        className="admin-todo-card-delete"
                        onClick={() =>
                            handleDeleteTodo(
                                todo.id
                            )
                        }
                        aria-label="Delete task"
                    >
                        ✕
                    </button>
                </div>

                <div className="admin-todo-card-bottom">
                    {dueDateLabel && (
                        <span
                            className={`admin-todo-card-due due-${dueState}`}
                        >
                            📅 {dueDateLabel}

                            {dueCaption && (
                                <span className="admin-todo-card-due-caption">
                                    {' '}
                                    · {dueCaption}
                                </span>
                            )}
                        </span>
                    )}

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
        <AdminLayout title="To-do Manager">
            <div className="admin-todo-overview">
                <div className="admin-todo-stat">
                    <span>Total</span>
                    <strong>
                        {todos.length}
                    </strong>
                </div>

                <div className="admin-todo-stat">
                    <span>Pending</span>
                    <strong>
                        {pendingCount}
                    </strong>
                </div>

                <div className="admin-todo-stat admin-todo-stat-urgent">
                    <span>
                        🔴 Urgent
                    </span>
                    <strong>
                        {
                            highPriorityTodos.length
                        }
                    </strong>
                </div>

                <div className="admin-todo-stat">
                    <span>Completed</span>
                    <strong>
                        {doneCount}
                    </strong>
                </div>
            </div>

            <form
                className="admin-form admin-todo-form"
                onSubmit={handleAddTodo}
            >
                <h3>Add a task</h3>

                <div className="admin-todo-form-row">
                    <label className="admin-todo-title-field">
                        <span>
                            Task title
                        </span>

                        <input
                            type="text"
                            value={newTodo}
                            onChange={(event) =>
                                setNewTodo(
                                    event.target.value
                                )
                            }
                            placeholder="Write a new item"
                        />
                    </label>

                    <label className="admin-todo-date-field">
                        <span>
                            Due date
                        </span>

                        <input
                            type="date"
                            value={dueDate}
                            onChange={(event) =>
                                setDueDate(
                                    event.target.value
                                )
                            }
                        />
                    </label>

                    <label className="admin-todo-priority-field">
                        <span>
                            Priority
                        </span>

                        <select
                            value={priority}
                            onChange={(event) =>
                                setPriority(
                                    event.target.value
                                )
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
                        activeTab === 'completed'
                            ? 'active'
                            : ''
                    }`}
                    onClick={() =>
                        setActiveTab(
                            'completed'
                        )
                    }
                >
                    Completed
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
                        'completed' &&
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
                                'This Week',
                                thisWeekTodos
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
        </AdminLayout>
    );
};

export default TodoAdmin;
