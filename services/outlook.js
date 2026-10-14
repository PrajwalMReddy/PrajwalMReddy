/**
 * Microsoft Outlook Service (Microsoft Graph API)
 * Handles:
 * - OAuth token refresh & caching for personal/work Microsoft accounts
 * - Reading inbox emails (unread/important messages, snippets, senders)
 * - Reading calendar events & schedule via calendarView (meetings, locations, times, attendees)
 * - Simulation fallback when keys are unconfigured
 */

const memoryTokenCache = {
    accessToken: null,
    expiresAt: 0,
};

/**
 * Get a valid access token for Microsoft Graph
 */
async function getOutlookAccessToken() {
    // 1. Check direct access token override
    if (process.env.MS_GRAPH_ACCESS_TOKEN) {
        return process.env.MS_GRAPH_ACCESS_TOKEN;
    }

    // 2. Check cached token
    const now = Date.now();
    if (memoryTokenCache.accessToken && memoryTokenCache.expiresAt > now + 60000) {
        return memoryTokenCache.accessToken;
    }

    const clientId = process.env.MS_GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
    const refreshToken = process.env.MS_GRAPH_REFRESH_TOKEN || process.env.OUTLOOK_REFRESH_TOKEN;
    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';

    if (!clientId || !clientSecret || !refreshToken) {
        return null; // Not fully configured
    }

    try {
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const bodyParams = {
            client_id: clientId,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'Mail.Read Calendars.Read offline_access User.Read Mail.Send',
        };
        if (clientSecret) {
            bodyParams.client_secret = clientSecret;
        }

        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(bodyParams),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Token refresh failed (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const expiresInMs = (data.expires_in || 3600) * 1000;

        memoryTokenCache.accessToken = data.access_token;
        memoryTokenCache.expiresAt = now + expiresInMs;

        return data.access_token;
    } catch (err) {
        console.error('Outlook Service: Token refresh error:', err.message);
        return null;
    }
}

/**
 * Fetch Microsoft Graph User Profile
 * Corresponds to getUserAsync in Microsoft Graph Tutorial
 */
async function getOutlookUserProfile() {
    const accessToken = await getOutlookAccessToken();

    if (!accessToken) {
        return {
            configured: false,
            displayName: 'Prajwal Reddy (Simulated)',
            email: 'prajwal@reddy.dev',
            accountType: 'simulated',
        };
    }

    try {
        const res = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to fetch Graph user (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return {
            configured: true,
            displayName: data.displayName || 'Prajwal Reddy',
            email: data.mail || data.userPrincipalName || '',
            userPrincipalName: data.userPrincipalName,
            id: data.id,
        };
    } catch (err) {
        console.error('Outlook Service: getOutlookUserProfile error:', err.message);
        return { configured: true, error: err.message };
    }
}

/**
 * Send an Email via Microsoft Graph
 * Corresponds to sendMailAsync in Microsoft Graph Tutorial
 */
async function sendOutlookEmail({ to, subject, body, isHtml = false }) {
    const accessToken = await getOutlookAccessToken();

    if (!accessToken) {
        return {
            sent: false,
            simulated: true,
            message: `Outlook credentials not active. Simulated sending email to ${to}: "${subject}"`,
        };
    }

    try {
        const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    subject,
                    body: {
                        contentType: isHtml ? 'HTML' : 'Text',
                        content: body,
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to,
                            },
                        },
                    ],
                },
                saveToSentItems: true,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Graph sendMail failed (${res.status}): ${errText}`);
        }

        return {
            sent: true,
            to,
            subject,
            message: `Email successfully sent to ${to} via Microsoft Graph.`,
        };
    } catch (err) {
        console.error('Outlook Service: sendOutlookEmail error:', err.message);
        return {
            sent: false,
            error: err.message,
        };
    }
}

/**
 * Initiate Device Code Flow for OAuth Authentication
 * Allows seamless sign-in via https://microsoft.com/devicelogin without redirect URI headaches
 */
async function initiateDeviceCodeFlow(clientIdOverride = null) {
    const clientId = clientIdOverride || process.env.MS_GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';

    if (!clientId) {
        throw new Error('MS_GRAPH_CLIENT_ID is required to initiate Device Code authentication.');
    }

    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            scope: 'Mail.Read Calendars.Read offline_access User.Read Mail.Send',
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Device code request failed (${res.status}): ${errText}`);
    }

    return await res.json();
}

/**
 * Poll Device Code for Tokens
 */
async function pollDeviceCodeToken(deviceCode, clientIdOverride = null, clientSecretOverride = null) {
    const clientId = clientIdOverride || process.env.MS_GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = clientSecretOverride || process.env.MS_GRAPH_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';

    const params = {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: deviceCode,
    };
    if (clientSecret) params.client_secret = clientSecret;

    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    });

    return await res.json();
}

/**
 * Generate Microsoft OAuth Authorization URL
 */
function getOutlookAuthUrl(redirectUri) {
    const clientId = process.env.MS_GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';
    if (!clientId) return null;

    const scopes = encodeURIComponent('Mail.Read Calendars.Read offline_access User.Read');
    const redirect = encodeURIComponent(redirectUri);
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirect}&response_mode=query&scope=${scopes}&state=outlook_auth`;
}

/**
 * Exchange Authorization Code for Refresh and Access Tokens
 */
async function exchangeCodeForTokens(code, redirectUri) {
    const clientId = process.env.MS_GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
    const tenantId = process.env.MS_GRAPH_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';

    if (!clientId || !clientSecret) {
        throw new Error('MS_GRAPH_CLIENT_ID and MS_GRAPH_CLIENT_SECRET are required.');
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Token exchange failed: ${errText}`);
    }

    return await res.json();
}

/**
 * Fetch Outlook Emails (Inbox)
 */
async function fetchOutlookEmails(maxResults = 8) {
    const accessToken = await getOutlookAccessToken();

    if (!accessToken) {
        // Return simulated snapshot if not configured yet
        return {
            configured: false,
            provider: 'outlook',
            status: 'Outlook integration ready. Set MS_GRAPH_CLIENT_ID and MS_GRAPH_REFRESH_TOKEN in .env',
            unreadCount: 2,
            importantCount: 1,
            messages: [
                {
                    id: 'sim_email_1',
                    from: 'University Registrar <registrar@university.edu>',
                    subject: 'Action Required: Fall Registration Verification & Degree Audit',
                    date: new Date(Date.now() - 2 * 3600000).toISOString(),
                    snippet: 'Please verify your final course registration and submit any elective prerequisite exemptions by Friday.',
                    isUnread: true,
                    isImportant: true,
                },
                {
                    id: 'sim_email_2',
                    from: 'GitHub Notifications <notifications@github.com>',
                    subject: '[PersonalWebsite] Security & Dependabot Advisory Update',
                    date: new Date(Date.now() - 5 * 3600000).toISOString(),
                    snippet: 'Your repository has 0 critical vulnerabilities. Webpack build pipeline is healthy.',
                    isUnread: true,
                    isImportant: false,
                },
            ],
        };
    }

    try {
        const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=${maxResults}&$select=id,subject,from,receivedDateTime,bodyPreview,importance,isRead,hasAttachments,webLink&$orderby=receivedDateTime desc`;
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Prefer: 'outlook.body-type="text"',
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Microsoft Graph API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const rawMessages = data.value || [];

        const messages = rawMessages.map((m) => ({
            id: m.id,
            from: m.from ? `${m.from.emailAddress.name || ''} <${m.from.emailAddress.address || ''}>`.trim() : 'Unknown Sender',
            subject: m.subject || '(No Subject)',
            date: m.receivedDateTime,
            snippet: m.bodyPreview ? m.bodyPreview.slice(0, 180) : '',
            isUnread: !m.isRead,
            isImportant: m.importance === 'high',
            hasAttachments: Boolean(m.hasAttachments),
            webLink: m.webLink,
        }));

        return {
            configured: true,
            provider: 'outlook',
            unreadCount: messages.length,
            importantCount: messages.filter((m) => m.isImportant).length,
            messages,
        };
    } catch (err) {
        console.error('Outlook Service: fetchOutlookEmails error:', err.message);
        return {
            configured: true,
            provider: 'outlook',
            error: err.message,
            unreadCount: 0,
            importantCount: 0,
            messages: [],
        };
    }
}

const { getDashboardSettings } = require('./settings');

// In-memory cache for parsed ICS calendar events
const icsCache = {
    rawText: null,
    rawEvents: null,
    fetchedAt: 0,
    ttlMs: 0, // Always fetch fresh on requests
};

function clearIcsCache() {
    icsCache.rawText = null;
    icsCache.rawEvents = null;
    icsCache.fetchedAt = 0;
}

let currentCalendarHtmlUrl = process.env.OUTLOOK_CALENDAR_HTML_URL || '';
let currentCalendarIcsUrl = process.env.OUTLOOK_CALENDAR_ICS_URL || '';

/**
 * Unescape special characters from raw ICS values
 */
function unescapeIcs(str) {
    if (!str) return '';
    return str
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\')
        .trim();
}

/**
 * Extract meeting link from text if present
 */
function extractMeetingLink(text) {
    if (!text) return null;
    const match = text.match(/https?:\/\/(?:teams\.microsoft\.com|zoom\.us|[a-z0-9-]+\.zoom\.us|meet\.google\.com)\/[^\s<>"'\)]+/i);
    return match ? match[0] : null;
}

const WINDOWS_TO_IANA = {
    'Eastern Standard Time': 'America/New_York',
    'US Eastern Standard Time': 'America/Indianapolis',
    'Central Standard Time': 'America/Chicago',
    'Mountain Standard Time': 'America/Denver',
    'US Mountain Standard Time': 'America/Phoenix',
    'Pacific Standard Time': 'America/Los_Angeles',
    'Alaskan Standard Time': 'America/Anchorage',
    'Hawaiian Standard Time': 'Pacific/Honolulu',
    'W. Europe Standard Time': 'Europe/Berlin',
    'Central Europe Standard Time': 'Europe/Budapest',
    'Romance Standard Time': 'Europe/Paris',
    'GMT Standard Time': 'Europe/London',
    'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'UTC': 'UTC',
    'India Standard Time': 'Asia/Kolkata',
    'Singapore Standard Time': 'Asia/Singapore',
    'China Standard Time': 'Asia/Shanghai',
    'Tokyo Standard Time': 'Asia/Tokyo',
    'AUS Eastern Standard Time': 'Australia/Sydney',
    'E. Europe Standard Time': 'Europe/Bucharest',
    'Israel Standard Time': 'Asia/Jerusalem',
    'Arab Standard Time': 'Asia/Riyadh',
    'Arabic Standard Time': 'Asia/Baghdad',
    'FLE Standard Time': 'Europe/Helsinki',
    'South Africa Standard Time': 'Africa/Johannesburg',
    'Korea Standard Time': 'Asia/Seoul',
    'Taipei Standard Time': 'Asia/Taipei',
    'New Zealand Standard Time': 'Pacific/Auckland',
    'Atlantic Standard Time': 'America/Halifax',
    'Newfoundland Standard Time': 'America/St_Johns',
    'SE Asia Standard Time': 'Asia/Bangkok',
};

/**
 * Resolve timezone identifier (Windows name, IANA, or params string) to a valid IANA timezone.
 */
function resolveTimezone(tzParam) {
    if (!tzParam) return 'America/New_York';
    let clean = String(tzParam).replace(/^TZID=/i, '').replace(/"/g, '').trim();
    if (WINDOWS_TO_IANA[clean]) return WINDOWS_TO_IANA[clean];
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: clean });
        return clean;
    } catch {
        for (const [winTz, ianaTz] of Object.entries(WINDOWS_TO_IANA)) {
            if (clean.toLowerCase().includes(winTz.toLowerCase()) || winTz.toLowerCase().includes(clean.toLowerCase())) {
                return ianaTz;
            }
        }
        return 'America/New_York';
    }
}

/**
 * Get UTC Date from given local calendar components in a specific timezone
 */
function getUtcDateFromLocal(y, m, d, h, min, s, timeZone) {
    const nominalUtc = Date.UTC(y, m - 1, d, h, min, s);
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });

    const parts = dtf.formatToParts(new Date(nominalUtc));
    const p = {};
    for (const part of parts) {
        p[part.type] = part.value;
    }
    const tzYear = parseInt(p.year, 10);
    const tzMonth = parseInt(p.month, 10);
    const tzDay = parseInt(p.day, 10);
    let tzHour = parseInt(p.hour, 10);
    if (tzHour === 24) tzHour = 0;
    const tzMin = parseInt(p.minute, 10);
    const tzSec = parseInt(p.second, 10);

    const tzNominalUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, tzSec);
    const offsetMs = tzNominalUtc - nominalUtc;
    return new Date(nominalUtc - offsetMs);
}

/**
 * Extract date parts in America/New_York
 */
function getNyDateParts(d) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });
    const parts = dtf.formatToParts(d);
    const p = {};
    for (const part of parts) {
        p[part.type] = part.value;
    }
    const year = parseInt(p.year, 10);
    const month = parseInt(p.month, 10);
    const day = parseInt(p.day, 10);
    let hour = parseInt(p.hour, 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(p.minute, 10);
    const second = parseInt(p.second, 10);
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, hour, minute, second, dateKey };
}

/**
 * Parse an ICS datetime string (e.g. 20260922T140000, 20260922T140000Z, or 20260922)
 * using the proper timezone context (e.g. TZID=W. Europe Standard Time, Eastern Standard Time, etc.)
 */
function parseIcsDate(dateStr, params = '') {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim();

    // All-day date: YYYYMMDD
    if (/^\d{8}$/.test(cleanStr)) {
        const y = parseInt(cleanStr.slice(0, 4), 10);
        const m = parseInt(cleanStr.slice(4, 6), 10);
        const d = parseInt(cleanStr.slice(6, 8), 10);
        const localDate = getUtcDateFromLocal(y, m, d, 0, 0, 0, 'America/New_York');
        return {
            date: localDate,
            isAllDay: true,
            timeZone: 'America/New_York',
            rawYear: y,
            rawMonth: m,
            rawDay: d,
            rawHour: 0,
            rawMin: 0,
            rawSec: 0,
            dateKey: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        };
    }

    // UTC formatted: YYYYMMDDTHHMMSSZ
    if (cleanStr.endsWith('Z')) {
        const y = parseInt(cleanStr.slice(0, 4), 10);
        const m = parseInt(cleanStr.slice(4, 6), 10);
        const d = parseInt(cleanStr.slice(6, 8), 10);
        const h = parseInt(cleanStr.slice(9, 11), 10);
        const min = parseInt(cleanStr.slice(11, 13), 10);
        const s = parseInt(cleanStr.slice(13, 15), 10) || 0;
        const date = new Date(Date.UTC(y, m - 1, d, h, min, s));
        return {
            date,
            isAllDay: false,
            timeZone: 'UTC',
            rawYear: y,
            rawMonth: m,
            rawDay: d,
            rawHour: h,
            rawMin: min,
            rawSec: s,
            dateKey: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        };
    }

    // Standard datetime: YYYYMMDDTHHMMSS with optional timezone parameter
    const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (!match) return null;

    const [_, y, m, d, h, min, s] = match.map((v) => parseInt(v, 10));
    const timeZone = resolveTimezone(params);
    const date = getUtcDateFromLocal(y, m, d, h, min, s, timeZone);

    return {
        date,
        isAllDay: false,
        timeZone,
        rawYear: y,
        rawMonth: m,
        rawDay: d,
        rawHour: h,
        rawMin: min,
        rawSec: s,
        dateKey: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    };
}

/**
 * Parse raw ICS string into structured VEVENT objects
 */
function parseICS(icsText) {
    const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const unfolded = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
            unfolded[unfolded.length - 1] += line.slice(1);
        } else {
            unfolded.push(line);
        }
    }

    const rawEvents = [];
    let inEvent = false;
    let currentEvent = {};

    for (const line of unfolded) {
        if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            currentEvent = {};
            continue;
        }
        if (line.startsWith('END:VEVENT')) {
            inEvent = false;
            rawEvents.push(currentEvent);
            continue;
        }
        if (!inEvent) continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const propKeyFull = line.substring(0, colonIdx);
        const propValue = line.substring(colonIdx + 1);

        const semicolonIdx = propKeyFull.indexOf(';');
        const propName = semicolonIdx === -1 ? propKeyFull.toUpperCase() : propKeyFull.substring(0, semicolonIdx).toUpperCase();
        const propParams = semicolonIdx === -1 ? '' : propKeyFull.substring(semicolonIdx + 1);

        if (!currentEvent[propName]) {
            currentEvent[propName] = { value: propValue, params: propParams };
        } else if (Array.isArray(currentEvent[propName])) {
            currentEvent[propName].push({ value: propValue, params: propParams });
        } else {
            currentEvent[propName] = [currentEvent[propName], { value: propValue, params: propParams }];
        }
    }
    return rawEvents;
}

const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Expand recurring and single events within a given time window
 */
function expandIcsEvents(rawEvents, windowStart, windowEnd) {
    const expanded = [];
    const windowStartMs = windowStart.getTime();
    const windowEndMs = windowEnd.getTime();

    // Map UID -> { timestamps: number[], dateKeys: string[] }
    const recurrenceExceptions = new Map();
    for (const raw of rawEvents) {
        const uid = raw.UID?.value;
        const recurrenceIdProp = raw['RECURRENCE-ID'];
        if (uid && recurrenceIdProp) {
            const recIdObj = parseIcsDate(recurrenceIdProp.value, recurrenceIdProp.params);
            if (recIdObj?.date) {
                if (!recurrenceExceptions.has(uid)) {
                    recurrenceExceptions.set(uid, { timestamps: [], dateKeys: [] });
                }
                const entry = recurrenceExceptions.get(uid);
                entry.timestamps.push(recIdObj.date.getTime());
                if (recIdObj.dateKey) {
                    entry.dateKeys.push(recIdObj.dateKey);
                }
            }
        }
    }

    for (const raw of rawEvents) {
        if (!raw.DTSTART) continue;
        const summary = unescapeIcs(raw.SUMMARY?.value || '(Untitled Event)');
        const status = raw.STATUS?.value?.toUpperCase();
        if (status === 'CANCELLED') continue;

        const dtstartObj = parseIcsDate(raw.DTSTART.value, raw.DTSTART.params);
        if (!dtstartObj || !dtstartObj.date) continue;

        const startDate = dtstartObj.date;
        const isAllDay = dtstartObj.isAllDay || raw['X-MICROSOFT-CDO-ALLDAYEVENT']?.value === 'TRUE';

        let durationMs = isAllDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
        if (raw.DTEND) {
            const dtendObj = parseIcsDate(raw.DTEND.value, raw.DTEND.params);
            if (dtendObj && dtendObj.date) {
                durationMs = Math.max(0, dtendObj.date.getTime() - startDate.getTime());
            }
        }

        const uid = raw.UID?.value || `${summary}_${startDate.toISOString()}`;
        let location = unescapeIcs(raw.LOCATION?.value || '');
        const description = unescapeIcs(raw.DESCRIPTION?.value || '');
        const organizer = raw.ORGANIZER?.params ? unescapeIcs(raw.ORGANIZER.params) : (raw.ORGANIZER?.value || 'Organizer');
        const meetingUrl = extractMeetingLink(location) || extractMeetingLink(description) || null;

        if (meetingUrl && location.includes(meetingUrl)) {
            location = location.replace(meetingUrl, '').replace(/^[,;\s-]+|[,;\s-]+$/g, '').trim();
        } else if (/^https?:\/\//i.test(location.trim())) {
            location = '';
        }

        let rawCategory = '';
        if (Array.isArray(raw.CATEGORIES)) {
            rawCategory = raw.CATEGORIES.map((c) => c.value).join(',');
        } else if (raw.CATEGORIES?.value) {
            rawCategory = raw.CATEGORIES.value;
        } else if (raw.CATEGORY?.value) {
            rawCategory = raw.CATEGORY.value;
        }
        const category = rawCategory ? unescapeIcs(rawCategory).split(',')[0].trim() : null;
        const rruleStr = raw.RRULE?.value;

        const exdateTimestamps = [];
        const exdateKeys = [];
        if (raw.EXDATE) {
            const exArr = Array.isArray(raw.EXDATE) ? raw.EXDATE : [raw.EXDATE];
            for (const ex of exArr) {
                const parts = ex.value.split(',');
                for (const p of parts) {
                    const parsedEx = parseIcsDate(p, ex.params);
                    if (parsedEx?.date) {
                        exdateTimestamps.push(parsedEx.date.getTime());
                        if (parsedEx.dateKey) exdateKeys.push(parsedEx.dateKey);
                    }
                }
            }
        }

        if (!rruleStr) {
            const startMs = startDate.getTime();
            const endMs = startMs + durationMs;
            if (endMs >= windowStartMs && startMs <= windowEndMs) {
                expanded.push({
                    id: raw['RECURRENCE-ID'] ? `${uid}_${startDate.toISOString()}` : uid,
                    subject: summary,
                    start: startDate.toISOString(),
                    end: new Date(endMs).toISOString(),
                    startDate,
                    endDate: new Date(endMs),
                    durationMinutes: Math.round(durationMs / 60000),
                    isAllDay,
                    location,
                    description,
                    organizer,
                    category,
                    onlineMeetingUrl: meetingUrl,
                    webLink: currentCalendarHtmlUrl,
                    isRecurring: Boolean(raw['RECURRENCE-ID']),
                });
            }
        } else {
            const rruleParts = {};
            for (const part of rruleStr.split(';')) {
                const [k, v] = part.split('=');
                if (k && v) rruleParts[k.toUpperCase()] = v;
            }

            const freq = rruleParts.FREQ;
            const interval = parseInt(rruleParts.INTERVAL || '1', 10);

            let untilMs = Infinity;
            if (rruleParts.UNTIL) {
                const untilObj = parseIcsDate(rruleParts.UNTIL);
                if (untilObj?.date) {
                    untilMs = untilObj.date.getTime();
                    if (untilObj.isAllDay) {
                        untilMs += 24 * 60 * 60 * 1000 - 1;
                    }
                }
            }

            const count = rruleParts.COUNT ? parseInt(rruleParts.COUNT, 10) : Infinity;
            const byDays = rruleParts.BYDAY
                ? rruleParts.BYDAY.split(',').map((d) => dayMap[d.trim().replace(/^[-+]?\d+/, '').toUpperCase()]).filter((d) => d !== undefined)
                : null;

            const tz = dtstartObj.timeZone || 'America/New_York';
            const { rawHour, rawMin, rawSec } = dtstartObj;

            let curYear = dtstartObj.rawYear;
            let curMonth = dtstartObj.rawMonth;
            let curDay = dtstartObj.rawDay;

            let occurrences = 0;
            const maxIterations = 500;
            let iter = 0;

            const uidExceptions = (uid && recurrenceExceptions.get(uid)) || { timestamps: [], dateKeys: [] };

            while (iter++ < maxIterations && occurrences < count) {
                const curOccurrenceDate = getUtcDateFromLocal(curYear, curMonth, curDay, rawHour, rawMin, rawSec, tz);
                const curStartMs = curOccurrenceDate.getTime();
                const curEndMs = curStartMs + durationMs;

                if (curStartMs > untilMs || curStartMs > windowEndMs) {
                    break;
                }

                const dayInTz = new Date(new Date(curStartMs).toLocaleString('en-US', { timeZone: tz })).getDay();
                let matchesDay = true;
                if (byDays && freq === 'WEEKLY') {
                    matchesDay = byDays.includes(dayInTz);
                }

                const curDateKey = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`;

                const isExcluded =
                    exdateTimestamps.some((ex) => Math.abs(ex - curStartMs) < 60000) ||
                    exdateKeys.includes(curDateKey) ||
                    uidExceptions.timestamps.some((ex) => Math.abs(ex - curStartMs) < 60000) ||
                    uidExceptions.dateKeys.includes(curDateKey);

                if (matchesDay && !isExcluded) {
                    if (curEndMs >= windowStartMs && curStartMs <= windowEndMs) {
                        expanded.push({
                            id: `${uid}_${curOccurrenceDate.toISOString()}`,
                            subject: summary,
                            start: curOccurrenceDate.toISOString(),
                            end: new Date(curEndMs).toISOString(),
                            startDate: curOccurrenceDate,
                            endDate: new Date(curEndMs),
                            durationMinutes: Math.round(durationMs / 60000),
                            isAllDay,
                            location,
                            description,
                            organizer,
                            category,
                            onlineMeetingUrl: meetingUrl,
                            webLink: currentCalendarHtmlUrl,
                            isRecurring: true,
                        });
                    }
                    occurrences++;
                }

                if (freq === 'WEEKLY' && byDays) {
                    const nextDate = new Date(Date.UTC(curYear, curMonth - 1, curDay + 1));
                    curYear = nextDate.getUTCFullYear();
                    curMonth = nextDate.getUTCMonth() + 1;
                    curDay = nextDate.getUTCDate();
                } else if (freq === 'WEEKLY') {
                    const nextDate = new Date(Date.UTC(curYear, curMonth - 1, curDay + interval * 7));
                    curYear = nextDate.getUTCFullYear();
                    curMonth = nextDate.getUTCMonth() + 1;
                    curDay = nextDate.getUTCDate();
                } else if (freq === 'DAILY') {
                    const nextDate = new Date(Date.UTC(curYear, curMonth - 1, curDay + interval));
                    curYear = nextDate.getUTCFullYear();
                    curMonth = nextDate.getUTCMonth() + 1;
                    curDay = nextDate.getUTCDate();
                } else if (freq === 'MONTHLY') {
                    const nextDate = new Date(Date.UTC(curYear, curMonth - 1 + interval, curDay));
                    curYear = nextDate.getUTCFullYear();
                    curMonth = nextDate.getUTCMonth() + 1;
                    curDay = nextDate.getUTCDate();
                } else {
                    const nextDate = new Date(Date.UTC(curYear, curMonth - 1, curDay + 1));
                    curYear = nextDate.getUTCFullYear();
                    curMonth = nextDate.getUTCMonth() + 1;
                    curDay = nextDate.getUTCDate();
                }
            }
        }
    }

    expanded.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    return expanded;
}

/**
 * Format start and end Date objects as user-friendly time string (e.g. "2:00 PM - 3:30 PM")
 */
function formatEventTimeRange(startDate, endDate, isAllDay = false) {
    if (isAllDay) return 'All Day';
    if (!startDate || Number.isNaN(startDate.getTime())) return 'Scheduled time';

    const formatOpts = { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' };
    const startStr = startDate.toLocaleTimeString('en-US', formatOpts);
    if (!endDate || Number.isNaN(endDate.getTime())) return startStr;
    const endStr = endDate.toLocaleTimeString('en-US', formatOpts);
    return `${startStr} – ${endStr}`;
}

/**
 * Determine urgency and human relative tag for an event
 */
function getEventUrgency(startDate, endDate, now) {
    const nowMs = now.getTime();
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (nowMs >= startMs && nowMs <= endMs) {
        return { urgency: 'now', badgeText: 'Happening Now' };
    }

    const diffMs = startMs - nowMs;
    const diffMins = Math.round(diffMs / 60000);

    const nowParts = getNyDateParts(now);
    const startParts = getNyDateParts(startDate);

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowParts = getNyDateParts(tomorrow);

    const isToday = nowParts.dateKey === startParts.dateKey;
    const isTomorrow = tomorrowParts.dateKey === startParts.dateKey;

    if (diffMs > 0 && diffMins <= 60) {
        return { urgency: 'starting_soon', badgeText: `In ${diffMins}m` };
    }
    if (isToday) {
        return { urgency: 'today', badgeText: 'Today' };
    }
    if (isTomorrow) {
        return { urgency: 'tomorrow', badgeText: 'Tomorrow' };
    }
    if (diffMs > 0 && diffMs < 7 * 24 * 3600000) {
        return { urgency: 'this_week', badgeText: 'This Week' };
    }
    return { urgency: 'upcoming', badgeText: 'Upcoming' };
}

/**
 * Fetch Outlook Calendar Events (Supports Live ICS Feed & Microsoft Graph API)
 */
async function fetchOutlookCalendar(timeframe = 'upcoming', forceFresh = false) {
    const now = new Date();
    const settings = await getDashboardSettings(forceFresh);
    const calendarConfig = settings.calendar || {};
    const icsUrl = (calendarConfig.icsUrl || currentCalendarIcsUrl).trim();
    let htmlUrl = (calendarConfig.htmlUrl || currentCalendarHtmlUrl).trim();

    // Auto-derive web view URL if htmlUrl is not set but icsUrl is present
    if (!htmlUrl && icsUrl) {
        if (/reach\/calendar\.ics/i.test(icsUrl)) {
            htmlUrl = icsUrl.replace(/reach\/calendar\.ics/i, 'reach/calendar.html');
        } else if (/\.ics(\?.*)?$/i.test(icsUrl)) {
            htmlUrl = icsUrl.replace(/\.ics(\?.*)?$/i, '.html$1');
        }
    }

    currentCalendarHtmlUrl = htmlUrl;
    currentCalendarIcsUrl = icsUrl;

    if (!icsUrl || calendarConfig.enabled === false) {
        return {
            configured: Boolean(icsUrl),
            enabled: calendarConfig.enabled !== false,
            provider: 'outlook_ics',
            timeframe,
            todayCount: 0,
            upcomingCount: 0,
            hasEventsToday: false,
            happeningNow: null,
            nextEvent: null,
            calendarHtmlUrl: htmlUrl,
            calendarIcsUrl: icsUrl,
            events: [],
            message: !icsUrl ? 'Calendar subscription URL (.ics) not configured. Add it in Dashboard Settings.' : 'Calendar integration disabled in settings.',
        };
    }

    try {
        let rawEvents = icsCache.rawEvents;
        const isCacheExpired = Date.now() - icsCache.fetchedAt > icsCache.ttlMs;

        if (forceFresh || !rawEvents || isCacheExpired) {
            const fetchUrl = `${icsUrl}${icsUrl.includes('?') ? '&' : '?'}_nocache=${Date.now()}`;
            const res = await fetch(fetchUrl, {
                headers: {
                    'User-Agent': 'PersonalWebsite-Assistant/2.0',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                },
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch ICS calendar (${res.status}): ${res.statusText}`);
            }

            const icsText = await res.text();
            rawEvents = parseICS(icsText);
            icsCache.rawText = icsText;
            icsCache.rawEvents = rawEvents;
            icsCache.fetchedAt = Date.now();
        }

        // Active window: from 24h ago to next 60 days
        const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

        const allExpanded = expandIcsEvents(rawEvents, windowStart, windowEnd);

        // Add formatted time range and urgency metadata
        const enrichedEvents = allExpanded.map((evt) => {
            const { urgency, badgeText } = getEventUrgency(evt.startDate, evt.endDate, now);
            const timeFormatted = formatEventTimeRange(evt.startDate, evt.endDate, evt.isAllDay);
            const dayKey = getNyDateParts(evt.startDate).dateKey;

            return {
                ...evt,
                timeFormatted,
                urgency,
                badgeText,
                dayKey,
            };
        });

        const nowMs = now.getTime();
        const nowParts = getNyDateParts(now);
        const todayKey = nowParts.dateKey;

        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowKey = getNyDateParts(tomorrow).dateKey;

        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        let filteredEvents = enrichedEvents;

        if (timeframe === 'today') {
            filteredEvents = enrichedEvents.filter((e) => e.dayKey === todayKey);
        } else if (timeframe === 'tomorrow') {
            filteredEvents = enrichedEvents.filter((e) => e.dayKey === tomorrowKey);
        } else if (timeframe === 'week' || timeframe === 'this_week' || timeframe === 'next_7_days') {
            filteredEvents = enrichedEvents.filter((e) => e.endDate.getTime() >= nowMs && e.startDate.getTime() <= weekEnd.getTime());
        } else if (timeframe === 'upcoming') {
            filteredEvents = enrichedEvents.filter((e) => e.endDate.getTime() >= nowMs - 15 * 60 * 1000);
        }

        const todayEvents = enrichedEvents.filter((e) => e.dayKey === todayKey);

        const nextEvent =
            enrichedEvents.find((e) => e.endDate.getTime() >= nowMs) || enrichedEvents[0] || null;

        const happeningNowEvent =
            enrichedEvents.find((e) => nowMs >= e.startDate.getTime() && nowMs <= e.endDate.getTime()) || null;

        return {
            configured: true,
            provider: 'outlook_ics',
            timeframe,
            todayCount: todayEvents.length,
            upcomingCount: filteredEvents.length,
            hasEventsToday: todayEvents.length > 0,
            happeningNow: happeningNowEvent,
            nextEvent,
            calendarHtmlUrl: currentCalendarHtmlUrl,
            calendarIcsUrl: currentCalendarIcsUrl,
            lastUpdated: new Date(icsCache.fetchedAt || Date.now()).toISOString(),
            events: filteredEvents,
        };
    } catch (err) {
        console.error('Outlook Service: fetchOutlookCalendar error:', err.message);
        return {
            configured: true,
            provider: 'outlook_ics',
            error: err.message,
            timeframe,
            todayCount: 0,
            upcomingCount: 0,
            hasEventsToday: false,
            happeningNow: null,
            nextEvent: null,
            calendarHtmlUrl: currentCalendarHtmlUrl,
            calendarIcsUrl: currentCalendarIcsUrl,
            events: [],
        };
    }
}

module.exports = {
    getOutlookAccessToken,
    getOutlookUserProfile,
    sendOutlookEmail,
    initiateDeviceCodeFlow,
    pollDeviceCodeToken,
    getOutlookAuthUrl,
    exchangeCodeForTokens,
    fetchOutlookEmails,
    fetchOutlookCalendar,
    clearIcsCache,
};

