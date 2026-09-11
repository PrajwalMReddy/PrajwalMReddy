import React from 'react';
import { useContent } from '../../utils/ContentContext';
import { formatCurrency } from '../../utils/budgetApi';

const StatCard = ({ label, value, negative }) => (
    <div className={`admin-stat-card${negative ? ' negative' : ''}`}>
        <span className="admin-stat-label">{label}</span>
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
        funds,
        spending,
        budget,
        transactionStats,
        ayana,
        categories,
        chartData,
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

    const aeBudgeted = Number.isFinite(Number(ayana?.aeBudgeted))
        ? Number(ayana.aeBudgeted)
        : 0;

    const totalCategorySpending = categoryList.reduce(
        (sum, cat) => sum + (Number(cat.spending) || 0),
        0
    );

    const maxCategory =
        categoryList.length > 0
            ? Math.max(...categoryList.map((cat) => Number(cat.spending) || 0))
            : 0;

    const maxMonthly = Math.max(
        ...monthlyTrend.flatMap((month) => [
            Number(month.expenses) || 0,
            Number(month.income) || 0,
        ]),
        1
    );

    const comparisonMax = Math.max(
        Number(incomeVsExpenses.income) || 0,
        Number(incomeVsExpenses.expenses) || 0,
        1
    );

    return (
        <div className="admin-stats">
            <section className="admin-stats-section">
                <h2>💰 {t('admin.budgetSection.stats.funds', 'Funds')}</h2>

                <div className="admin-stat-grid admin-stat-grid-3">
                    <StatCard
                        label={t('admin.budgetSection.stats.injections', 'Injections')}
                        value={formatVal(funds.injections)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.otherIncome', 'Other Income')}
                        value={formatVal(funds.otherIncome)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.totalFunds', 'Total Funds')}
                        value={formatVal(funds.totalFunds)}
                    />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>💸 {t('admin.budgetSection.stats.spending', 'Spending')}</h2>

                <div className="admin-stat-grid admin-stat-grid-4">
                    <StatCard
                        label={t('admin.budgetSection.stats.expenses', 'Expenses')}
                        value={formatVal(spending.expenses)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.realSpent', 'Real Spent')}
                        value={formatVal(spending.realSpent)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.realAvgPerMonth', 'Real Avg / Month')}
                        value={formatVal(spending.realAvgPerMonth)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.monthsLeft', 'Months Left')}
                        value={formatNum(spending.monthsLeft)}
                    />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>🎯 {t('admin.budgetSection.stats.budget', 'Budget')}</h2>

                <div className="admin-stat-grid admin-stat-grid-3">
                    <StatCard
                        label={t('admin.budgetSection.stats.meBudgeted', 'ME Budgeted (to date)')}
                        value={formatVal(meBudgeted)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.meSurplus', 'ME Surplus')}
                        value={formatVal(budget.meSurplus)}
                        negative={budget.meSurplus < 0}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.netBalance', 'Net Balance')}
                        value={formatVal(budget.netBalance)}
                    />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>📊 {t('admin.budgetSection.stats.transactionStats', 'Transaction Statistics')}</h2>

                <div className="admin-stat-grid admin-stat-grid-6">
                    <StatCard
                        label={t('admin.budgetSection.stats.q1', 'Q1')}
                        value={formatVal(transactionStats.q1)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.median', 'Tran Med')}
                        value={formatVal(transactionStats.median)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.q3', 'Q3')}
                        value={formatVal(transactionStats.q3)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.mean', 'Tran Mean')}
                        value={formatVal(transactionStats.mean)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.trimMean', 'Trim Mean')}
                        value={formatVal(transactionStats.trimMean)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.mode', 'Tran Mode')}
                        value={formatVal(transactionStats.mode)}
                    />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>🗓️ {t('admin.budgetSection.stats.ayanaPeriod', 'Ayana (6-month period)')}</h2>

                <div className="admin-stat-grid admin-stat-grid-4">
                    <StatCard
                        label={t('admin.budgetSection.stats.completedAyanas', 'Completed Ayanas')}
                        value={formatNum(ayana.completedAyanas)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.realAvgPerAyana', 'Real Avg / Ayana')}
                        value={formatVal(ayana.realAvgPerAyana)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.aeBudgeted', 'AE Budgeted (to date)')}
                        value={formatVal(aeBudgeted)}
                    />

                    <StatCard
                        label={t('admin.budgetSection.stats.aeSurplus', 'AE Surplus')}
                        value={formatVal(ayana.aeSurplus)}
                        negative={ayana.aeSurplus < 0}
                    />
                </div>
            </section>

            <div className="admin-stats-columns">
                <section className="admin-stats-section">
                    <h2>🏷️ {t('admin.budgetSection.stats.categorySpending', 'Category Spending')}</h2>

                    <table className="admin-table">
                        <thead>
                        <tr>
                            <th>{t('admin.budgetSection.headers.category', 'Category')}</th>
                            <th>{t('admin.budgetSection.stats.spending', 'Spending')}</th>
                            <th>{t('admin.budgetSection.stats.spendingPerAyana', 'Spending / Ayana')}</th>
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
                            <td>{t('admin.budgetSection.stats.total', 'Total')}</td>

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
                    <h2>📈 {t('admin.budgetSection.stats.categoryBreakdown', 'Category Breakdown')}</h2>

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
                <h2>{t('admin.budgetSection.stats.monthlyTrend', 'Monthly Trend')}</h2>

                <div className="admin-monthly-chart">
                    {monthlyTrend.map((month) => (
                        <div
                            key={month.month}
                            className="admin-monthly-group"
                        >
                            <div className="admin-monthly-bars">
                                <div
                                    className="admin-monthly-bar income"
                                    style={{
                                        height: `${
                                            ((Number(month.income) || 0) /
                                                maxMonthly) *
                                            100
                                        }%`,
                                    }}
                                    title={`${t('admin.budgetSection.stats.incomeLabel', 'Income:')} ${formatVal(
                                        month.income
                                    )}`}
                                />

                                <div
                                    className="admin-monthly-bar expenses"
                                    style={{
                                        height: `${
                                            ((Number(month.expenses) || 0) /
                                                maxMonthly) *
                                            100
                                        }%`,
                                    }}
                                    title={`${t('admin.budgetSection.stats.expensesLabel', 'Expenses:')} ${formatVal(
                                        month.expenses
                                    )}`}
                                />
                            </div>

                            <span className="admin-monthly-label">
                                {formatNumber(month.month.slice(5))}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="admin-chart-legend">
                    <span className="legend-income">{t('admin.budgetSection.stats.income', 'Income')}</span>
                    <span className="legend-expenses">{t('admin.budgetSection.stats.expenses', 'Expenses')}</span>
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>{t('admin.budgetSection.stats.incomeVsExpenses', 'Income vs Expenses')}</h2>

                <div className="admin-comparison-chart">
                    <div className="admin-comparison-bar">
                        <div
                            className="admin-comparison-fill income"
                            style={{
                                width: `${
                                    ((Number(
                                            incomeVsExpenses.income
                                        ) || 0) /
                                        comparisonMax) *
                                    100
                                }%`,
                            }}
                        />

                        <span>
                            {t('admin.budgetSection.stats.incomeLabel', 'Income:')}{' '}
                            {formatVal(incomeVsExpenses.income)}
                        </span>
                    </div>

                    <div className="admin-comparison-bar">
                        <div
                            className="admin-comparison-fill expenses"
                            style={{
                                width: `${
                                    ((Number(
                                            incomeVsExpenses.expenses
                                        ) || 0) /
                                        comparisonMax) *
                                    100
                                }%`,
                            }}
                        />

                        <span>
                            {t('admin.budgetSection.stats.expensesLabel', 'Expenses:')}{' '}
                            {formatVal(incomeVsExpenses.expenses)}
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BudgetStats;
