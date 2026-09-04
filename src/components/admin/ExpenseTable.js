import React, { useState } from 'react';
import {
    budgetApi,
    DEFAULT_CATEGORIES,
    formatCurrency,
    formatDate,
    toInputDate,
} from '../../utils/budgetApi';

const emptyExpense = {
    serialNumber: '',
    date: new Date().toISOString().split('T')[0],
    item: '',
    category: DEFAULT_CATEGORIES[0],
    cost: '',
};

const ExpenseTable = ({ expenses, onRefresh }) => {
    const [form, setForm] = useState(emptyExpense);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

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

    return (
        <div className="admin-data-section">
            <form className="admin-form" onSubmit={handleSubmit}>
                <h3>{editingId ? 'Edit Expense' : 'Add Expense'}</h3>
                <div className="admin-form-grid">
                    <label>
                        Serial #
                        <input
                            type="number"
                            value={form.serialNumber}
                            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                            placeholder="Auto"
                        />
                    </label>
                    <label>
                        Date
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Item
                        <input
                            type="text"
                            value={form.item}
                            onChange={(e) => setForm({ ...form, item: e.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Category
                        <input
                            type="text"
                            list="expense-categories"
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            required
                        />
                        <datalist id="expense-categories">
                            {DEFAULT_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                    </label>
                    <label>
                        Cost
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.cost}
                            onChange={(e) => setForm({ ...form, cost: e.target.value })}
                            required
                        />
                    </label>
                    <div className="admin-form-actions">
                        <button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : editingId ? 'Update' : 'Add'}
                        </button>
                        {editingId && (
                            <button type="button" className="secondary" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
                {error && <p className="admin-error">{error}</p>}
            </form>

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
                    {expenses.map((expense) => (
                        <tr key={expense.id}>
                            <td>{expense.serialNumber}</td>
                            <td>{formatDate(expense.date)}</td>
                            <td>{expense.item}</td>
                            <td>{expense.category}</td>
                            <td>{formatCurrency(expense.cost)}</td>
                            <td className="admin-table-actions">
                                <button type="button" onClick={() => handleEdit(expense)}>Edit</button>
                                <button type="button" className="danger" onClick={() => handleDelete(expense.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                    {expenses.length === 0 && (
                        <tr>
                            <td colSpan="6" className="admin-empty">No expenses yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ExpenseTable;
