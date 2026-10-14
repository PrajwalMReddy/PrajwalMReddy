import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import TodoCard from './todo/TodoCard';
import TodoModal from './todo/TodoModal';
import {
    COLLAPSED_COLUMNS_KEY,
    getDayKey,
    getDueDayKey,
    getDueState,
    getNextNDaysRange,
    getNextThreeDaysRange,
    isRecurringChildVisible,
    isScheduledForFuture,
    parseDateOnly,
    TODO_API,
} from './todo/todoUtils';

const NEXT_DAYS_STORAGE_KEY = 'admin_todo_next_days_count';

const TodoAdmin = () => {
    const { t, formatNumber } = useContent();
    const [todos, setTodos] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    const [newTags, setNewTags] = useState('');
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
    const [collapsedColumns, setCollapsedColumns] = useState(() => {
        try {
            const saved = localStorage.getItem(COLLAPSED_COLUMNS_KEY);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });
    const [nextDaysCount, setNextDaysCount] = useState(() => {
        try {
            const saved = localStorage.getItem(NEXT_DAYS_STORAGE_KEY);
            const parsed = parseInt(saved, 10);
            return parsed && parsed >= 1 && parsed <= 30 ? parsed : 3;
        } catch {
            return 3;
        }
    });
    const [search, setSearch] = useState('');
    const SELECTED_TAGS_KEY = 'admin_todo_selected_tags';
    const [selectedTags, setSelectedTags] = useState(() => {
        try {
            const saved = localStorage.getItem(SELECTED_TAGS_KEY);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [tagFilterSearch, setTagFilterSearch] = useState('');
    const tagDropdownRef = useRef(null);
    const [isDaysPickerOpen, setIsDaysPickerOpen] = useState(false);
    const daysPickerRef = useRef(null);

    const handleNextDaysChange = useCallback((count) => {
        setNextDaysCount(count);
        try {
            localStorage.setItem(NEXT_DAYS_STORAGE_KEY, String(count));
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(
                COLLAPSED_COLUMNS_KEY,
                JSON.stringify(Array.from(collapsedColumns))
            );
        } catch (e) {
            // ignore
        }
    }, [collapsedColumns]);

    useEffect(() => {
        try {
            localStorage.setItem(
                SELECTED_TAGS_KEY,
                JSON.stringify(Array.from(selectedTags))
            );
        } catch (e) {
            // ignore
        }
    }, [selectedTags]);

    const toggleColumnCollapse = useCallback((columnKey) => {
        setCollapsedColumns((prev) => {
            const next = new Set(prev);
            if (next.has(columnKey)) {
                next.delete(columnKey);
            } else {
                next.add(columnKey);
            }
            return next;
        });
    }, []);

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
        document.title = t('pageTitles.adminTodo', 'To-Do | Admin | Prajwal Reddy');
    }, [t]);

    useEffect(() => {
        loadTodos();
    }, [loadTodos]);

    useEffect(() => {
        if (!isTagDropdownOpen) return;
        const handleClickOutside = (e) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
                setIsTagDropdownOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isTagDropdownOpen]);

    useEffect(() => {
        if (!isDaysPickerOpen) return;
        const handleClickOutside = (e) => {
            if (daysPickerRef.current && !daysPickerRef.current.contains(e.target)) {
                setIsDaysPickerOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsDaysPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDaysPickerOpen]);

    const allAvailableTags = useMemo(() => {
        const tagMap = new Map();
        todos.forEach((todo) => {
            if (!isRecurringChildVisible(todo, todos)) return;
            if (Array.isArray(todo.tags)) {
                todo.tags.forEach((tag) => {
                    const str = String(tag || '').trim();
                    if (!str) return;
                    const lower = str.toLowerCase();
                    if (tagMap.has(lower)) {
                        tagMap.get(lower).count += 1;
                    } else {
                        tagMap.set(lower, {
                            key: lower,
                            label: str,
                            count: 1,
                        });
                    }
                });
            }
        });
        return Array.from(tagMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [todos]);

    const filteredDropdownTags = useMemo(() => {
        const q = tagFilterSearch.trim().toLowerCase();
        if (!q) return allAvailableTags;
        return allAvailableTags.filter((t) => t.label.toLowerCase().includes(q));
    }, [allAvailableTags, tagFilterSearch]);

    const toggleTag = useCallback((tagKey) => {
        setSelectedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tagKey)) {
                next.delete(tagKey);
            } else {
                next.add(tagKey);
            }
            return next;
        });
    }, []);

    const selectAllTags = useCallback(() => {
        const allKeys = new Set(allAvailableTags.map((t) => t.key));
        setSelectedTags(allKeys);
    }, [allAvailableTags]);

    const clearAllTags = useCallback(() => {
        setSelectedTags(new Set());
    }, []);

    const displayTodos = useMemo(() => {
        const query = search.trim().toLowerCase();
        return todos.filter((todo) => {
            if (!isRecurringChildVisible(todo, todos)) {
                return false;
            }

            if (selectedTags.size > 0) {
                const todoTags = Array.isArray(todo.tags)
                    ? todo.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
                    : [];
                const hasMatchingTag = todoTags.some((t) => selectedTags.has(t));
                if (!hasMatchingTag) {
                    return false;
                }
            }

            if (query) {
                const titleMatch = (todo.title || '').toLowerCase().includes(query);
                const descMatch = (todo.description || '').toLowerCase().includes(query);
                const linkMatch = (todo.link || '').toLowerCase().includes(query);
                const tagMatch =
                    Array.isArray(todo.tags) &&
                    todo.tags.some((t) => String(t).toLowerCase().includes(query));
                const subtaskMatch =
                    Array.isArray(todo.subtasks) &&
                    todo.subtasks.some((st) => (st.title || '').toLowerCase().includes(query));
                if (!titleMatch && !descMatch && !linkMatch && !tagMatch && !subtaskMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [todos, search, selectedTags]);


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
        const { startKey, endKey } = getNextNDaysRange(nextDaysCount);
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
    }, [displayTodos, nextDaysCount]);

    const upcomingTodos = useMemo(() => {
        const { endKey } = getNextNDaysRange(nextDaysCount);
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
    }, [displayTodos, nextDaysCount]);

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
                .filter(
                    (todo) =>
                        todo.completed &&
                        (!todo.recurrence || todo.recurrence === 'none' || todo.recurrenceSeriesId)
                )
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

    const completedMasterTodos = useMemo(
        () =>
            displayTodos
                .filter(
                    (todo) =>
                        todo.completed &&
                        todo.recurrence &&
                        todo.recurrence !== 'none' &&
                        !todo.recurrenceSeriesId
                )
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

        const parsedTags = newTags
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean);

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
                    tags: parsedTags,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to create todo');
            }

            setTodos((currentTodos) => [...currentTodos, data]);
            setNewTodo('');
            setNewTags('');
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

    const handleToggleSubtask = async (todoId, subtaskIndex) => {
        const previousTodos = todos;
        const currentTodo = todos.find((todo) => todo.id === todoId);
        if (!currentTodo || !Array.isArray(currentTodo.subtasks)) return;

        const updatedSubtasks = currentTodo.subtasks.map((subtask, idx) =>
            idx === subtaskIndex ? { ...subtask, completed: !subtask.completed } : subtask
        );

        setTodos((currentTodos) =>
            currentTodos.map((todo) =>
                todo.id === todoId ? { ...todo, subtasks: updatedSubtasks } : todo
            )
        );

        try {
            const updatedTodo = await persistTodoUpdate(todoId, { subtasks: updatedSubtasks });
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
            onToggleSubtask={handleToggleSubtask}
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
            'Completed Master Tasks': t('admin.todoSection.columns.masterTasks', 'Completed Master Tasks'),
            'Completed': t('admin.todoSection.columns.completed', 'Completed'),
        };
        const displayTitle = columnTitleMap[titleKey] || titleKey;
        const isCollapsed = collapsedColumns.has(titleKey);
        const isNextDaysColumn = titleKey === 'Next 3 Days';
        const hasOpenDropdown = isNextDaysColumn && isDaysPickerOpen;
        const nextDaysTitleText = `${t('admin.todoSection.columns.nextPrefix', 'Next')} ${formatNumber(nextDaysCount)} ${nextDaysCount === 1 ? t('admin.todoSection.columns.daySuffixSingular', 'Day') : t('admin.todoSection.columns.daySuffixPlural', 'Days')}`;

        return (
            <div className={`admin-todo-column${isCollapsed ? ' is-collapsed' : ''}${hasOpenDropdown ? ' has-open-dropdown' : ''}`} key={titleKey}>
                <div
                    role="button"
                    tabIndex={0}
                    className={`admin-todo-column-header${isCollapsed ? ' is-collapsed' : ''}${hasOpenDropdown ? ' has-open-dropdown' : ''}`}
                    onClick={() => toggleColumnCollapse(titleKey)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            if (e.target === e.currentTarget) {
                                toggleColumnCollapse(titleKey);
                            }
                        }
                    }}
                    aria-expanded={!isCollapsed}
                    title={
                        isCollapsed
                            ? t('admin.todoSection.showColumn', 'Show column')
                            : t('admin.todoSection.hideColumn', 'Hide column')
                    }
                >
                    {isNextDaysColumn ? (
                        <div
                            ref={daysPickerRef}
                            className={`admin-todo-days-header-wrapper${isDaysPickerOpen ? ' is-open' : ''}`}
                        >
                            <button
                                type="button"
                                className="admin-todo-days-trigger-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDaysPickerOpen((prev) => !prev);
                                }}
                                aria-haspopup="true"
                                aria-expanded={isDaysPickerOpen}
                                title={t('admin.todoSection.changeDaysRange', 'Click to change upcoming days range')}
                            >
                                <span className="admin-todo-column-title admin-todo-days-header-title">
                                    {nextDaysTitleText}
                                </span>
                            </button>

                            {isDaysPickerOpen && (
                                <div
                                    className="admin-todo-days-dropdown-menu"
                                    onClick={(e) => e.stopPropagation()}
                                    role="menu"
                                    aria-label={t('admin.todoSection.changeDaysRange', 'Change upcoming days range')}
                                >
                                    <div className="admin-todo-days-dropdown-header">
                                        {t('admin.todoSection.upcomingRange', 'Show Upcoming')}
                                    </div>
                                    <div className="admin-todo-days-dropdown-list">
                                        {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                role="menuitem"
                                                className={`admin-todo-days-dropdown-item${nextDaysCount === num ? ' is-selected' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleNextDaysChange(num);
                                                    setIsDaysPickerOpen(false);
                                                }}
                                            >
                                                <span className="admin-todo-days-dropdown-label">
                                                    {formatNumber(num)} {num === 1 ? t('admin.todoSection.columns.daySuffixSingular', 'Day') : t('admin.todoSection.columns.daySuffixPlural', 'Days')}
                                                </span>
                                                {nextDaysCount === num && (
                                                    <svg
                                                        className="admin-todo-days-dropdown-check"
                                                        width="13"
                                                        height="13"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="admin-todo-column-title">{displayTitle}</span>
                    )}
                    <div className="admin-todo-column-header-right">
                        <span className="admin-todo-column-count">{formatNumber(items.length)}</span>
                        <span className="admin-todo-column-chevron" aria-hidden="true">
                            <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </span>
                    </div>
                </div>
                {!isCollapsed && (
                    <div className="admin-todo-column-body">
                        {items.map(renderTodoCard)}
                    </div>
                )}
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

                        <label className="admin-todo-tags-field">
                            <span>{t('admin.todoSection.tags', 'Tags')}</span>
                            <input
                                type="text"
                                value={newTags}
                                onChange={(event) => setNewTags(event.target.value)}
                                placeholder={t('admin.todoSection.tagsPlaceholder', 'e.g. work, urgent')}
                                autoComplete="off"
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
                                <option value="low">{t('admin.todoSection.priorities.low', 'Low')}</option>
                                <option value="medium">{t('admin.todoSection.priorities.medium', 'Medium')}</option>
                                <option value="high">{t('admin.todoSection.priorities.high', 'High')}</option>
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
                        <span>{t('admin.todoSection.urgent', 'Urgent')}</span>
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

                    <div className="admin-todo-controls-group">
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

                        {/* Tag Filter Dropdown Button & Popover */}
                        <div className="admin-todo-tag-filter-wrap" ref={tagDropdownRef}>
                            <button
                                type="button"
                                className={`admin-todo-tag-filter-btn ${selectedTags.size > 0 ? 'has-active' : ''} ${isTagDropdownOpen ? 'is-open' : ''}`}
                                onClick={() => setIsTagDropdownOpen((prev) => !prev)}
                                aria-expanded={isTagDropdownOpen}
                                title={t('admin.todoSection.filterByTags', 'Filter by Tags')}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                    <line x1="7" y1="7" x2="7.01" y2="7" />
                                </svg>
                                <span>{t('admin.todoSection.tags', 'Tags')}</span>
                                {selectedTags.size > 0 && (
                                    <span className="admin-todo-tag-filter-badge">
                                        {formatNumber(selectedTags.size)}
                                    </span>
                                )}
                                <svg className={`admin-todo-tag-filter-arrow ${isTagDropdownOpen ? 'rotated' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>

                            {isTagDropdownOpen && (
                                <div className="admin-todo-tag-dropdown-menu">
                                    <div className="admin-todo-tag-dropdown-header">
                                        <span className="admin-todo-tag-dropdown-title">
                                            {t('admin.todoSection.filterByTags', 'Filter by Tags')}
                                        </span>
                                    </div>

                                    {allAvailableTags.length > 5 && (
                                        <div className="admin-todo-tag-dropdown-search">
                                            <input
                                                type="text"
                                                placeholder={t('admin.todoSection.searchTagsPlaceholder', 'Search tags...')}
                                                value={tagFilterSearch}
                                                onChange={(e) => setTagFilterSearch(e.target.value)}
                                                className="admin-todo-tag-dropdown-search-input"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    <div className="admin-todo-tag-dropdown-list">
                                        {allAvailableTags.length === 0 ? (
                                            <div className="admin-todo-tag-dropdown-empty">
                                                {t('admin.todoSection.noTagsFound', 'No tags created yet')}
                                            </div>
                                        ) : filteredDropdownTags.length === 0 ? (
                                            <div className="admin-todo-tag-dropdown-empty">
                                                {t('admin.todoSection.noMatchingSearchTasks', 'No matching tags')}
                                            </div>
                                        ) : (
                                            filteredDropdownTags.map((tag) => {
                                                const isSelected = selectedTags.has(tag.key);
                                                return (
                                                    <button
                                                        key={tag.key}
                                                        type="button"
                                                        className={`admin-todo-tag-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                                                        onClick={() => toggleTag(tag.key)}
                                                    >
                                                        <span className={`admin-todo-tag-checkbox ${isSelected ? 'checked' : ''}`}>
                                                            {isSelected && (
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="admin-todo-tag-dropdown-item-name">
                                                            {tag.label}
                                                        </span>
                                                        <span className="admin-todo-tag-dropdown-item-count">
                                                            {formatNumber(tag.count)}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {allAvailableTags.length > 0 && (
                                        <div className="admin-todo-tag-dropdown-footer">
                                            <span className="admin-todo-tag-dropdown-summary">
                                                {t('admin.todoSection.selectedCount', '{count} selected').replace('{count}', formatNumber(selectedTags.size))}
                                            </span>
                                            <div className="admin-todo-tag-dropdown-footer-actions">
                                                {selectedTags.size < allAvailableTags.length && (
                                                    <button
                                                        type="button"
                                                        className="admin-todo-tag-dropdown-select-all-btn"
                                                        onClick={selectAllTags}
                                                    >
                                                        {t('admin.todoSection.selectAllTags', 'Select All')}
                                                    </button>
                                                )}
                                                {selectedTags.size > 0 && (
                                                    <button
                                                        type="button"
                                                        className="admin-todo-tag-dropdown-clear-btn"
                                                        onClick={clearAllTags}
                                                    >
                                                        {t('admin.todoSection.clearTags', 'Clear')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <p className="admin-loading-text">{t('admin.todoSection.loading', 'Loading tasks...')}</p>
            ) : todos.length === 0 ? (
                <p className="admin-empty">{t('admin.todoSection.empty', 'No tasks yet. Add your first one above.')}</p>
            ) : displayTodos.length === 0 ? (
                <p className="admin-empty">
                    {selectedTags.size > 0 && search
                        ? t('admin.todoSection.noMatchingFilterTasks', 'No tasks match your search and tag filters.')
                        : selectedTags.size > 0
                        ? t('admin.todoSection.noMatchingTagTasks', 'No tasks match this tag filter.')
                        : t('admin.todoSection.noMatchingSearchTasks', 'No tasks match your search.')}
                </p>
            ) : (
                <div className="admin-todo-board">
                    {activeTab === 'other' && (
                        <>
                            {renderColumn('Scheduled', scheduledTodos)}
                            {renderColumn('Completed Master Tasks', completedMasterTodos)}
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
