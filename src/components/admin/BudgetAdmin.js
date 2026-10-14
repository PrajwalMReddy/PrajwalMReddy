import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import BudgetStats from './BudgetStats';
import ExpenseTable from './ExpenseTable';
import IncomeTable from './IncomeTable';
import BudgetPlanner from './BudgetPlanner';
import { budgetApi } from '../../utils/budgetApi';

const VALID_TAB_IDS = ['expenses', 'income', 'statistics', 'planner'];

const normalizeTab = (tab) => {
    if (!tab) return 'expenses';
    const lower = tab.toLowerCase();
    if (lower === 'stats') return 'statistics';
    if (VALID_TAB_IDS.includes(lower)) return lower;
    return 'expenses';
};

const BudgetAdmin = () => {
    const { t } = useContent();
    const { tab: urlTab } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState(() => normalizeTab(urlTab));

    useEffect(() => {
        const resolved = normalizeTab(urlTab);
        setActiveTab(resolved);
    }, [urlTab]);

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
        navigate(`/admin/budget/${tabId}`);
    };

    const tabs = [
        { id: 'expenses', label: t('admin.budgetSection.tabs.expenses', 'Expenses') },
        { id: 'income', label: t('admin.budgetSection.tabs.income', 'Income') },
        { id: 'statistics', label: t('admin.budgetSection.tabs.statistics', 'Statistics') },
        { id: 'planner', label: t('admin.budgetSection.tabs.planner', 'Planner') },
    ];
    const [expenses, setExpenses] = useState([]);
    const [income, setIncome] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        setError('');
        try {
            const [expensesData, incomeData, statsData] = await Promise.all([
                budgetApi.getExpenses(),
                budgetApi.getIncome(),
                budgetApi.getStats(),
            ]);
            setExpenses(expensesData);
            setIncome(incomeData);
            setStats(statsData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        document.title = t('pageTitles.adminBudget', 'Budget | Admin | Prajwal Reddy');
    }, [t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = async () => {
        await loadData();
    };

    return (
        <AdminLayout title={t('admin.budgetSection.title', 'Budget Manager')}>
            <div className="admin-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={activeTab === tab.id ? 'active' : ''}
                        onClick={() => handleTabClick(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && <p className="admin-loading-text">{t('admin.budgetSection.loading', 'Loading budget data...')}</p>}
            {error && <p className="admin-error">{error}</p>}

            {!loading && !error && (
                <>
                    {activeTab === 'expenses' && (
                        <ExpenseTable expenses={expenses} onRefresh={handleRefresh} />
                    )}
                    {activeTab === 'income' && (
                        <IncomeTable income={income} onRefresh={handleRefresh} />
                    )}
                    {activeTab === 'statistics' && <BudgetStats stats={stats} />}
                    {activeTab === 'planner' && <BudgetPlanner expenses={expenses} onRefresh={handleRefresh} />}
                </>
            )}
        </AdminLayout>
    );
};

export default BudgetAdmin;
