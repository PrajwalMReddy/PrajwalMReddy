import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../../utils/AuthContext';
import AdminLayout from './AdminLayout';
import AIAssistant from '../AIAssistant';
import {
    TasksIcon,
    NotesIcon,
    SpendingIcon,
    IncomeIcon,
    SearchIcon,
    PlusIcon,
    RefreshIcon,
    ClockIcon,
    AlertTriangleIcon,
    CheckCircleIcon,
    ArrowRightIcon,
    XIcon,
} from './AdminIcons';

const AdminHome = () => {
    const {user} = useAuth();
    const navigate = useNavigate();

    const [data, setData] = useState({
        tasks: [], notes: [], expenses: [], income: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTaskTab, setActiveTaskTab] = useState('today'); // 'today' | 'overdue' | 'all'
    const [activeFeedTab, setActiveFeedTab] = useState('notes'); // 'notes' | 'expenses'
    const [quickModal, setQuickModal] = useState(null); // 'task' | 'note' | 'expense' | null

    // Form inputs for modal
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemPriority, setNewItemPriority] = useState('medium');
    const [newItemDueDate, setNewItemDueDate] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('General');
    const [newItemAmount, setNewItemAmount] = useState('');
    const [newItemFolder, setNewItemFolder] = useState('');
    const [newItemContent, setNewItemContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [tasksRes, notesRes, expensesRes, incomeRes] = await Promise.all([fetch('/api/todo', {credentials: 'include'}), fetch('/api/notes', {credentials: 'include'}), fetch('/api/budget/expenses', {credentials: 'include'}), fetch('/api/budget/income', {credentials: 'include'}),]);

            const [tasks, notes, expenses, income] = await Promise.all([tasksRes.ok ? tasksRes.json() : [], notesRes.ok ? notesRes.json() : [], expensesRes.ok ? expensesRes.json() : [], incomeRes.ok ? incomeRes.json() : [],]);

            setData({
                tasks: Array.isArray(tasks) ? tasks : [],
                notes: Array.isArray(notes) ? notes : [],
                expenses: Array.isArray(expenses) ? expenses : [],
                income: Array.isArray(income) ? income : [],
            });
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Could not load all dashboard data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleTask = async (taskId, currentCompleted) => {
        const nextState = !currentCompleted;
        setData((prev) => ({
            ...prev, tasks: prev.tasks.map((t) => (t._id === taskId ? {...t, completed: nextState} : t)),
        }));

        try {
            const res = await fetch(`/api/todo/${taskId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({completed: nextState}),
            });
            if (!res.ok) throw new Error('Update failed');
        } catch (err) {
            console.error('Failed to toggle task:', err);
            setData((prev) => ({
                ...prev, tasks: prev.tasks.map((t) => (t._id === taskId ? {...t, completed: currentCompleted} : t)),
            }));
        }
    };

    const metrics = useMemo(() => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const activeTasks = data.tasks.filter((t) => !t.completed);
        const completedTasks = data.tasks.filter((t) => t.completed);

        const todayTasks = activeTasks.filter((t) => {
            if (!t.dueDate) return false;
            return t.dueDate.startsWith(todayStr);
        });

        const overdueTasks = activeTasks.filter((t) => {
            if (!t.dueDate) return false;
            const due = t.dueDate.split('T')[0];
            return due < todayStr;
        });

        const monthExpenses = data.expenses.filter((e) => {
            if (!e.date) return false;
            const d = new Date(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const totalSpending = monthExpenses.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);

        const monthIncome = data.income.filter((item) => {
            if (!item.date) return false;

            const d = new Date(item.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const totalIncome = monthIncome.reduce((sum, item) => {
            const val = item.value !== undefined ? parseFloat(item.value) : parseFloat(item.amount) || 0;

            return sum + (Number.isNaN(val) ? 0 : val);
        }, 0);


        return {
            totalTasks: activeTasks.length,
            completedTasks: completedTasks.length,
            todayCount: todayTasks.length,
            overdueCount: overdueTasks.length,
            todayTasks,
            overdueTasks,
            activeTasks,
            totalNotes: data.notes.length,
            monthSpending: totalSpending,
            monthExpenseCount: monthExpenses.length,
            totalIncome,
            incomeEntries: monthIncome.length,
        };
    }, [data]);

    // Live search results
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return null;

        const matchedTasks = data.tasks.filter((t) => (t.title || '').toLowerCase().includes(q)).slice(0, 5);
        const matchedNotes = data.notes.filter((n) => (n.title || '').toLowerCase().includes(q)).slice(0, 5);
        const matchedExpenses = data.expenses.filter((e) => (e.item || '').toLowerCase().includes(q)).slice(0, 5);

        return {
            tasks: matchedTasks,
            notes: matchedNotes,
            expenses: matchedExpenses,
            total: matchedTasks.length + matchedNotes.length + matchedExpenses.length,
        };
    }, [searchQuery, data]);

    const handleCreateQuickItem = async (e) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;

        setIsSubmitting(true);
        try {
            if (quickModal === 'task') {
                const res = await fetch('/api/todo', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    credentials: 'include',
                    body: JSON.stringify({
                        title: newItemTitle.trim(),
                        priority: newItemPriority,
                        dueDate: newItemDueDate || null,
                        completed: false,
                    }),
                });
                if (!res.ok) throw new Error('Failed to add task');
                const newTask = await res.json();
                setData((prev) => ({...prev, tasks: [newTask, ...prev.tasks]}));
            } else if (quickModal === 'note') {
                const res = await fetch('/api/notes', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    credentials: 'include',
                    body: JSON.stringify({
                        title: newItemTitle.trim(), content: newItemContent, folder: newItemFolder.trim() || 'General',
                    }),
                });
                if (!res.ok) throw new Error('Failed to create note');
                const newNote = await res.json();
                setData((prev) => ({...prev, notes: [newNote, ...prev.notes]}));
            } else if (quickModal === 'expense') {
                const res = await fetch('/api/budget/expenses', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    credentials: 'include',
                    body: JSON.stringify({
                        item: newItemTitle.trim(),
                        cost: parseFloat(newItemAmount) || 0,
                        category: newItemCategory,
                        date: newItemDueDate || new Date().toISOString(),
                    }),
                });
                if (!res.ok) throw new Error('Failed to record expense');
                const newExpense = await res.json();
                setData((prev) => ({...prev, expenses: [newExpense, ...prev.expenses]}));
            }

            closeQuickModal();
        } catch (err) {
            alert(`Creation failed: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeQuickModal = () => {
        setQuickModal(null);
        setNewItemTitle('');
        setNewItemPriority('medium');
        setNewItemDueDate('');
        setNewItemCategory('General');
        setNewItemAmount('');
        setNewItemFolder('');
        setNewItemContent('');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0,
        }).format(val || 0);
    };

    const displayedTasks = useMemo(() => {
        if (activeTaskTab === 'today') return metrics.todayTasks;
        if (activeTaskTab === 'overdue') return metrics.overdueTasks;
        return metrics.activeTasks.slice(0, 10);
    }, [activeTaskTab, metrics]);

    if (loading) {
        return (<AdminLayout title="Dashboard">
            <div className="dash-loading-wrapper">
                <p className="admin-loading-text">Loading dashboard...</p>
            </div>
        </AdminLayout>);
    }

    return (<AdminLayout title="Dashboard">
        <div className="dash-shell">
            {/* 1. Subheader Row */}
            <div className="dash-header">
                <div className="dash-header-greeting">
                    <p className="dash-date">
                        <span>{formattedDate}</span>
                        <span className="dash-date-divider">•</span>
                        <span className="dash-greeting-label">{getGreeting()}, {user?.name || 'Prajwal'}</span>
                    </p>
                </div>

                <div className="dash-header-controls">
                    {/* Search Bar */}
                    <div className="dash-search-box">
                        <SearchIcon width={15} height={15} className="dash-search-icon"/>
                        <input
                            type="search"
                            className="dash-search-input"
                            placeholder="Search tasks, notes, budget..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search dashboard"
                        />
                        {searchQuery && (<button
                            type="button"
                            className="dash-search-clear"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                        >
                            <XIcon width={13} height={13}/>
                        </button>)}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="dash-quick-btns">
                        <button
                            type="button"
                            className="dash-btn dash-btn-secondary"
                            onClick={() => setQuickModal('task')}
                        >
                            <PlusIcon width={13} height={13}/>
                            <span>Task</span>
                        </button>
                        <button
                            type="button"
                            className="dash-btn dash-btn-secondary"
                            onClick={() => setQuickModal('note')}
                        >
                            <PlusIcon width={13} height={13}/>
                            <span>Note</span>
                        </button>
                        <button
                            type="button"
                            className="dash-btn dash-btn-secondary"
                            onClick={() => setQuickModal('expense')}
                        >
                            <PlusIcon width={13} height={13}/>
                            <span>Expense</span>
                        </button>
                        <button
                            type="button"
                            className="dash-btn-icon"
                            onClick={fetchData}
                            title="Refresh dashboard data"
                            aria-label="Refresh data"
                        >
                            <RefreshIcon width={14} height={14}/>
                        </button>
                    </div>
                </div>
            </div>

            {error && (<div className="dash-alert dash-alert-error">
                <AlertTriangleIcon width={16} height={16}/>
                <span>{error}</span>
                <button type="button" onClick={() => setError('')} className="dash-alert-dismiss">
                    <XIcon width={14} height={14}/>
                </button>
            </div>)}

            {/* Live Search Results Overlay */}
            {searchResults && (<div className="dash-search-results-panel">
                <div className="dash-search-results-header">
                    <h3>Search results for "{searchQuery}" ({searchResults.total})</h3>
                    <button type="button" onClick={() => setSearchQuery('')}>Close</button>
                </div>
                {searchResults.total === 0 ? (<p className="admin-empty">No items found matching your search.</p>) : (
                    <div className="dash-search-results-grid">
                        {searchResults.tasks.length > 0 && (<div className="dash-search-col">
                            <h4>Tasks</h4>
                            {searchResults.tasks.map((t) => (<div key={t._id} className="dash-search-item"
                                                                  onClick={() => navigate('/admin/todo')}>
                                <span>{t.title}</span>
                                <span
                                    className={`badge-pill badge-${t.priority || 'medium'}`}>{t.priority}</span>
                            </div>))}
                        </div>)}
                        {searchResults.notes.length > 0 && (<div className="dash-search-col">
                            <h4>Notes</h4>
                            {searchResults.notes.map((n) => (<div key={n._id} className="dash-search-item"
                                                                  onClick={() => navigate('/admin/notes')}>
                                <span>{n.title}</span>
                                <span
                                    className="dash-tag dash-tag-neutral">{n.folder || 'General'}</span>
                            </div>))}
                        </div>)}
                        {searchResults.expenses.length > 0 && (<div className="dash-search-col">
                            <h4>Expenses</h4>
                            {searchResults.expenses.map((e) => (<div key={e._id} className="dash-search-item"
                                                                     onClick={() => navigate('/admin/budget')}>
                                <span>{e.item}</span>
                                <span
                                    className="dash-search-cost">${parseFloat(e.cost || 0).toFixed(0)}</span>
                            </div>))}
                        </div>)}
                    </div>)}
            </div>)}

            {/* 2. Key Metrics Row (Modernized Stat Cards) */}
            <div className="dash-metrics-row">
                <div className="dash-metric-card" onClick={() => navigate('/admin/todo')}>
                    <div className="dash-metric-top">
                        <span className="dash-metric-label">Tasks</span>
                        <div className="dash-metric-icon-wrap icon-tasks">
                            <TasksIcon width={16} height={16}/>
                        </div>
                    </div>
                    <div className="dash-metric-value">{metrics.totalTasks}</div>
                    <div className="dash-metric-tags">
                        {metrics.todayCount > 0 && (<span className="dash-tag dash-tag-today">
                                    <ClockIcon width={10} height={10}/> {metrics.todayCount} today
                                </span>)}
                        {metrics.overdueCount > 0 && (<span className="dash-tag dash-tag-overdue">
                                    <AlertTriangleIcon width={10} height={10}/> {metrics.overdueCount} overdue
                                </span>)}
                        <span className="dash-tag dash-tag-neutral">
                                <CheckCircleIcon width={10} height={10}/> {metrics.completedTasks} done
                            </span>
                    </div>
                </div>

                <div className="dash-metric-card" onClick={() => navigate('/admin/notes')}>
                    <div className="dash-metric-top">
                        <span className="dash-metric-label">Notes</span>
                        <div className="dash-metric-icon-wrap icon-notes">
                            <NotesIcon width={16} height={16}/>
                        </div>
                    </div>
                    <div className="dash-metric-value">{metrics.totalNotes}</div>
                    <div className="dash-metric-tags">
                        <span className="dash-tag dash-tag-neutral">All documents</span>
                    </div>
                </div>

                <div className="dash-metric-card" onClick={() => navigate('/admin/budget')}>
                    <div className="dash-metric-top">
                        <span className="dash-metric-label">Income (Month)</span>
                        <div className="dash-metric-icon-wrap icon-income">
                            <IncomeIcon width={16} height={16}/>
                        </div>
                    </div>
                    <div className="dash-metric-value">{formatCurrency(metrics.totalIncome)}</div>
                    <div className="dash-metric-tags">
                        <span className="dash-tag dash-tag-income">{metrics.incomeEntries} entries</span>
                    </div>
                </div>

                <div className="dash-metric-card" onClick={() => navigate('/admin/budget')}>
                    <div className="dash-metric-top">
                        <span className="dash-metric-label">Expenses (Month)</span>
                        <div className="dash-metric-icon-wrap icon-spending">
                            <SpendingIcon width={16} height={16}/>
                        </div>
                    </div>
                    <div className="dash-metric-value">{formatCurrency(metrics.monthSpending)}</div>
                    <div className="dash-metric-tags">
                        <span className="dash-tag dash-tag-neutral">{metrics.monthExpenseCount} items</span>
                    </div>
                </div>
            </div>

            {/* 3. Main Two-Column Layout: Integrated AI Chat (Left) + Tasks/Overview (Right) */}
            <div className="dash-content-grid">
                {/* Integrated AI Assistant */}
                <div className="dash-column-ai">
                    <AIAssistant embedded={true} onTaskCreated={fetchData}/>
                </div>

                {/* Right Column: Tasks & Recent Activity */}
                <div className="dash-column-overview">
                    {/* Priority Tasks Panel */}
                    <div className="dash-panel">
                        <div className="dash-panel-header">
                            <div className="dash-panel-title-group">
                                <TasksIcon width={16} height={16}/>
                                <h2 className="dash-panel-title">Tasks</h2>
                            </div>
                            <div className="dash-panel-tabs">
                                <button
                                    type="button"
                                    className={`dash-tab-btn ${activeTaskTab === 'today' ? 'active' : ''}`}
                                    onClick={() => setActiveTaskTab('today')}
                                >
                                    Today ({metrics.todayCount})
                                </button>
                                <button
                                    type="button"
                                    className={`dash-tab-btn ${activeTaskTab === 'overdue' ? 'active' : ''} ${metrics.overdueCount > 0 ? 'has-badge' : ''}`}
                                    onClick={() => setActiveTaskTab('overdue')}
                                >
                                    Overdue ({metrics.overdueCount})
                                </button>
                                <button
                                    type="button"
                                    className={`dash-tab-btn ${activeTaskTab === 'all' ? 'active' : ''}`}
                                    onClick={() => setActiveTaskTab('all')}
                                >
                                    All Active
                                </button>
                            </div>
                        </div>

                        <div className="dash-panel-body">
                            {displayedTasks.length === 0 ? (<div className="dash-empty-state">
                                <CheckCircleIcon width={24} height={24} className="dash-empty-icon"/>
                                <span>No tasks in this list. You're all caught up!</span>
                            </div>) : (<ul className="dash-task-list">
                                {displayedTasks.map((task) => {
                                    const isOverdue = metrics.overdueTasks.some((t) => t._id === task._id);
                                    const isToday = metrics.todayTasks.some((t) => t._id === task._id);

                                    return (<li
                                        key={task._id}
                                        className={`dash-task-item ${isOverdue ? 'is-overdue' : ''} ${task.priority === 'high' ? 'priority-high' : ''}`}
                                    >
                                        <label className="dash-checkbox-wrap" title="Toggle complete">
                                            <input
                                                type="checkbox"
                                                className="dash-task-checkbox"
                                                checked={Boolean(task.completed)}
                                                onChange={() => handleToggleTask(task._id, task.completed)}
                                            />
                                            <span className="dash-checkbox-custom"/>
                                        </label>

                                        <div
                                            className="dash-task-main"
                                            onClick={() => navigate('/admin/todo')}
                                        >
                                            <span className="dash-task-name">{task.title}</span>
                                            {isOverdue && <span
                                                className="dash-task-date-overdue">Due {task.dueDate ? task.dueDate.split('T')[0].slice(5) : ''}</span>}
                                            {isToday && !isOverdue &&
                                                <span className="dash-task-date-today">Today</span>}
                                        </div>

                                        <span className={`badge-pill badge-${task.priority || 'medium'}`}>
                                                        {(task.priority || 'medium').toUpperCase()}
                                                    </span>
                                    </li>);
                                })}
                            </ul>)}
                        </div>

                        <div className="dash-panel-footer">
                            <button
                                type="button"
                                className="dash-footer-link"
                                onClick={() => navigate('/admin/todo')}
                            >
                                <span>Manage all tasks in To-Do</span>
                                <ArrowRightIcon width={13} height={13}/>
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity Panel */}
                    <div className="dash-panel">
                        <div className="dash-panel-header">
                            <div className="dash-panel-tabs">
                                <button
                                    type="button"
                                    className={`dash-tab-btn ${activeFeedTab === 'notes' ? 'active' : ''}`}
                                    onClick={() => setActiveFeedTab('notes')}
                                >
                                    Recent Notes ({data.notes.length})
                                </button>
                                <button
                                    type="button"
                                    className={`dash-tab-btn ${activeFeedTab === 'expenses' ? 'active' : ''}`}
                                    onClick={() => setActiveFeedTab('expenses')}
                                >
                                    Recent Expenses ({data.expenses.length})
                                </button>
                            </div>
                        </div>

                        <div className="dash-panel-body">
                            {activeFeedTab === 'notes' ? (<ul className="dash-feed-list">
                                {data.notes.slice(0, 4).map((note) => (<li
                                    key={note._id}
                                    className="dash-feed-item"
                                    onClick={() => navigate('/admin/notes')}
                                >
                                    <div className="dash-feed-icon-wrap">
                                        <NotesIcon width={14} height={14}/>
                                    </div>
                                    <div className="dash-feed-main">
                                        <h3 className="dash-feed-title">{note.title}</h3>
                                        <span
                                            className="dash-feed-meta">Folder: {note.folder || 'General'}</span>
                                    </div>
                                    <ArrowRightIcon width={13} height={13} className="dash-feed-arrow"/>
                                </li>))}
                            </ul>) : (<ul className="dash-feed-list">
                                {data.expenses.slice(0, 4).map((exp) => (<li
                                    key={exp._id}
                                    className="dash-feed-item"
                                    onClick={() => navigate('/admin/budget')}
                                >
                                    <div className="dash-feed-icon-wrap">
                                        <SpendingIcon width={14} height={14}/>
                                    </div>
                                    <div className="dash-feed-main">
                                        <h3 className="dash-feed-title">{exp.item}</h3>
                                        <span
                                            className="dash-feed-meta">{exp.category || 'General'} &bull; {exp.date ? exp.date.split('T')[0] : ''}</span>
                                    </div>
                                    <span
                                        className="dash-feed-cost">${parseFloat(exp.cost || 0).toFixed(0)}</span>
                                </li>))}
                            </ul>)}
                        </div>

                        <div className="dash-panel-footer">
                            <button
                                type="button"
                                className="dash-footer-link"
                                onClick={() => navigate(activeFeedTab === 'notes' ? '/admin/notes' : '/admin/budget')}
                            >
                                <span>View all {activeFeedTab === 'notes' ? 'notes' : 'budget records'}</span>
                                <ArrowRightIcon width={13} height={13}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Add Modal */}
            {quickModal && (<div className="dash-modal-backdrop" onClick={closeQuickModal}>
                <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="dash-modal-header">
                        <h3>
                            {quickModal === 'task' && 'Add New Task'}
                            {quickModal === 'note' && 'Create New Note'}
                            {quickModal === 'expense' && 'Record New Expense'}
                        </h3>
                        <button type="button" onClick={closeQuickModal} className="dash-modal-close">
                            <XIcon width={16} height={16}/>
                        </button>
                    </div>

                    <form onSubmit={handleCreateQuickItem} className="dash-modal-form">
                        <div className="dash-form-group">
                            <label>
                                {quickModal === 'task' && 'Task Title *'}
                                {quickModal === 'note' && 'Note Title *'}
                                {quickModal === 'expense' && 'Item Description *'}
                            </label>
                            <input
                                type="text"
                                required
                                autoFocus
                                value={newItemTitle}
                                onChange={(e) => setNewItemTitle(e.target.value)}
                                placeholder="Enter title..."
                            />
                        </div>

                        {quickModal === 'task' && (<div className="dash-form-row">
                            <div className="dash-form-group">
                                <label>Priority</label>
                                <select
                                    value={newItemPriority}
                                    onChange={(e) => setNewItemPriority(e.target.value)}
                                >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                            <div className="dash-form-group">
                                <label>Due Date</label>
                                <input
                                    type="date"
                                    value={newItemDueDate}
                                    onChange={(e) => setNewItemDueDate(e.target.value)}
                                />
                            </div>
                        </div>)}

                        {quickModal === 'note' && (<>
                            <div className="dash-form-group">
                                <label>Folder</label>
                                <input
                                    type="text"
                                    value={newItemFolder}
                                    onChange={(e) => setNewItemFolder(e.target.value)}
                                    placeholder="e.g. Work, Ideas..."
                                />
                            </div>
                            <div className="dash-form-group">
                                <label>Content</label>
                                <textarea
                                    rows={3}
                                    value={newItemContent}
                                    onChange={(e) => setNewItemContent(e.target.value)}
                                    placeholder="Write note..."
                                />
                            </div>
                        </>)}

                        {quickModal === 'expense' && (<div className="dash-form-row">
                            <div className="dash-form-group">
                                <label>Cost ($) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={newItemAmount}
                                    onChange={(e) => setNewItemAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="dash-form-group">
                                <label>Category</label>
                                <select
                                    value={newItemCategory}
                                    onChange={(e) => setNewItemCategory(e.target.value)}
                                >
                                    <option value="General">General</option>
                                    <option value="Food">Food</option>
                                    <option value="Groceries">Groceries</option>
                                    <option value="Transport">Transport</option>
                                    <option value="Utilities">Utilities</option>
                                    <option value="Shopping">Shopping</option>
                                </select>
                            </div>
                        </div>)}

                        <div className="dash-modal-footer">
                            <button type="button" className="dash-btn-cancel" onClick={closeQuickModal}>
                                Cancel
                            </button>
                            <button type="submit" className="dash-btn-submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Create Item'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>)}
        </div>
    </AdminLayout>);
};

export default AdminHome;
