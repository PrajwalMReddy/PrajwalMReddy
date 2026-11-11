import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { assistantApi } from '../../../utils/assistantApi';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_CALENDAR_HTML_URL = '';

const HOUR_HEIGHT = 68; // Height in pixels for 1 hour

function parseEventLocationAndMeeting(item) {
    if (!item) return { displayLocation: '', meetingUrl: null };
    const rawLoc = (item.location || '').trim();
    const isUrl = /^https?:\/\//i.test(rawLoc);
    let meetingUrl = item.onlineMeetingUrl || (isUrl ? rawLoc : null);
    let displayLocation = rawLoc;

    if (isUrl) {
        displayLocation = '';
    } else if (displayLocation) {
        displayLocation = displayLocation
            .replace(/https?:\/\/[^\s<>"'\)]+/gi, '')
            .replace(/^[,;\s-]+|[,;\s-]+$/g, '')
            .trim();
    }

    return { displayLocation, meetingUrl };
}

function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function formatHourLabel(hour) {
    const h = hour % 24;
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
}

function formatEventTime(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York',
        });
    } catch {
        return '';
    }
}

function getNyTimeParts(dateStr) {
    if (!dateStr) return { minutes: 0, dateKey: '', hour: 0, minute: 0 };
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return { minutes: 0, dateKey: '', hour: 0, minute: 0 };

    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
        });
        const parts = dtf.formatToParts(d);
        const p = {};
        for (const part of parts) {
            p[part.type] = part.value;
        }
        let hour = parseInt(p.hour, 10);
        if (hour === 24) hour = 0;
        const minute = parseInt(p.minute, 10);
        const dateKey = `${p.year}-${p.month}-${p.day}`;
        return {
            minutes: hour * 60 + minute,
            dateKey,
            hour,
            minute,
        };
    } catch {
        const h = d.getHours();
        const m = d.getMinutes();
        return {
            minutes: h * 60 + m,
            dateKey: '',
            hour: h,
            minute: m,
        };
    }
}

function computeTimetableLayout(events) {
    if (!events || events.length === 0) return { timedEvents: [], minHour: 8, maxHour: 20 };

    const todayNyParts = getNyTimeParts(new Date().toISOString());
    const todayKey = todayNyParts.dateKey;

    const timed = [];
    let minMin = 24 * 60;
    let maxMin = 0;

    for (const evt of events) {
        if (evt.isAllDay) continue;

        const startParts = getNyTimeParts(evt.start);
        const endParts = getNyTimeParts(evt.end);

        let durationMins = evt.durationMinutes;
        if (!durationMins || durationMins <= 0) {
            const startMs = new Date(evt.start).getTime();
            const endMs = new Date(evt.end).getTime();
            if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
                durationMins = Math.round((endMs - startMs) / 60000);
            } else {
                durationMins = 60;
            }
        }

        // Determine if event started on a previous day and is spilling into today
        const isFromYesterday = Boolean(
            (evt.dayKey && todayKey && evt.dayKey < todayKey) ||
            (startParts.dateKey && todayKey && startParts.dateKey < todayKey)
        );

        let startMin = isFromYesterday ? 0 : startParts.minutes;
        let endMin = endParts.minutes;

        // Check if event spills over after midnight
        const isSpillover = Boolean(
            evt.spillsOverMidnight ||
            (startParts.dateKey && endParts.dateKey && startParts.dateKey !== endParts.dateKey && (endParts.hour > 0 || endParts.minute > 0)) ||
            (!isFromYesterday && endMin <= startMin && durationMins > 0)
        );

        if (!isFromYesterday && (isSpillover || endMin <= startMin)) {
            endMin = startMin + durationMins;
        }

        minMin = Math.min(minMin, startMin);
        maxMin = Math.max(maxMin, endMin);

        timed.push({
            ...evt,
            startMin,
            endMin,
            durationMinutes: durationMins,
            spillsOverMidnight: isSpillover,
            spillsFromYesterday: isFromYesterday,
        });
    }

    if (timed.length === 0) {
        return { timedEvents: [], minHour: 8, maxHour: 20 };
    }

    // Determine minHour and maxHour bounds
    // Daily calendar grid terminates at midnight (hour 24 = 12 AM)
    let minHour = Math.max(0, Math.floor(minMin / 60));
    let maxHour = Math.min(24, Math.ceil(maxMin / 60) + 1);

    // Make sure we have at least a 6-hour range
    if (maxHour - minHour < 6) {
        maxHour = Math.min(24, minHour + 6);
        if (maxHour - minHour < 6) {
            minHour = Math.max(0, maxHour - 6);
        }
    }

    // Sort by startMin ascending, then duration descending
    const sorted = [...timed].sort(
        (a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin)
    );

    // Group into connected overlapping clusters
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    for (const evt of sorted) {
        if (currentCluster.length === 0 || evt.startMin < clusterEnd) {
            currentCluster.push(evt);
            clusterEnd = Math.max(clusterEnd, evt.endMin);
        } else {
            clusters.push(currentCluster);
            currentCluster = [evt];
            clusterEnd = evt.endMin;
        }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    const totalGridHeight = (maxHour - minHour) * HOUR_HEIGHT;
    const maxGridMin = maxHour * 60;
    const positioned = [];

    for (const cluster of clusters) {
        const columns = []; // array of end times for each column
        const clusterPlaced = [];

        for (const evt of cluster) {
            let placedCol = -1;
            for (let i = 0; i < columns.length; i++) {
                if (columns[i] <= evt.startMin) {
                    placedCol = i;
                    columns[i] = evt.endMin;
                    break;
                }
            }
            if (placedCol === -1) {
                placedCol = columns.length;
                columns.push(evt.endMin);
            }
            clusterPlaced.push({ evt, col: placedCol });
        }

        const totalCols = columns.length;
        for (const item of clusterPlaced) {
            const leftPercent = (item.col / totalCols) * 100;
            const widthPercent = (1 / totalCols) * 100;

            const top = Math.max(0, (item.evt.startMin - minHour * 60) * (HOUR_HEIGHT / 60));

            // Clamp displayed end time to midnight (maxGridMin) so the event card cuts at midnight
            const displayEndMin = Math.min(maxGridMin, item.evt.endMin);

            const remainingGridHeight = Math.max(0, totalGridHeight - top);
            const rawHeight = (displayEndMin - item.evt.startMin) * (HOUR_HEIGHT / 60) - 4;
            const height = Math.min(Math.max(28, rawHeight), remainingGridHeight);

            positioned.push({
                ...item.evt,
                col: item.col,
                totalCols,
                leftPercent,
                widthPercent,
                top,
                height,
            });
        }
    }

    return { timedEvents: positioned, minHour, maxHour };
}

const UpcomingEvents = ({ onOpenSettings }) => {
    const { t } = useContent();
    const [events, setEvents] = useState([]);
    const [meta, setMeta] = useState({
        todayCount: 0,
        happeningNow: null,
        calendarHtmlUrl: DEFAULT_CALENDAR_HTML_URL,
    });
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('admin_events_view_mode') || 'list';
        } catch {
            return 'list';
        }
    });
    const [expandedEvents, setExpandedEvents] = useState({});
    const [activeTimetableEvent, setActiveTimetableEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const handleViewChange = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('admin_events_view_mode', mode);
        } catch {
            // ignore
        }
    };

    const loadEvents = useCallback(async (forceFresh = true) => {
        try {
            setError(null);
            const res = await assistantApi.getCalendar('today', { fresh: forceFresh });
            const list = Array.isArray(res?.events) ? res.events : [];
            setEvents(list);
            setMeta({
                todayCount: list.length,
                happeningNow: res?.happeningNow || null,
                calendarHtmlUrl: res?.calendarHtmlUrl || '',
            });
        } catch (err) {
            console.error(t('logs.eventsLoadError', "Failed to load today's events:"), err);
            setError(err.message || t('admin.events.error', 'Failed to load calendar events.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadEvents(true);
    };

    const toggleExpand = (id) => {
        setExpandedEvents((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    // Current time indicator position
    const currentNyTime = useMemo(() => {
        const parts = getNyTimeParts(new Date().toISOString());
        return parts.minutes;
    }, [events, refreshing]);

    // Timetable calculations
    const { timedEvents, minHour, maxHour } = useMemo(() => {
        return computeTimetableLayout(events);
    }, [events]);

    const allDayEvents = useMemo(() => {
        return events.filter((e) => e.isAllDay);
    }, [events]);

    const hourSlots = useMemo(() => {
        const slots = [];
        for (let h = minHour; h <= maxHour; h++) {
            slots.push(h);
        }
        return slots;
    }, [minHour, maxHour]);

    const totalGridHeight = (maxHour - minHour) * HOUR_HEIGHT;
    const nowTop = (currentNyTime - minHour * 60) * (HOUR_HEIGHT / 60);
    const isNowVisible = currentNyTime >= minHour * 60 && currentNyTime <= maxHour * 60;
    const timetableContainerRef = useRef(null);

    useEffect(() => {
        if (viewMode === 'timetable' && timetableContainerRef.current) {
            const targetTop = isNowVisible
                ? Math.max(0, nowTop - 60)
                : timedEvents.length > 0
                ? Math.max(0, timedEvents[0].top - 30)
                : 0;
            if (targetTop > 0) {
                timetableContainerRef.current.scrollTop = targetTop;
            }
        }
    }, [viewMode, isNowVisible, nowTop, timedEvents]);

    if (loading) {
        return (
            <article className="briefing-memo-document admin-events-card events-loading-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                <div className="events-loading-spinner" />
                <div className="events-loading-title">
                    {t('admin.events.loading', "Loading Today's Events...")}
                </div>
                <div className="events-loading-sub">
                    {t('admin.events.fetchingLatest', 'Syncing with Cornell Office 365 calendar')}
                </div>
            </article>
        );
    }

    const { happeningNow } = meta;

    return (
        <article className="briefing-memo-document admin-events-card" aria-label={t('admin.events.todaysEvents', "Today's Events")}>
            {/* Header */}
            <header className="memo-masthead" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
                <div className="memo-header-top" style={{ marginBottom: 0, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <h2 className="memo-title" style={{ fontSize: '1.4rem', margin: 0 }}>
                            {t('admin.events.todaysEvents', "Today's Events")}
                        </h2>

                        {/* Happening Now Pulse Pill */}
                        {happeningNow && (
                            <span className="admin-events-pulse-pill" title={happeningNow.subject}>
                                <span className="pulse-dot" />
                                <span className="pulse-text">
                                    {t('admin.events.happeningNow', 'Happening Now')}: <strong>{happeningNow.subject}</strong>
                                </span>
                            </span>
                        )}
                    </div>

                    {/* Actions & View Toggle */}
                    <div className="memo-actions" style={{ gap: '0.5rem', alignItems: 'center' }}>
                        {/* View Switcher Toggle */}
                        <div className="admin-events-view-toggle" role="group" aria-label="View Switcher">
                            <button
                                type="button"
                                className={`admin-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => handleViewChange('list')}
                                title={t('admin.events.listView', 'List View')}
                                aria-pressed={viewMode === 'list'}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6" />
                                    <line x1="8" y1="12" x2="21" y2="12" />
                                    <line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                                <span>{t('admin.events.listView', 'List')}</span>
                            </button>

                            <button
                                type="button"
                                className={`admin-view-toggle-btn ${viewMode === 'timetable' ? 'active' : ''}`}
                                onClick={() => handleViewChange('timetable')}
                                title={t('admin.events.timetableView', 'Timetable View')}
                                aria-pressed={viewMode === 'timetable'}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                    <line x1="10" y1="10" x2="10" y2="22" />
                                </svg>
                                <span>{t('admin.events.timetableView', 'Timetable')}</span>
                            </button>
                        </div>

                        {/* Outlook Link */}
                        <a
                            href={meta.calendarHtmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-events-outlook-link"
                            title={t('admin.events.openOutlook', 'Open Outlook Calendar')}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            <span>Outlook</span>
                        </a>
                    </div>
                </div>
            </header>

            {/* Error Notification */}
            {error && (
                <div className="events-error-banner">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="events-retry-btn"
                    >
                        {t('admin.events.retry', 'Retry')}
                    </button>
                </div>
            )}

            {/* Main Content: List or Timetable View */}
            <main>
                {events.length === 0 && !error ? (
                    <div className="admin-events-empty-state" style={{ padding: '3rem 1rem' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.75rem auto', display: 'block' }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                            <line x1="9" y1="14" x2="15" y2="14" />
                        </svg>
                        <div>{t('admin.events.noEventsToday', 'No events scheduled for today.')}</div>
                    </div>
                ) : viewMode === 'list' ? (
                    /* ================= LIST VIEW ================= */
                    <ul className="admin-events-list">
                        {events.map((item) => {
                            const isExpanded = Boolean(expandedEvents[item.id]);
                            const hasDescription = item.description && item.description.length > 5;
                            const isHappeningNow = item.urgency === 'now';
                            const isStartingSoon = item.urgency === 'starting_soon';

                            return (
                                <li
                                    key={item.id}
                                    className={`admin-event-row ${isHappeningNow ? 'happening-now' : ''} ${isStartingSoon ? 'starting-soon' : ''}`}
                                >
                                    {/* Left Time Column */}
                                    <div className="admin-event-time-col">
                                        <div className="admin-event-time-badge">
                                            <span className="time-text">{item.timeFormatted}</span>
                                            {item.durationMinutes > 0 && !item.isAllDay && (
                                                <span className="duration-text">
                                                    {formatDuration(item.durationMinutes)}
                                                </span>
                                            )}
                                            {item.category && (
                                                <span className="admin-event-category-tag">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>

                                        {/* Relative urgency badge */}
                                        {item.badgeText && item.urgency !== 'today' && (
                                            <span className={`admin-event-urgency-tag tag-${item.urgency}`}>
                                                {item.badgeText}
                                            </span>
                                        )}
                                    </div>

                                    {/* Middle Details Column */}
                                    <div className="admin-event-main-col">
                                        <div className="admin-event-title-row">
                                            <h4 className="admin-event-subject">{item.subject}</h4>
                                            {item.isRecurring && (
                                                <span className="admin-event-recurring-icon" title="Recurring Series">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>

                                        {/* Metadata: Location & Meeting links */}
                                        {(() => {
                                            const { displayLocation, meetingUrl } = parseEventLocationAndMeeting(item);
                                            return (
                                                <div className="admin-event-meta-row">
                                                    {displayLocation && (
                                                        <span className="admin-event-location" title={displayLocation}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                                <circle cx="12" cy="10" r="3" />
                                                            </svg>
                                                            <span>{displayLocation}</span>
                                                        </span>
                                                    )}

                                                    {meetingUrl && (
                                                        <a
                                                            href={meetingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="admin-event-join-btn"
                                                        >
                                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polygon points="23 7 16 12 23 17 23 7" />
                                                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                                            </svg>
                                                            <span>{t('admin.events.joinMeeting', 'Join Meeting')}</span>
                                                        </a>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Collapsible details */}
                                        {hasDescription && (
                                            <div className="admin-event-desc-wrapper">
                                                <button
                                                    type="button"
                                                    className="admin-event-toggle-desc-btn"
                                                    onClick={() => toggleExpand(item.id)}
                                                >
                                                    <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                                                    <svg
                                                        width="10"
                                                        height="10"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                                                    >
                                                        <polyline points="6 9 12 15 18 9" />
                                                    </svg>
                                                </button>

                                                {isExpanded && (
                                                    <div className="admin-event-desc-content">
                                                        {item.description}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    /* ================= TIMETABLE VIEW ================= */
                    <div className="admin-events-timetable-wrapper">
                        {/* All-Day Events Banner if present */}
                        {allDayEvents.length > 0 && (
                            <div className="admin-timetable-allday-row">
                                <div className="admin-timetable-allday-label">{t('admin.events.allDay', 'All Day')}</div>
                                <div className="admin-timetable-allday-items">
                                    {allDayEvents.map((evt) => (
                                        <div key={evt.id} className="admin-timetable-allday-pill">
                                            <span>{evt.subject}</span>
                                            {evt.location && <span className="allday-loc">({evt.location})</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Timetable Grid */}
                        <div className="admin-timetable-container" ref={timetableContainerRef}>
                            {/* Left Hours Column */}
                            <div className="admin-timetable-hours-col" style={{ height: totalGridHeight }}>
                                {hourSlots.map((hour, idx) => (
                                    <div
                                        key={hour}
                                        className="admin-timetable-hour-label"
                                        style={{ top: idx * HOUR_HEIGHT }}
                                    >
                                        {formatHourLabel(hour)}
                                    </div>
                                ))}
                            </div>

                            {/* Right Grid Canvas */}
                            <div className="admin-timetable-canvas" style={{ height: totalGridHeight }}>
                                {/* Horizontal Hour Guideline Lines */}
                                {hourSlots.map((hour, idx) => (
                                    <div
                                        key={`line-${hour}`}
                                        className="admin-timetable-grid-line"
                                        style={{ top: Math.min(idx * HOUR_HEIGHT, totalGridHeight - 1) }}
                                    />
                                ))}

                                {/* Red / Blue Current Time Line */}
                                {isNowVisible && (
                                    <div className="admin-timetable-now-indicator" style={{ top: nowTop }}>
                                        <span className="now-dot" />
                                        <span className="now-line" />
                                    </div>
                                )}

                                {/* Event Blocks */}
                                {timedEvents.map((evt) => {
                                    const isSelected = activeTimetableEvent?.id === evt.id;

                                    return (
                                        <div
                                            key={evt.id}
                                            className={`admin-timetable-event-block ${isSelected ? 'selected' : ''}`}
                                            style={{
                                                top: evt.top,
                                                height: evt.height,
                                                left: `calc(${evt.leftPercent}% + 3px)`,
                                                width: `calc(${evt.widthPercent}% - 6px)`,
                                            }}
                                            onClick={() => setActiveTimetableEvent(isSelected ? null : evt)}
                                            title={`${evt.subject}\n${evt.timeFormatted}${evt.location ? `\n${evt.location}` : ''}`}
                                        >
                                            <div className="admin-timetable-event-content">
                                                <div className="admin-timetable-event-subject">
                                                    {evt.subject}
                                                </div>
                                                {evt.location && evt.height > 34 && (
                                                    <div className="admin-timetable-event-location">
                                                        {evt.location}
                                                    </div>
                                                )}
                                                {evt.category && evt.height > 52 && (
                                                    <div className="admin-timetable-event-cat">
                                                        {evt.category}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Recurrence loop icon at bottom right matching screenshot */}
                                            {evt.isRecurring && (
                                                <span className="admin-timetable-recurring-icon" title="Recurring Series">
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Detail Card below timetable if an event is clicked */}
                        {activeTimetableEvent && (
                            <div className="admin-timetable-event-preview-popover">
                                <div className="preview-header">
                                    <h4 className="preview-title">{activeTimetableEvent.subject}</h4>
                                    <button
                                        type="button"
                                        className="preview-close-btn"
                                        onClick={() => setActiveTimetableEvent(null)}
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                                {(() => {
                                    const { displayLocation, meetingUrl } = parseEventLocationAndMeeting(activeTimetableEvent);
                                    return (
                                        <div className="preview-body">
                                            <div className="preview-row">
                                                <span className="preview-label">Time:</span>
                                                <span className="preview-value">{activeTimetableEvent.timeFormatted}</span>
                                            </div>
                                            {displayLocation && (
                                                <div className="preview-row">
                                                    <span className="preview-label">Location:</span>
                                                    <span className="preview-value">{displayLocation}</span>
                                                </div>
                                            )}
                                            {activeTimetableEvent.category && (
                                                <div className="preview-row">
                                                    <span className="preview-label">Category:</span>
                                                    <span className="preview-value">{activeTimetableEvent.category}</span>
                                                </div>
                                            )}
                                            {activeTimetableEvent.description && (
                                                <div className="preview-description">
                                                    {activeTimetableEvent.description}
                                                </div>
                                            )}
                                            {meetingUrl && (
                                                <a
                                                    href={meetingUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="admin-event-join-btn"
                                                    style={{ marginTop: '0.5rem', display: 'inline-flex' }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="23 7 16 12 23 17 23 7" />
                                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                                    </svg>
                                                    <span>{t('admin.events.joinMeeting', 'Join Meeting')}</span>
                                                </a>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </article>
    );
};

export default UpcomingEvents;

