import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import TodoCard from './todo/TodoCard';
import TodoModal from './todo/TodoModal';
import {
    getDayKey,
    getDueDayKey,
    getDueState,
    getNextThreeDaysRange,
    isScheduledForFuture,
    parseDateOnly,
    TODO_API,
} from './todo/todoUtils';

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
            const res = await fetch(TODO_API, { credentials: 'include' });
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

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortByPriority = (a, b) =>
        (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);

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
                    if (priorityDiff !== 0) return priorityDiff;
                    return getDueDayKey(a) - getDueDayKey(b);
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
        const { startKey, endKey } = getNextThreeDaysRange();
        return todos
            .filter((todo) => {
                if (todo.completed || isScheduledForFuture(todo)) return false;
                const dueKey = getDueDayKey(todo);
                if (dueKey === null) return false;
                return dueKey > startKey && dueKey <= endKey;
            })
            .sort((a, b) => {
                const priorityDiff = sortByPriority(a, b);
                if (priorityDiff !== 0) return priorityDiff;
                return getDueDayKey(a) - getDueDayKey(b);
            });
    }, [todos]);

    const upcomingTodos = useMemo(() => {
        const { endKey } = getNextThreeDaysRange();
        return todos
            .filter((todo) => {
                if (todo.completed || isScheduledForFuture(todo)) return false;
                const dueKey = getDueDayKey(todo);
                if (dueKey === null) return false;
                return dueKey > endKey;
            })
            .sort((a, b) => {
                const dateDiff = getDueDayKey(a) - getDueDayKey(b);
                if (dateDiff !== 0) return dateDiff;
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

    const scheduledTodos = useMemo(
        () =>
            todos
                .filter((todo) => isScheduledForFuture(todo) && !todo.completed)
                .sort(
                    (a, b) =>
                        getDayKey(parseDateOnly(a.scheduledAt)) -
                        getDayKey(parseDateOnly(b.scheduledAt))
                ),
        [todos]
    );

    const completedTodos = useMemo(
        () =>
            todos
                .filter((todo) => todo.completed)
                .sort((a, b) => {
                    if (a.updatedAt && b.updatedAt) {
                        return new Date(b.updatedAt) - new Date(a.updatedAt);
                    }
                    return (
                        (a.order ?? a.serialNumber ?? 0) -
                        (b.order ?? b.serialNumber ?? 0)
                    );
                }),
        [todos]
    );

    const highPriorityTodos = useMemo(
        () => todos.filter((todo) => !todo.completed && todo.priority === 'high'),
        [todos]
    );

    const persistTodoUpdate = async (todoId, updates) => {
        const res = await fetch(`${TODO_API}/${todoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to update todo');
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
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: trimmedTodo,
                    completed: false,
                    dueDate: dueDate || null,
                    priority,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to create todo');
            }

            setTodos((currentTodos) => [...currentTodos, data]);
            setNewTodo('');
            setDueDate('');
            setPriority('medium');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleToggleTodo = async (todoId, completed) => {
        const previousTodos = todos;
        const nextCompleted = !completed;

        setTodos((currentTodos) =>
            currentTodos.map((todo) =>
                todo.id === todoId ? { ...todo, completed: nextCompleted } : todo
            )
        );

        try {
            const updatedTodo = await persistTodoUpdate(todoId, { completed: nextCompleted });
            setTodos((currentTodos) =>
                currentTodos.map((todo) =>
                    todo.id === todoId ? updatedTodo : todo
                )
            );
        } catch (err) {
            setTodos(previousTodos);
            setError(err.message);
        }
    };

    const handleChangePriority = async (todoId, newPriority) => {
        const previousTodos = todos;
        setTodos((currentTodos) =>
            currentTodos.map((todo) =>
                todo.id === todoId ? { ...todo, priority: newPriority } : todo
            )
        );

        try {
            const updatedTodo = await persistTodoUpdate(todoId, { priority: newPriority });
            setTodos((currentTodos) =>
                currentTodos.map((todo) =>
                    todo.id === todoId ? updatedTodo : todo
                )
            );
        } catch (err) {
            setTodos(previousTodos);
            setError(err.message);
        }
    };

    const handleDeleteTodo = async (todoId) => {
        try {
            const res = await fetch(`${TODO_API}/${todoId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete todo');
            }
            setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
        } catch (err) {
            setError(err.message);
        }
    };

    const moveTodo = async (dragId, targetId) => {
        if (!dragId || !targetId || dragId === targetId) return;

        const reordered = [...todos];
        const dragIndex = reordered.findIndex((todo) => todo.id === dragId);
        const targetIndex = reordered.findIndex((todo) => todo.id === targetId);

        if (dragIndex === -1 || targetIndex === -1) return;

        const [movedItem] = reordered.splice(dragIndex, 1);
        reordered.splice(targetIndex, 0, movedItem);

        const nextTodos = reordered.map((todo, index) => ({
            ...todo,
            serialNumber: index + 1,
            order: index + 1,
        }));

        setTodos(nextTodos);

        try {
            await Promise.all(
                nextTodos.map((todo) =>
                    persistTodoUpdate(todo.id, {
                        serialNumber: todo.serialNumber,
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

    const handleDrop = async (event, targetId) => {
        event.preventDefault();
        setDragOverId(null);
        if (draggedId) {
            await moveTodo(draggedId, targetId);
            setDraggedId(null);
        }
    };

    const renderTodoCard = (todo) => (
        <TodoCard
            key={todo.id}
            todo={todo}
            draggedId={draggedId}
            dragOverId={dragOverId}
            onDragStart={(event, id) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(id));
                setDraggedId(id);
            }}
            onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
            }}
            onDragOver={(event, id) => {
                event.preventDefault();
                if (draggedId && draggedId !== id) {
                    setDragOverId(id);
                }
            }}
            onDragLeave={() => {
                if (dragOverId === todo.id) setDragOverId(null);
            }}
            onDrop={handleDrop}
            onToggle={handleToggleTodo}
            onEdit={(t) => {
                setActiveTodo(t);
                setIsModalOpen(true);
            }}
            onDelete={(t) => {
                const confirmed = window.confirm(
                    `Are you sure you want to delete "${t.title}"?`
                );
                if (confirmed) {
                    handleDeleteTodo(t.id);
                }
            }}
            onChangePriority={handleChangePriority}
            onSaveTodo={handleSaveTodo}
            isExpanded={expandedSubtasks.has(todo.id)}
            onToggleSubtasksExpanded={toggleSubtasksExpanded}
        />
    );

    const renderColumn = (title, items) => (
        <div className="admin-todo-column" key={title}>
            <div className="admin-todo-column-header">
                <span className="admin-todo-column-title">{title}</span>
                <span className="admin-todo-column-count">{items.length}</span>
            </div>
            <div className="admin-todo-column-body">
                {items.map(renderTodoCard)}
            </div>
        </div>
    );

    return (
        <AdminLayout title="To-Do Manager">
            <div className="admin-todo-top-dashboard">
                <form className="admin-form admin-todo-form" onSubmit={handleAddTodo}>
                    <h3>Add a task</h3>
                    <div className="admin-todo-form-row">
                        <label className="admin-todo-title-field">
                            <span>Task title</span>
                            <input
                                type="text"
                                value={newTodo}
                                onChange={(event) => setNewTodo(event.target.value)}
                                placeholder="Write a new item"
                            />
                        </label>

                        <label className="admin-todo-date-field">
                            <span>Due date</span>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(event) => setDueDate(event.target.value)}
                            />
                        </label>

                        <label className="admin-todo-priority-field">
                            <span>Priority</span>
                            <select
                                value={priority}
                                onChange={(event) => setPriority(event.target.value)}
                            >
                                <option value="low">🟢 Low</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="high">🔴 High</option>
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

                    {error && <p className="admin-error">{error}</p>}
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
                    className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All Tasks
                </button>

                <button
                    type="button"
                    className={`admin-tab ${activeTab === 'other' ? 'active' : ''}`}
                    onClick={() => setActiveTab('other')}
                >
                    Other
                </button>
            </div>

            {loading ? (
                <p className="admin-loading-text">Loading tasks...</p>
            ) : todos.length === 0 ? (
                <p className="admin-empty">No tasks yet. Add your first one above.</p>
            ) : (
                <div className="admin-todo-board">
                    {activeTab === 'other' && (
                        <>
                            {renderColumn('Scheduled', scheduledTodos)}
                            {renderColumn('Completed', completedTodos)}
                        </>
                    )}

                    {activeTab === 'all' && (
                        <>
                            {renderColumn('Overdue', overdueTodos)}
                            {renderColumn('Today', todayTodos)}
                            {renderColumn('Next 3 Days', nextThreeDaysTodos)}
                            {renderColumn('Upcoming', upcomingTodos)}
                            {renderColumn('No Due Date', noDueDateTodos)}
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
