import React, { useMemo, useState } from 'react';
import {
    budgetApi,
    formatCurrency,
    formatDate,
    toInputDate,
} from '../../utils/budgetApi';

const emptyExpense = {
    serialNumber: '',
    date: new Date().toISOString().split('T')[0],
    item: '',
    category: '',
    cost: '',
};

const ExpenseTable = ({ expenses, onRefresh }) => {
    const [form, setForm] = useState(emptyExpense);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredExpenses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return expenses;

        return expenses.filter((expense) => {
            const rawDate = String(expense.date || '').toLowerCase();
            const formattedDateStr = formatDate(expense.date).toLowerCase();
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
        setForm(emptyExpense);
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
        if (!window.confirm('Delete this expense?')) return;
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
                        <span className="admin-budget-form-icon" aria-hidden="true">
                            {editingId ? '✏️' : '💳'}
                        </span>
                        <div>
                            <h3 className="admin-budget-form-title">
                                {editingId ? 'Edit Expense' : 'Add Expense'}
                            </h3>
                            <p className="admin-budget-form-subtitle">
                                {editingId
                                    ? `Updating record #${form.serialNumber || editingId}`
                                    : 'Record a new transaction to track spending'}
                            </p>
                        </div>
                    </div>
                    {editingId && (
                        <button
                            type="button"
                            className="admin-budget-cancel-btn"
                            onClick={resetForm}
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>

                <div className="admin-budget-form-grid">
                    <label className="admin-field-group admin-field-serial">
                        <span className="admin-field-label">Serial #</span>
                        <input
                            type="number"
                            value={form.serialNumber}
                            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                            placeholder="Auto"
                        />
                    </label>
                    <label className="admin-field-group admin-field-date">
                        <span className="admin-field-label">Date</span>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-item">
                        <span className="admin-field-label">Item Description</span>
                        <input
                            type="text"
                            value={form.item}
                            onChange={(e) => setForm({ ...form, item: e.target.value })}
                            placeholder="e.g. Groceries, Dinner, Transit..."
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-category">
                        <span className="admin-field-label">Category</span>
                        <input
                            type="text"
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            placeholder="Category"
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-cost">
                        <span className="admin-field-label">Cost</span>
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
                                ? 'Saving...'
                                : editingId
                                ? 'Update Expense'
                                : '+ Add Expense'}
                        </button>
                    </div>
                </div>
                {error && <p className="admin-error">{error}</p>}
            </form>

            <div className="admin-budget-table-card">
                <div className="admin-budget-table-header">
                    <div className="admin-budget-table-title-group">
                        <h3 className="admin-budget-table-title">Expense History</h3>
                        <span className="admin-budget-count-badge">
                            {expenses.length} {expenses.length === 1 ? 'record' : 'records'}
                        </span>
                        {searchQuery && filteredExpenses.length !== expenses.length && (
                            <span className="admin-budget-filter-badge">
                                {filteredExpenses.length} matching
                            </span>
                        )}
                    </div>
                    <div className="admin-budget-search-area">
                        <div className="admin-table-search-wrap">
                            <span className="admin-table-search-icon" aria-hidden="true">
                                🔍
                            </span>
                            <input
                                type="search"
                                className="admin-table-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search expenses by date, #, item, category, or cost..."
                                aria-label="Search expenses"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="admin-table-search-clear"
                                    onClick={() => setSearchQuery('')}
                                    title="Clear search"
                                    aria-label="Clear search"
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
                                <th>Serial #</th>
                                <th>Date</th>
                                <th>Item</th>
                                <th>Category</th>
                                <th>Cost</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>
                                        <span className="admin-serial-tag">
                                            #{expense.serialNumber}
                                        </span>
                                    </td>
                                    <td>{formatDate(expense.date)}</td>
                                    <td className="admin-item-cell">{expense.item}</td>
                                    <td>
                                        <span className="admin-category-tag">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="admin-cost-cell">
                                        {formatCurrency(expense.cost)}
                                    </td>
                                    <td className="admin-table-actions">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(expense)}
                                            title="Edit this expense"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="danger"
                                            onClick={() => handleDelete(expense.id)}
                                            title="Delete this expense"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length > 0 && (
                                <tr className="admin-table-total">
                                    <td colSpan="4">
                                        Total {searchQuery ? '(Filtered)' : ''}
                                    </td>
                                    <td className="admin-cost-cell">
                                        {formatCurrency(filteredTotal)}
                                    </td>
                                    <td />
                                </tr>
                            )}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        No expenses recorded yet. Use the form above to add one.
                                    </td>
                                </tr>
                            )}
                            {expenses.length > 0 && filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        No expenses matching &ldquo;{searchQuery}&rdquo;.
                                        <button
                                            type="button"
                                            className="admin-table-clear-btn"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            Clear search
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
