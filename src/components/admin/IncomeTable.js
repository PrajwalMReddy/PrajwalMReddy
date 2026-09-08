import React, { useMemo, useState } from 'react';
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
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIncome = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return income;

        return income.filter((entry) => {
            const rawDate = String(entry.date || '').toLowerCase();
            const formattedDateStr = formatDate(entry.date).toLowerCase();
            const inputDateStr = toInputDate(entry.date).toLowerCase();
            const dateMatch =
                rawDate.includes(q) || formattedDateStr.includes(q) || inputDateStr.includes(q);

            const noStr = String(entry.no ?? '').toLowerCase();
            const noHashStr = `#${noStr}`;
            const noMatch = noStr.includes(q) || noHashStr.includes(q);

            const itemStr = String(entry.item || '').toLowerCase();
            const itemMatch = itemStr.includes(q);

            const typeRawStr = String(entry.type || '').toLowerCase();
            const typeLabel = (entry.type === 'injection' ? 'injection' : 'other income').toLowerCase();
            const typeMatch = typeRawStr.includes(q) || typeLabel.includes(q);

            const valueRawStr = String(entry.value ?? '').toLowerCase();
            const valueFormattedStr = formatCurrency(entry.value).toLowerCase();
            const valueMatch = valueRawStr.includes(q) || valueFormattedStr.includes(q);

            return dateMatch || noMatch || itemMatch || typeMatch || valueMatch;
        });
    }, [income, searchQuery]);

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

    const filteredTotal = useMemo(() => {
        return filteredIncome.reduce((acc, inc) => acc + (Number(inc.value) || 0), 0);
    }, [filteredIncome]);

    return (
        <div className="admin-data-section">
            <form className="admin-budget-form-card" onSubmit={handleSubmit}>
                <div className="admin-budget-form-header">
                    <div className="admin-budget-form-title-wrap">
                        <span className="admin-budget-form-icon" aria-hidden="true">
                            {editingId ? '✏️' : '💰'}
                        </span>
                        <div>
                            <h3 className="admin-budget-form-title">
                                {editingId ? 'Edit Income' : 'Add Income'}
                            </h3>
                            <p className="admin-budget-form-subtitle">
                                {editingId
                                    ? `Updating entry #${form.no || editingId}`
                                    : 'Record incoming funds or capital injections'}
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
                        <span className="admin-field-label">No</span>
                        <input
                            type="number"
                            value={form.no}
                            onChange={(e) => setForm({ ...form, no: e.target.value })}
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
                            placeholder="e.g. Salary, Consulting, Investment..."
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-category">
                        <span className="admin-field-label">Income Type</span>
                        <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                        >
                            <option value="injection">Injection</option>
                            <option value="other">Other Income</option>
                        </select>
                    </label>
                    <label className="admin-field-group admin-field-cost">
                        <span className="admin-field-label">Value</span>
                        <div className="admin-currency-input-wrap">
                            <span className="admin-currency-symbol" aria-hidden="true">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.value}
                                onChange={(e) => setForm({ ...form, value: e.target.value })}
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
                                ? 'Update Income'
                                : '+ Add Income'}
                        </button>
                    </div>
                </div>
                {error && <p className="admin-error">{error}</p>}
            </form>

            <div className="admin-budget-table-card">
                <div className="admin-budget-table-header">
                    <div className="admin-budget-table-title-group">
                        <h3 className="admin-budget-table-title">Income History</h3>
                        <span className="admin-budget-count-badge">
                            {income.length} {income.length === 1 ? 'entry' : 'entries'}
                        </span>
                        {searchQuery && filteredIncome.length !== income.length && (
                            <span className="admin-budget-filter-badge">
                                {filteredIncome.length} matching
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
                                placeholder="Search income by date, #, item, type, value..."
                                aria-label="Search income"
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
                                <th>No</th>
                                <th>Date</th>
                                <th>Item</th>
                                <th>Type</th>
                                <th>Value</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredIncome.map((entry) => (
                                <tr key={entry.id}>
                                    <td>
                                        <span className="admin-serial-tag">
                                            #{entry.no}
                                        </span>
                                    </td>
                                    <td>{formatDate(entry.date)}</td>
                                    <td className="admin-item-cell">{entry.item}</td>
                                    <td>
                                        <span
                                            className={`admin-type-tag ${entry.type || 'other'}`}
                                        >
                                            {entry.type === 'injection' ? 'Injection' : 'Other Income'}
                                        </span>
                                    </td>
                                    <td className="admin-cost-cell">
                                        {formatCurrency(entry.value)}
                                    </td>
                                    <td className="admin-table-actions">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(entry)}
                                            title="Edit this income entry"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="danger"
                                            onClick={() => handleDelete(entry.id)}
                                            title="Delete this income entry"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredIncome.length > 0 && (
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
                            {income.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        No income entries recorded yet. Use the form above to add one.
                                    </td>
                                </tr>
                            )}
                            {income.length > 0 && filteredIncome.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        No income entries matching &ldquo;{searchQuery}&rdquo;.
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

export default IncomeTable;
