import React, { useState } from 'react';
import { budgetApi, formatCurrency, formatDate, toInputDate } from '../../utils/budgetApi';

const emptyIncome = {
    no: '',
    date: new Date().toISOString().split('T')[0],
    item: '',
    value: '',
    type: 'injection',
};

const IncomeTable = ({ income, onRefresh }) => {
    const [form, setForm] = useState(emptyIncome);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        setForm(emptyIncome);
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                ...form,
                value: Number(form.value),
                no: form.no ? Number(form.no) : undefined,
            };
            if (editingId) {
                await budgetApi.updateIncome(editingId, payload);
            } else {
                await budgetApi.createIncome(payload);
            }
            resetForm();
            onRefresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (entry) => {
        setEditingId(entry.id);
        setForm({
            no: entry.no,
            date: toInputDate(entry.date),
            item: entry.item,
            value: entry.value,
            type: entry.type || 'other',
        });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this income entry?')) return;
        try {
            await budgetApi.deleteIncome(id);
            if (editingId === id) resetForm();
            onRefresh();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="admin-data-section">
            <form className="admin-form" onSubmit={handleSubmit}>
                <h3>{editingId ? 'Edit Income' : 'Add Income'}</h3>
                <div className="admin-form-grid">
                    <label>
                        No
                        <input
                            type="number"
                            value={form.no}
                            onChange={(e) => setForm({ ...form, no: e.target.value })}
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
                        Type
                        <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                        >
                            <option value="injection">Injection</option>
                            <option value="other">Other Income</option>
                        </select>
                    </label>
                    <label>
                        Value
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.value}
                            onChange={(e) => setForm({ ...form, value: e.target.value })}
                            required
                        />
                    </label>
                </div>
                {error && <p className="admin-error">{error}</p>}
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
            </form>

            <table className="admin-table">
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Date</th>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {income.map((entry) => (
                        <tr key={entry.id}>
                            <td>{entry.no}</td>
                            <td>{formatDate(entry.date)}</td>
                            <td>{entry.item}</td>
                            <td>{entry.type === 'injection' ? 'Injection' : 'Other Income'}</td>
                            <td>{formatCurrency(entry.value)}</td>
                            <td className="admin-table-actions">
                                <button type="button" onClick={() => handleEdit(entry)}>Edit</button>
                                <button type="button" className="danger" onClick={() => handleDelete(entry.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                    {income.length === 0 && (
                        <tr>
                            <td colSpan="6" className="admin-empty">No income entries yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default IncomeTable;
