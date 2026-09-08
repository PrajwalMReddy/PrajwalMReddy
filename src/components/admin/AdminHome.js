import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import AdminLayout from './AdminLayout';
import AIAssistant from '../AIAssistant';
import DashboardHeader from './dashboard/DashboardHeader';
import DashboardFocus from './dashboard/DashboardFocus';
import DashboardContext from './dashboard/DashboardContext';
import { fetchDailyBriefing, checkAIHealth } from '../../utils/aiApi';

import { AlertTriangleIcon, SparklesIcon, XIcon } from './AdminIcons';
import './dashboard/dashboard.css';

const AdminHome = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [data, setData] = useState({
        tasks: [],
        notes: [],
        expenses: [],
        income: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [assistantQuery, setAssistantQuery] = useState('');

    // Briefing state
    const [briefing, setBriefing] = useState(null);
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [isAIOffline, setIsAIOffline] = useState(false);

    // AI Assistant state (on-demand drawer dialog)
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
    const [aiInitialPrompt, setAiInitialPrompt] = useState('');
    const [aiAutoTriggerAction, setAiAutoTriggerAction] = useState(null);

    // Check actual client AI connectivity on mount
    useEffect(() => {
        checkAIHealth()
            .then((h) => {
                if (h?.status === 'connected') {
                    setIsAIOffline(false);
                }
            })
            .catch(() => {});
    }, []);

    const loadBriefing = useCallback(async (forceRefresh = false) => {
        setBriefingLoading(true);
        try {
            const res = await fetchDailyBriefing(forceRefresh);
            setBriefing(res);
            // Verify real AI connectivity: if browser can reach local Ollama or server proxy, AI is NOT offline
            const health = await checkAIHealth().catch(() => ({ status: 'offline' }));
            if (health?.status === 'connected') {
                setIsAIOffline(false);
            } else {
                setIsAIOffline(Boolean(res?.offlineNotice));
            }
        } catch (err) {
            const health = await checkAIHealth().catch(() => ({ status: 'offline' }));
            setIsAIOffline(health?.status !== 'connected');
        } finally {
            setBriefingLoading(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [tasksRes, notesRes, expensesRes, incomeRes] = await Promise.all([
                fetch('/api/todo', { credentials: 'include' }),
                fetch('/api/notes', { credentials: 'include' }),
                fetch('/api/budget/expenses', { credentials: 'include' }),
                fetch('/api/budget/income', { credentials: 'include' }),
            ]);

            const [tasks, notes, expenses, income] = await Promise.all([
                tasksRes.ok ? tasksRes.json() : [],
                notesRes.ok ? notesRes.json() : [],
                expensesRes.ok ? expensesRes.json() : [],
                incomeRes.ok ? incomeRes.json() : [],
            ]);

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
        loadBriefing(false);
    }, [fetchData, loadBriefing]);

    const handleToggleTask = async (taskId, currentCompleted) => {
        const nextState = !currentCompleted;
        setData((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t._id === taskId || t.id === taskId ? { ...t, completed: nextState } : t)),
        }));

        try {
            const res = await fetch(`/api/todo/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ completed: nextState }),
            });
            if (!res.ok) throw new Error('Update failed');
        } catch (err) {
            console.error('Failed to toggle task:', err);
            setData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((t) => (t._id === taskId || t.id === taskId ? { ...t, completed: currentCompleted } : t)),
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

        const overdueTasks = activeTasks.filter((t) => {
            if (!t.dueDate) return false;
            const due = t.dueDate.split('T')[0];
            return due < todayStr;
        });

        const todayTasks = activeTasks.filter((t) => {
            if (!t.dueDate) return false;
            return t.dueDate.startsWith(todayStr);
        });

        const upcomingTasks = activeTasks
            .filter((t) => {
                if (!t.dueDate) return false;
                const due = t.dueDate.split('T')[0];
                return due > todayStr;
            })
            .sort((a, b) => {
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
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
            upcomingTasks,
            activeTasks,
            completedList: completedTasks,
            totalNotes: data.notes.length,
            monthSpending: totalSpending,
            monthExpenseCount: monthExpenses.length,
            totalIncome,
            incomeEntries: monthIncome.length,
        };
    }, [data]);

    // Calculate days behind for oldest overdue task
    const oldestOverdueDays = useMemo(() => {
        if (!metrics.overdueTasks.length) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let maxDays = 0;
        for (const t of metrics.overdueTasks) {
            if (!t.dueDate) continue;
            const datePart = t.dueDate.split('T')[0];
            const [year, month, day] = datePart.split('-');
            const due = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            due.setHours(0, 0, 0, 0);
            const days = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            if (days > maxDays) maxDays = days;
        }
        return maxDays > 0 ? maxDays : null;
    }, [metrics.overdueTasks]);

    // Editorial, synthesized AI insight
    const aiInsight = useMemo(() => {
        if (briefing?.summary?.body && !briefing.summary.body.includes('You have')) {
            return briefing.summary.body;
        }
        if (metrics.overdueTasks.length > 0) {
            const top = metrics.overdueTasks[0];
            const days = oldestOverdueDays;
            const remaining = metrics.overdueTasks.length - 1;
            return `Finish ${top.title} first — it's ${top.priority || 'high'} priority and ${days ? `${days} days overdue` : 'overdue'}.${remaining > 0 ? ` Then clear the remaining ${remaining} overdue item${remaining > 1 ? 's' : ''}.` : ''}`;
        }
        if (metrics.todayTasks.length > 0) {
            const top = metrics.todayTasks[0];
            return `Start with ${top.title} (${top.priority || 'medium'} priority) for today.`;
        }
        return null;
    }, [briefing, metrics.overdueTasks, metrics.todayTasks, oldestOverdueDays]);

    const recentTransactions = useMemo(() => {
        const expenses = (data.expenses || []).map((e) => ({ ...e, isIncome: false }));
        const income = (data.income || []).map((i) => ({ ...i, item: i.item || i.source || 'Income', isIncome: true }));
        return [...expenses, ...income]
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, 5);
    }, [data.expenses, data.income]);

    const handleOpenAI = (prompt = '', action = null) => {
        setAiInitialPrompt(prompt);
        setAiAutoTriggerAction(action);
        setIsAIAssistantOpen(true);
    };

    const handleAssistantSubmit = (e) => {
        e.preventDefault();
        handleOpenAI(assistantQuery.trim() || undefined);
        setAssistantQuery('');
    };

    const handleCloseAI = () => {
        setIsAIAssistantOpen(false);
        setAiInitialPrompt('');
        setAiAutoTriggerAction(null);
    };

    if (loading) {
        return (
            <AdminLayout title="Admin Dashboard">
                <div className="dash-loading-wrapper">
                    <p className="admin-loading-text">Opening your workspace...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Admin Dashboard">
            <div className="dash-workspace">
                {/* 1. Greeting Header */}
                <DashboardHeader
                    userName={user?.name || user?.username || ''}
                    overdueCount={metrics.overdueCount}
                    todayCount={metrics.todayCount}
                    oldestOverdueDays={oldestOverdueDays}
                    aiStatus={{
                        isOffline: isAIOffline,
                        isRefreshing: briefingLoading,
                        onRetry: () => loadBriefing(true),
                    }}
                    onRefresh={() => {
                        fetchData();
                        loadBriefing(true);
                    }}
                />

                {/* 2. AI Assistant Section: Compact Bar or Expanded In-Page Chat */}
                {!isAIAssistantOpen ? (
                    <div className="dash-top-assistant-bar">
                        <form onSubmit={handleAssistantSubmit} className="dash-assistant-form">
                            <div className="dash-assistant-icon" aria-hidden="true">
                                <SparklesIcon width={16} height={16} />
                            </div>
                            <input
                                type="text"
                                className="dash-assistant-input"
                                placeholder="Ask assistant anything, plan your week, or check goals..."
                                value={assistantQuery}
                                onChange={(e) => setAssistantQuery(e.target.value)}
                                aria-label="Ask assistant"
                            />
                            <button type="submit" className="dash-assistant-submit-btn">
                                Ask
                            </button>
                            <button
                                type="button"
                                className="dash-assistant-expand-btn"
                                onClick={() => handleOpenAI()}
                                title="Expand chat interface in page"
                            >
                                Expand Chat ↗
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="dash-embedded-ai-wrap">
                        <AIAssistant
                            isOpen={true}
                            onClose={handleCloseAI}
                            onTaskCreated={fetchData}
                            onNoteCreated={fetchData}
                            embedded={true}
                            initialPrompt={aiInitialPrompt}
                            autoTriggerAction={aiAutoTriggerAction}
                        />
                    </div>
                )}

                {error && (
                    <div className="dash-alert dash-alert-error" role="alert">
                        <AlertTriangleIcon width={15} height={15} />
                        <span>{error}</span>
                        <button type="button" onClick={() => setError('')} className="dash-alert-dismiss" aria-label="Dismiss alert">
                            <XIcon width={13} height={13} />
                        </button>
                    </div>
                )}

                {/* 3. Main Two-Column Workspace (Focus on Left, Ambient Context on Right) */}
                <div className="dash-workspace-grid">
                    {/* Main Column: Clear Focus Area */}
                    <div className="dash-grid-primary">
                        <DashboardFocus
                            overdueTasks={metrics.overdueTasks}
                            todayTasks={metrics.todayTasks}
                            upcomingTasks={metrics.upcomingTasks}
                            aiInsight={aiInsight}
                            onToggleTask={handleToggleTask}
                            onNavigate={navigate}
                        />
                    </div>

                    {/* Secondary Column: Compact Ambient Context */}
                    <div className="dash-grid-secondary">
                        <DashboardContext
                            weather={briefing?.weather || []}
                            news={briefing?.news || []}
                            recentNote={data.notes[0] || null}
                            monthSpending={metrics.monthSpending}
                            monthIncome={metrics.totalIncome}
                            recentTransactions={recentTransactions}
                        />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminHome;
