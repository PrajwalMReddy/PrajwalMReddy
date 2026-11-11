import React, { useMemo, useState } from 'react';
import { useContent } from '../../utils/ContentContext';
import {
    budgetApi,
    formatCurrency,
    formatDate,
    getTodayInputDate,
    toInputDate,
} from '../../utils/budgetApi';
import { matchesBudgetEntry } from '../../utils/budgetSearch';

const createEmptyExpense = () => ({
    serialNumber: '',
    date: getTodayInputDate(),
    item: '',
    category: '',
    cost: '',
});

const ExpenseTable = ({ expenses = [], onRefresh }) => {
    const { t, formatNumber, language } = useContent();
    const [form, setForm] = useState(createEmptyExpense);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        date: '',
        item: '',
        category: '',
        cost: '',
    });
    const [inlineSubmitting, setInlineSubmitting] = useState(false);
    const [inlineError, setInlineError] = useState('');

    const filteredExpenses = useMemo(() => {
        if (!searchQuery.trim()) return expenses;
        return expenses.filter((expense) => matchesBudgetEntry(expense, searchQuery, language));
    }, [expenses, searchQuery, language]);

    const resetForm = () => {
        setForm(createEmptyExpense());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                date: form.date,
                item: form.item,
                category: form.category,
                cost: Number(form.cost),
            };
            await budgetApi.createExpense(payload);
            resetForm();
            onRefresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEdit = (expense) => {
        setEditingId(expense.id);
        setEditForm({
            date: toInputDate(expense.date),
            item: expense.item || '',
            category: expense.category || '',
            cost: expense.cost !== undefined && expense.cost !== null ? String(expense.cost) : '',
        });
        setInlineError('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setInlineError('');
    };

    const handleSaveInline = async (expenseId) => {
        if (!editForm.date) {
            setInlineError(t('admin.budgetSection.dateRequired', 'Date is required'));
            return;
        }
        if (!editForm.item || !editForm.item.trim()) {
            setInlineError(t('admin.budgetSection.itemRequired', 'Item description is required'));
            return;
        }
        if (!editForm.category || !editForm.category.trim()) {
            setInlineError(t('admin.budgetSection.categoryRequired', 'Category is required'));
            return;
        }
        const costNum = Number(editForm.cost);
        if (editForm.cost === '' || isNaN(costNum) || costNum < 0) {
            setInlineError(t('admin.budgetSection.validCostRequired', 'A valid non-negative cost is required'));
            return;
        }

        setInlineError('');
        setInlineSubmitting(true);
        try {
            const payload = {
                date: editForm.date,
                item: editForm.item.trim(),
                category: editForm.category.trim(),
                cost: costNum,
            };
            await budgetApi.updateExpense(expenseId, payload);
            setEditingId(null);
            onRefresh();
        } catch (err) {
            setInlineError(err.message);
        } finally {
            setInlineSubmitting(false);
        }
    };

    const handleInlineKeyDown = (e, expenseId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveInline(expenseId);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('admin.budgetSection.deleteConfirmExpense', 'Delete this expense?'))) return;
        try {
            await budgetApi.deleteExpense(id);
            if (editingId === id) handleCancelEdit();
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
                                {t('admin.budgetSection.addExpense', 'Add Expense')}
                            </h3>
                            <p className="admin-budget-form-subtitle">
                                {t('admin.budgetSection.recordNewExpense', 'Record a new transaction to track spending')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="admin-budget-form-grid">
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
                            {filteredExpenses.map((expense) => {
                                const isEditing = editingId === expense.id;
                                if (isEditing) {
                                    return (
                                        <React.Fragment key={expense.id}>
                                            <tr className="admin-inline-edit-row">
                                                <td>
                                                    <span className="admin-serial-tag">
                                                        #{formatNumber(expense.serialNumber)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <input
                                                        type="date"
                                                        className="admin-inline-input admin-inline-date"
                                                        value={editForm.date}
                                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                        onKeyDown={(e) => handleInlineKeyDown(e, expense.id)}
                                                        required
                                                        aria-label={t('admin.budgetSection.headers.date', 'Date')}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="admin-inline-input admin-inline-item"
                                                        value={editForm.item}
                                                        onChange={(e) => setEditForm({ ...editForm, item: e.target.value })}
                                                        onKeyDown={(e) => handleInlineKeyDown(e, expense.id)}
                                                        placeholder={t('admin.budgetSection.expenseItemPlaceholder', 'Item')}
                                                        required
                                                        autoFocus
                                                        aria-label={t('admin.budgetSection.headers.item', 'Item')}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="admin-inline-input admin-inline-category"
                                                        value={editForm.category}
                                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                        onKeyDown={(e) => handleInlineKeyDown(e, expense.id)}
                                                        placeholder={t('admin.budgetSection.category', 'Category')}
                                                        required
                                                        aria-label={t('admin.budgetSection.headers.category', 'Category')}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="admin-inline-cost-wrap">
                                                        <span className="admin-inline-currency" aria-hidden="true">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="admin-inline-input admin-inline-cost"
                                                            value={editForm.cost}
                                                            onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                                                            onKeyDown={(e) => handleInlineKeyDown(e, expense.id)}
                                                            placeholder="0.00"
                                                            required
                                                            aria-label={t('admin.budgetSection.headers.cost', 'Cost')}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="admin-table-actions-cell">
                                                    <div className="admin-table-actions admin-inline-actions">
                                                        <button
                                                            type="button"
                                                            className="admin-inline-save-btn"
                                                            onClick={() => handleSaveInline(expense.id)}
                                                            disabled={inlineSubmitting}
                                                            title={t('admin.budgetSection.save', 'Save')}
                                                        >
                                                            {inlineSubmitting ? t('admin.actions.saving', 'Saving...') : t('admin.budgetSection.save', 'Save')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="admin-inline-cancel-btn"
                                                            onClick={handleCancelEdit}
                                                            disabled={inlineSubmitting}
                                                            title={t('admin.budgetSection.cancel', 'Cancel')}
                                                        >
                                                            {t('admin.budgetSection.cancel', 'Cancel')}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {inlineError && (
                                                <tr className="admin-inline-error-row">
                                                    <td colSpan="6">
                                                        <span className="admin-inline-error-text">{inlineError}</span>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                }

                                return (
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
                                        <td className="admin-table-actions-cell">
                                            <div className="admin-table-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEdit(expense)}
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
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
