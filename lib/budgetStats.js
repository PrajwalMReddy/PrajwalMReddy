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

function getMonthKey(dateVal) {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return '';
        return dateVal.toISOString().slice(0, 7);
    }
    const str = String(dateVal).trim();
    const datePart = str.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length >= 2 && parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 7);
    }
    return '';
}

function computeBudgetStats(expenses = [], income = [], settings = {}) {
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const safeIncome = Array.isArray(income) ? income : [];
    const safeSettings = settings || {};

    const now = new Date();
    const ayanaStart = safeSettings.ayanaStartDate
        ? new Date(safeSettings.ayanaStartDate)
        : now;

    const totalInjections = safeIncome
        .filter((entry) => entry.type === 'injection')
        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

    const otherIncome = safeIncome
        .filter((entry) => entry.type === 'other')
        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

    const totalFunds = totalInjections + otherIncome;
    const totalExpenses = safeExpenses.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0);
    const netExpenses = totalExpenses - totalFunds;
    const realSpent = totalExpenses - otherIncome;

    const monthsElapsed = Math.max(monthsBetween(ayanaStart, now), 1 / 30);
    const ayanaDurationMonths = (safeSettings.ayanaMonths || safeSettings.horizons?.ayanaMonths) || AYANA_MONTHS;
    const completedAyanas = monthsBetween(ayanaStart, now) / ayanaDurationMonths;

    const realAvgPerMonth = realSpent / monthsElapsed;
    const netBalance = totalFunds - totalExpenses;
    const monthsLeft = realAvgPerMonth > 0 ? netBalance / realAvgPerMonth : 0;

    const meBudgeted = safeSettings.meBudgeted || 0;
    const aeBudgeted = safeSettings.aeBudgeted || 0;
    const thisMonthBudgeted = safeSettings.thisMonthBudgeted || 0;
    const thisAyanaBudgeted = safeSettings.thisAyanaBudgeted || 0;
    const meSurplus = meBudgeted - realSpent;
    const aeSurplus = aeBudgeted - realSpent;

    // Current month and current ayana spending
    const currentMonthKey = now.toISOString().slice(0, 7);
    const startYear = ayanaStart.getUTCFullYear();
    const startMonth = ayanaStart.getUTCMonth();
    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const monthsDiff = (nowYear - startYear) * 12 + (nowMonth - startMonth);
    const currentAyanaIndex = Math.max(0, Math.floor(monthsDiff / ayanaDurationMonths));
    const currentAyanaStartMonths = currentAyanaIndex * ayanaDurationMonths;

    const currentAyanaMonthSet = new Set();
    for (let i = 0; i < ayanaDurationMonths; i++) {
        const totalMonths = startMonth + currentAyanaStartMonths + i;
        const y = startYear + Math.floor(totalMonths / 12);
        const m = (totalMonths % 12) + 1;
        currentAyanaMonthSet.add(`${y}-${String(m).padStart(2, '0')}`);
    }

    let thisMonthSpending = 0;
    let thisAyanaSpending = 0;
    for (const expense of safeExpenses) {
        const key = getMonthKey(expense.date);
        if (!key) continue;
        const cost = Number(expense.cost) || 0;
        if (key === currentMonthKey) {
            thisMonthSpending += cost;
        }
        if (currentAyanaMonthSet.has(key)) {
            thisAyanaSpending += cost;
        }
    }

    const categoryMap = {};
    for (const expense of safeExpenses) {
        const cat = expense.category || 'Uncategorized';
        categoryMap[cat] = (categoryMap[cat] || 0) + (Number(expense.cost) || 0);
    }

    const ayanaDivisor = completedAyanas > 0 ? completedAyanas : 1;
    const categories = Object.entries(categoryMap)
        .map(([category, spending]) => ({
            category,
            spending: round(spending),
            spendingPerAyana: round(spending / ayanaDivisor),
        }))
        .sort((a, b) => b.spending - a.spending);

    const costs = safeExpenses.map((e) => Number(e.cost) || 0);
    const transactionStats = computeTransactionStats(costs);

    return {
        funds: {
            injections: round(totalInjections),
            otherIncome: round(otherIncome),
            totalFunds: round(totalFunds),
        },
        spending: {
            expenses: round(totalExpenses),
            netExpenses: round(netExpenses),
            realSpent: round(realSpent),
            realAvgPerMonth: round(realAvgPerMonth),
            monthsLeft: round(monthsLeft),
        },
        budget: {
            meBudgeted: round(meBudgeted),
            thisMonthBudgeted: round(thisMonthBudgeted),
            meSurplus: round(meSurplus),
            netBalance: round(netBalance),
            thisMonthSpending: round(thisMonthSpending),
        },
        transactionStats,
        ayana: {
            completedAyanas: round(completedAyanas),
            realAvgPerAyana: round(realSpent / ayanaDivisor),
            aeBudgeted: round(aeBudgeted),
            thisAyanaBudgeted: round(thisAyanaBudgeted),
            aeSurplus: round(aeSurplus),
            thisAyanaSpending: round(thisAyanaSpending),
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
                netExpenses: round(netExpenses),
            },
        },
    };
}

function computeTransactionStats(costs) {
    // Excel's QUARTILE.INC/MEDIAN/MODE/TRIMMEAN skip forgiven ("F") rows entirely, since
    // those are text cells in the sheet — not zero values. Tran Mean is the exception: it
    // divides by the count of ALL transactions (COUNT of the No. column), so zeros belong
    // in that denominator. We mirror both behaviors here.
    // Assumption: cost === 0 means "forgiven" (from an F-marked row), not a genuine $0 expense.
    if (costs.length === 0) {
        return { q1: 0, median: 0, q3: 0, mean: 0, trimMean: 0, mode: 0 };
    }

    const sum = costs.reduce((acc, v) => acc + v, 0);
    const mean = sum / costs.length;

    const nonZero = costs.filter((c) => c !== 0);
    const sorted = [...nonZero].sort((a, b) => a - b);

    // Excel's TRIMMEAN(range, 0.1) excludes 10% of values TOTAL, split evenly across both
    // ends, and rounds the excluded count down to the nearest even number before splitting.
    let trimMean = 0;
    if (sorted.length > 0) {
        let excludeCount = Math.floor(sorted.length * 0.1);
        if (excludeCount % 2 !== 0) excludeCount -= 1;
        const trimEachSide = excludeCount / 2;
        const trimmed =
            trimEachSide > 0 && sorted.length > excludeCount
                ? sorted.slice(trimEachSide, sorted.length - trimEachSide)
                : sorted;
        trimMean = trimmed.reduce((acc, v) => acc + v, 0) / (trimmed.length || 1);
    }

    const frequency = {};
    let mode = nonZero.length > 0 ? nonZero[0] : 0;
    let maxFreq = 0;
    for (const cost of nonZero) {
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

function computeMonthlyTrend(expenses = [], income = []) {
    const monthMap = {};
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const safeIncome = Array.isArray(income) ? income : [];

    for (const expense of safeExpenses) {
        const key = getMonthKey(expense.date);
        if (!key || key.length < 7) continue;
        if (!monthMap[key]) {
            monthMap[key] = { month: key, expenses: 0, income: 0, otherIncome: 0, injections: 0 };
        }
        monthMap[key].expenses += Number(expense.cost) || 0;
    }

    for (const entry of safeIncome) {
        const key = getMonthKey(entry.date);
        if (!key || key.length < 7) continue;
        if (!monthMap[key]) {
            monthMap[key] = { month: key, expenses: 0, income: 0, otherIncome: 0, injections: 0 };
        }
        const val = Number(entry.value) || 0;
        monthMap[key].income += val;
        if (entry.type === 'injection') {
            monthMap[key].injections += val;
        } else {
            monthMap[key].otherIncome += val;
        }
    }

    return Object.values(monthMap)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
            const exp = round(m.expenses);
            const inc = round(m.income);
            const oth = round(m.otherIncome);
            const inj = round(m.injections);
            return {
                month: m.month,
                expenses: exp,
                income: inc,
                otherIncome: oth,
                injections: inj,
                netExpenses: round(exp - inc),
                realSpent: round(exp - oth),
            };
        });
}

module.exports = { computeBudgetStats, AYANA_MONTHS };


