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

const DEFAULT_CALENDAR_ICS_URL =
    process.env.OUTLOOK_CALENDAR_ICS_URL ||
    'https://outlook.office365.com/owa/calendar/5ef4458128274155a3e0052c141f4a12@cornell.edu/011c3e16f06340128352b9771f10846d17964027501824703155/calendar.ics';

const DEFAULT_CALENDAR_HTML_URL =
    process.env.OUTLOOK_CALENDAR_HTML_URL ||
    'https://outlook.office365.com/owa/calendar/5ef4458128274155a3e0052c141f4a12@cornell.edu/011c3e16f06340128352b9771f10846d17964027501824703155/calendar.html';

// In-memory cache for parsed ICS calendar events
const icsCache = {
    rawText: null,
    rawEvents: null,
    fetchedAt: 0,
    ttlMs: 0, // Always fetch fresh on requests
};

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

/**
 * Parse an ICS datetime string (e.g. 20260922T140000, 20260922T140000Z, or 20260922)
 */
function parseIcsDate(dateStr, params = '') {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim();

    // All-day date: YYYYMMDD
    if (/^\d{8}$/.test(cleanStr)) {
        const y = parseInt(cleanStr.slice(0, 4), 10);
        const m = parseInt(cleanStr.slice(4, 6), 10) - 1;
        const d = parseInt(cleanStr.slice(6, 8), 10);
        return {
            date: new Date(Date.UTC(y, m, d, 0, 0, 0)),
            isAllDay: true,
        };
    }

    // UTC formatted: YYYYMMDDTHHMMSSZ
    if (cleanStr.endsWith('Z')) {
        const y = parseInt(cleanStr.slice(0, 4), 10);
        const m = parseInt(cleanStr.slice(4, 6), 10) - 1;
        const d = parseInt(cleanStr.slice(6, 8), 10);
        const h = parseInt(cleanStr.slice(9, 11), 10);
        const min = parseInt(cleanStr.slice(11, 13), 10);
        const s = parseInt(cleanStr.slice(13, 15), 10) || 0;
        return {
            date: new Date(Date.UTC(y, m, d, h, min, s)),
            isAllDay: false,
        };
    }

    // Standard datetime: YYYYMMDDTHHMMSS with optional timezone
    const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (!match) return null;

    const [_, y, m, d, h, min, s] = match.map((v) => parseInt(v, 10));

    // Determine offset in minutes for common timezones
    let offsetMinutes = -300; // default Eastern Time EST
    const paramStr = String(params || '');
    if (paramStr.includes('Eastern') || paramStr.includes('EDT') || paramStr.includes('EST') || !params) {
        // Approximate US daylight savings (2nd Sun of March to 1st Sun of Nov)
        const isDst = (m > 3 && m < 11) || (m === 3 && d >= 8) || (m === 11 && d < 7);
        offsetMinutes = isDst ? -240 : -300;
    } else if (paramStr.includes('Pacific')) {
        const isDst = (m > 3 && m < 11) || (m === 3 && d >= 8) || (m === 11 && d < 7);
        offsetMinutes = isDst ? -420 : -480;
    } else if (paramStr.includes('Central')) {
        const isDst = (m > 3 && m < 11) || (m === 3 && d >= 8) || (m === 11 && d < 7);
        offsetMinutes = isDst ? -300 : -360;
    } else if (paramStr.includes('Mountain')) {
        const isDst = (m > 3 && m < 11) || (m === 3 && d >= 8) || (m === 11 && d < 7);
        offsetMinutes = isDst ? -360 : -420;
    } else if (paramStr.includes('India')) {
        offsetMinutes = 330;
    } else if (paramStr.includes('Singapore')) {
        offsetMinutes = 480;
    }

    const utcTimestamp = Date.UTC(y, m - 1, d, h, min, s) - offsetMinutes * 60 * 1000;
    return {
        date: new Date(utcTimestamp),
        isAllDay: false,
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

    for (const raw of rawEvents) {
        if (!raw.DTSTART) continue;
        const summary = unescapeIcs(raw.SUMMARY?.value || '(Untitled Event)');
        const status = raw.STATUS?.value?.toUpperCase();
        if (status === 'CANCELLED') continue;

        const dtstartObj = parseIcsDate(raw.DTSTART.value, raw.DTSTART.params);
        if (!dtstartObj || !dtstartObj.date) continue;

        const startDate = dtstartObj.date;
        const isAllDay = dtstartObj.isAllDay || raw['X-MICROSOFT-CDO-ALLDAYEVENT']?.value === 'TRUE';

        let durationMs = 60 * 60 * 1000;
        if (raw.DTEND) {
            const dtendObj = parseIcsDate(raw.DTEND.value, raw.DTEND.params);
            if (dtendObj && dtendObj.date) {
                durationMs = Math.max(0, dtendObj.date.getTime() - startDate.getTime());
            }
        }

        const uid = raw.UID?.value || `${summary}_${startDate.toISOString()}`;
        const location = unescapeIcs(raw.LOCATION?.value || '');
        const description = unescapeIcs(raw.DESCRIPTION?.value || '');
        const organizer = raw.ORGANIZER?.params ? unescapeIcs(raw.ORGANIZER.params) : (raw.ORGANIZER?.value || 'Organizer');
        const meetingUrl = extractMeetingLink(location) || extractMeetingLink(description) || null;
        const rawCategory = raw.CATEGORIES?.value || raw.CATEGORY?.value || null;
        const category = rawCategory ? unescapeIcs(rawCategory).split(',')[0].trim() : null;
        const rruleStr = raw.RRULE?.value;

        const exdates = [];
        if (raw.EXDATE) {
            const exArr = Array.isArray(raw.EXDATE) ? raw.EXDATE : [raw.EXDATE];
            for (const ex of exArr) {
                const parts = ex.value.split(',');
                for (const p of parts) {
                    const parsedEx = parseIcsDate(p, ex.params);
                    if (parsedEx?.date) exdates.push(parsedEx.date.getTime());
                }
            }
        }

        if (!rruleStr) {
            const startMs = startDate.getTime();
            const endMs = startMs + durationMs;
            if (endMs >= windowStartMs && startMs <= windowEndMs) {
                expanded.push({
                    id: uid,
                    subject: summary,
                    start: startDate.toISOString(),
                    end: new Date(endMs).toISOString(),
                    startDate,
                    endDate: new Date(endMs),
                    durationMinutes: Math.round(durationMs / 60000),
                    isAllDay,
                    location: location || (meetingUrl ? 'Online Meeting' : ''),
                    description,
                    organizer,
                    category,
                    onlineMeetingUrl: meetingUrl,
                    webLink: DEFAULT_CALENDAR_HTML_URL,
                    isRecurring: false,
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
            let untilMs = rruleParts.UNTIL ? parseIcsDate(rruleParts.UNTIL)?.date?.getTime() || Infinity : Infinity;
            const count = rruleParts.COUNT ? parseInt(rruleParts.COUNT, 10) : Infinity;
            const byDays = rruleParts.BYDAY ? rruleParts.BYDAY.split(',').map((d) => dayMap[d.trim().toUpperCase()]) : null;

            let currentStart = new Date(startDate.getTime());
            let occurrences = 0;
            const maxIterations = 500;
            let iter = 0;

            while (iter++ < maxIterations && occurrences < count && currentStart.getTime() <= untilMs && currentStart.getTime() <= windowEndMs) {
                const curStartMs = currentStart.getTime();
                const curEndMs = curStartMs + durationMs;

                let matchesDay = true;
                if (byDays && freq === 'WEEKLY') {
                    matchesDay = byDays.includes(currentStart.getUTCDay());
                }

                if (matchesDay && !exdates.some((ex) => Math.abs(ex - curStartMs) < 60000)) {
                    if (curEndMs >= windowStartMs && curStartMs <= windowEndMs) {
                        expanded.push({
                            id: `${uid}_${currentStart.toISOString()}`,
                            subject: summary,
                            start: new Date(curStartMs).toISOString(),
                            end: new Date(curEndMs).toISOString(),
                            startDate: new Date(curStartMs),
                            endDate: new Date(curEndMs),
                            durationMinutes: Math.round(durationMs / 60000),
                            isAllDay,
                            location: location || (meetingUrl ? 'Online Meeting' : ''),
                            description,
                            organizer,
                            category,
                            onlineMeetingUrl: meetingUrl,
                            webLink: DEFAULT_CALENDAR_HTML_URL,
                            isRecurring: true,
                        });
                    }
                    occurrences++;
                }

                if (freq === 'WEEKLY' && byDays) {
                    currentStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000);
                } else if (freq === 'WEEKLY') {
                    currentStart = new Date(currentStart.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
                } else if (freq === 'DAILY') {
                    currentStart = new Date(currentStart.getTime() + interval * 24 * 60 * 60 * 1000);
                } else if (freq === 'MONTHLY') {
                    currentStart.setUTCMonth(currentStart.getUTCMonth() + interval);
                } else {
                    currentStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000);
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
    const diffHours = Math.round(diffMs / 3600000);

    const nowNy = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const startNy = new Date(startDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    const isToday =
        nowNy.getFullYear() === startNy.getFullYear() &&
        nowNy.getMonth() === startNy.getMonth() &&
        nowNy.getDate() === startNy.getDate();

    const tomorrowNy = new Date(nowNy);
    tomorrowNy.setDate(nowNy.getDate() + 1);
    const isTomorrow =
        tomorrowNy.getFullYear() === startNy.getFullYear() &&
        tomorrowNy.getMonth() === startNy.getMonth() &&
        tomorrowNy.getDate() === startNy.getDate();

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
    const icsUrl = DEFAULT_CALENDAR_ICS_URL;

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

            const startNy = new Date(evt.startDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const year = startNy.getFullYear();
            const month = String(startNy.getMonth() + 1).padStart(2, '0');
            const day = String(startNy.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${day}`;

            return {
                ...evt,
                timeFormatted,
                urgency,
                badgeText,
                dayKey,
            };
        });

        // Filter based on requested timeframe
        const nowMs = now.getTime();
        const nowNy = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

        const todayStart = new Date(nowNy);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(nowNy);
        todayEnd.setHours(23, 59, 59, 999);

        const weekEnd = new Date(nowNy);
        weekEnd.setDate(nowNy.getDate() + 7);
        weekEnd.setHours(23, 59, 59, 999);

        let filteredEvents = enrichedEvents;

        if (timeframe === 'today') {
            filteredEvents = enrichedEvents.filter((e) => {
                const s = new Date(new Date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
                const end = new Date(new Date(e.end).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
                return (s >= todayStart.getTime() && s <= todayEnd.getTime()) || (s < todayStart.getTime() && end >= todayStart.getTime());
            });
        } else if (timeframe === 'tomorrow') {
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(todayStart.getDate() + 1);
            const tomorrowEnd = new Date(todayEnd);
            tomorrowEnd.setDate(todayEnd.getDate() + 1);
            filteredEvents = enrichedEvents.filter((e) => {
                const s = new Date(new Date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
                return s >= tomorrowStart.getTime() && s <= tomorrowEnd.getTime();
            });
        } else if (timeframe === 'week' || timeframe === 'this_week' || timeframe === 'next_7_days') {
            filteredEvents = enrichedEvents.filter((e) => {
                const end = new Date(new Date(e.end).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
                const s = new Date(new Date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
                return end >= nowMs && s <= weekEnd.getTime();
            });
        } else if (timeframe === 'upcoming') {
            // All future or currently ongoing events
            filteredEvents = enrichedEvents.filter((e) => {
                const endMs = new Date(e.end).getTime();
                return endMs >= nowMs - 15 * 60 * 1000; // include events that ended in the last 15 mins
            });
        }

        const todayEvents = enrichedEvents.filter((e) => {
            const s = new Date(new Date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
            const end = new Date(new Date(e.end).toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
            return (s >= todayStart.getTime() && s <= todayEnd.getTime()) || (s < todayStart.getTime() && end >= todayStart.getTime());
        });

        const nextEvent =
            enrichedEvents.find((e) => new Date(e.end).getTime() >= nowMs) || enrichedEvents[0] || null;

        const happeningNowEvent =
            enrichedEvents.find((e) => {
                const s = new Date(e.start).getTime();
                const end = new Date(e.end).getTime();
                return nowMs >= s && nowMs <= end;
            }) || null;

        return {
            configured: true,
            provider: 'outlook_ics',
            timeframe,
            todayCount: todayEvents.length,
            upcomingCount: filteredEvents.length,
            hasEventsToday: todayEvents.length > 0,
            happeningNow: happeningNowEvent,
            nextEvent,
            calendarHtmlUrl: DEFAULT_CALENDAR_HTML_URL,
            calendarIcsUrl: DEFAULT_CALENDAR_ICS_URL,
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
            calendarHtmlUrl: DEFAULT_CALENDAR_HTML_URL,
            calendarIcsUrl: DEFAULT_CALENDAR_ICS_URL,
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
    DEFAULT_CALENDAR_ICS_URL,
    DEFAULT_CALENDAR_HTML_URL,
};

