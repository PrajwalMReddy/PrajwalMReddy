import React, { useMemo, useState } from 'react';
import { useContent } from '../../utils/ContentContext';
import {
    budgetApi,
    formatCurrency,
    formatDate,
    getTodayInputDate,
    toInputDate,
} from '../../utils/budgetApi';

const createEmptyExpense = () => ({
    serialNumber: '',
    date: getTodayInputDate(),
    item: '',
    category: '',
    cost: '',
});

const ExpenseTable = ({ expenses, onRefresh }) => {
    const { t, formatNumber, language } = useContent();
    const [form, setForm] = useState(createEmptyExpense);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredExpenses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return expenses;

        return expenses.filter((expense) => {
            const rawDate = String(expense.date || '').toLowerCase();
            const formattedDateStr = formatDate(expense.date, language).toLowerCase();
            const inputDateStr = toInputDate(expense.date).toLowerCase();
            const dateMatch =
                rawDate.includes(q) || formattedDateStr.includes(q) || inputDateStr.includes(q);

            const serialStr = String(expense.serialNumber ?? '').toLowerCase();
            const serialHashStr = `#${serialStr}`;
            const serialMatch = serialStr.includes(q) || serialHashStr.includes(q);

            const itemStr = String(expense.item || '').toLowerCase();
            const itemMatch = itemStr.includes(q);

            const categoryStr = String(expense.category || '').toLowerCase();
            const categoryMatch = categoryStr.includes(q);

            const costRawStr = String(expense.cost ?? '').toLowerCase();
            const costFormattedStr = formatCurrency(expense.cost).toLowerCase();
            const costMatch = costRawStr.includes(q) || costFormattedStr.includes(q);

            return dateMatch || serialMatch || itemMatch || categoryMatch || costMatch;
        });
    }, [expenses, searchQuery]);

    const resetForm = () => {
        setForm(createEmptyExpense());
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                ...form,
                cost: Number(form.cost),
                serialNumber: form.serialNumber ? Number(form.serialNumber) : undefined,
            };
            if (editingId) {
                await budgetApi.updateExpense(editingId, payload);
            } else {
                await budgetApi.createExpense(payload);
            }
            resetForm();
            onRefresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (expense) => {
        setEditingId(expense.id);
        setForm({
            serialNumber: expense.serialNumber,
            date: toInputDate(expense.date),
            item: expense.item,
            category: expense.category,
            cost: expense.cost,
        });
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('admin.budgetSection.deleteConfirmExpense', 'Delete this expense?'))) return;
        try {
            await budgetApi.deleteExpense(id);
            if (editingId === id) resetForm();
            onRefresh();
        } catch (err) {
            setError(err.message);
        }
    };

    const filteredTotal = useMemo(() => {
        return filteredExpenses.reduce((acc, exp) => acc + (Number(exp.cost) || 0), 0);
    }, [filteredExpenses]);

    return (
        <div className="admin-data-section">
            <form className="admin-budget-form-card" onSubmit={handleSubmit}>
                <div className="admin-budget-form-header">
                    <div className="admin-budget-form-title-wrap">
                        <div>
                            <h3 className="admin-budget-form-title">
                                {editingId
                                    ? t('admin.budgetSection.editExpense', 'Edit Expense')
                                    : t('admin.budgetSection.addExpense', 'Add Expense')}
                            </h3>
                            <p className="admin-budget-form-subtitle">
                                {editingId
                                    ? `${t('admin.budgetSection.updatingRecord', 'Updating record')} #${formatNumber(form.serialNumber || editingId)}`
                                    : t('admin.budgetSection.recordNewExpense', 'Record a new transaction to track spending')}
                            </p>
                        </div>
                    </div>
                    {editingId && (
                        <button
                            type="button"
                            className="admin-budget-cancel-btn"
                            onClick={resetForm}
                        >
                            {t('admin.budgetSection.cancelEdit', 'Cancel Edit')}
                        </button>
                    )}
                </div>

                <div className="admin-budget-form-grid">
                    <label className="admin-field-group admin-field-serial">
                        <span className="admin-field-label">{t('admin.budgetSection.serialNumber', 'Serial #')}</span>
                        <input
                            type="number"
                            value={form.serialNumber}
                            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                            placeholder={t('admin.budgetSection.auto', 'Auto')}
                        />
                    </label>
                    <label className="admin-field-group admin-field-date">
                        <span className="admin-field-label">{t('admin.budgetSection.date', 'Date')}</span>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-item">
                        <span className="admin-field-label">{t('admin.budgetSection.itemDescription', 'Item Description')}</span>
                        <input
                            type="text"
                            value={form.item}
                            onChange={(e) => setForm({ ...form, item: e.target.value })}
                            placeholder={t('admin.budgetSection.expenseItemPlaceholder', 'e.g. Groceries, Dinner, Transit...')}
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-category">
                        <span className="admin-field-label">{t('admin.budgetSection.category', 'Category')}</span>
                        <input
                            type="text"
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            placeholder={t('admin.budgetSection.category', 'Category')}
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-cost">
                        <span className="admin-field-label">{t('admin.budgetSection.cost', 'Cost')}</span>
                        <div className="admin-currency-input-wrap">
                            <span className="admin-currency-symbol" aria-hidden="true">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.cost}
                                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </label>
                    <div className="admin-budget-form-actions">
                        <button
                            type="submit"
                            className="admin-budget-submit-btn"
                            disabled={submitting}
                        >
                            {submitting
                                ? t('admin.actions.saving', 'Saving...')
                                : editingId
                                ? t('admin.budgetSection.updateExpenseBtn', 'Update Expense')
                                : t('admin.budgetSection.addExpenseBtn', '+ Add Expense')}
                        </button>
                    </div>
                </div>
                {error && <p className="admin-error">{error}</p>}
            </form>

            <div className="admin-budget-table-card">
                <div className="admin-budget-table-header">
                    <div className="admin-budget-table-title-group">
                        <h3 className="admin-budget-table-title">{t('admin.budgetSection.expenseHistory', 'Expense History')}</h3>
                        {searchQuery && filteredExpenses.length !== expenses.length && (
                            <span className="admin-budget-filter-badge">
                                {formatNumber(filteredExpenses.length)} {t('admin.budgetSection.matching', 'matching')}
                            </span>
                        )}
                    </div>
                    <div className="admin-budget-search-area">
                        <div className="admin-table-search-wrap">
                            <span className="admin-table-search-icon" aria-hidden="true">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                inputMode="search"
                                className="admin-table-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('admin.budgetSection.searchExpensesPlaceholder', 'Search expenses by date, #, item, category, or cost...')}
                                aria-label={t('admin.budgetSection.searchExpensesPlaceholder', 'Search expenses')}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="admin-table-search-clear"
                                    onClick={() => setSearchQuery('')}
                                    title={t('admin.budgetSection.clearSearch', 'Clear search')}
                                    aria-label={t('admin.budgetSection.clearSearch', 'Clear search')}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="admin-table-scroll">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('admin.budgetSection.headers.serial', 'Serial #')}</th>
                                <th>{t('admin.budgetSection.headers.date', 'Date')}</th>
                                <th>{t('admin.budgetSection.headers.item', 'Item')}</th>
                                <th>{t('admin.budgetSection.headers.category', 'Category')}</th>
                                <th>{t('admin.budgetSection.headers.cost', 'Cost')}</th>
                                <th>{t('admin.budgetSection.headers.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>
                                        <span className="admin-serial-tag">
                                            #{formatNumber(expense.serialNumber)}
                                        </span>
                                    </td>
                                    <td>{formatNumber(formatDate(expense.date, language))}</td>
                                    <td className="admin-item-cell">{expense.item}</td>
                                    <td>
                                        <span className="admin-category-tag">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="admin-cost-cell">
                                        {formatNumber(formatCurrency(expense.cost))}
                                    </td>
                                    <td className="admin-table-actions">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(expense)}
                                            title={t('admin.actions.edit', 'Edit')}
                                        >
                                            {t('admin.actions.edit', 'Edit')}
                                        </button>
                                        <button
                                            type="button"
                                            className="danger"
                                            onClick={() => handleDelete(expense.id)}
                                            title={t('admin.actions.delete', 'Delete')}
                                        >
                                            {t('admin.actions.delete', 'Delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length > 0 && (
                                <tr className="admin-table-total">
                                    <td colSpan="4">
                                        {t('admin.budgetSection.totalFiltered', 'Total (Filtered):')}
                                    </td>
                                    <td className="admin-cost-cell">
                                        {formatNumber(formatCurrency(filteredTotal))}
                                    </td>
                                    <td />
                                </tr>
                            )}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        {t('admin.budgetSection.noExpenses', 'No expenses recorded yet.')}
                                    </td>
                                </tr>
                            )}
                            {expenses.length > 0 && filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        {t('admin.budgetSection.noExpensesMatch', 'No expenses match your search.')}
                                        <button
                                            type="button"
                                            className="admin-table-clear-btn"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            {t('admin.budgetSection.clearSearch', 'Clear search')}
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExpenseTable;
