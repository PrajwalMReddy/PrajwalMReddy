import React, {useEffect, useMemo, useState} from 'react';
import { useContent } from '../../utils/ContentContext';
import {
    AYANA_START_DATE,
    budgetApi,
    DEFAULT_CATEGORIES,
    formatAyanaLabel,
    formatCurrency,
    formatMonthLabel,
    getAyanaMonths,
    getCurrentAyanaNumber,
} from '../../utils/budgetApi';

const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyItemForm = {
    item: '',
    category: DEFAULT_CATEGORIES[0],
    amount: '',
};

const isCloseToZero = (n) => Math.abs(n) < 0.005;

const BudgetPlanner = () => {
    const { t, formatNumber, language } = useContent();
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [draftPlan, setDraftPlan] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [budgetTotal, setBudgetTotal] = useState('');
    const [monthlyBudget, setMonthlyBudget] = useState({});

    const [expandedMonth, setExpandedMonth] = useState(null);
    const [itemForms, setItemForms] = useState({});

    const currentAyanaNumber = useMemo(
        () => getCurrentAyanaNumber(AYANA_START_DATE),
        []
    );

    const availableAyanaNumbers = useMemo(() => {
        const maxAyana = currentAyanaNumber + 1;

        return Array.from(
            {length: maxAyana},
            (_, index) => index + 1
        );
    }, [currentAyanaNumber]);

    const loadPlans = async (preferId = null) => {
        setLoading(true);
        setError('');

        try {
            const data = await budgetApi.getBudgetPlans();

            const sorted = [...data].sort(
                (a, b) => b.ayanaNumber - a.ayanaNumber
            );

            setPlans(sorted);

            if (preferId) {
                setSelectedPlanId(preferId);
            } else if (
                sorted.length > 0 &&
                selectedPlanId === null
            ) {
                setSelectedPlanId(sorted[0].id);
            }
        } catch (err) {
            setError(err.message || 'Failed to load budget plans.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedPlanId === null) {
            return;
        }

        const found = plans.find(
            (plan) => plan.id === selectedPlanId
        );

        setDraftPlan(
            found
                ? JSON.parse(JSON.stringify(found))
                : null
        );
    }, [plans, selectedPlanId]);

    useEffect(() => {
        if (!draftPlan) {
            setBudgetTotal('');
            setMonthlyBudget({});
            setExpandedMonth(null);
            setItemForms({});
            return;
        }

        const months = getAyanaMonths(
            AYANA_START_DATE,
            draftPlan.ayanaNumber
        );

        const monthly = {};

        months.forEach((month) => {
            const value =
                (draftPlan.monthlyBudgeted || {})[month];

            monthly[month] =
                value !== undefined && value !== null
                    ? String(value)
                    : '';
        });

        setBudgetTotal(
            draftPlan.ayanaBudgeted > 0
                ? String(draftPlan.ayanaBudgeted)
                : ''
        );

        setMonthlyBudget(monthly);

        setExpandedMonth((previous) =>
            previous && months.includes(previous)
                ? previous
                : null
        );

        const forms = {};

        months.forEach((month) => {
            forms[month] = {
                ...emptyItemForm,
            };
        });

        setItemForms(forms);
    }, [draftPlan?.id, draftPlan?.ayanaNumber]);

    const monthsInAyana = useMemo(
        () =>
            draftPlan
                ? getAyanaMonths(
                    AYANA_START_DATE,
                    draftPlan.ayanaNumber
                )
                : [],
        [draftPlan]
    );

    const updateDraft = (changes) => {
        setDraftPlan((previous) => ({
            ...previous,
            ...changes,
        }));
    };

    const existingAyanaNumbers = plans.map(
        (plan) => plan.ayanaNumber
    );

    const handleNewPlan = () => {
        let nextNumber = currentAyanaNumber;

        while (
            existingAyanaNumbers.includes(nextNumber)
            ) {
            nextNumber += 1;
        }

        setDraftPlan({
            id: null,
            ayanaNumber: nextNumber,
            monthlyItems: [],
            ayanaBudgeted: 0,
            monthlyBudgeted: {},
        });

        setSelectedPlanId(null);
        setError('');
    };

    const handleAyanaSelection = (event) => {
        const ayanaNumber = Number(event.target.value);

        if (!ayanaNumber) {
            return;
        }

        const existingPlan = plans.find(
            (plan) => plan.ayanaNumber === ayanaNumber
        );

        if (existingPlan) {
            setSelectedPlanId(existingPlan.id);
            setError('');
            return;
        }

        setSelectedPlanId(null);

        setDraftPlan({
            id: null,
            ayanaNumber,
            monthlyItems: [],
            ayanaBudgeted: 0,
            monthlyBudgeted: {},
        });

        setError('');
    };

    const handleBudgetMonthChange = (month, value) => {
        setMonthlyBudget((previous) => ({
            ...previous,
            [month]: value,
        }));
    };

    const handleDistributeEvenly = () => {
        const total = Number(budgetTotal) || 0;

        if (total <= 0 || monthsInAyana.length === 0) {
            setError('Enter a total Ayana budget first.');
            return;
        }

        const base =
            Math.floor(
                (total / monthsInAyana.length) * 100
            ) / 100;

        const monthly = {};
        let running = 0;

        monthsInAyana.forEach((month, index) => {
            if (index === monthsInAyana.length - 1) {
                monthly[month] = (
                    total - running
                ).toFixed(2);
            } else {
                monthly[month] = base.toFixed(2);
                running += base;
            }
        });

        setMonthlyBudget(monthly);
        setError('');
    };

    const handleItemFormChange = (
        month,
        field,
        value
    ) => {
        setItemForms((previous) => ({
            ...previous,
            [month]: {
                ...(previous[month] || emptyItemForm),
                [field]: value,
            },
        }));
    };

    const handleAddMonthlyItem = (
        event,
        month
    ) => {
        event.preventDefault();

        const form =
            itemForms[month] || emptyItemForm;

        if (
            !form.item.trim() ||
            form.amount === ''
        ) {
            return;
        }

        const amount = Number(form.amount);

        if (!Number.isFinite(amount) || amount < 0) {
            setError('Enter a valid expense amount.');
            return;
        }

        const newItem = {
            id: generateId(),
            month,
            item: form.item.trim(),
            category:
                form.category || 'Miscellaneous',
            amount,
        };

        updateDraft({
            monthlyItems: [
                ...(draftPlan.monthlyItems || []),
                newItem,
            ],
        });

        setItemForms((previous) => ({
            ...previous,
            [month]: {
                ...emptyItemForm,
            },
        }));

        setError('');
    };

    const handleDeleteMonthlyItem = (id) => {
        updateDraft({
            monthlyItems:
                (draftPlan.monthlyItems || []).filter(
                    (item) => item.id !== id
                ),
        });
    };

    const monthlyTotals = useMemo(() => {
        return monthsInAyana.map((month) => {
            const items =
                (draftPlan?.monthlyItems || []).filter(
                    (item) => item.month === month
                );

            const planned = items.reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

            const budgeted =
                Number(monthlyBudget[month]) || 0;

            return {
                month,
                items,
                budgeted,
                planned,
                remaining: budgeted - planned,
            };
        });
    }, [
        draftPlan?.monthlyItems,
        monthlyBudget,
        monthsInAyana,
    ]);

    const totalBudget =
        Number(budgetTotal) || 0;

    const totalMonthlyBudget =
        monthsInAyana.reduce(
            (sum, month) =>
                sum +
                (Number(monthlyBudget[month]) || 0),
            0
        );

    const totalPlanned =
        monthlyTotals.reduce(
            (sum, month) => sum + month.planned,
            0
        );

    const allocationDifference =
        totalBudget - totalMonthlyBudget;

    const remainingToSpend =
        totalBudget - totalPlanned;

    const allocationValid =
        totalBudget > 0 &&
        allocationDifference >= -0.005 &&
        isCloseToZero(allocationDifference);

    const handleSavePlan = async () => {
        if (!draftPlan) {
            return;
        }

        if (!allocationValid) {
            setError(
                allocationDifference < 0
                    ? `The monthly budgets are ${formatCurrency(
                        Math.abs(allocationDifference)
                    )} over the Ayana budget.`
                    : `Allocate the full Ayana budget. ${formatCurrency(
                        allocationDifference
                    )} remains unallocated.`
            );
            return;
        }

        setSaving(true);
        setError('');

        const cleanMonthlyBudget = {};

        monthsInAyana.forEach((month) => {
            cleanMonthlyBudget[month] =
                Number(monthlyBudget[month]) || 0;
        });

        const planToSave = {
            ...draftPlan,
            ayanaBudgeted: totalBudget,
            monthlyBudgeted: cleanMonthlyBudget,
            monthlyItems: draftPlan.monthlyItems || [],
        };

        try {
            if (draftPlan.id) {
                const saved =
                    await budgetApi.updateBudgetPlan(
                        draftPlan.id,
                        planToSave
                    );

                setDraftPlan(saved);
                setSelectedPlanId(saved.id);

                await loadPlans(saved.id);
            } else {
                const created =
                    await budgetApi.createBudgetPlan(
                        planToSave
                    );

                setDraftPlan(created);
                setSelectedPlanId(created.id);

                await loadPlans(created.id);
            }
        } catch (err) {
            setError(
                err.message ||
                'Failed to save budget plan.'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePlan = async () => {
        if (!draftPlan?.id) {
            setDraftPlan(null);
            return;
        }

        if (
            !window.confirm(
                t('admin.budgetSection.planner.deleteConfirmPlan', 'Delete this budget plan?')
            )
        ) {
            return;
        }

        setError('');

        try {
            await budgetApi.deleteBudgetPlan(
                draftPlan.id
            );

            setSelectedPlanId(null);
            setDraftPlan(null);

            await loadPlans();
        } catch (err) {
            setError(
                err.message ||
                'Failed to delete budget plan.'
            );
        }
    };

    if (loading) {
        return (
            <p className="admin-loading-text">
                {t('admin.budgetSection.planner.loading', 'Loading budget plans...')}
            </p>
        );
    }

    return (
        <div className="admin-data-section admin-budget-planner">
            {error && (
                <p className="admin-error">
                    {error}
                </p>
            )}

            {/* =========================================================
                AYANA SELECTOR
            ========================================================== */}

            <div className="admin-planner-tabs">
                <div className="admin-planner-plan-controls">
                    <label className="admin-planner-ayana-selector">
                        <span>{t('admin.budgetSection.planner.planFor', 'Plan for')}</span>

                        <select
                            value={
                                draftPlan?.ayanaNumber ||
                                (plans.find(
                                    (plan) =>
                                        plan.id === selectedPlanId
                                )?.ayanaNumber ?? '')
                            }
                            onChange={handleAyanaSelection}
                        >
                            <option value="" disabled>
                                {t('admin.budgetSection.planner.selectAyana', 'Select Ayana')}
                            </option>

                            {availableAyanaNumbers.map((ayanaNumber) => {
                                const hasPlan = plans.some(
                                    (plan) =>
                                        plan.ayanaNumber === ayanaNumber
                                );

                                return (
                                    <option
                                        key={ayanaNumber}
                                        value={ayanaNumber}
                                    >
                                        {`${t('admin.budgetSection.planner.ayana', 'Ayana')} ${formatNumber(ayanaNumber)}${
                                            ayanaNumber === currentAyanaNumber
                                                ? ` · ${t('admin.budgetSection.planner.current', 'Current')}`
                                                : ayanaNumber < currentAyanaNumber
                                                    ? ` · ${t('admin.budgetSection.planner.past', 'Past')}`
                                                    : ` · ${t('admin.budgetSection.planner.future', 'Future')}`
                                        }${
                                            hasPlan
                                                ? ` · ${t('admin.budgetSection.planner.saved', 'Saved')}`
                                                : ''
                                        }`}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                </div>
            </div>

            {!draftPlan && !error && (
                <div className="admin-planner-empty">
                    <h3>{t('admin.budgetSection.planner.noPlanSelected', 'No budget plan selected')}</h3>

                    <p>
                        {t('admin.budgetSection.planner.selectAyanaPrompt', 'Select an Ayana above to create or edit its budget plan.')}
                    </p>
                </div>
            )}

            {draftPlan && (
                <>
                    {/* =================================================
                        PLAN HEADER
                    ================================================== */}

                    <div className="admin-planner-header">
                        <div>
                            <span className="admin-planner-eyebrow">
                                {t('admin.budgetSection.planner.budgetPlanner', 'Budget Planner')}
                            </span>

                            <h3>
                                {formatAyanaLabel(
                                    AYANA_START_DATE,
                                    draftPlan.ayanaNumber,
                                    language,
                                    formatNumber
                                )}
                            </h3>
                        </div>

                        <div className="admin-planner-header-actions">
                            <button
                                type="button"
                                className="danger"
                                onClick={handleDeletePlan}
                            >
                                {t('admin.budgetSection.planner.deletePlan', 'Delete')}
                            </button>

                            <button
                                type="button"
                                onClick={handleSavePlan}
                                disabled={
                                    saving ||
                                    !allocationValid
                                }
                            >
                                {saving
                                    ? t('admin.actions.saving', 'Saving...')
                                    : t('admin.budgetSection.planner.savePlan', 'Save Plan')}
                            </button>
                        </div>
                    </div>

                    {/* =================================================
                        BUDGET OVERVIEW
                    ================================================== */}

                    <section className="admin-planner-overview">
                        <div className="admin-planner-budget-input">
                            <label>
                                <span>{t('admin.budgetSection.planner.totalAyanaBudget', 'Total Ayana Budget')}</span>

                                <div className="admin-planner-money-input">
                                    <span>$</span>

                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={budgetTotal}
                                        onChange={(event) =>
                                            setBudgetTotal(
                                                event.target.value
                                            )
                                        }
                                        placeholder="0.00"
                                    />
                                </div>
                            </label>

                            <button
                                type="button"
                                onClick={handleDistributeEvenly}
                                disabled={totalBudget <= 0}
                            >
                                {t('admin.budgetSection.planner.distributeEvenly', 'Split Evenly')}
                            </button>
                        </div>

                        <div className="admin-planner-overview-stats">
                            <div>
                                <span>{t('admin.budgetSection.planner.monthlyBudget', 'Monthly Budget')}</span>

                                <strong>
                                    {formatNumber(formatCurrency(
                                        totalMonthlyBudget
                                    ))}
                                </strong>
                            </div>

                            <div>
                                <span>{t('admin.budgetSection.planner.planned', 'Planned')}</span>

                                <strong>
                                    {formatNumber(formatCurrency(
                                        totalPlanned
                                    ))}
                                </strong>
                            </div>

                            <div
                                className={
                                    remainingToSpend < 0
                                        ? 'negative'
                                        : ''
                                }
                            >
                                <span>
                                    {remainingToSpend < 0
                                        ? t('admin.budgetSection.planner.overBudget', 'Over Budget')
                                        : t('admin.budgetSection.planner.remaining', 'Remaining')}
                                </span>

                                <strong>
                                    {formatNumber(formatCurrency(
                                        Math.abs(
                                            remainingToSpend
                                        )
                                    ))}
                                </strong>
                            </div>
                        </div>

                        <div className="admin-planner-allocation">
                            <div className="admin-planner-allocation-bar">
                                <div
                                    className={`admin-planner-allocation-fill${
                                        allocationValid
                                            ? ' balanced'
                                            : allocationDifference < 0
                                                ? ' over'
                                                : ''
                                    }`}
                                    style={{
                                        width: `${
                                            totalBudget > 0
                                                ? Math.min(
                                                    (totalMonthlyBudget /
                                                        totalBudget) *
                                                    100,
                                                    100
                                                )
                                                : 0
                                        }%`,
                                    }}
                                />
                            </div>

                            <span
                                className={
                                    allocationValid
                                        ? 'balanced'
                                        : allocationDifference < 0
                                            ? 'negative'
                                            : ''
                                }
                            >
                                {allocationValid
                                    ? t('admin.budgetSection.planner.allocatedFully', 'Budget fully allocated')
                                    : allocationDifference < 0
                                        ? `${formatNumber(formatCurrency(
                                            Math.abs(
                                                allocationDifference
                                            )
                                        ))} ${t('admin.budgetSection.planner.overAllocated', 'over-allocated')}`
                                        : `${formatNumber(formatCurrency(
                                            allocationDifference
                                        ))} ${t('admin.budgetSection.planner.leftToAllocate', 'left to allocate')}`}
                            </span>
                        </div>
                    </section>

                    {/* =================================================
                        MONTHLY PLAN
                    ================================================== */}

                    <section className="admin-planner-months">
                        <div className="admin-planner-section-heading">
                            <h2>{t('admin.budgetSection.planner.monthlyPlan', 'Monthly Plan')}</h2>

                            <p>
                                {t('admin.budgetSection.planner.monthlyPlanDesc', "Set each month's budget and add the expenses you expect during that month.")}
                            </p>
                        </div>

                        {monthlyTotals.map(
                            ({
                                 month,
                                 items,
                                 budgeted,
                                 planned,
                                 remaining,
                             }) => {
                                const form =
                                    itemForms[month] ||
                                    emptyItemForm;

                                const isOpen =
                                    expandedMonth === month;

                                return (
                                    <div
                                        key={month}
                                        className={`admin-planner-month-card${
                                            isOpen
                                                ? ' open'
                                                : ''
                                        }`}
                                    >
                                        {/* Month header */}

                                        <button
                                            type="button"
                                            className="admin-planner-month-header"
                                            onClick={() =>
                                                setExpandedMonth(
                                                    isOpen
                                                        ? null
                                                        : month
                                                )
                                            }
                                            aria-expanded={isOpen}
                                        >
                                            <span className="admin-planner-month-name">
                                                {formatMonthLabel(month, language, formatNumber)}
                                            </span>

                                            <span className="admin-planner-month-metrics">
                                                <span>
                                                    {t('admin.budgetSection.planner.budget', 'Budget')}{' '}
                                                    <strong>
                                                        {formatNumber(formatCurrency(
                                                            budgeted
                                                        ))}
                                                    </strong>
                                                </span>

                                                <span>
                                                    {t('admin.budgetSection.planner.planned', 'Planned')}{' '}
                                                    <strong>
                                                        {formatNumber(formatCurrency(
                                                            planned
                                                        ))}
                                                    </strong>
                                                </span>

                                                <span
                                                    className={
                                                        remaining < 0
                                                            ? 'negative'
                                                            : ''
                                                    }
                                                >
                                                    {remaining < 0
                                                        ? t('admin.budgetSection.planner.over', 'Over ')
                                                        : t('admin.budgetSection.planner.left', 'Left ')}

                                                    <strong>
                                                        {formatNumber(formatCurrency(
                                                            Math.abs(
                                                                remaining
                                                            )
                                                        ))}
                                                    </strong>
                                                </span>
                                            </span>

                                            <span
                                                className="admin-planner-month-chevron"
                                                aria-hidden="true"
                                            >
                                                {isOpen ? '−' : '+'}
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div className="admin-planner-month-content">
                                                {/* Monthly budget */}

                                                <div className="admin-planner-month-budget">
                                                    <label>
                                                        <span>
                                                            {t('admin.budgetSection.planner.monthlyBudget', 'Monthly Budget')}
                                                        </span>

                                                        <div className="admin-planner-money-input">
                                                            <span>$</span>

                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={
                                                                    monthlyBudget[
                                                                        month
                                                                        ] || ''
                                                                }
                                                                onChange={(event) =>
                                                                    handleBudgetMonthChange(
                                                                        month,
                                                                        event.target.value
                                                                    )
                                                                }
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </label>
                                                </div>

                                                {/* Planned expenses */}

                                                <div className="admin-planner-planned-expenses">
                                                    <div className="admin-planner-subsection-header">
                                                        <h3>
                                                            {t('admin.budgetSection.planner.plannedExpenses', 'Planned Expenses')}
                                                        </h3>

                                                        <p>
                                                            {t('admin.budgetSection.planner.plannedExpensesDesc', 'Add expenses you expect to make this month.')}
                                                        </p>
                                                    </div>

                                                    <form
                                                        className="admin-planner-add-expense"
                                                        onSubmit={(event) =>
                                                            handleAddMonthlyItem(
                                                                event,
                                                                month
                                                            )
                                                        }
                                                    >
                                                        <label>
                                                            <span>
                                                                {t('admin.budgetSection.planner.headers.item', 'Expense')}
                                                            </span>

                                                            <input
                                                                type="text"
                                                                placeholder={t('admin.budgetSection.planner.expenseItemPlaceholder', 'e.g. Groceries')}
                                                                value={form.item}
                                                                onChange={(event) =>
                                                                    handleItemFormChange(
                                                                        month,
                                                                        'item',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        </label>

                                                        <label>
                                                            <span>
                                                                {t('admin.budgetSection.planner.headers.category', 'Category')}
                                                            </span>

                                                            <select
                                                                value={
                                                                    form.category
                                                                }
                                                                onChange={(event) =>
                                                                    handleItemFormChange(
                                                                        month,
                                                                        'category',
                                                                        event.target.value
                                                                    )
                                                                }
                                                            >
                                                                {DEFAULT_CATEGORIES.map(
                                                                    (
                                                                        category
                                                                    ) => (
                                                                        <option
                                                                            key={
                                                                                category
                                                                            }
                                                                            value={
                                                                                category
                                                                            }
                                                                        >
                                                                            {
                                                                                category
                                                                            }
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>
                                                        </label>

                                                        <label>
                                                            <span>
                                                                {t('admin.budgetSection.planner.headers.amount', 'Amount')}
                                                            </span>

                                                            <div className="admin-planner-money-input">
                                                                <span>$</span>

                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    placeholder="0.00"
                                                                    value={
                                                                        form.amount
                                                                    }
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        handleItemFormChange(
                                                                            month,
                                                                            'amount',
                                                                            event
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        </label>

                                                        <button
                                                            type="submit"
                                                            disabled={
                                                                !form.item.trim() ||
                                                                form.amount === ''
                                                            }
                                                        >
                                                            {t('admin.budgetSection.planner.addExpenseBtn', 'Add expense')}
                                                        </button>
                                                    </form>

                                                    {/* Existing expenses */}

                                                    {items.length > 0 ? (
                                                        <div className="admin-planner-expense-list">
                                                            <div className="admin-planner-expense-list-header">
                                                                <span>
                                                                    {t('admin.budgetSection.planner.headers.item', 'Expense')}
                                                                </span>

                                                                <span>
                                                                    {t('admin.budgetSection.planner.headers.category', 'Category')}
                                                                </span>

                                                                <span>
                                                                    {t('admin.budgetSection.planner.headers.amount', 'Amount')}
                                                                </span>

                                                                <span/>
                                                            </div>

                                                            {items.map(
                                                                (item) => (
                                                                    <div
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        className="admin-planner-expense-row"
                                                                    >
                                                                        <div className="admin-planner-expense-name">
                                                                            <strong>
                                                                                {
                                                                                    item.item
                                                                                }
                                                                            </strong>
                                                                        </div>

                                                                        <div className="admin-planner-expense-category">
                                                                            {
                                                                                item.category
                                                                            }
                                                                        </div>

                                                                        <strong
                                                                            className="admin-planner-expense-amount">
                                                                            {formatNumber(formatCurrency(
                                                                                Number(
                                                                                    item.amount
                                                                                ) ||
                                                                                0
                                                                            ))}
                                                                        </strong>

                                                                        <button
                                                                            type="button"
                                                                            className="admin-planner-delete-expense"
                                                                            onClick={() =>
                                                                                handleDeleteMonthlyItem(
                                                                                    item.id
                                                                                )
                                                                            }
                                                                            aria-label={`${t('admin.actions.delete', 'Delete')} ${item.item}`}
                                                                            title={t('admin.budgetSection.planner.deleteExpenseTitle', 'Delete expense')}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="admin-planner-no-expenses">
                                                            <strong>
                                                                {t('admin.budgetSection.planner.noExpensesYet', 'No expenses yet')}
                                                            </strong>

                                                            <span>
                                                                {t('admin.budgetSection.planner.addExpectedAbove', 'Add your expected expenses above.')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default BudgetPlanner;
