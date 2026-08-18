import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import BudgetStats from './BudgetStats';
import ExpenseTable from './ExpenseTable';
import IncomeTable from './IncomeTable';
import BudgetPlanner from './BudgetPlanner';
import { budgetApi } from '../../utils/budgetApi';

const TABS = [
    { id: 'expenses', label: 'Expenses' },
    { id: 'income', label: 'Income' },
    { id: 'statistics', label: 'Statistics' },
    { id: 'planner', label: 'Planner' },
];

const BudgetAdmin = () => {
    const [activeTab, setActiveTab] = useState('expenses');
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
        loadData();
    }, [loadData]);

    const handleRefresh = async () => {
        await loadData();
    };

    return (
        <AdminLayout title="Budget Manager">
            <div className="admin-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={activeTab === tab.id ? 'active' : ''}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && <p className="admin-loading-text">Loading budget data...</p>}
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
                    {activeTab === 'planner' && <BudgetPlanner />}
                </>
            )}
        </AdminLayout>
    );
};

export default BudgetAdmin;
