import React, { useMemo, useState } from 'react';
import { useContent } from '../../utils/ContentContext';
import { budgetApi, formatCurrency, formatDate, getTodayInputDate, toInputDate } from '../../utils/budgetApi';
import { matchesBudgetEntry } from '../../utils/budgetSearch';

export const normalizeIncomeType = (type) => {
    if (!type) return 'repayment';
    const lower = String(type).toLowerCase();
    if (lower === 'injection') return 'injection';
    if (lower === 'income') return 'income';
    return 'repayment';
};

const getIncomeTypeLabel = (type, t) => {
    const normalized = normalizeIncomeType(type);
    if (normalized === 'injection') {
        return t('admin.budgetSection.injection', 'Injection');
    }
    if (normalized === 'income') {
        return t('admin.budgetSection.income', 'Income');
    }
    return t('admin.budgetSection.repayment', 'Repayment');
};

const createEmptyIncome = () => ({
    no: '',
    date: getTodayInputDate(),
    item: '',
    value: '',
    type: 'repayment',
});

const IncomeTable = ({ income = [], onRefresh }) => {
    const { t, formatNumber, language } = useContent();
    const [form, setForm] = useState(createEmptyIncome);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        date: '',
        item: '',
        type: 'repayment',
        value: '',
    });
    const [inlineSubmitting, setInlineSubmitting] = useState(false);
    const [inlineError, setInlineError] = useState('');

    const filteredIncome = useMemo(() => {
        if (!searchQuery.trim()) return income;
        return income.filter((entry) => matchesBudgetEntry(entry, searchQuery, language));
    }, [income, searchQuery, language]);

    const resetForm = () => {
        setForm(createEmptyIncome());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                date: form.date,
                item: form.item,
                value: Number(form.value),
                type: normalizeIncomeType(form.type),
            };
            await budgetApi.createIncome(payload);
            resetForm();
            onRefresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEdit = (entry) => {
        setEditingId(entry.id);
        setEditForm({
            date: toInputDate(entry.date),
            item: entry.item || '',
            type: normalizeIncomeType(entry.type),
            value: entry.value !== undefined && entry.value !== null ? String(entry.value) : '',
        });
        setInlineError('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setInlineError('');
    };

    const handleSaveInline = async (entryId) => {
        if (!editForm.date) {
            setInlineError(t('admin.budgetSection.dateRequired', 'Date is required'));
            return;
        }
        if (!editForm.item || !editForm.item.trim()) {
            setInlineError(t('admin.budgetSection.itemRequired', 'Item description is required'));
            return;
        }
        const val = Number(editForm.value);
        if (editForm.value === '' || isNaN(val) || val < 0) {
            setInlineError(t('admin.budgetSection.validValueRequired', 'A valid non-negative value is required'));
            return;
        }

        setInlineError('');
        setInlineSubmitting(true);
        try {
            const payload = {
                date: editForm.date,
                item: editForm.item.trim(),
                value: val,
                type: normalizeIncomeType(editForm.type),
            };
            await budgetApi.updateIncome(entryId, payload);
            setEditingId(null);
            onRefresh();
        } catch (err) {
            setInlineError(err.message);
        } finally {
            setInlineSubmitting(false);
        }
    };

    const handleInlineKeyDown = (e, entryId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveInline(entryId);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('admin.budgetSection.deleteConfirmIncome', 'Delete this income entry?'))) return;
        try {
            await budgetApi.deleteIncome(id);
            if (editingId === id) handleCancelEdit();
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
                        <div>
                            <h3 className="admin-budget-form-title">
                                {t('admin.budgetSection.addIncome', 'Add Income')}
                            </h3>
                            <p className="admin-budget-form-subtitle">
                                {t('admin.budgetSection.recordNewIncome', 'Record incoming funds or capital injections')}
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
                            placeholder={t('admin.budgetSection.incomeItemPlaceholder', 'e.g. Salary, Consulting, Investment...')}
                            required
                        />
                    </label>
                    <label className="admin-field-group admin-field-category">
                        <span className="admin-field-label">{t('admin.budgetSection.incomeType', 'Income Type')}</span>
                        <select
                            value={normalizeIncomeType(form.type)}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                        >
                            <option value="repayment">{t('admin.budgetSection.repayment', 'Repayment')}</option>
                            <option value="income">{t('admin.budgetSection.income', 'Income')}</option>
                            <option value="injection">{t('admin.budgetSection.injection', 'Injection')}</option>
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
                        {searchQuery && filteredIncome.length !== income.length && (
                            <span className="admin-budget-filter-badge">
                                {formatNumber(filteredIncome.length)} {t('admin.budgetSection.matching', 'matching')}
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
                            {filteredIncome.map((entry) => {
                                const isEditing = editingId === entry.id;
                                if (isEditing) {
                                    return (
                                        <React.Fragment key={entry.id}>
                                            <tr className="admin-inline-edit-row">
                                                <td>
                                                    <span className="admin-serial-tag">
                                                        #{formatNumber(entry.no)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <input
                                                        type="date"
                                                        className="admin-inline-input admin-inline-date"
                                                        value={editForm.date}
                                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                        onKeyDown={(e) => handleInlineKeyDown(e, entry.id)}
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
                                                        onKeyDown={(e) => handleInlineKeyDown(e, entry.id)}
                                                        placeholder={t('admin.budgetSection.incomeItemPlaceholder', 'Item')}
                                                        required
                                                        autoFocus
                                                        aria-label={t('admin.budgetSection.headers.item', 'Item')}
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        className="admin-inline-select admin-inline-type"
                                                        value={normalizeIncomeType(editForm.type)}
                                                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                                        onKeyDown={(e) => handleInlineKeyDown(e, entry.id)}
                                                        aria-label={t('admin.budgetSection.headers.type', 'Type')}
                                                    >
                                                        <option value="repayment">{t('admin.budgetSection.repayment', 'Repayment')}</option>
                                                        <option value="income">{t('admin.budgetSection.income', 'Income')}</option>
                                                        <option value="injection">{t('admin.budgetSection.injection', 'Injection')}</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <div className="admin-inline-cost-wrap">
                                                        <span className="admin-inline-currency" aria-hidden="true">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="admin-inline-input admin-inline-cost"
                                                            value={editForm.value}
                                                            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                                                            onKeyDown={(e) => handleInlineKeyDown(e, entry.id)}
                                                            placeholder="0.00"
                                                            required
                                                            aria-label={t('admin.budgetSection.headers.value', 'Value')}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="admin-table-actions-cell">
                                                    <div className="admin-table-actions admin-inline-actions">
                                                        <button
                                                            type="button"
                                                            className="admin-inline-save-btn"
                                                            onClick={() => handleSaveInline(entry.id)}
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
                                    <tr key={entry.id}>
                                        <td>
                                            <span className="admin-serial-tag">
                                                #{formatNumber(entry.no)}
                                            </span>
                                        </td>
                                        <td>{formatNumber(formatDate(entry.date, language))}</td>
                                        <td className="admin-item-cell">{entry.item}</td>
                                        <td>
                                            <span className="admin-category-tag">
                                                {getIncomeTypeLabel(entry.type, t)}
                                            </span>
                                        </td>
                                        <td className="admin-cost-cell">
                                            {formatNumber(formatCurrency(entry.value))}
                                        </td>
                                        <td className="admin-table-actions-cell">
                                            <div className="admin-table-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEdit(entry)}
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
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
