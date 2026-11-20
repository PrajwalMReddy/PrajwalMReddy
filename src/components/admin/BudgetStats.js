import React, { useState } from 'react';
import { useContent } from '../../utils/ContentContext';
import { formatCurrency } from '../../utils/budgetApi';

const StatCard = ({ label, value, negative }) => (
    <div className={`admin-stat-card${negative ? ' negative' : ''}`}>
        <span className="admin-stat-label" title={label}>{label}</span>
        <span className="admin-stat-value">{value}</span>
    </div>
);

const CategoryBar = ({ name, value, totalValue, maxValue, formatVal }) => {
    const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 3) : 0;
    const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';

    return (
        <div className="admin-bar-row">
            <div className="admin-bar-header">
                <span className="admin-bar-label" title={name}>{name}</span>
                <span className="admin-bar-value">
                    <span className="admin-bar-pct">{pct}%</span>
                    <strong>{formatVal(value)}</strong>
                </span>
            </div>
            <div className="admin-bar-track">
                <div
                    className="admin-bar-fill"
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    );
};

const BudgetStats = ({ stats }) => {
    const { t, formatNumber } = useContent();

    if (!stats) return null;

    const {
        funds = {},
        spending = {},
        budget = {},
        transactionStats = {},
        ayana = {},
        categories = [],
        chartData = {},
    } = stats;

    const formatVal = (val) => formatNumber(formatCurrency(val));
    const formatNum = (num, digits = 2) => formatNumber(Number(num || 0).toFixed(digits));

    const categoryList = Array.isArray(categories) ? categories : [];

    const monthlyTrend = Array.isArray(chartData?.monthlyTrend)
        ? chartData.monthlyTrend
        : [];

    const incomeVsExpenses = chartData?.incomeVsExpenses || {
        income: 0,
        expenses: 0,
    };

    const meBudgeted = Number.isFinite(Number(budget?.meBudgeted))
        ? Number(budget.meBudgeted)
        : 0;

    const thisMonthBudgeted = Number.isFinite(Number(budget?.thisMonthBudgeted))
        ? Number(budget.thisMonthBudgeted)
        : 0;

    const thisMonthSpending = Number.isFinite(Number(budget?.thisMonthSpending))
        ? Number(budget.thisMonthSpending)
        : 0;

    const thisMonthSurplus =
        budget?.thisMonthSurplus !== undefined
            ? Number(budget.thisMonthSurplus)
            : thisMonthBudgeted - thisMonthSpending;

    const aeBudgeted = Number.isFinite(Number(ayana?.aeBudgeted))
        ? Number(ayana.aeBudgeted)
        : 0;

    const thisAyanaBudgeted = Number.isFinite(Number(ayana?.thisAyanaBudgeted))
        ? Number(ayana.thisAyanaBudgeted)
        : 0;

    const thisAyanaSpending = Number.isFinite(Number(ayana?.thisAyanaSpending))
        ? Number(ayana.thisAyanaSpending)
        : 0;

    const thisAyanaSurplus =
        ayana?.thisAyanaSurplus !== undefined
            ? Number(ayana.thisAyanaSurplus)
            : thisAyanaBudgeted - thisAyanaSpending;

    const totalCategorySpending = categoryList.reduce(
        (sum, cat) => sum + (Number(cat.spending) || 0),
        0
    );

    const maxCategory =
        categoryList.length > 0
            ? Math.max(...categoryList.map((cat) => Number(cat.spending) || 0))
            : 0;

    const [trendFilter, setTrendFilter] = useState('expenses');

    const visibleMonthlyValues = monthlyTrend.flatMap((month) => {
        const vals = [];
        const monthIncome = Number(month.income) || 0;
        const monthExpenses = Number(month.expenses) || 0;
        const monthRepayment = Number(month.repayment ?? month.repayments ?? month.otherIncome) || 0;
        const monthNetExpenses =
            month.netExpenses !== undefined
                ? Number(month.netExpenses)
                : monthExpenses - monthIncome;
        const monthRealSpent =
            month.realSpent !== undefined
                ? Number(month.realSpent)
                : monthExpenses - monthRepayment;

        if (trendFilter === 'all' || trendFilter === 'expenses') {
            vals.push(monthExpenses);
        }
        if (trendFilter === 'all' || trendFilter === 'income') {
            vals.push(monthIncome);
        }
        if (trendFilter === 'all' || trendFilter === 'realSpent') {
            vals.push(Math.max(monthRealSpent, 0));
        }
        if (trendFilter === 'all' || trendFilter === 'netExpenses') {
            vals.push(Math.max(monthNetExpenses, 0));
        }
        return vals;
    });

    const maxMonthly = Math.max(...visibleMonthlyValues, 1);
    const chartMax = maxMonthly * 1.08;

    const comparisonMax = Math.max(
        Number(incomeVsExpenses.expenses) || 0,
        Number(incomeVsExpenses.income) || 0,
        1
    );

    const netBalance =
        budget?.netBalance !== undefined
            ? Number(budget.netBalance)
            : (Number(funds?.totalFunds ?? incomeVsExpenses?.income) || 0) -
              (Number(spending?.expenses ?? incomeVsExpenses?.expenses) || 0);

    return (
        <div className="admin-stats">
            <div className="admin-stats-overview">
                <section className="admin-stats-section">
                    <h2>{t('admin.budgetSection.stats.funds')}</h2>

                    <div className="admin-stat-grid admin-stat-grid-5">
                        <StatCard
                            label={t('admin.budgetSection.stats.injections')}
                            value={formatVal(funds.injections)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.income')}
                            value={formatVal(funds.income)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.repayment')}
                            value={formatVal(funds.repayment ?? funds.repayments ?? funds.otherIncome)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.totalFunds')}
                            value={formatVal(funds.totalFunds)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.netBalance')}
                            value={formatVal(netBalance)}
                            negative={netBalance < 0}
                        />
                    </div>
                </section>

                <section className="admin-stats-section">
                    <h2>{t('admin.budgetSection.stats.spending')}</h2>

                    <div className="admin-stat-grid admin-stat-grid-4">
                        <StatCard
                            label={t('admin.budgetSection.stats.expenses')}
                            value={formatVal(spending.expenses)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.realSpent')}
                            value={formatVal(spending.realSpent)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.realAvgPerMonth')}
                            value={formatVal(spending.realAvgPerMonth)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.monthsLeft')}
                            value={formatNum(spending.monthsLeft)}
                        />
                    </div>
                </section>

                <section className="admin-stats-section">
                    <h2>{t('admin.budgetSection.stats.budget')}</h2>

                    <div className="admin-stat-subgroup">
                        <span className="admin-stat-subgroup-title">
                            {t('admin.budgetSection.stats.thisMonth')}
                        </span>
                        <div className="admin-stat-grid admin-stat-grid-3">
                            <StatCard
                                label={t('admin.budgetSection.stats.thisMonthBudgeted')}
                                value={formatVal(thisMonthBudgeted)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.monthSpending')}
                                value={formatVal(thisMonthSpending)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.monthSurplus')}
                                value={formatVal(thisMonthSurplus)}
                                negative={thisMonthSurplus < 0}
                            />
                        </div>
                    </div>

                    <div className="admin-stat-subgroup">
                        <span className="admin-stat-subgroup-title">
                            {t('admin.budgetSection.stats.cumulativeToDate')}
                        </span>
                        <div className="admin-stat-grid admin-stat-grid-2">
                            <StatCard
                                label={t('admin.budgetSection.stats.meBudgeted')}
                                value={formatVal(meBudgeted)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.meSurplus')}
                                value={formatVal(budget.meSurplus)}
                                negative={budget.meSurplus < 0}
                            />
                        </div>
                    </div>
                </section>

                <section className="admin-stats-section">
                    <h2>{t('admin.budgetSection.stats.ayanaPeriod')}</h2>

                    <div className="admin-stat-subgroup">
                        <span className="admin-stat-subgroup-title">
                            {t('admin.budgetSection.stats.currentAyana')}
                        </span>
                        <div className="admin-stat-grid admin-stat-grid-3">
                            <StatCard
                                label={t('admin.budgetSection.stats.thisAyanaBudgeted')}
                                value={formatVal(thisAyanaBudgeted)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.ayanaSpending')}
                                value={formatVal(thisAyanaSpending)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.ayanaSurplus')}
                                value={formatVal(thisAyanaSurplus)}
                                negative={thisAyanaSurplus < 0}
                            />
                        </div>
                    </div>

                    <div className="admin-stat-subgroup">
                        <span className="admin-stat-subgroup-title">
                            {t('admin.budgetSection.stats.horizonToDate')}
                        </span>
                        <div className="admin-stat-grid admin-stat-grid-4">
                            <StatCard
                                label={t('admin.budgetSection.stats.completedAyanas')}
                                value={formatNum(ayana.completedAyanas)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.realAvgPerAyana')}
                                value={formatVal(ayana.realAvgPerAyana)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.aeBudgeted')}
                                value={formatVal(aeBudgeted)}
                            />

                            <StatCard
                                label={t('admin.budgetSection.stats.aeSurplus')}
                                value={formatVal(ayana.aeSurplus)}
                                negative={ayana.aeSurplus < 0}
                            />
                        </div>
                    </div>
                </section>

                <section className="admin-stats-section admin-stats-span-2">
                    <h2>{t('admin.budgetSection.stats.transactionStats')}</h2>

                    <div className="admin-stat-grid admin-stat-grid-6">
                        <StatCard
                            label={t('admin.budgetSection.stats.q1')}
                            value={formatVal(transactionStats.q1)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.median')}
                            value={formatVal(transactionStats.median)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.q3')}
                            value={formatVal(transactionStats.q3)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.mean')}
                            value={formatVal(transactionStats.mean)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.trimMean')}
                            value={formatVal(transactionStats.trimMean)}
                        />

                        <StatCard
                            label={t('admin.budgetSection.stats.mode')}
                            value={formatVal(transactionStats.mode)}
                        />
                    </div>
                </section>
            </div>

            <div className="admin-stats-columns">
                <section className="admin-stats-section">
                    <h2>{t('admin.budgetSection.stats.categorySpending')}</h2>

                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('admin.budgetSection.headers.category')}</th>
                                <th>{t('admin.budgetSection.stats.spending')}</th>
                                <th>{t('admin.budgetSection.stats.spendingPerAyana')}</th>
                            </tr>
                        </thead>

                        <tbody>
                            {categoryList.map((cat) => (
                                <tr key={cat.category}>
                                    <td>{cat.category}</td>
                                    <td>{formatVal(cat.spending)}</td>
                                    <td>{formatVal(cat.spendingPerAyana)}</td>
                                </tr>
                            ))}

                            <tr className="admin-table-total">
                                <td>{t('admin.budgetSection.stats.total')}</td>

                                <td>
                                    {formatVal(spending.expenses)}
                                </td>

                                <td>
                                    {formatVal(
                                        categoryList.reduce(
                                            (sum, category) =>
                                                sum +
                                                (Number(
                                                    category.spendingPerAyana
                                                ) || 0),
                                            0
                                        )
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className="admin-stats-section">
                    <h2>{t('admin.budgetSection.stats.categoryBreakdown')}</h2>

                    <div className="admin-bar-chart">
                        {categoryList.map((cat) => (
                            <CategoryBar
                                key={cat.category}
                                name={cat.category}
                                value={Number(cat.spending) || 0}
                                totalValue={totalCategorySpending}
                                maxValue={maxCategory}
                                formatVal={formatVal}
                            />
                        ))}
                    </div>
                </section>
            </div>

            <section className="admin-stats-section">
                <div className="admin-stats-header-with-actions">
                    <h2>{t('admin.budgetSection.stats.monthlyTrend')}</h2>

                    <div className="admin-trend-filter-group" role="group" aria-label={t('admin.ui.budgetStats.monthlyTrendFilter')}>
                        <button
                            type="button"
                            className={`admin-trend-filter-btn ${trendFilter === 'expenses' ? 'active' : ''}`}
                            onClick={() => setTrendFilter('expenses')}
                        >
                            {t('admin.budgetSection.stats.expenses')}
                        </button>
                        <button
                            type="button"
                            className={`admin-trend-filter-btn ${trendFilter === 'income' ? 'active' : ''}`}
                            onClick={() => setTrendFilter('income')}
                        >
                            {t('admin.budgetSection.stats.income')}
                        </button>
                        <button
                            type="button"
                            className={`admin-trend-filter-btn ${trendFilter === 'realSpent' ? 'active' : ''}`}
                            onClick={() => setTrendFilter('realSpent')}
                            title={t('admin.budgetSection.stats.realSpentTooltip')}
                        >
                            {t('admin.budgetSection.stats.realSpent')}
                        </button>
                        <button
                            type="button"
                            className={`admin-trend-filter-btn ${trendFilter === 'netExpenses' ? 'active' : ''}`}
                            onClick={() => setTrendFilter('netExpenses')}
                            title={t('admin.budgetSection.stats.netExpensesTooltip')}
                        >
                            {t('admin.budgetSection.stats.netExpenses')}
                        </button>
                        <button
                            type="button"
                            className={`admin-trend-filter-btn ${trendFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setTrendFilter('all')}
                        >
                            {t('admin.budgetSection.stats.together')}
                        </button>
                    </div>
                </div>

                <div className={`admin-monthly-chart trend-mode-${trendFilter}`}>
                    {monthlyTrend.map((month) => {
                        const monthStr = String(month.month || '');
                        const monthPart = monthStr.slice(5);
                        const yearPart = monthStr.slice(0, 4);
                        const isOne = parseInt(monthPart, 10) === 1;

                        const monthIncome = Number(month.income) || 0;
                        const monthExpenses = Number(month.expenses) || 0;
                        const monthRepayment = Number(month.repayment ?? month.repayments ?? month.otherIncome) || 0;
                        const monthRealSpent =
                            month.realSpent !== undefined
                                ? Number(month.realSpent)
                                : monthExpenses - monthRepayment;
                        const monthNetExpenses =
                            month.netExpenses !== undefined
                                ? Number(month.netExpenses)
                                : monthExpenses - monthIncome;

                        return (
                            <div
                                key={month.month}
                                className="admin-monthly-group"
                            >
                                <div className="admin-monthly-bars">
                                    {(trendFilter === 'all' || trendFilter === 'expenses') && (
                                        <div
                                            className="admin-monthly-bar expenses"
                                            style={{
                                                height: `${(monthExpenses / chartMax) * 100}%`,
                                            }}
                                            title={`${t('admin.budgetSection.stats.expensesLabel')} ${formatVal(
                                                monthExpenses
                                            )}`}
                                        />
                                    )}

                                    {(trendFilter === 'all' || trendFilter === 'income') && (
                                        <div
                                            className="admin-monthly-bar income"
                                            style={{
                                                height: `${(monthIncome / chartMax) * 100}%`,
                                            }}
                                            title={`${t('admin.budgetSection.stats.incomeLabel')} ${formatVal(
                                                monthIncome
                                            )}`}
                                        />
                                    )}

                                    {(trendFilter === 'all' || trendFilter === 'realSpent') && (
                                        <div
                                            className="admin-monthly-bar real-spent"
                                            style={{
                                                height: `${(Math.max(monthRealSpent, 0) / chartMax) * 100}%`,
                                            }}
                                            title={`${t('admin.budgetSection.stats.realSpentLabel')} ${formatVal(
                                                monthRealSpent
                                            )}`}
                                        />
                                    )}

                                    {(trendFilter === 'all' || trendFilter === 'netExpenses') && (
                                        <div
                                            className="admin-monthly-bar net-expenses"
                                            style={{
                                                height: `${(Math.max(monthNetExpenses, 0) / chartMax) * 100}%`,
                                            }}
                                            title={`${t('admin.budgetSection.stats.netExpensesLabel')} ${formatVal(
                                                monthNetExpenses
                                            )}`}
                                        />
                                    )}
                                </div>

                                <div className="admin-monthly-label-wrapper">
                                    <span className={`admin-monthly-label ${isOne ? 'is-year-start' : ''}`}>
                                        {formatNumber(monthPart)}
                                    </span>
                                    {isOne && (
                                        <span className="admin-monthly-year">
                                            {formatNumber(yearPart)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="admin-chart-legend">
                    {(trendFilter === 'all' || trendFilter === 'expenses') && (
                        <span className="legend-expenses">{t('admin.budgetSection.stats.expenses')}</span>
                    )}
                    {(trendFilter === 'all' || trendFilter === 'income') && (
                        <span className="legend-income">{t('admin.budgetSection.stats.income')}</span>
                    )}
                    {(trendFilter === 'all' || trendFilter === 'realSpent') && (
                        <span className="legend-real-spent">{t('admin.budgetSection.stats.realSpent')}</span>
                    )}
                    {(trendFilter === 'all' || trendFilter === 'netExpenses') && (
                        <span className="legend-net-expenses">{t('admin.budgetSection.stats.netExpenses')}</span>
                    )}
                </div>
            </section>


            <section className="admin-stats-section">
                <h2>{t('admin.budgetSection.stats.incomeVsExpenses')}</h2>

                <div className="admin-comparison-chart">
                    <div className="admin-comparison-bar">
                        <div
                            className="admin-comparison-fill expenses"
                            style={{
                                width: `${((Number(
                                    incomeVsExpenses.expenses
                                ) || 0) /
                                    comparisonMax) *
                                    100
                                    }%`,
                            }}
                        />

                        <span>
                            {t('admin.budgetSection.stats.expensesLabel')}{' '}
                            {formatVal(incomeVsExpenses.expenses)}
                        </span>
                    </div>

                    <div className="admin-comparison-bar">
                        <div
                            className="admin-comparison-fill income"
                            style={{
                                width: `${((Number(
                                    incomeVsExpenses.income
                                ) || 0) /
                                    comparisonMax) *
                                    100
                                    }%`,
                            }}
                        />

                        <span>
                            {t('admin.budgetSection.stats.incomeLabel')}{' '}
                            {formatVal(incomeVsExpenses.income)}
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BudgetStats;
