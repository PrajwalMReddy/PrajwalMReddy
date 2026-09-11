import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import TodoCard from './todo/TodoCard';
import TodoModal from './todo/TodoModal';
import {
    getDayKey,
    getDueDayKey,
    getDueState,
    getNextThreeDaysRange,
    isRecurringChildVisible,
    isScheduledForFuture,
    parseDateOnly,
    TODO_API,
} from './todo/todoUtils';

const TodoAdmin = () => {
    const { t, formatNumber } = useContent();
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
    const [selectedTag, setSelectedTag] = useState(null);
    const [search, setSearch] = useState('');

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

    const allTags = useMemo(() => {
        const tagSet = new Set();
        todos.forEach((todo) => {
            if (Array.isArray(todo.tags)) {
                todo.tags.forEach((tag) => {
                    const trimmed = String(tag || '').trim();
                    if (trimmed) tagSet.add(trimmed);
                });
            }
        });
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    }, [todos]);

    useEffect(() => {
        if (selectedTag && !allTags.some((t) => t.toLowerCase() === selectedTag.toLowerCase())) {
            setSelectedTag(null);
        }
    }, [allTags, selectedTag]);

    const displayTodos = useMemo(() => {
        const query = search.trim().toLowerCase();
        return todos.filter((todo) => {
            if (!isRecurringChildVisible(todo, todos)) {
                return false;
            }

            if (selectedTag) {
                const hasTag =
                    Array.isArray(todo.tags) &&
                    todo.tags.some(
                        (t) => String(t).trim().toLowerCase() === selectedTag.toLowerCase()
                    );
                if (!hasTag) return false;
            }

            if (query) {
                const titleMatch = (todo.title || '').toLowerCase().includes(query);
                const descMatch = (todo.description || '').toLowerCase().includes(query);
                const tagMatch =
                    Array.isArray(todo.tags) &&
                    todo.tags.some((t) => String(t).toLowerCase().includes(query));
                const subtaskMatch =
                    Array.isArray(todo.subtasks) &&
                    todo.subtasks.some((st) => (st.title || '').toLowerCase().includes(query));
                if (!titleMatch && !descMatch && !tagMatch && !subtaskMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [todos, selectedTag, search]);

    const pendingCount = useMemo(
        () => displayTodos.filter((todo) => !todo.completed).length,
        [displayTodos]
    );

    const doneCount = useMemo(
        () => displayTodos.filter((todo) => todo.completed).length,
        [displayTodos]
    );

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortByPriority = (a, b) =>
        (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);

    const overdueTodos = useMemo(
        () =>
            displayTodos
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
        [displayTodos]
    );

    const todayTodos = useMemo(
        () =>
            displayTodos
                .filter(
                    (todo) =>
                        !todo.completed &&
                        !isScheduledForFuture(todo) &&
                        getDueState(todo) === 'today'
                )
                .sort(sortByPriority),
        [displayTodos]
    );

    const nextThreeDaysTodos = useMemo(() => {
        const { startKey, endKey } = getNextThreeDaysRange();
        return displayTodos
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
    }, [displayTodos]);

    const upcomingTodos = useMemo(() => {
        const { endKey } = getNextThreeDaysRange();
        return displayTodos
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
    }, [displayTodos]);

    const noDueDateTodos = useMemo(
        () =>
            displayTodos
                .filter(
                    (todo) =>
                        !todo.completed &&
                        !isScheduledForFuture(todo) &&
                        getDueDayKey(todo) === null
                )
                .sort(sortByPriority),
        [displayTodos]
    );

    const scheduledTodos = useMemo(
        () =>
            displayTodos
                .filter((todo) => isScheduledForFuture(todo) && !todo.completed)
                .sort(
                    (a, b) =>
                        getDayKey(parseDateOnly(a.scheduledAt)) -
                        getDayKey(parseDateOnly(b.scheduledAt))
                ),
        [displayTodos]
    );

    const completedTodos = useMemo(
        () =>
            displayTodos
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
        [displayTodos]
    );

    const highPriorityTodos = useMemo(
        () => displayTodos.filter((todo) => !todo.completed && todo.priority === 'high'),
        [displayTodos]
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
            onDelete={(taskItem) => {
                const confirmed = window.confirm(
                    t('admin.todoSection.deleteConfirm', 'Are you sure you want to delete this task?')
                );
                if (confirmed) {
                    handleDeleteTodo(taskItem.id);
                }
            }}
            onChangePriority={handleChangePriority}
            onSaveTodo={handleSaveTodo}
            isExpanded={expandedSubtasks.has(todo.id)}
            onToggleSubtasksExpanded={toggleSubtasksExpanded}
        />
    );

    const renderColumn = (titleKey, items) => {
        const columnTitleMap = {
            'Overdue': t('admin.todoSection.columns.overdue', 'Overdue'),
            'Today': t('admin.todoSection.columns.today', 'Today'),
            'Next 3 Days': t('admin.todoSection.columns.next3Days', 'Next 3 Days'),
            'Upcoming': t('admin.todoSection.columns.upcoming', 'Upcoming'),
            'No Due Date': t('admin.todoSection.columns.noDueDate', 'No Due Date'),
            'Scheduled': t('admin.todoSection.columns.scheduled', 'Scheduled'),
            'Completed': t('admin.todoSection.columns.completed', 'Completed'),
        };
        const displayTitle = columnTitleMap[titleKey] || titleKey;

        return (
            <div className="admin-todo-column" key={titleKey}>
                <div className="admin-todo-column-header">
                    <span className="admin-todo-column-title">{displayTitle}</span>
                    <span className="admin-todo-column-count">{formatNumber(items.length)}</span>
                </div>
                <div className="admin-todo-column-body">
                    {items.map(renderTodoCard)}
                </div>
            </div>
        );
    };

    return (
        <AdminLayout title={t('admin.todoSection.title', 'To-Do Manager')}>
            <div className="admin-todo-top-dashboard">
                <form className="admin-form admin-todo-form" onSubmit={handleAddTodo}>
                    <h3>{t('admin.todoSection.addATask', 'Add a task')}</h3>
                    <div className="admin-todo-form-row">
                        <label className="admin-todo-title-field">
                            <span>{t('admin.todoSection.taskTitle', 'Task title')}</span>
                            <input
                                type="text"
                                value={newTodo}
                                onChange={(event) => setNewTodo(event.target.value)}
                                placeholder={t('admin.todoSection.placeholder', 'Write a new item')}
                            />
                        </label>

                        <label className="admin-todo-date-field">
                            <span>{t('admin.todoSection.dueDate', 'Due date')}</span>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(event) => setDueDate(event.target.value)}
                            />
                        </label>

                        <label className="admin-todo-priority-field">
                            <span>{t('admin.todoSection.priority', 'Priority')}</span>
                            <select
                                value={priority}
                                onChange={(event) => setPriority(event.target.value)}
                            >
                                <option value="low">🟢 {t('admin.todoSection.priorities.low', 'Low')}</option>
                                <option value="medium">🟡 {t('admin.todoSection.priorities.medium', 'Medium')}</option>
                                <option value="high">🔴 {t('admin.todoSection.priorities.high', 'High')}</option>
                            </select>
                        </label>

                        <button
                            type="submit"
                            className="admin-todo-submit"
                            disabled={loading}
                        >
                            {t('admin.todoSection.addTask', 'Add task')}
                        </button>
                    </div>

                    {error && <p className="admin-error">{error}</p>}
                </form>

                <div className="admin-todo-overview">
                    <div className="admin-todo-stat">
                        <span>{t('admin.todoSection.pending', 'Pending')}</span>
                        <strong>{formatNumber(pendingCount)}</strong>
                    </div>

                    <div className="admin-todo-stat admin-todo-stat-urgent">
                        <span>🔴 {t('admin.todoSection.urgent', 'Urgent')}</span>
                        <strong>{formatNumber(highPriorityTodos.length)}</strong>
                    </div>

                    <div className="admin-todo-stat">
                        <span>{t('admin.todoSection.completed', 'Completed')}</span>
                        <strong>{formatNumber(doneCount)}</strong>
                    </div>

                    <div className="admin-todo-stat">
                        <span>{t('admin.todoSection.total', 'Total')}</span>
                        <strong>{formatNumber(displayTodos.length)}</strong>
                    </div>
                </div>
            </div>

            <div className="admin-todo-nav-bar">
                <div className="admin-todo-nav-main">
                    <div className="admin-tabs">
                        <button
                            type="button"
                            className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            {t('admin.todoSection.allTasks', 'All Tasks')}
                        </button>

                        <button
                            type="button"
                            className={`admin-tab ${activeTab === 'other' ? 'active' : ''}`}
                            onClick={() => setActiveTab('other')}
                        >
                            {t('admin.todoSection.other', 'Other')}
                        </button>
                    </div>

                    <div className="admin-todo-search-wrap">
                        <span className="admin-todo-search-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.todoSection.searchPlaceholder', 'Search tasks...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape' && search) {
                                    e.stopPropagation();
                                    setSearch('');
                                }
                            }}
                            className="admin-todo-search-input"
                            aria-label={t('admin.todoSection.searchAriaLabel', 'Search tasks')}
                        />
                        {search && (
                            <button
                                type="button"
                                className="admin-todo-search-clear"
                                onClick={() => setSearch('')}
                                aria-label={t('admin.todoSection.clearSearch', 'Clear search')}
                                title={t('admin.todoSection.clearSearch', 'Clear search')}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {allTags.length > 0 && (
                    <div className="admin-todo-tag-filter-container">
                        <span className="admin-todo-tag-filter-label">{t('admin.todoSection.filterByTag', 'Filter by tag:')}</span>
                        <div className="admin-todo-tag-filter-pills">
                            <button
                                type="button"
                                className={`admin-todo-tag-filter-pill ${!selectedTag ? 'active' : ''}`}
                                onClick={() => setSelectedTag(null)}
                            >
                                {t('admin.todoSection.all', 'All')}
                            </button>
                            {allTags.map((tag) => {
                                const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        className={`admin-todo-tag-filter-pill ${isSelected ? 'active' : ''}`}
                                        onClick={() => setSelectedTag(isSelected ? null : tag)}
                                        title={`${t('admin.todoSection.filterByTag', 'Filter by tag:')} ${tag}`}
                                    >
                                        🏷️ {tag}
                                        {isSelected && <span className="admin-todo-tag-filter-clear">✕</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="admin-loading-text">{t('admin.todoSection.loading', 'Loading tasks...')}</p>
            ) : todos.length === 0 ? (
                <p className="admin-empty">{t('admin.todoSection.empty', 'No tasks yet. Add your first one above.')}</p>
            ) : displayTodos.length === 0 ? (
                <div className="admin-todo-filter-empty">
                    <p>
                        {search.trim()
                            ? t('admin.todoSection.noMatchingSearchTasks', 'No tasks match your search.')
                            : t('admin.todoSection.noMatchingTagTasks', 'No tasks match this tag filter.')}
                    </p>
                    <button
                        type="button"
                        className="admin-todo-clear-filter-btn"
                        onClick={() => {
                            if (search) setSearch('');
                            if (selectedTag) setSelectedTag(null);
                        }}
                    >
                        {search.trim() && !selectedTag
                            ? t('admin.todoSection.clearSearch', 'Clear search')
                            : t('admin.todoSection.clearFilter', 'Clear filter')}
                    </button>
                </div>
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
