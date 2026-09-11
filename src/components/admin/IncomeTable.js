import React, { useMemo, useState } from 'react';
import { useContent } from '../../utils/ContentContext';
import { budgetApi, formatCurrency, formatDate, getTodayInputDate, toInputDate } from '../../utils/budgetApi';

const createEmptyIncome = () => ({
    no: '',
    date: getTodayInputDate(),
    item: '',
    value: '',
    type: 'injection',
});

const IncomeTable = ({ income, onRefresh }) => {
    const { t, formatNumber, language } = useContent();
    const [form, setForm] = useState(createEmptyIncome);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIncome = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return income;

        return income.filter((entry) => {
            const rawDate = String(entry.date || '').toLowerCase();
            const formattedDateStr = formatDate(entry.date, language).toLowerCase();
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
        setForm(createEmptyIncome());
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
        if (!window.confirm(t('admin.budgetSection.deleteConfirmIncome', 'Delete this income entry?'))) return;
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
                                {editingId
                                    ? t('admin.budgetSection.editIncome', 'Edit Income')
                                    : t('admin.budgetSection.addIncome', 'Add Income')}
                            </h3>
                            <p className="admin-budget-form-subtitle">
                                {editingId
                                    ? `${t('admin.budgetSection.updatingEntry', 'Updating entry')} #${formatNumber(form.no || editingId)}`
                                    : t('admin.budgetSection.recordNewIncome', 'Record incoming funds or capital injections')}
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
                        <span className="admin-field-label">{t('admin.budgetSection.no', 'No')}</span>
                        <input
                            type="number"
                            value={form.no}
                            onChange={(e) => setForm({ ...form, no: e.target.value })}
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
                            placeholder={t('admin.budgetSection.incomeItemPlaceholder', 'e.g. Salary, Consulting, Investment...')}
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-category">
                        <span className="admin-field-label">{t('admin.budgetSection.incomeType', 'Income Type')}</span>
                        <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                        >
                            <option value="injection">{t('admin.budgetSection.injection', 'Injection')}</option>
                            <option value="other">{t('admin.budgetSection.otherIncome', 'Other Income')}</option>
                        </select>
                    </label>
                    <label className="admin-field-group admin-field-cost">
                        <span className="admin-field-label">{t('admin.budgetSection.value', 'Value')}</span>
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
                                ? t('admin.actions.saving', 'Saving...')
                                : editingId
                                ? t('admin.budgetSection.updateIncomeBtn', 'Update Income')
                                : t('admin.budgetSection.addIncomeBtn', '+ Add Income')}
                        </button>
                    </div>
                </div>
                {error && <p className="admin-error">{error}</p>}
            </form>

            <div className="admin-budget-table-card">
                <div className="admin-budget-table-header">
                    <div className="admin-budget-table-title-group">
                        <h3 className="admin-budget-table-title">{t('admin.budgetSection.incomeHistory', 'Income History')}</h3>
                        <span className="admin-budget-count-badge">
                            {formatNumber(income.length)} {income.length === 1 ? t('admin.budgetSection.entry', 'entry') : t('admin.budgetSection.entries', 'entries')}
                        </span>
                        {searchQuery && filteredIncome.length !== income.length && (
                            <span className="admin-budget-filter-badge">
                                {formatNumber(filteredIncome.length)} {t('admin.budgetSection.matching', 'matching')}
                            </span>
                        )}
                    </div>
                    <div className="admin-budget-search-area">
                        <div className="admin-table-search-wrap">
                            <span className="admin-table-search-icon" aria-hidden="true">
                                🔍
                            </span>
                            <input
                                type="text"
                                inputMode="search"
                                className="admin-table-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('admin.budgetSection.searchIncomePlaceholder', 'Search income by date, #, item, type, value...')}
                                aria-label={t('admin.budgetSection.searchIncomePlaceholder', 'Search income')}
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
                                <th>{t('admin.budgetSection.headers.no', 'No')}</th>
                                <th>{t('admin.budgetSection.headers.date', 'Date')}</th>
                                <th>{t('admin.budgetSection.headers.item', 'Item')}</th>
                                <th>{t('admin.budgetSection.headers.type', 'Type')}</th>
                                <th>{t('admin.budgetSection.headers.value', 'Value')}</th>
                                <th>{t('admin.budgetSection.headers.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredIncome.map((entry) => (
                                <tr key={entry.id}>
                                    <td>
                                        <span className="admin-serial-tag">
                                            #{formatNumber(entry.no)}
                                        </span>
                                    </td>
                                    <td>{formatNumber(formatDate(entry.date, language))}</td>
                                    <td className="admin-item-cell">{entry.item}</td>
                                    <td>
                                        <span
                                            className={`admin-type-tag ${entry.type || 'other'}`}
                                        >
                                            {entry.type === 'injection'
                                                ? t('admin.budgetSection.injection', 'Injection')
                                                : t('admin.budgetSection.otherIncome', 'Other Income')}
                                        </span>
                                    </td>
                                    <td className="admin-cost-cell">
                                        {formatNumber(formatCurrency(entry.value))}
                                    </td>
                                    <td className="admin-table-actions">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(entry)}
                                            title={t('admin.actions.edit', 'Edit')}
                                        >
                                            {t('admin.actions.edit', 'Edit')}
                                        </button>
                                        <button
                                            type="button"
                                            className="danger"
                                            onClick={() => handleDelete(entry.id)}
                                            title={t('admin.actions.delete', 'Delete')}
                                        >
                                            {t('admin.actions.delete', 'Delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredIncome.length > 0 && (
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
                            {income.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        {t('admin.budgetSection.noIncome', 'No income entries recorded yet.')}
                                    </td>
                                </tr>
                            )}
                            {income.length > 0 && filteredIncome.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="admin-empty">
                                        {t('admin.budgetSection.noIncomeMatch', 'No income entries match your search.')}
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

export default IncomeTable;
