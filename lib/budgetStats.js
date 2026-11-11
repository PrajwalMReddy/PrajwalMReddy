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

    const totalIncome = safeIncome
        .filter((entry) => entry.type === 'income')
        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

    const totalRepayments = safeIncome
        .filter((entry) => entry.type === 'repayment' || entry.type === 'other' || !entry.type)
        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

    const totalFunds = totalInjections + totalIncome + totalRepayments;
    const totalExpenses = safeExpenses.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0);
    const netExpenses = totalExpenses - totalFunds;
    const fundsLeft = totalFunds - totalExpenses;
    const realSpent = totalExpenses - totalRepayments;

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

    const thisMonthSurplus = thisMonthBudgeted - thisMonthSpending;
    const thisAyanaSurplus = thisAyanaBudgeted - thisAyanaSpending;

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
            income: round(totalIncome),
            repayment: round(totalRepayments),
            repayments: round(totalRepayments),
            otherIncome: round(totalRepayments),
            totalFunds: round(totalFunds),
        },
        spending: {
            expenses: round(totalExpenses),
            fundsLeft: round(fundsLeft),
            netExpenses: round(netExpenses),
            realSpent: round(realSpent),
            realAvgPerMonth: round(realAvgPerMonth),
            monthsLeft: round(monthsLeft),
        },
        budget: {
            meBudgeted: round(meBudgeted),
            thisMonthBudgeted: round(thisMonthBudgeted),
            thisMonthSpending: round(thisMonthSpending),
            thisMonthSurplus: round(thisMonthSurplus),
            meSurplus: round(meSurplus),
            netBalance: round(netBalance),
        },
        transactionStats,
        ayana: {
            completedAyanas: round(completedAyanas),
            realAvgPerAyana: round(realSpent / ayanaDivisor),
            aeBudgeted: round(aeBudgeted),
            thisAyanaBudgeted: round(thisAyanaBudgeted),
            thisAyanaSpending: round(thisAyanaSpending),
            thisAyanaSurplus: round(thisAyanaSurplus),
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
            monthMap[key] = { month: key, expenses: 0, income: 0, repayment: 0, incomeOnly: 0, injections: 0 };
        }
        monthMap[key].expenses += Number(expense.cost) || 0;
    }

    for (const entry of safeIncome) {
        const key = getMonthKey(entry.date);
        if (!key || key.length < 7) continue;
        if (!monthMap[key]) {
            monthMap[key] = { month: key, expenses: 0, income: 0, repayment: 0, incomeOnly: 0, injections: 0 };
        }
        const val = Number(entry.value) || 0;
        monthMap[key].income += val;
        if (entry.type === 'injection') {
            monthMap[key].injections += val;
        } else if (entry.type === 'income') {
            monthMap[key].incomeOnly = (monthMap[key].incomeOnly || 0) + val;
        } else {
            monthMap[key].repayment = (monthMap[key].repayment || 0) + val;
        }
    }

    return Object.values(monthMap)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
            const exp = round(m.expenses);
            const inc = round(m.income);
            const rep = round(m.repayment);
            const inj = round(m.injections);
            const incOnly = round(m.incomeOnly || 0);
            return {
                month: m.month,
                expenses: exp,
                income: inc,
                repayment: rep,
                repayments: rep,
                incomeOnly: incOnly,
                otherIncome: rep,
                injections: inj,
                netExpenses: round(exp - inc),
                realSpent: round(exp - rep),
            };
        });
}

module.exports = { computeBudgetStats, AYANA_MONTHS };


