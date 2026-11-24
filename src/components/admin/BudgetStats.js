import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../../utils/ContentContext';
import { formatCurrency } from '../../utils/budgetApi';

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const pickRepayment = (obj = {}) => num(obj.repayment ?? obj.repayments ?? obj.otherIncome);

// Series keep the same color in every view (color follows the entity).
const TREND_SERIES = [
    { key: 'expenses', labelKey: 'expenses', colorVar: '--bs-series-1' },
    { key: 'realSpent', labelKey: 'realSpent', colorVar: '--bs-series-2', tipKey: 'realSpentTooltip' },
    { key: 'income', labelKey: 'income', colorVar: '--bs-series-3' },
    { key: 'netExpenses', labelKey: 'netExpenses', colorVar: '--bs-series-4', tipKey: 'netExpensesTooltip' },
];

const useElementWidth = () => {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        if (!ref.current) return undefined;
        const el = ref.current;
        const update = () => setWidth(el.clientWidth);
        update();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
};

const niceTicks = (max, count = 4) => {
    if (max <= 0) return [0];
    const rough = max / count;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const norm = rough / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const ticks = [];
    for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
};

const compactMoney = (v) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
    return `${sign}$${Math.round(abs)}`;
};

/* ---------- Small building blocks ---------- */

const Kpi = ({ label, value, sub, tone, primary }) => (
    <div className={`bs-kpi${primary ? ' bs-kpi-primary' : ''}${tone ? ` bs-tone-${tone}` : ''}`}>
        <span className="bs-kpi-label">{label}</span>
        <span className="bs-kpi-value">{value}</span>
        {sub && <span className="bs-kpi-sub">{sub}</span>}
    </div>
);

const StatusLine = ({ value, formatVal, t }) => {
    const over = value < 0;
    return (
        <span className={`bs-status ${over ? 'bs-status-bad' : 'bs-status-good'}`}>
            <span className="bs-status-icon" aria-hidden="true">{over ? '▲' : '▼'}</span>
            <strong>{formatVal(Math.abs(value))}</strong>
            <span>{t(over ? 'admin.budgetSection.stats.overBudget' : 'admin.budgetSection.stats.underBudget')}</span>
        </span>
    );
};

const BudgetMeter = ({ budgeted, spent, formatVal, formatNumber, t }) => {
    const ratio = budgeted > 0 ? spent / budgeted : spent > 0 ? 1 : 0;
    const over = spent > budgeted;
    const fill = Math.min(ratio, 1) * 100;
    const pct = budgeted > 0 ? Math.round(ratio * 100) : null;

    return (
        <div className="bs-meter-block">
            <div className="bs-meter-head">
                <span className="bs-meter-spent">
                    {formatVal(spent)}
                    <span className="bs-meter-of">
                        {' / '}
                        {formatVal(budgeted)}
                    </span>
                </span>
                {pct !== null && (
                    <span className={`bs-meter-pct${over ? ' is-over' : ''}`}>
                        {formatNumber(pct)}%
                    </span>
                )}
            </div>
            <div
                className={`bs-meter${over ? ' is-over' : ''}`}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={Math.max(budgeted, spent)}
                aria-valuenow={spent}
                aria-label={t('admin.budgetSection.stats.spentLabel')}
            >
                <div className="bs-meter-fill" style={{ width: `${fill}%` }} />
            </div>
        </div>
    );
};

const PeriodCard = ({
    title,
    budgeted,
    spent,
    surplus,
    toDateBudgeted,
    toDateSurplus,
    toDateBudgetedLabel,
    toDateSurplusLabel,
    extra,
    formatVal,
    formatNumber,
    t,
}) => (
    <section className="bs-card bs-period">
        <header className="bs-card-head">
            <h2>{title}</h2>
            <StatusLine value={surplus} formatVal={formatVal} t={t} />
        </header>

        <BudgetMeter budgeted={budgeted} spent={spent} formatVal={formatVal} formatNumber={formatNumber} t={t} />

        <dl className="bs-dl">
            <div>
                <dt>{t('admin.budgetSection.stats.toDate')} · {toDateBudgetedLabel}</dt>
                <dd>{formatVal(toDateBudgeted)}</dd>
            </div>
            <div>
                <dt>{t('admin.budgetSection.stats.toDate')} · {toDateSurplusLabel}</dt>
                <dd className={toDateSurplus < 0 ? 'bs-neg' : 'bs-pos'}>{formatVal(toDateSurplus)}</dd>
            </div>
            {extra}
        </dl>
    </section>
);

/* ---------- Monthly trend chart ---------- */

const TrendChart = ({ months, series, formatVal, formatNumber, formatDate, t }) => {
    const [wrapRef, width] = useElementWidth();
    const [hover, setHover] = useState(null);

    const height = 280;
    const pad = { top: 12, right: 12, bottom: 34, left: 52 };
    const innerW = Math.max(width - pad.left - pad.right, 10);
    const innerH = height - pad.top - pad.bottom;
    const n = months.length;

    const maxVal = Math.max(
        1,
        ...months.flatMap((m) => series.map((s) => Math.max(m[s.key], 0)))
    );
    const ticks = niceTicks(maxVal);
    const yMax = ticks[ticks.length - 1] || 1;
    const y = (v) => pad.top + innerH - (Math.max(v, 0) / yMax) * innerH;

    const band = n > 0 ? innerW / n : innerW;
    const xCenter = (i) => pad.left + band * i + band / 2;
    const asLines = series.length > 1;

    // Label every k-th month so labels never collide (~54px each).
    const labelEvery = Math.max(1, Math.ceil(54 / Math.max(band, 1)));

    const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - pad.left;
        const i = Math.floor(x / band);
        setHover(i >= 0 && i < n ? i : null);
    };

    const barPath = (cx, top, w) => {
        const base = pad.top + innerH;
        const h = base - top;
        if (h <= 0.5) return '';
        const r = Math.min(4, w / 2, h);
        const l = cx - w / 2;
        const rgt = cx + w / 2;
        return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${rgt - r}Q${rgt},${top} ${rgt},${top + r}V${base}Z`;
    };

    const hovered = hover !== null ? months[hover] : null;
    const tipLeft = hover !== null ? xCenter(hover) : 0;

    return (
        <div className="bs-trend-wrap" ref={wrapRef}>
            {width > 0 && n > 0 && (
                <svg
                    className="bs-trend-svg"
                    width={width}
                    height={height}
                    onMouseMove={onMove}
                    onMouseLeave={() => setHover(null)}
                    role="img"
                    aria-label={t('admin.budgetSection.stats.monthlyTrend')}
                >
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line
                                className={tick === 0 ? 'bs-axis' : 'bs-grid'}
                                x1={pad.left}
                                x2={pad.left + innerW}
                                y1={y(tick)}
                                y2={y(tick)}
                            />
                            <text className="bs-tick" x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                                {formatNumber(compactMoney(tick))}
                            </text>
                        </g>
                    ))}

                    {hover !== null && (
                        <rect
                            className="bs-hover-band"
                            x={pad.left + band * hover}
                            y={pad.top}
                            width={band}
                            height={innerH}
                        />
                    )}

                    {!asLines &&
                        series.map((s) =>
                            months.map((m, i) => (
                                <path
                                    key={`${s.key}-${m.month}`}
                                    d={barPath(xCenter(i), y(m[s.key]), Math.max(Math.min(band - 2, band * 0.72), 1))}
                                    style={{ fill: `var(${s.colorVar})` }}
                                    className={hover !== null && hover !== i ? 'bs-dim' : ''}
                                />
                            ))
                        )}

                    {asLines &&
                        series.map((s) => (
                            <polyline
                                key={s.key}
                                className="bs-line"
                                points={months.map((m, i) => `${xCenter(i)},${y(m[s.key])}`).join(' ')}
                                style={{ stroke: `var(${s.colorVar})` }}
                            />
                        ))}

                    {asLines && hover !== null && (
                        <>
                            <line
                                className="bs-crosshair"
                                x1={xCenter(hover)}
                                x2={xCenter(hover)}
                                y1={pad.top}
                                y2={pad.top + innerH}
                            />
                            {series.map((s) => (
                                <circle
                                    key={s.key}
                                    className="bs-dot"
                                    cx={xCenter(hover)}
                                    cy={y(months[hover][s.key])}
                                    r={4.5}
                                    style={{ fill: `var(${s.colorVar})` }}
                                />
                            ))}
                        </>
                    )}

                    {months.map((m, i) => {
                        const monthNum = parseInt(m.month.slice(5), 10);
                        const isJan = monthNum === 1;
                        // Regular stride only, so labels never collide; Jan is
                        // emphasized only when it lands on the stride.
                        if (i % labelEvery !== 0) return null;
                        return (
                            <text
                                key={m.month}
                                className={`bs-tick${isJan ? ' bs-tick-strong' : ''}`}
                                x={xCenter(i)}
                                y={pad.top + innerH + 16}
                                textAnchor="middle"
                            >
                                {i === 0 || months[i - labelEvery].month.slice(0, 4) !== m.month.slice(0, 4)
                                    ? `${formatDate(m.month, { month: 'short', day: false, year: false })} ’${formatNumber(m.month.slice(2, 4))}`
                                    : formatDate(m.month, { month: 'short', day: false, year: false })}
                            </text>
                        );
                    })}
                </svg>
            )}

            {hovered && (
                <div
                    className={`bs-tooltip${tipLeft > width / 2 ? ' is-left' : ''}`}
                    style={{ left: tipLeft }}
                >
                    <div className="bs-tooltip-title">
                        {formatDate(hovered.month, { month: 'long', day: false })}
                    </div>
                    {series.map((s) => (
                        <div key={s.key} className="bs-tooltip-row">
                            <span className="bs-swatch" style={{ background: `var(${s.colorVar})` }} />
                            <span>{t(`admin.budgetSection.stats.${s.labelKey}`)}</span>
                            <strong>{formatVal(hovered[s.key])}</strong>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ---------- Main ---------- */

const BudgetStats = ({ stats }) => {
    const { t, formatNumber, formatDate } = useContent();
    const [trendFilter, setTrendFilter] = useState('expenses');

    const months = useMemo(() => {
        const raw = Array.isArray(stats?.chartData?.monthlyTrend) ? stats.chartData.monthlyTrend : [];
        return raw.map((m) => {
            const expenses = num(m.expenses);
            const income = num(m.income);
            const repayment = pickRepayment(m);
            return {
                month: String(m.month || ''),
                expenses,
                income,
                realSpent: m.realSpent !== undefined ? num(m.realSpent) : expenses - repayment,
                netExpenses: m.netExpenses !== undefined ? num(m.netExpenses) : expenses - income,
            };
        });
    }, [stats]);

    if (!stats) return null;

    const { funds = {}, spending = {}, budget = {}, transactionStats: tx = {}, ayana = {} } = stats;
    const categories = Array.isArray(stats.categories) ? stats.categories : [];

    const formatVal = (val) => formatNumber(formatCurrency(num(val)));
    const formatNum = (val, digits = 1) => formatNumber(num(val).toFixed(digits));
    const S = (key) => t(`admin.budgetSection.stats.${key}`);

    const injections = num(funds.injections);
    const income = num(funds.income);
    const repayment = pickRepayment(funds);
    const totalFunds = num(funds.totalFunds) || injections + income + repayment;
    const totalExpenses = num(spending.expenses);
    const netBalance =
        budget.netBalance !== undefined ? num(budget.netBalance) : totalFunds - totalExpenses;
    const spentShare = totalFunds > 0 ? Math.min(totalExpenses / totalFunds, 1) : 0;

    const thisMonthBudgeted = num(budget.thisMonthBudgeted);
    const thisMonthSpending = num(budget.thisMonthSpending);
    const thisMonthSurplus =
        budget.thisMonthSurplus !== undefined ? num(budget.thisMonthSurplus) : thisMonthBudgeted - thisMonthSpending;

    const thisAyanaBudgeted = num(ayana.thisAyanaBudgeted);
    const thisAyanaSpending = num(ayana.thisAyanaSpending);
    const thisAyanaSurplus =
        ayana.thisAyanaSurplus !== undefined ? num(ayana.thisAyanaSurplus) : thisAyanaBudgeted - thisAyanaSpending;

    const categoryTotal = categories.reduce((sum, c) => sum + num(c.spending), 0);
    const categoryMax = Math.max(...categories.map((c) => num(c.spending)), 0);
    const perAyanaTotal = categories.reduce((sum, c) => sum + num(c.spendingPerAyana), 0);

    const fundParts = [
        { key: 'injections', label: S('injections'), value: injections, cls: 'bs-fund-1' },
        { key: 'income', label: S('income'), value: income, cls: 'bs-fund-2' },
        { key: 'repayment', label: S('repayment'), value: repayment, cls: 'bs-fund-3' },
    ];
    const fundSum = fundParts.reduce((s, p) => s + Math.max(p.value, 0), 0);

    const visibleSeries =
        trendFilter === 'all' ? TREND_SERIES : TREND_SERIES.filter((s) => s.key === trendFilter);

    // Transaction distribution strip (Q1–Q3 box with markers).
    const q1 = num(tx.q1);
    const median = num(tx.median);
    const q3 = num(tx.q3);
    const mean = num(tx.mean);
    const trimMean = num(tx.trimMean);
    const mode = num(tx.mode);
    // Mode is excluded: a recurring large payment (e.g. rent) would squash the strip.
    const stripMax = Math.max(q3, mean, trimMean, median, 1) * 1.15;
    const sx = (v) => `${(Math.max(v, 0) / stripMax) * 100}%`;

    const filterButtons = [
        ...TREND_SERIES.map((s) => ({ id: s.key, label: S(s.labelKey), title: s.tipKey ? S(s.tipKey) : undefined })),
        { id: 'all', label: S('together') },
    ];

    return (
        <div className="bs">
            {/* KPI row */}
            <section className="bs-kpis">
                <Kpi
                    primary
                    label={S('netBalance')}
                    value={formatVal(netBalance)}
                    tone={netBalance < 0 ? 'bad' : undefined}
                    sub={`${formatNum(spending.monthsLeft)} ${S('monthsUnit')} ${S('runway')}`}
                />
                <Kpi
                    label={S('totalFunds')}
                    value={formatVal(totalFunds)}
                    sub={`${formatNumber(Math.round(spentShare * 100))}% ${S('ofTotalFunds')}`}
                />
                <Kpi
                    label={S('realSpent')}
                    value={formatVal(spending.realSpent)}
                    sub={`${S('expenses')} ${formatVal(totalExpenses)}`}
                />
                <Kpi
                    label={S('realAvgPerMonth')}
                    value={formatVal(spending.realAvgPerMonth)}
                    sub={`${S('realAvgPerAyana')} ${formatVal(ayana.realAvgPerAyana)}`}
                />
            </section>

            {/* Budget periods */}
            <div className="bs-row-2 bs-row-periods">
                <PeriodCard
                    title={S('thisMonth')}
                    budgeted={thisMonthBudgeted}
                    spent={thisMonthSpending}
                    surplus={thisMonthSurplus}
                    toDateBudgeted={num(budget.meBudgeted)}
                    toDateSurplus={num(budget.meSurplus)}
                    toDateBudgetedLabel={S('budgetedLabel')}
                    toDateSurplusLabel={S('surplusLabel')}
                    formatVal={formatVal}
                    formatNumber={formatNumber}
                    t={t}
                />
                <PeriodCard
                    title={S('currentAyana')}
                    budgeted={thisAyanaBudgeted}
                    spent={thisAyanaSpending}
                    surplus={thisAyanaSurplus}
                    toDateBudgeted={num(ayana.aeBudgeted)}
                    toDateSurplus={num(ayana.aeSurplus)}
                    toDateBudgetedLabel={S('budgetedLabel')}
                    toDateSurplusLabel={S('surplusLabel')}
                    formatVal={formatVal}
                    formatNumber={formatNumber}
                    t={t}
                    extra={
                        <div>
                            <dt>{S('completedAyanas')}</dt>
                            <dd>{formatNum(ayana.completedAyanas, 2)}</dd>
                        </div>
                    }
                />
            </div>

            {/* Monthly trend */}
            <section className="bs-card">
                <header className="bs-card-head bs-card-head-wrap">
                    <h2>{S('monthlyTrend')}</h2>
                    <div className="bs-segmented" role="group" aria-label={t('admin.ui.budgetStats.monthlyTrendFilter')}>
                        {filterButtons.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                title={b.title}
                                className={trendFilter === b.id ? 'active' : ''}
                                aria-pressed={trendFilter === b.id}
                                onClick={() => setTrendFilter(b.id)}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                </header>

                {visibleSeries.length > 1 && (
                    <div className="bs-legend">
                        {visibleSeries.map((s) => (
                            <span key={s.key}>
                                <span className="bs-swatch" style={{ background: `var(${s.colorVar})` }} />
                                {S(s.labelKey)}
                            </span>
                        ))}
                    </div>
                )}

                <TrendChart
                    months={months}
                    series={visibleSeries}
                    formatVal={formatVal}
                    formatNumber={formatNumber}
                    formatDate={formatDate}
                    t={t}
                />
            </section>

            <div className="bs-row-2 bs-row-wide-left">
                {/* Categories */}
                <section className="bs-card">
                    <header className="bs-card-head">
                        <h2>{S('categoryBreakdown')}</h2>
                        <span className="bs-card-meta">{formatVal(totalExpenses)}</span>
                    </header>

                    <div className="bs-cat-table" role="table">
                        <div className="bs-cat-row bs-cat-headrow" role="row">
                            <span role="columnheader">{t('admin.budgetSection.headers.category')}</span>
                            <span role="columnheader" className="bs-num">{S('spending')}</span>
                            <span role="columnheader" className="bs-num">{S('spendingPerAyana')}</span>
                        </div>
                        {categories.map((c) => {
                            const value = num(c.spending);
                            const pct = categoryTotal > 0 ? (value / categoryTotal) * 100 : 0;
                            const w = categoryMax > 0 ? Math.max((value / categoryMax) * 100, 1.5) : 0;
                            return (
                                <div key={c.category} className="bs-cat-row" role="row">
                                    <span className="bs-cat-name" role="cell">
                                        <span className="bs-cat-label">
                                            <span title={c.category}>{c.category}</span>
                                            <span className="bs-cat-pct">{formatNumber(pct.toFixed(1))}%</span>
                                        </span>
                                        <span className="bs-cat-track">
                                            <span className="bs-cat-fill" style={{ width: `${w}%` }} />
                                        </span>
                                    </span>
                                    <span role="cell" className="bs-num bs-strong">{formatVal(value)}</span>
                                    <span role="cell" className="bs-num bs-muted">{formatVal(c.spendingPerAyana)}</span>
                                </div>
                            );
                        })}
                        <div className="bs-cat-row bs-cat-total" role="row">
                            <span role="cell">{S('total')}</span>
                            <span role="cell" className="bs-num">{formatVal(totalExpenses)}</span>
                            <span role="cell" className="bs-num">{formatVal(perAyanaTotal)}</span>
                        </div>
                    </div>
                </section>

                <div className="bs-stack">
                    {/* Funds */}
                    <section className="bs-card">
                        <header className="bs-card-head">
                            <h2>{S('fundsBreakdown')}</h2>
                            <span className="bs-card-meta">{formatVal(totalFunds)}</span>
                        </header>

                        <div className="bs-fund-bar" role="img" aria-label={S('fundsBreakdown')}>
                            {fundParts.map((p) =>
                                p.value > 0 && fundSum > 0 ? (
                                    <span
                                        key={p.key}
                                        className={`bs-fund-seg ${p.cls}`}
                                        style={{ flexGrow: p.value / fundSum }}
                                        title={`${p.label}: ${formatVal(p.value)}`}
                                    />
                                ) : null
                            )}
                        </div>

                        <ul className="bs-fund-list">
                            {fundParts.map((p) => (
                                <li key={p.key}>
                                    <span className={`bs-swatch ${p.cls}`} />
                                    <span>{p.label}</span>
                                    <span className="bs-muted">
                                        {formatNumber(fundSum > 0 ? ((p.value / fundSum) * 100).toFixed(0) : '0')}%
                                    </span>
                                    <strong>{formatVal(p.value)}</strong>
                                </li>
                            ))}
                        </ul>

                        <div className="bs-divider" />

                        <div className="bs-subhead">{S('incomeVsExpenses')}</div>
                        <BudgetMeter
                            budgeted={totalFunds}
                            spent={totalExpenses}
                            formatVal={formatVal}
                            formatNumber={formatNumber}
                            t={t}
                        />
                    </section>

                    {/* Transactions */}
                    <section className="bs-card">
                        <header className="bs-card-head">
                            <h2>{S('transactionStats')}</h2>
                        </header>

                        <div className="bs-subhead">{S('typicalRange')}</div>
                        <div className="bs-strip">
                            <div className="bs-strip-track" />
                            <div className="bs-strip-box" style={{ left: sx(q1), width: `calc(${sx(q3)} - ${sx(q1)})` }} />
                            <div className="bs-strip-median" style={{ left: sx(median) }} title={`${S('median')}: ${formatVal(median)}`} />
                            <div className="bs-strip-mean" style={{ left: sx(mean) }} title={`${S('mean')}: ${formatVal(mean)}`} />
                        </div>
                        <div className="bs-strip-scale">
                            <span>{formatVal(0)}</span>
                            <span>{formatVal(stripMax)}</span>
                        </div>
                        <div className="bs-strip-legend">
                            <span><span className="bs-key-box" />{S('q1')}–{S('q3')}</span>
                            <span><span className="bs-key-median" />{S('median')}</span>
                            <span><span className="bs-key-mean" />{S('mean')}</span>
                        </div>

                        <div className="bs-tx-grid">
                            {[
                                ['q1', q1],
                                ['median', median],
                                ['q3', q3],
                                ['mean', mean],
                                ['trimMean', trimMean],
                                ['mode', mode],
                            ].map(([k, v]) => (
                                <div key={k} className="bs-tx-cell">
                                    <span>{S(k)}</span>
                                    <strong>{formatVal(v)}</strong>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default BudgetStats;
