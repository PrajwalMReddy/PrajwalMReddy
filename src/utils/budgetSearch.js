import { parseLocalDate, formatDate, formatCurrency, toInputDate } from './budgetApi.js';

const MONTH_NAMES = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
};

const M_NAMES = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// Individual date/month expressions (ordered from most specific to least)
const DATE_EXPR = `(?:` +
    // 1. Month Day, Year: e.g. "January 15, 2026" or "Jan 15 2026"
    `${M_NAMES}[\\s,]+(?:0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?[,\\s]+(?:19|20)\\d{2}\\b` +
    // 2. Day Month Year: e.g. "15 Jan 2026"
    `|(?:0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?[\\s,]+${M_NAMES}[,\\s]+(?:19|20)\\d{2}\\b` +
    // 3. Month Year: e.g. "January 2026" or "Jan 2026"
    `|${M_NAMES}[,\\s]+(?:19|20)\\d{2}\\b` +
    // 4. Year Month: e.g. "2026 January" or "2026 Jan"
    `|\\b(?:19|20)\\d{2}[,\\s]+${M_NAMES}\\b` +
    // 5. ISO Date: "2026-01-15"
    `|\\b(?:19|20)\\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\\d|3[01])\\b` +
    // 6. ISO Month: "2026-01" (with lookahead ensuring not followed by day)
    `|\\b(?:19|20)\\d{2}-(?:0?[1-9]|1[0-2])(?!-\\d)\\b` +
    // 7. Slash Date: "01/15/2026"
    `|\\b(?:0?[1-9]|1[0-2])\\/(?:0?[1-9]|[12]\\d|3[01])\\/(?:19|20)\\d{2}\\b` +
    // 8. Slash Month: "01/2026"
    `|\\b(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2}\\b` +
    // 9. Month name alone (for "Jan to June 2026")
    `|\\b${M_NAMES}\\b` +
`)`;

function parseSingleDateOrMonth(token, defaultYear = null) {
    if (!token) return null;
    const str = token.trim();

    // 1. Month Day Year: e.g. "Jan 15 2026"
    const mDayYrRegex = new RegExp(`^(${M_NAMES})[\\s,]+(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?[,\\s]+((?:19|20)\\d{2})$`, 'i');
    const matchMDayYr = str.match(mDayYrRegex);
    if (matchMDayYr) {
        const m = MONTH_NAMES[matchMDayYr[1].toLowerCase()];
        const day = parseInt(matchMDayYr[2], 10);
        const yr = parseInt(matchMDayYr[3], 10);
        if (m && day && yr) {
            return {
                start: new Date(yr, m - 1, day, 0, 0, 0, 0),
                end: new Date(yr, m - 1, day, 23, 59, 59, 999),
            };
        }
    }

    // 2. Day Month Year: e.g. "15 Jan 2026"
    const dayMYrRegex = new RegExp(`^(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?[\\s,]+(${M_NAMES})[,\\s]+((?:19|20)\\d{2})$`, 'i');
    const matchDayMYr = str.match(dayMYrRegex);
    if (matchDayMYr) {
        const day = parseInt(matchDayMYr[1], 10);
        const m = MONTH_NAMES[matchDayMYr[2].toLowerCase()];
        const yr = parseInt(matchDayMYr[3], 10);
        if (m && day && yr) {
            return {
                start: new Date(yr, m - 1, day, 0, 0, 0, 0),
                end: new Date(yr, m - 1, day, 23, 59, 59, 999),
            };
        }
    }

    // 3. ISO Date: YYYY-MM-DD
    const isoDateRegex = /^((?:19|20)\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/;
    const matchIsoDate = str.match(isoDateRegex);
    if (matchIsoDate) {
        const yr = parseInt(matchIsoDate[1], 10);
        const m = parseInt(matchIsoDate[2], 10);
        const day = parseInt(matchIsoDate[3], 10);
        return {
            start: new Date(yr, m - 1, day, 0, 0, 0, 0),
            end: new Date(yr, m - 1, day, 23, 59, 59, 999),
        };
    }

    // 4. Slash Date: MM/DD/YYYY
    const slashDateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/((?:19|20)\d{2})$/;
    const matchSlashDate = str.match(slashDateRegex);
    if (matchSlashDate) {
        const m = parseInt(matchSlashDate[1], 10);
        const day = parseInt(matchSlashDate[2], 10);
        const yr = parseInt(matchSlashDate[3], 10);
        return {
            start: new Date(yr, m - 1, day, 0, 0, 0, 0),
            end: new Date(yr, m - 1, day, 23, 59, 59, 999),
        };
    }

    // 5. Month + Year: e.g. "Jan 2026", "January 2026"
    const mYrRegex = new RegExp(`^(${M_NAMES})[,\\s]+((?:19|20)\\d{2})$`, 'i');
    const matchMYr = str.match(mYrRegex);
    if (matchMYr) {
        const m = MONTH_NAMES[matchMYr[1].toLowerCase()];
        const yr = parseInt(matchMYr[2], 10);
        if (m && yr) {
            return {
                start: new Date(yr, m - 1, 1, 0, 0, 0, 0),
                end: new Date(yr, m, 0, 23, 59, 59, 999),
            };
        }
    }

    // 6. Year + Month: e.g. "2026 Jan"
    const yrMRegex = new RegExp(`^((?:19|20)\\d{2})[,\\s]+(${M_NAMES})$`, 'i');
    const matchYrM = str.match(yrMRegex);
    if (matchYrM) {
        const yr = parseInt(matchYrM[1], 10);
        const m = MONTH_NAMES[matchYrM[2].toLowerCase()];
        if (m && yr) {
            return {
                start: new Date(yr, m - 1, 1, 0, 0, 0, 0),
                end: new Date(yr, m, 0, 23, 59, 59, 999),
            };
        }
    }

    // 7. ISO Month: YYYY-MM
    const isoMonthRegex = /^((?:19|20)\d{2})-(0?[1-9]|1[0-2])$/;
    const matchIsoM = str.match(isoMonthRegex);
    if (matchIsoM) {
        const yr = parseInt(matchIsoM[1], 10);
        const m = parseInt(matchIsoM[2], 10);
        return {
            start: new Date(yr, m - 1, 1, 0, 0, 0, 0),
            end: new Date(yr, m, 0, 23, 59, 59, 999),
        };
    }

    // 8. Slash Month: MM/YYYY
    const slashMonthRegex = /^(0?[1-9]|1[0-2])\/((?:19|20)\d{2})$/;
    const matchSlashM = str.match(slashMonthRegex);
    if (matchSlashM) {
        const m = parseInt(matchSlashM[1], 10);
        const yr = parseInt(matchSlashM[2], 10);
        return {
            start: new Date(yr, m - 1, 1, 0, 0, 0, 0),
            end: new Date(yr, m, 0, 23, 59, 59, 999),
        };
    }

    // 9. Month name only (uses defaultYear): e.g. "Jan" with defaultYear 2026
    if (defaultYear) {
        const mOnlyRegex = new RegExp(`^(${M_NAMES})$`, 'i');
        const matchMOnly = str.match(mOnlyRegex);
        if (matchMOnly) {
            const m = MONTH_NAMES[matchMOnly[1].toLowerCase()];
            if (m) {
                return {
                    start: new Date(defaultYear, m - 1, 1, 0, 0, 0, 0),
                    end: new Date(defaultYear, m, 0, 23, 59, 59, 999),
                };
            }
        }
    }

    return null;
}

/**
 * Parses a Date / Month Range pattern from a query string (e.g. "Jan 2026 to June 2026", "2026-01 to 2026-06").
 * Returns { start, end, remaining } or null.
 */
export function extractDateRangePattern(queryStr) {
    if (!queryStr || typeof queryStr !== 'string') return null;
    const str = queryStr.trim();
    if (!str) return null;

    // Matches: [from|between] <DATE_EXPR> (to|through|thru|till|until|–|—|-|and) <DATE_EXPR>
    const rangeRegex = new RegExp(
        `(?:\\b(?:from|between)\\s+)?(${DATE_EXPR})\\s+(?:to|through|thru|till|until|–|—|-|and)\\s+(${DATE_EXPR})`,
        'i'
    );

    const match = str.match(rangeRegex);
    if (match) {
        const rawPart1 = match[1].trim();
        const rawPart2 = match[2].trim();

        // Check if one part has a year and the other doesn't (e.g. "Jan to June 2026")
        let yearPart1 = (rawPart1.match(/\b(?:19|20)\d{2}\b/) || [])[0];
        let yearPart2 = (rawPart2.match(/\b(?:19|20)\d{2}\b/) || [])[0];
        const sharedYear = yearPart2 ? parseInt(yearPart2, 10) : (yearPart1 ? parseInt(yearPart1, 10) : null);

        const d1 = parseSingleDateOrMonth(rawPart1, sharedYear);
        const d2 = parseSingleDateOrMonth(rawPart2, sharedYear);

        if (d1 && d2) {
            let start = d1.start;
            let end = d2.end;
            if (start > end) {
                const temp = start;
                start = d2.start;
                end = d1.end;
            }

            const remaining = str.replace(match[0], ' ')
                .replace(/\b(?:from|between)\b/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            return {
                start,
                end,
                remaining
            };
        }
    }

    return null;
}

/**
 * Parses a single Month Year pattern from a query string if present (e.g. "March 2026", "Mar 2026", "2026-03", "03/2026").
 * Returns { month, year, remaining } or null.
 */
export function extractMonthYearPattern(queryStr) {
    if (!queryStr || typeof queryStr !== 'string') return null;
    const str = queryStr.trim();
    if (!str) return null;

    // 1. Named Month + 4-digit Year: e.g. "March 2026", "Mar 2026", "March, 2026"
    const namedMonthYearRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+((?:19|20)\d{2})\b/i;
    const match1 = str.match(namedMonthYearRegex);
    if (match1) {
        const mKey = match1[1].toLowerCase();
        const month = MONTH_NAMES[mKey];
        const year = parseInt(match1[2], 10);
        if (month && year) {
            const remaining = str.replace(match1[0], ' ').trim();
            return { month, year, remaining };
        }
    }

    // 2. 4-digit Year + Named Month: e.g. "2026 March", "2026 Mar"
    const yearNamedMonthRegex = /\b((?:19|20)\d{2})[,\s]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
    const match2 = str.match(yearNamedMonthRegex);
    if (match2) {
        const year = parseInt(match2[1], 10);
        const mKey = match2[2].toLowerCase();
        const month = MONTH_NAMES[mKey];
        if (month && year) {
            const remaining = str.replace(match2[0], ' ').trim();
            return { month, year, remaining };
        }
    }

    // 3. Numeric Year-Month: e.g. "2026-03", "2026-3"
    const isoMonthRegex = /\b((?:19|20)\d{2})-(0?[1-9]|1[0-2])\b/;
    const match3 = str.match(isoMonthRegex);
    if (match3) {
        const year = parseInt(match3[1], 10);
        const month = parseInt(match3[2], 10);
        if (month >= 1 && month <= 12 && year) {
            const remaining = str.replace(match3[0], ' ').trim();
            return { month, year, remaining };
        }
    }

    // 4. Numeric Month/Year or Month-Year: e.g. "03/2026", "3/2026", "03-2026"
    const slashMonthYearRegex = /\b(0?[1-9]|1[0-2])[/-]((?:19|20)\d{2})\b/;
    const match4 = str.match(slashMonthYearRegex);
    if (match4) {
        const month = parseInt(match4[1], 10);
        const year = parseInt(match4[2], 10);
        if (month >= 1 && month <= 12 && year) {
            const remaining = str.replace(match4[0], ' ').trim();
            return { month, year, remaining };
        }
    }

    return null;
}

function getEntryDate(entry) {
    if (!entry || !entry.date) return null;
    if (entry.date instanceof Date) {
        return isNaN(entry.date.getTime())
            ? null
            : new Date(entry.date.getFullYear(), entry.date.getMonth(), entry.date.getDate());
    }
    const str = String(entry.date).trim();
    if (!str) return null;
    const datePart = str.split('T')[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES_LIST = [
    '',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
];

const MONTH_SHORT_LIST = [
    '',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

/**
 * Matches a budget entry (expense or income) directly against raw text,
 * date / month ranges (e.g. "Jan 2026 to June 2026", "2026-01 - 2026-06"),
 * and single Month Year patterns (e.g. "March 2026", "Mar 2026", "2026-03").
 */
export function matchesBudgetEntry(entry, queryStr, language = 'en') {
    if (!queryStr || !queryStr.trim()) return true;
    if (!entry) return false;

    const trimmedQuery = queryStr.trim().toLowerCase();
    const dateObj = getEntryDate(entry);
    const amount = Number(entry.cost ?? entry.value ?? 0);

    // Prepare raw searchable fields
    const serialVal = entry.serialNumber ?? entry.no ?? '';
    const serialStr = String(serialVal).toLowerCase();
    const serialHashStr = `#${serialStr}`;
    const rawDateStr = String(entry.date || '').toLowerCase();
    const formattedDateStr = formatDate(entry.date, language).toLowerCase();
    const formattedDateEnStr = formatDate(entry.date, 'en').toLowerCase();
    const inputDateStr = toInputDate(entry.date).toLowerCase();
    const itemStr = String(entry.item || '').toLowerCase();
    const categoryStr = String(entry.category || '').toLowerCase();
    const typeStr = String(entry.type || '').toLowerCase();
    const typeLabel = (entry.type === 'injection' ? 'injection' : 'other income').toLowerCase();
    const amountRawStr = String(amount).toLowerCase();
    const amountFormattedStr = formatCurrency(amount).toLowerCase();

    // Date part representations
    const entryYear = dateObj ? dateObj.getFullYear() : null;
    const entryMonth = dateObj ? dateObj.getMonth() + 1 : null;
    const yearStr = entryYear ? String(entryYear) : '';
    const monthPadStr = entryMonth ? String(entryMonth).padStart(2, '0') : '';
    const isoMonthStr = entryYear && entryMonth ? `${entryYear}-${monthPadStr}` : '';
    const monthFullName = entryMonth ? (MONTH_NAMES_LIST[entryMonth] || '') : '';
    const monthShortName = entryMonth ? (MONTH_SHORT_LIST[entryMonth] || '') : '';

    const searchableBlob = [
        serialStr,
        serialHashStr,
        rawDateStr,
        formattedDateStr,
        formattedDateEnStr,
        inputDateStr,
        itemStr,
        categoryStr,
        typeStr,
        typeLabel,
        amountRawStr,
        amountFormattedStr,
        yearStr,
        isoMonthStr,
        monthFullName,
        monthShortName,
    ].join(' ');

    // 1. Check for Date / Month Range pattern (e.g. "Jan 2026 to June 2026", "Jan 2026 - June 2026")
    const dateRange = extractDateRangePattern(trimmedQuery);
    if (dateRange) {
        if (!dateObj) return false;
        const entryTime = dateObj.getTime();
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        if (entryTime < startTime || entryTime > endTime) {
            return false;
        }

        // If query was solely the date range, it matches!
        if (!dateRange.remaining) {
            return true;
        }

        // Check any remaining tokens against raw searchable text (e.g. "Jan 2026 to June 2026 groceries")
        const remainingTokens = dateRange.remaining
            .split(/\s+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);

        return remainingTokens.every((token) => searchableBlob.includes(token));
    }

    // 2. Check for single Month Year pattern (e.g. "March 2026", "Mar 2026", "2026-03")
    const monthYear = extractMonthYearPattern(trimmedQuery);
    if (monthYear) {
        if (!dateObj || entryYear !== monthYear.year || entryMonth !== monthYear.month) {
            return false;
        }

        // If query was just the Month Year, it matches!
        if (!monthYear.remaining) {
            return true;
        }

        // Check any remaining tokens against raw searchable text
        const remainingTokens = monthYear.remaining
            .split(/\s+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);

        return remainingTokens.every((token) => searchableBlob.includes(token));
    }

    // 3. Direct raw text matching (split into whitespace tokens for multi-term search like "groceries trader")
    const tokens = trimmedQuery
        .split(/\s+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

    return tokens.every((token) => searchableBlob.includes(token));
}
