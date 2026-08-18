import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';

const TODO_API = '/api/todo';

const formatDueDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDueState = (todo) => {
    if (!todo?.dueDate) return 'none';
    if (todo.completed) return 'done';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(todo.dueDate);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'soon';
    return 'upcoming';
};

const TodoAdmin = () => {
    const [todos, setTodos] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [draggedId, setDraggedId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadTodos = useCallback(async () => {
        try {
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

    const pendingCount = useMemo(() => todos.filter((todo) => !todo.completed).length, [todos]);
    const doneCount = useMemo(() => todos.filter((todo) => todo.completed).length, [todos]);

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
                body: JSON.stringify({ title: trimmedTodo, completed: false, dueDate }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to create todo');
            }

            setTodos((currentTodos) => [...currentTodos, data]);
            setNewTodo('');
            setDueDate('');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleToggleTodo = async (todoId, completed) => {
        const previousTodos = todos;
        const optimisticUpdate = (currentTodos) => currentTodos.map((todo) => (
            todo.id === todoId ? { ...todo, completed: !completed } : todo
        ));

        setTodos((currentTodos) => optimisticUpdate(currentTodos));

        try {
            const updatedTodo = await persistTodoUpdate(todoId, { completed: !completed });
            setTodos((currentTodos) => currentTodos.map((todo) => (
                todo.id === todoId ? updatedTodo : todo
            )));
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
                nextTodos.map((todo) => persistTodoUpdate(todo.id, {
                    serialNumber: todo.serialNumber,
                    order: todo.order,
                }))
            );
        } catch (err) {
            setError(err.message);
            loadTodos();
        }
    };

    const handleDrop = async (event, targetId) => {
        event.preventDefault();
        setDragOverId(null);
        if (draggedId) {
            await moveTodo(draggedId, targetId);
            setDraggedId(null);
        }
    };

    return (
        <AdminLayout title="To-do Manager">
            <div className="admin-todo-overview">
                <div className="admin-todo-stat">
                    <span>Total</span>
                    <strong>{todos.length}</strong>
                </div>
                <div className="admin-todo-stat">
                    <span>Pending</span>
                    <strong>{pendingCount}</strong>
                </div>
                <div className="admin-todo-stat">
                    <span>Completed</span>
                    <strong>{doneCount}</strong>
                </div>
            </div>

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

                    <button type="submit" className="admin-todo-submit" disabled={loading}>Add task</button>
                </div>

                {error && <p className="admin-error">{error}</p>}
            </form>

            <div className="admin-todo-list">
                {loading ? (
                    <p className="admin-loading-text">Loading tasks...</p>
                ) : todos.length === 0 ? (
                    <p className="admin-empty">No tasks yet. Add your first one above.</p>
                ) : (
                    todos.map((todo, index) => {
                        const dueState = getDueState(todo);

                        return (
                            <div
                                key={todo.id}
                                className={`admin-todo-item ${todo.completed ? 'complete' : ''} ${dueState} ${draggedId === todo.id ? 'dragging' : ''} ${dragOverId === todo.id ? 'drag-over' : ''}`}
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', todo.id);
                                    setDraggedId(todo.id);
                                }}
                                onDragEnd={() => {
                                    setDraggedId(null);
                                    setDragOverId(null);
                                }}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    if (draggedId && draggedId !== todo.id) {
                                        setDragOverId(todo.id);
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dragOverId === todo.id) {
                                        setDragOverId(null);
                                    }
                                }}
                                onDrop={(event) => handleDrop(event, todo.id)}
                            >
                                <div className="admin-todo-main">
                                    <span className="admin-todo-handle" aria-label="Drag to reorder">⋮⋮</span>
                                    <span className="admin-todo-serial">#{String(todo.serialNumber ?? index + 1).padStart(2, '0')}</span>
                                    <label className="admin-todo-check">
                                        <input
                                            type="checkbox"
                                            checked={todo.completed}
                                            onChange={() => handleToggleTodo(todo.id, todo.completed)}
                                        />
                                        <span>{todo.title}</span>
                                    </label>
                                </div>

                                <div className="admin-todo-meta">
                                    <span className={`admin-todo-due ${dueState}`}>
                                        {todo.completed ? 'Completed' : formatDueDate(todo.dueDate)}
                                    </span>
                                    <button
                                        type="button"
                                        className="admin-todo-delete"
                                        onClick={() => handleDeleteTodo(todo.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </AdminLayout>
    );
};

export default TodoAdmin;
