import React, { useEffect, useState } from 'react';
import { budgetApi, toInputDate } from '../../utils/budgetApi';

const BudgetSettings = ({ settings, onRefresh }) => {
    const [form, setForm] = useState({
        meBudgeted: 0,
        aeBudgeted: 0,
        ayanaStartDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (settings) {
            setForm({
                meBudgeted: settings.meBudgeted ?? 0,
                aeBudgeted: settings.aeBudgeted ?? 0,
                ayanaStartDate: settings.ayanaStartDate
                    ? toInputDate(settings.ayanaStartDate)
                    : new Date().toISOString().split('T')[0],
            });
        }
    }, [settings]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSubmitting(true);
        try {
            await budgetApi.updateSettings({
                meBudgeted: Number(form.meBudgeted),
                aeBudgeted: Number(form.aeBudgeted),
                ayanaStartDate: form.ayanaStartDate,
            });
            setSuccess('Settings saved.');
            onRefresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="admin-data-section">
            <form className="admin-form admin-settings-form" onSubmit={handleSubmit}>
                <h3>Budget Settings</h3>
                <p className="admin-settings-note">
                    An ayana is a 6-month period. Set the start date to calculate completed ayanas and per-ayana averages.
                </p>
                <div className="admin-form-grid">
                    <label>
                        ME Budgeted
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.meBudgeted}
                            onChange={(e) => setForm({ ...form, meBudgeted: e.target.value })}
                        />
                    </label>
                    <label>
                        AE Budgeted
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.aeBudgeted}
                            onChange={(e) => setForm({ ...form, aeBudgeted: e.target.value })}
                        />
                    </label>
                    <label>
                        Ayana Start Date
                        <input
                            type="date"
                            value={form.ayanaStartDate}
                            onChange={(e) => setForm({ ...form, ayanaStartDate: e.target.value })}
                        />
                    </label>
                </div>
                {error && <p className="admin-error">{error}</p>}
                {success && <p className="admin-success">{success}</p>}
                <div className="admin-form-actions">
                    <button type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BudgetSettings;
