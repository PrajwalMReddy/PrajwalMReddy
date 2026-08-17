const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000;
const AYANA_MONTHS = 6;

function monthsBetween(start, end) {
    return (end.getTime() - start.getTime()) / MS_PER_MONTH;
}

function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function computeTransactionStats(costs) {
    if (costs.length === 0) {
        return { q1: 0, median: 0, q3: 0, mean: 0, trimMean: 0, mode: 0 };
    }

    const sorted = [...costs].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / sorted.length;

    const trimCount = Math.floor(sorted.length * 0.1);
    const trimmed =
        sorted.length > trimCount * 2
            ? sorted.slice(trimCount, sorted.length - trimCount)
            : sorted;
    const trimMean =
        trimmed.reduce((acc, v) => acc + v, 0) / (trimmed.length || 1);

    const frequency = {};
    let mode = sorted[0];
    let maxFreq = 0;
    for (const cost of costs) {
        const key = cost.toFixed(2);
        frequency[key] = (frequency[key] || 0) + 1;
        if (frequency[key] > maxFreq) {
            maxFreq = frequency[key];
            mode = cost;
        }
    }

    return {
        q1: round(percentile(sorted, 0.25)),
        median: round(percentile(sorted, 0.5)),
        q3: round(percentile(sorted, 0.75)),
        mean: round(mean),
        trimMean: round(trimMean),
        mode: round(mode),
    };
}

function computeBudgetStats(expenses, income, settings) {
    const now = new Date();
    const ayanaStart = settings.ayanaStartDate
        ? new Date(settings.ayanaStartDate)
        : now;

    const totalInjections = income
        .filter((entry) => entry.type === 'injection')
        .reduce((sum, entry) => sum + entry.value, 0);

    const otherIncome = income
        .filter((entry) => entry.type === 'other')
        .reduce((sum, entry) => sum + entry.value, 0);

    const totalFunds = totalInjections + otherIncome;
    const totalExpenses = expenses.reduce((sum, entry) => sum + entry.cost, 0);
    const realSpent = totalExpenses - otherIncome;

    const monthsElapsed = Math.max(monthsBetween(ayanaStart, now), 1 / 30);
    const completedAyanas = monthsBetween(ayanaStart, now) / AYANA_MONTHS;

    const realAvgPerMonth = realSpent / monthsElapsed;
    const netBalance = totalFunds - totalExpenses;
    const monthsLeft = realAvgPerMonth > 0 ? netBalance / realAvgPerMonth : 0;

    const meBudgeted = settings.meBudgeted || 0;
    const aeBudgeted = settings.aeBudgeted || 0;
    const meSurplus = meBudgeted - realSpent;
    const aeSurplus = aeBudgeted - realSpent;

    const categoryMap = {};
    for (const expense of expenses) {
        const cat = expense.category || 'Uncategorized';
        categoryMap[cat] = (categoryMap[cat] || 0) + expense.cost;
    }

    const ayanaDivisor = completedAyanas > 0 ? completedAyanas : 1;
    const categories = Object.entries(categoryMap)
        .map(([category, spending]) => ({
            category,
            spending: round(spending),
            spendingPerAyana: round(spending / ayanaDivisor),
        }))
        .sort((a, b) => b.spending - a.spending);

    const costs = expenses.map((e) => e.cost);
    const transactionStats = computeTransactionStats(costs);

    return {
        funds: {
            injections: round(totalInjections),
            otherIncome: round(otherIncome),
            totalFunds: round(totalFunds),
        },
        spending: {
            expenses: round(totalExpenses),
            realSpent: round(realSpent),
            realAvgPerMonth: round(realAvgPerMonth),
            monthsLeft: round(monthsLeft),
        },
        budget: {
            meBudgeted: round(meBudgeted),
            meSurplus: round(meSurplus),
            netBalance: round(netBalance),
        },
        transactionStats,
        ayana: {
            completedAyanas: round(completedAyanas),
            realAvgPerAyana: round(realSpent / ayanaDivisor),
            aeBudgeted: round(aeBudgeted),
            aeSurplus: round(aeSurplus),
        },
        categories,
        chartData: {
            categoryBreakdown: categories.map((c) => ({
                name: c.category,
                value: c.spending,
            })),
            monthlyTrend: computeMonthlyTrend(expenses, income),
            incomeVsExpenses: {
                income: round(totalFunds),
                expenses: round(totalExpenses),
            },
        },
    };
}

function computeMonthlyTrend(expenses, income) {
    const monthMap = {};

    for (const expense of expenses) {
        const date = new Date(expense.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) {
            monthMap[key] = { month: key, expenses: 0, income: 0 };
        }
        monthMap[key].expenses += expense.cost;
    }

    for (const entry of income) {
        const date = new Date(entry.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) {
            monthMap[key] = { month: key, expenses: 0, income: 0 };
        }
        monthMap[key].income += entry.value;
    }

    return Object.values(monthMap)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({
            month: m.month,
            expenses: round(m.expenses),
            income: round(m.income),
        }));
}

module.exports = { computeBudgetStats, AYANA_MONTHS };
