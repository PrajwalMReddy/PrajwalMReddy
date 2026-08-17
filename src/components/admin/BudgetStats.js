import React from 'react';
import { formatCurrency } from '../../utils/budgetApi';

const StatCard = ({ label, value, negative }) => (
    <div className={`admin-stat-card${negative ? ' negative' : ''}`}>
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-value">{value}</span>
    </div>
);

const CategoryBar = ({ name, value, maxValue }) => {
    const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="admin-bar-row">
            <span className="admin-bar-label">{name}</span>
            <div className="admin-bar-track">
                <div className="admin-bar-fill" style={{ width: `${width}%` }} />
            </div>
            <span className="admin-bar-value">{formatCurrency(value)}</span>
        </div>
    );
};

const BudgetStats = ({ stats }) => {
    if (!stats) return null;

    const { funds, spending, budget, transactionStats, ayana, categories, chartData } = stats;
    const maxCategory = categories.length > 0 ? categories[0].spending : 0;
    const maxMonthly = Math.max(
        ...chartData.monthlyTrend.flatMap((m) => [m.expenses, m.income]),
        1
    );

    return (
        <div className="admin-stats">
            <section className="admin-stats-section">
                <h2>Funds</h2>
                <div className="admin-stat-grid">
                    <StatCard label="Injections" value={formatCurrency(funds.injections)} />
                    <StatCard label="Other Income" value={formatCurrency(funds.otherIncome)} />
                    <StatCard label="Total Funds" value={formatCurrency(funds.totalFunds)} />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>Spending</h2>
                <div className="admin-stat-grid">
                    <StatCard label="Expenses" value={formatCurrency(spending.expenses)} />
                    <StatCard label="Real Spent" value={formatCurrency(spending.realSpent)} />
                    <StatCard label="Real Avg / Month" value={formatCurrency(spending.realAvgPerMonth)} />
                    <StatCard label="Months Left" value={spending.monthsLeft.toFixed(2)} />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>Budget</h2>
                <div className="admin-stat-grid">
                    <StatCard label="ME Budgeted" value={formatCurrency(budget.meBudgeted)} />
                    <StatCard
                        label="ME Surplus"
                        value={formatCurrency(budget.meSurplus)}
                        negative={budget.meSurplus < 0}
                    />
                    <StatCard label="Net Balance" value={formatCurrency(budget.netBalance)} />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>Transaction Statistics</h2>
                <div className="admin-stat-grid admin-stat-grid-6">
                    <StatCard label="Q1" value={formatCurrency(transactionStats.q1)} />
                    <StatCard label="Tran Med" value={formatCurrency(transactionStats.median)} />
                    <StatCard label="Q3" value={formatCurrency(transactionStats.q3)} />
                    <StatCard label="Tran Mean" value={formatCurrency(transactionStats.mean)} />
                    <StatCard label="Trim Mean" value={formatCurrency(transactionStats.trimMean)} />
                    <StatCard label="Tran Mode" value={formatCurrency(transactionStats.mode)} />
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>Ayana (6-month period)</h2>
                <div className="admin-stat-grid">
                    <StatCard label="Completed Ayanas" value={ayana.completedAyanas.toFixed(2)} />
                    <StatCard label="Real Avg / Ayana" value={formatCurrency(ayana.realAvgPerAyana)} />
                    <StatCard label="AE Budgeted" value={formatCurrency(ayana.aeBudgeted)} />
                    <StatCard
                        label="AE Surplus"
                        value={formatCurrency(ayana.aeSurplus)}
                        negative={ayana.aeSurplus < 0}
                    />
                </div>
            </section>

            <div className="admin-stats-columns">
                <section className="admin-stats-section">
                    <h2>Category Spending</h2>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Spending</th>
                                <th>Spending / Ayana</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((cat) => (
                                <tr key={cat.category}>
                                    <td>{cat.category}</td>
                                    <td>{formatCurrency(cat.spending)}</td>
                                    <td>{formatCurrency(cat.spendingPerAyana)}</td>
                                </tr>
                            ))}
                            <tr className="admin-table-total">
                                <td>Total</td>
                                <td>{formatCurrency(spending.expenses)}</td>
                                <td>{formatCurrency(categories.reduce((s, c) => s + c.spendingPerAyana, 0))}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className="admin-stats-section">
                    <h2>Category Breakdown</h2>
                    <div className="admin-bar-chart">
                        {categories.slice(0, 10).map((cat) => (
                            <CategoryBar
                                key={cat.category}
                                name={cat.category}
                                value={cat.spending}
                                maxValue={maxCategory}
                            />
                        ))}
                    </div>
                </section>
            </div>

            <section className="admin-stats-section">
                <h2>Monthly Trend</h2>
                <div className="admin-monthly-chart">
                    {chartData.monthlyTrend.map((month) => (
                        <div key={month.month} className="admin-monthly-group">
                            <div className="admin-monthly-bars">
                                <div
                                    className="admin-monthly-bar income"
                                    style={{ height: `${(month.income / maxMonthly) * 100}%` }}
                                    title={`Income: ${formatCurrency(month.income)}`}
                                />
                                <div
                                    className="admin-monthly-bar expenses"
                                    style={{ height: `${(month.expenses / maxMonthly) * 100}%` }}
                                    title={`Expenses: ${formatCurrency(month.expenses)}`}
                                />
                            </div>
                            <span className="admin-monthly-label">{month.month.slice(5)}</span>
                        </div>
                    ))}
                </div>
                <div className="admin-chart-legend">
                    <span className="legend-income">Income</span>
                    <span className="legend-expenses">Expenses</span>
                </div>
            </section>

            <section className="admin-stats-section">
                <h2>Income vs Expenses</h2>
                <div className="admin-comparison-chart">
                    <div className="admin-comparison-bar">
                        <div
                            className="admin-comparison-fill income"
                            style={{
                                width: `${(chartData.incomeVsExpenses.income / Math.max(chartData.incomeVsExpenses.income, chartData.incomeVsExpenses.expenses, 1)) * 100}%`,
                            }}
                        />
                        <span>Income: {formatCurrency(chartData.incomeVsExpenses.income)}</span>
                    </div>
                    <div className="admin-comparison-bar">
                        <div
                            className="admin-comparison-fill expenses"
                            style={{
                                width: `${(chartData.incomeVsExpenses.expenses / Math.max(chartData.incomeVsExpenses.income, chartData.incomeVsExpenses.expenses, 1)) * 100}%`,
                            }}
                        />
                        <span>Expenses: {formatCurrency(chartData.incomeVsExpenses.expenses)}</span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BudgetStats;
