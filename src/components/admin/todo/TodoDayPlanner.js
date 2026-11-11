import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useContent } from '../../../utils/ContentContext';
import { assistantApi } from '../../../utils/assistantApi';

const PLANNER_STORAGE_KEY = 'admin_todo_day_planner_data';

// Helper to get today's local date string YYYY-MM-DD
export const getTodayDateKey = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Format minute (0..1440) to 12h display string e.g. "9:30 AM"
export const formatMinutesToTime = (totalMinutes) => {
    if (totalMinutes >= 1440) return '12:00 AM';
    const mins = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
    let hour = Math.floor(mins / 60);
    const minute = mins % 60;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const minuteStr = String(minute).padStart(2, '0');
    return `${hour}:${minuteStr} ${ampm}`;
};

// Format hour (0..24) to label e.g. "12 AM", "1 PM"
const formatHourLabel = (hour) => {
    const h = hour % 24;
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
};

// Format duration minutes e.g. "45m", "1h 30m"
export const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

// Extract meeting URL and cleaned location from a calendar event
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

// Convert UTC or local date string to minutes and dateKey in America/New_York
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

// Calculate maximum simultaneous overlapping peers for a given block
function getBlockMaxConcurrency(targetBlock, blocks) {
    const targetEnd = targetBlock.startMin + (targetBlock.durationMin || 60);
    const peers = blocks.filter((b) => {
        const bEnd = b.startMin + (b.durationMin || 60);
        return Math.max(targetBlock.startMin, b.startMin) < Math.min(targetEnd, bEnd);
    });

    if (peers.length <= 1) return 1;

    let maxConc = 1;
    for (const p of peers) {
        const pt = Math.max(targetBlock.startMin, p.startMin);
        if (pt < targetEnd) {
            let active = 0;
            for (const other of peers) {
                const otherEnd = other.startMin + (other.durationMin || 60);
                if (other.startMin <= pt && otherEnd > pt) {
                    active++;
                }
            }
            if (active > maxConc) maxConc = active;
        }
    }
    return maxConc;
}

// Layout overlapping blocks into horizontal tracks (swimlanes)
function layoutPlannerBlocks(blocks) {
    if (!blocks || blocks.length === 0) return { positioned: [], maxTracks: 1 };
    const sorted = [...blocks].sort(
        (a, b) => a.startMin - b.startMin || (b.durationMin || 0) - (a.durationMin || 0)
    );

    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    for (const b of sorted) {
        const bEnd = b.startMin + (b.durationMin || 60);
        if (currentCluster.length === 0 || b.startMin < clusterEnd) {
            currentCluster.push(b);
            clusterEnd = Math.max(clusterEnd, bEnd);
        } else {
            clusters.push(currentCluster);
            currentCluster = [b];
            clusterEnd = bEnd;
        }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    const positioned = [];
    let globalMaxTrack = 0;
    for (const cluster of clusters) {
        const tracks = [];
        const clusterBlocks = [];
        for (const b of cluster) {
            const bEnd = b.startMin + (b.durationMin || 60);
            let trackIdx = -1;
            for (let i = 0; i < tracks.length; i++) {
                if (tracks[i] <= b.startMin) {
                    trackIdx = i;
                    tracks[i] = bEnd;
                    break;
                }
            }
            if (trackIdx === -1) {
                trackIdx = tracks.length;
                tracks.push(bEnd);
            }
            if (trackIdx > globalMaxTrack) globalMaxTrack = trackIdx;
            clusterBlocks.push({
                ...b,
                track: trackIdx,
            });
        }
        for (const b of clusterBlocks) {
            const blockConc = getBlockMaxConcurrency(b, cluster);
            // Effective tracks for this block: at least its own track + 1, up to block's max concurrency
            const effectiveTracks = Math.max(b.track + 1, blockConc);
            positioned.push({
                ...b,
                effectiveTracks,
                clusterTracks: Math.max(1, tracks.length),
            });
        }
    }
    return { positioned, maxTracks: Math.max(1, globalMaxTrack + 1) };
}

// Precomputed 5-minute time options for single time dropdown
const TIME_OPTIONS = Array.from({ length: 288 }, (_, i) => {
    const mins = i * 5;
    return {
        value: mins,
        label: formatMinutesToTime(mins),
    };
});

// Generate 5-minute End Time options strictly after a given start minute up to 1440 (midnight)
const getEndTimeOptions = (startMin) => {
    const start = typeof startMin === 'number' ? startMin : 540;
    const options = [];
    for (let m = start + 5; m <= 1440; m += 5) {
        const timeStr = m === 1440 ? '12:00 AM' : formatMinutesToTime(m);
        options.push({
            value: m,
            label: timeStr,
        });
    }
    return options;
};

const TodoDayPlanner = ({
    todos = [],
    draggedId = null,
    onClose,
    onBlockCountChange,
    onToggleTodo,
    onEditTodo,
}) => {
    const { t } = useContent();

    // Mobile viewport detection for responsive timeline slot scaling (120px on mobile vs 180px desktop)
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 640);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const hourWidth = isMobile ? 120 : 180;

    // 1. User Planned Blocks (Saved to Local Storage & Cleared Everyday)
    const [blocks, setBlocks] = useState(() => {
        try {
            const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const today = getTodayDateKey();
            if (parsed.dateKey !== today) {
                localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({ dateKey: today, blocks: [] }));
                return [];
            }
            return Array.isArray(parsed.blocks) ? parsed.blocks : [];
        } catch {
            return [];
        }
    });

    // 2. Synced External Calendar Events (Live, Read-Only & Immutable)
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [allDayEvents, setAllDayEvents] = useState([]);
    const [calendarLoading, setCalendarLoading] = useState(false);

    const [currentDateKey, setCurrentDateKey] = useState(getTodayDateKey);
    const [currentTimeMin, setCurrentTimeMin] = useState(() => {
        const d = new Date();
        return d.getHours() * 60 + d.getMinutes();
    });

    // Interaction states
    const [dragOverMin, setDragOverMin] = useState(null);
    const [draggedBlockId, setDraggedBlockId] = useState(null);
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [selectedBlockTitle, setSelectedBlockTitle] = useState('');
    const titleInputRef = useRef(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [customDraft, setCustomDraft] = useState({
        title: '',
        startMin: 540,
        endMin: 600,
    });

    // Live Drag-to-Create state: { startMin, currentMin }
    const [dragCreate, setDragCreate] = useState(null);
    // Live Resizing state: { id, initialDuration, durationMin, startMin }
    const [resizingBlock, setResizingBlock] = useState(null);

    const scrollContainerRef = useRef(null);
    const timelineGridRef = useRef(null);
    const hasInitialScrolled = useRef(false);

    // Fetch and Sync External Calendar Events
    const loadCalendarEvents = useCallback(async (forceFresh = false) => {
        try {
            setCalendarLoading(true);
            const res = await assistantApi.getCalendar('today', { fresh: forceFresh });
            const rawEvents = Array.isArray(res?.events) ? res.events : [];

            const timedList = [];
            const allDayList = [];

            const todayNyParts = getNyTimeParts(new Date().toISOString());
            const todayKey = todayNyParts.dateKey;

            for (const evt of rawEvents) {
                if (evt.isAllDay) {
                    allDayList.push(evt);
                    continue;
                }

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

                const isFromYesterday = Boolean(
                    (evt.dayKey && todayKey && evt.dayKey < todayKey) ||
                    (startParts.dateKey && todayKey && startParts.dateKey < todayKey)
                );

                let startMin = isFromYesterday ? 0 : startParts.minutes;
                let endMin = endParts.minutes;

                const isSpillover = Boolean(
                    evt.spillsOverMidnight ||
                    (startParts.dateKey && endParts.dateKey && startParts.dateKey !== endParts.dateKey && (endParts.hour > 0 || endParts.minute > 0)) ||
                    (!isFromYesterday && endMin <= startMin && durationMins > 0)
                );

                if (!isFromYesterday && (isSpillover || endMin <= startMin)) {
                    endMin = startMin + durationMins;
                }

                const { displayLocation, meetingUrl } = parseEventLocationAndMeeting(evt);

                timedList.push({
                    id: `cal-${evt.id || String(Math.random())}`,
                    title: evt.subject || evt.title || evt.summary || 'Calendar Event',
                    startMin,
                    durationMin: Math.max(5, durationMins),
                    isCalendarEvent: true,
                    isImmutable: true,
                    location: displayLocation,
                    meetingUrl,
                    isRecurring: Boolean(evt.isRecurring),
                    category: evt.category || '',
                    description: evt.description || '',
                    organizer: evt.organizer || '',
                    originalEvent: evt,
                });
            }

            setCalendarEvents(timedList);
            setAllDayEvents(allDayList);
        } catch (err) {
            console.warn('Calendar sync in day planner:', err.message);
        } finally {
            setCalendarLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCalendarEvents(false);
    }, [loadCalendarEvents]);

    // Keep blocks' completed status and title in sync with the main todos array
    useEffect(() => {
        if (!Array.isArray(todos) || todos.length === 0) return;
        setBlocks((prevBlocks) => {
            let hasChanged = false;
            const updated = prevBlocks.map((b) => {
                if (!b.todoId) return b;
                const matched = todos.find((t) => String(t.id) === String(b.todoId));
                if (!matched) return b;
                const isMatchedCompleted = Boolean(matched.completed);
                const isMatchedTitle = matched.title || b.title;
                if (Boolean(b.completed) !== isMatchedCompleted || b.title !== isMatchedTitle) {
                    hasChanged = true;
                    return {
                        ...b,
                        completed: isMatchedCompleted,
                        title: isMatchedTitle,
                    };
                }
                return b;
            });
            return hasChanged ? updated : prevBlocks;
        });
    }, [todos]);

    // Save user blocks to local storage whenever they change
    useEffect(() => {
        try {
            const today = getTodayDateKey();
            localStorage.setItem(
                PLANNER_STORAGE_KEY,
                JSON.stringify({ dateKey: today, blocks })
            );
            if (onBlockCountChange) {
                onBlockCountChange(blocks.length);
            }
        } catch (e) {
            // LocalStorage quota or access error
        }
    }, [blocks, onBlockCountChange]);

    // Check every 30 seconds for time updates and midnight rollover
    useEffect(() => {
        const interval = setInterval(() => {
            const d = new Date();
            const nowMin = d.getHours() * 60 + d.getMinutes();
            setCurrentTimeMin(nowMin);

            const today = getTodayDateKey();
            if (today !== currentDateKey) {
                setCurrentDateKey(today);
                setBlocks([]);
                try {
                    localStorage.setItem(
                        PLANNER_STORAGE_KEY,
                        JSON.stringify({ dateKey: today, blocks: [] })
                    );
                } catch {}
                loadCalendarEvents(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [currentDateKey, loadCalendarEvents]);

    // Active Drag Preview Ghost (Drag-to-Create or Drag-over from Kanban)
    const ghostBlock = useMemo(() => {
        if (dragCreate) {
            const dcMin = Math.min(dragCreate.startMin, dragCreate.currentMin);
            const dcMax = Math.max(dragCreate.startMin, dragCreate.currentMin);
            return {
                id: '__drag_create_ghost__',
                title: '+ New',
                startMin: dcMin,
                durationMin: Math.max(5, dcMax - dcMin),
                isGhost: true,
                isDragCreate: true,
            };
        }
        if (dragOverMin !== null) {
            return {
                id: '__drag_over_ghost__',
                title: 'Drop Task',
                startMin: dragOverMin,
                durationMin: 60,
                isGhost: true,
                isDropGhost: true,
            };
        }
        return null;
    }, [dragCreate, dragOverMin]);

    // Combined list: Immutable calendar events + User planned blocks
    const allBlocks = useMemo(() => {
        return [...calendarEvents, ...blocks];
    }, [calendarEvents, blocks]);

    // Combined list including live preview ghost for interactive track assignment
    const allBlocksWithGhost = useMemo(() => {
        if (!ghostBlock) return allBlocks;
        return [...allBlocks, ghostBlock];
    }, [allBlocks, ghostBlock]);

    // Overlapping layout computation for all blocks in horizontal tracks
    const laidOutBlocks = useMemo(() => layoutPlannerBlocks(allBlocksWithGhost), [allBlocksWithGhost]);

    // Scroll to target minute on timeline smoothly (centers target time)
    const scrollToTime = useCallback((targetMin, smooth = true) => {
        if (!scrollContainerRef.current) return;
        const containerWidth = scrollContainerRef.current.clientWidth || 800;
        const targetX = (targetMin / 60) * hourWidth;
        const leftPx = Math.max(0, targetX - containerWidth / 3);
        scrollContainerRef.current.scrollTo({
            left: leftPx,
            behavior: smooth ? 'smooth' : 'auto',
        });
    }, [hourWidth]);

    // Initial mount: scroll to current time
    useEffect(() => {
        if (hasInitialScrolled.current) return;
        hasInitialScrolled.current = true;
        const timer = setTimeout(() => {
            scrollToTime(currentTimeMin, false);
        }, 120);
        return () => clearTimeout(timer);
    }, [currentTimeMin, scrollToTime]);

    // Map mouse wheel deltaY to horizontal scroll for intuitive timeline exploration
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const handleWheel = (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // Snap X position on horizontal timeline to nearest 5-minute increment
    const getSnappedMinutesFromX = useCallback((clientX) => {
        if (!timelineGridRef.current) return 0;
        const rect = timelineGridRef.current.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const rawMin = (offsetX / hourWidth) * 60;
        const snapped = Math.round(rawMin / 5) * 5;
        return Math.max(0, Math.min(1435, snapped));
    }, [hourWidth]);

    // Selected block reference (can be a user block OR a calendar event)
    const selectedBlock = useMemo(
        () => allBlocks.find((b) => b.id === selectedBlockId) || null,
        [allBlocks, selectedBlockId]
    );

    // Sync title input when selected user block changes
    useEffect(() => {
        if (selectedBlock && !selectedBlock.isImmutable) {
            setSelectedBlockTitle(selectedBlock.title || '');
        }
    }, [selectedBlockId, selectedBlock?.title, selectedBlock?.isImmutable]);

    // Handle escape key to close floating popover, composer, or drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedBlockId) {
                    if (selectedBlock && !selectedBlock.isImmutable && !selectedBlock.todoId) {
                        const finalTitle = selectedBlockTitle.trim() || t('admin.todoSection.focusTime', 'Focus Block');
                        setBlocks((prev) =>
                            prev.map((b) => (b.id === selectedBlockId && !b.isImmutable && !b.todoId ? { ...b, title: finalTitle } : b))
                        );
                    }
                    setSelectedBlockId(null);
                } else if (isAddModalOpen) {
                    setIsAddModalOpen(false);
                } else if (typeof onClose === 'function') {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedBlockId, selectedBlock, selectedBlockTitle, isAddModalOpen, onClose, t]);

    // Drag over timeline grid
    const handleTimelineDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            if (e.dataTransfer.effectAllowed === 'move') {
                e.dataTransfer.dropEffect = 'move';
            } else {
                e.dataTransfer.dropEffect = 'copy';
            }
        } catch {}

        const snappedMin = getSnappedMinutesFromX(e.clientX);
        setDragOverMin(snappedMin);
    };

    const handleTimelineDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverMin(null);
        }
    };

    // Drop handler: accepts dropped todos OR internal block moves
    const handleTimelineDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const snappedMin = getSnappedMinutesFromX(e.clientX);
        setDragOverMin(null);

        // 1. Moving an existing block (calendar events are never dragged)
        let movedBlockId = null;
        try {
            movedBlockId = e.dataTransfer.getData('application/day-planner-block-id');
        } catch {}

        if (!movedBlockId && draggedBlockId) {
            movedBlockId = draggedBlockId;
        }

        if (movedBlockId) {
            setBlocks((prev) =>
                prev.map((b) => (b.id === movedBlockId ? { ...b, startMin: snappedMin } : b))
            );
            setDraggedBlockId(null);
            return;
        }

        // 2. Dropping a todo from the board
        let todoData = null;
        try {
            const rawJson = e.dataTransfer.getData('application/json');
            if (rawJson) {
                todoData = JSON.parse(rawJson);
            }
        } catch {}

        const textId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || String(draggedId || '');
        const targetId = String(todoData?.id || textId || '');

        const matchedTodo = todos.find((t) => String(t.id) === targetId) || todoData;
        if (!matchedTodo) {
            return;
        }

        let duration = 60;
        if (matchedTodo.estimatedTime && Number(matchedTodo.estimatedTime) > 0) {
            duration = Math.min(240, Math.max(5, Number(matchedTodo.estimatedTime)));
        }

        const newBlock = {
            id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title: matchedTodo.title || 'Task',
            startMin: snappedMin,
            durationMin: duration,
            todoId: matchedTodo.id,
            priority: matchedTodo.priority || 'medium',
            color: 'darkblue',
            isCustom: false,
            completed: Boolean(matchedTodo.completed),
        };

        setBlocks((prev) => [...prev, newBlock]);
        setSelectedBlockId(newBlock.id);
    };

    // Drag-to-create on timeline canvas horizontally
    const handleGridMouseDown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.admin-todo-planner-block') || e.target.closest('.admin-todo-planner-bottom-panel') || e.target.closest('button, input, select, a')) {
            return;
        }

        const startClientX = e.clientX;
        const startMin = getSnappedMinutesFromX(startClientX);
        let hasMoved = false;

        const onWindowMouseMove = (moveE) => {
            if (!hasMoved && Math.abs(moveE.clientX - startClientX) < 8) {
                return;
            }
            hasMoved = true;
            const curMin = getSnappedMinutesFromX(moveE.clientX);
            const minStart = Math.min(startMin, curMin);
            const maxEnd = Math.max(startMin, curMin);
            const effectiveEnd = Math.max(minStart + 5, Math.min(1440, maxEnd));
            setDragCreate({ startMin: minStart, currentMin: effectiveEnd });
        };

        const onWindowMouseUp = (upE) => {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);

            setDragCreate(null);

            if (hasMoved) {
                const endMin = getSnappedMinutesFromX(upE.clientX);
                const minStart = Math.min(startMin, endMin);
                const maxEnd = Math.max(startMin, endMin);
                const duration = Math.max(5, Math.min(1440 - minStart, maxEnd - minStart));

                if (duration >= 5) {
                    const newBlock = {
                        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        title: t('admin.todoSection.focusTime', 'Focus Block'),
                        startMin: minStart,
                        durationMin: duration,
                        color: 'darkblue',
                        isCustom: true,
                        completed: false,
                    };
                    setBlocks((prev) => [...prev, newBlock]);
                    setSelectedBlockId(newBlock.id);
                    return;
                }
            }

            // Clean click without drag: dismiss selection or open composer
            if (selectedBlockId) {
                setSelectedBlockId(null);
                return;
            }

            const snapped = Math.max(0, Math.min(1435, Math.floor(startMin / 5) * 5));
            setCustomDraft({
                title: '',
                startMin: snapped,
                endMin: Math.min(1440, snapped + 60),
            });
            setSelectedBlockId(null);
            setIsAddModalOpen(true);
        };

        window.addEventListener('mousemove', onWindowMouseMove);
        window.addEventListener('mouseup', onWindowMouseUp);
    };

    // Resize existing user block with horizontal mouse drag
    const handleResizeMouseDown = (block, startE) => {
        if (block.isImmutable) return;
        startE.stopPropagation();
        startE.preventDefault();

        const initialX = startE.clientX;
        const initialDuration = block.durationMin || 60;
        const maxDuration = 1440 - block.startMin;

        setResizingBlock({
            id: block.id,
            startMin: block.startMin,
            durationMin: initialDuration,
        });

        const onMouseMove = (moveE) => {
            const deltaX = moveE.clientX - initialX;
            const deltaMins = Math.round(((deltaX / hourWidth) * 60) / 5) * 5;
            const newDuration = Math.max(5, Math.min(maxDuration, initialDuration + deltaMins));

            setResizingBlock((prev) => (prev ? { ...prev, durationMin: newDuration } : null));

            setBlocks((prev) =>
                prev.map((b) => (b.id === block.id ? { ...b, durationMin: newDuration } : b))
            );
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setResizingBlock(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Add custom block via composer form
    const handleAddCustomBlock = (e) => {
        e?.preventDefault();
        const title = customDraft.title.trim() || t('admin.todoSection.focusTime', 'Focus Block');
        const startMin = Math.max(0, Math.min(1435, customDraft.startMin ?? 540));
        const endMin = Math.max(startMin + 5, Math.min(1440, customDraft.endMin ?? (startMin + 60)));
        const durationMin = endMin - startMin;

        const newBlock = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title,
            startMin,
            durationMin,
            color: 'darkblue',
            isCustom: true,
            completed: false,
        };

        setBlocks((prev) => [...prev, newBlock]);
        setIsAddModalOpen(false);
        setCustomDraft({
            title: '',
            startMin: 540,
            endMin: 600,
        });
        setSelectedBlockId(newBlock.id);
        scrollToTime(startMin, true);
    };

    // Delete a user block (calendar events cannot be deleted)
    const handleDeleteBlock = (blockId, e) => {
        e?.stopPropagation();
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        if (selectedBlockId === blockId) {
            setSelectedBlockId(null);
        }
    };

    // Clear whole day plan (clears user blocks; leaves calendar events intact)
    const handleClearDay = () => {
        if (blocks.length === 0) return;
        const confirmMsg = t(
            'admin.todoSection.clearPlanConfirm',
            "Are you sure you want to clear today's planned timeline? (Synced calendar events will remain)"
        );
        if (window.confirm(confirmMsg)) {
            setBlocks([]);
            setSelectedBlockId(null);
            try {
                localStorage.setItem(
                    PLANNER_STORAGE_KEY,
                    JSON.stringify({ dateKey: getTodayDateKey(), blocks: [] })
                );
            } catch {}
        }
    };

    // Title text input change inside selected block panel (for user-made blocks only)
    const handleTitleChange = (blockId, text) => {
        setSelectedBlockTitle(text);
        setBlocks((prev) =>
            prev.map((b) => (b.id === blockId && !b.isImmutable && !b.todoId ? { ...b, title: text } : b))
        );
    };

    const handleTitleBlur = (blockId) => {
        if (selectedBlock && !selectedBlock.isImmutable && !selectedBlock.todoId) {
            const finalTitle = selectedBlockTitle.trim() || t('admin.todoSection.focusTime', 'Focus Block');
            setSelectedBlockTitle(finalTitle);
            setBlocks((prev) =>
                prev.map((b) => (b.id === blockId && !b.isImmutable && !b.todoId ? { ...b, title: finalTitle } : b))
            );
        }
    };

    // Hours to display horizontally: 24 hours (12 AM to 11 PM)
    const displayHours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

    const totalGridWidthPx = displayHours.length * hourWidth;
    const maxTracks = Math.max(1, laidOutBlocks.maxTracks);
    const { trackHeight, trackGap } = useMemo(() => {
        if (maxTracks <= 1) return { trackHeight: 32, trackGap: 4 };
        if (maxTracks === 2) return { trackHeight: 24, trackGap: 3 };
        if (maxTracks === 3) return { trackHeight: 20, trackGap: 2 };
        return { trackHeight: 18, trackGap: 2 };
    }, [maxTracks]);
    const totalAvailableHeight = Math.max(32, maxTracks * trackHeight + Math.max(0, maxTracks - 1) * trackGap);
    const tracksAreaHeight = 4 + totalAvailableHeight + 4;
    const densityClass = maxTracks >= 3 ? 'is-dense-3' : maxTracks === 2 ? 'is-dense-2' : '';

    // Current time position line
    const currentTimeLeftPx = (currentTimeMin / 60) * hourWidth;

    return (
        <section
            className={`admin-todo-planner-horizontal ${densityClass}`.trim()}
            aria-label="Day Planner"
            onDragOver={handleTimelineDragOver}
            onDrop={handleTimelineDrop}
        >
            {/* Header Toolbar */}
            <div className="admin-todo-planner-h-header">
                <div className="admin-todo-planner-h-left">
                    <span className="admin-todo-planner-h-title">{t('admin.todoSection.dayPlanner', 'Day Planner')}</span>
                </div>

                <div className="admin-todo-planner-h-right">
                    {/* All-Day Events inline if present */}
                    {allDayEvents.length > 0 && (
                        <div className="admin-todo-planner-h-all-day-bar">
                            <span className="admin-todo-planner-all-day-label">
                                {t('admin.events.allDay', 'All Day')}:
                            </span>
                            <div className="admin-todo-planner-h-all-day-pills">
                                {allDayEvents.map((evt, idx) => (
                                    <button
                                        key={evt.id || idx}
                                        type="button"
                                        className="admin-todo-planner-all-day-pill"
                                        title={evt.subject}
                                        onClick={() => {
                                            const synthetic = {
                                                id: `allday-${idx}`,
                                                title: evt.subject || 'All-Day Event',
                                                startMin: 0,
                                                durationMin: 1440,
                                                isCalendarEvent: true,
                                                isImmutable: true,
                                                location: evt.location || '',
                                                description: evt.description || '',
                                                originalEvent: evt,
                                            };
                                            setSelectedBlockId(synthetic.id);
                                        }}
                                    >
                                        {evt.subject}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {blocks.length > 0 && (
                        <button
                            type="button"
                            className="admin-todo-planner-btn-clear-link"
                            onClick={handleClearDay}
                            title={t('admin.todoSection.clearPlan', "Clear today's planned blocks")}
                        >
                            {t('admin.todoSection.clear', 'Clear')}
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Horizontal Timeline Canvas */}
            <div
                className="admin-todo-planner-h-scroll"
                ref={scrollContainerRef}
                onDragOver={handleTimelineDragOver}
                onDragLeave={handleTimelineDragLeave}
                onDrop={handleTimelineDrop}
            >
                <div
                    className="admin-todo-planner-h-timeline"
                    ref={timelineGridRef}
                    onMouseDown={handleGridMouseDown}
                    style={{ width: `${totalGridWidthPx + (isMobile ? 40 : 60)}px` }}
                >
                    {/* Hourly Header Bar */}
                    <div className="admin-todo-planner-h-hour-bar">
                        {displayHours.map((hour, idx) => (
                            <div
                                key={hour}
                                className="admin-todo-planner-h-hour-slot"
                                style={{ width: `${hourWidth}px` }}
                            >
                                <span className="admin-todo-planner-h-hour-label">
                                    {formatHourLabel(hour)}
                                </span>
                            </div>
                        ))}
                        <div className="admin-todo-planner-h-hour-slot is-midnight" style={{ width: isMobile ? '40px' : '60px' }}>
                            <span className="admin-todo-planner-h-hour-label">12 AM</span>
                        </div>
                    </div>

                    {/* Timeline Tracks Canvas */}
                    <div
                        className="admin-todo-planner-h-tracks"
                        style={{ height: `${tracksAreaHeight}px` }}
                    >
                        {/* Background Vertical Guidelines */}
                        {displayHours.map((hour, idx) => (
                            <React.Fragment key={hour}>
                                <div
                                    className="admin-todo-planner-h-grid-line"
                                    style={{ left: `${idx * hourWidth}px` }}
                                />
                                <div
                                    className="admin-todo-planner-h-half-grid-line"
                                    style={{ left: `${idx * hourWidth + hourWidth / 2}px` }}
                                />
                            </React.Fragment>
                        ))}
                        <div
                            className="admin-todo-planner-h-grid-line is-midnight"
                            style={{ left: `${totalGridWidthPx}px` }}
                        />

                        {/* Real-Time "Now" Vertical Indicator Line */}
                        {currentTimeLeftPx >= 0 && currentTimeLeftPx <= totalGridWidthPx && (
                            <div
                                className="admin-todo-planner-h-now-line"
                                style={{ left: `${currentTimeLeftPx}px` }}
                                title={`${t('admin.todoSection.currentTime', 'Current Time')}: ${formatMinutesToTime(currentTimeMin)}`}
                            >
                                <span className="admin-todo-planner-h-now-pill">
                                    {formatMinutesToTime(currentTimeMin)}
                                </span>
                                <div className="admin-todo-planner-h-now-bar" />
                            </div>
                        )}


                        {/* Planned Blocks, Synced Calendar Events & Active Drag Ghost */}
                        <div className="admin-todo-planner-h-events-layer">
                            {laidOutBlocks.positioned.map((b) => {
                                const leftPx = (b.startMin / 60) * hourWidth;
                                const widthPx = Math.max(28, ((b.durationMin || 60) / 60) * hourWidth - 4);
                                const effTracks = Math.min(maxTracks, Math.max(1, b.effectiveTracks || 1));
                                const blockHeight = Math.floor(
                                    (totalAvailableHeight - Math.max(0, effTracks - 1) * trackGap) / effTracks
                                );
                                const topPx = 4 + b.track * (blockHeight + trackGap);

                                // Dynamic Live Drag Preview Ghost
                                if (b.isGhost) {
                                    if (b.isDragCreate) {
                                        return (
                                            <div
                                                key={b.id}
                                                className="admin-todo-planner-h-drag-create"
                                                style={{
                                                    left: `${leftPx}px`,
                                                    width: `${widthPx}px`,
                                                    top: `${topPx}px`,
                                                    height: `${blockHeight}px`,
                                                }}
                                            >
                                                <span className="admin-todo-planner-drag-create-badge">+ New</span>
                                                <span>
                                                    {formatMinutesToTime(b.startMin)} – {formatMinutesToTime(b.startMin + (b.durationMin || 60))}
                                                </span>
                                                <span className="admin-todo-planner-drag-create-dur">
                                                    ({formatDuration(b.durationMin)})
                                                </span>
                                            </div>
                                        );
                                    }
                                    if (b.isDropGhost) {
                                        return (
                                            <div
                                                key={b.id}
                                                className="admin-todo-planner-h-drop-ghost"
                                                style={{
                                                    left: `${leftPx}px`,
                                                    width: `${widthPx}px`,
                                                    top: `${topPx}px`,
                                                    height: `${blockHeight}px`,
                                                }}
                                            >
                                                <span>{formatMinutesToTime(b.startMin)}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                }

                                const isSelected = selectedBlockId === b.id;
                                const isResizing = resizingBlock?.id === b.id;
                                const isImmutable = Boolean(b.isImmutable || b.isCalendarEvent);

                                const blockDensityClass =
                                    blockHeight <= 22 ? 'is-dense-3' :
                                    blockHeight <= 32 && effTracks > 1 ? 'is-dense-2' :
                                    effTracks === 1 && maxTracks > 1 ? 'is-full-height' : '';

                                return (
                                    <div
                                        key={b.id}
                                        className={`admin-todo-planner-block color-${b.color || 'blue'} ${b.completed ? 'is-completed' : ''} ${isSelected ? 'is-selected' : ''} ${isResizing ? 'is-resizing' : ''} ${isImmutable ? 'is-calendar-event is-immutable' : ''} ${blockDensityClass}`.trim()}
                                        title={`${b.title} (${formatMinutesToTime(b.startMin)} – ${formatMinutesToTime(b.startMin + (b.durationMin || 60))})`}
                                        style={{
                                            left: `${leftPx}px`,
                                            width: `${widthPx}px`,
                                            top: `${topPx}px`,
                                            height: `${blockHeight}px`,
                                        }}
                                        draggable={!isImmutable && !isResizing}
                                        onDragStart={(e) => {
                                            if (isImmutable || isResizing) {
                                                e.preventDefault();
                                                return;
                                            }
                                            e.stopPropagation();
                                            e.dataTransfer.setData('application/day-planner-block-id', b.id);
                                            e.dataTransfer.effectAllowed = 'copyMove';
                                            setDraggedBlockId(b.id);
                                        }}
                                        onDragEnd={() => setDraggedBlockId(null)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBlockId(isSelected ? null : b.id);
                                        }}
                                        onDoubleClick={(e) => {
                                            if (!isImmutable && !b.todoId) {
                                                e.stopPropagation();
                                                setSelectedBlockId(b.id);
                                                setTimeout(() => {
                                                    titleInputRef.current?.focus();
                                                    titleInputRef.current?.select();
                                                }, 50);
                                            }
                                        }}
                                    >
                                        <div className="admin-todo-planner-block-content-h">
                                            {isImmutable && (
                                                <svg
                                                    className="admin-todo-planner-block-cal-icon"
                                                    width={blockHeight <= 22 ? "9" : blockHeight <= 32 ? "10" : "12"}
                                                    height={blockHeight <= 22 ? "9" : blockHeight <= 32 ? "10" : "12"}
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{ flexShrink: 0, opacity: 0.85 }}
                                                >
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                </svg>
                                            )}
                                            <span className="admin-todo-planner-block-title" title={b.title}>
                                                {b.title}
                                            </span>
                                        </div>

                                        {/* Live Resizing Tooltip */}
                                        {isResizing && (
                                            <div className="admin-todo-planner-resize-tooltip">
                                                {formatDuration(b.durationMin)} ({formatMinutesToTime(b.startMin + b.durationMin)})
                                            </div>
                                        )}

                                        {/* Right horizontal resize handle (User blocks only) */}
                                        {!isImmutable && (
                                            <div
                                                className="admin-todo-planner-resize-handle-h"
                                                onMouseDown={(e) => handleResizeMouseDown(b, e)}
                                                title={t('admin.todoSection.dragToResize', 'Drag right/left to adjust duration')}
                                            >
                                                <div className="admin-todo-planner-resize-grip-pill-v" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Docked Action Panel: New Event Composer OR Selected Block Inspector */}
            {isAddModalOpen ? (
                <div className="admin-todo-planner-bottom-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-todo-planner-bottom-accent-bar" />
                    <form onSubmit={handleAddCustomBlock} className="admin-todo-planner-bottom-form-h">
                        <div className="admin-todo-planner-bottom-row-h">
                            <span className="admin-todo-planner-bottom-heading">
                                {t('admin.todoSection.addCustomBlock', 'New event')}
                            </span>

                            <div className="admin-todo-planner-bottom-title-box">
                                <span className="admin-todo-planner-bottom-accent-stripe" />
                                <input
                                    type="text"
                                    className="admin-todo-planner-bottom-title-input"
                                    autoFocus
                                    placeholder={t('admin.todoSection.customBlockPlaceholder', 'Add title')}
                                    value={customDraft.title}
                                    onChange={(e) => setCustomDraft({ ...customDraft, title: e.target.value })}
                                />
                            </div>

                            <div className="admin-todo-planner-bottom-time-pickers">
                                <div className="admin-todo-planner-bottom-field">
                                    <label className="admin-todo-planner-bottom-label">
                                        {t('admin.todoSection.startTime', 'Start')}
                                    </label>
                                    <select
                                        className="admin-todo-planner-bottom-select"
                                        value={customDraft.startMin}
                                        onChange={(e) => {
                                            const newStart = parseInt(e.target.value, 10);
                                            const currentDur = Math.max(5, (customDraft.endMin || 600) - (customDraft.startMin || 540));
                                            setCustomDraft({
                                                ...customDraft,
                                                startMin: newStart,
                                                endMin: Math.min(1440, newStart + currentDur),
                                            });
                                        }}
                                    >
                                        {TIME_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="admin-todo-planner-bottom-field">
                                    <label className="admin-todo-planner-bottom-label">
                                        {t('admin.todoSection.endTime', 'End')}
                                    </label>
                                    <select
                                        className="admin-todo-planner-bottom-select"
                                        value={customDraft.endMin ?? (customDraft.startMin + 60)}
                                        onChange={(e) => {
                                            const newEnd = parseInt(e.target.value, 10);
                                            setCustomDraft({
                                                ...customDraft,
                                                endMin: Math.max(customDraft.startMin + 5, newEnd),
                                            });
                                        }}
                                    >
                                        {getEndTimeOptions(customDraft.startMin).map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="admin-todo-planner-bottom-duration-display" title={t('admin.todoSection.duration', 'Duration')}>
                                    {formatDuration((customDraft.endMin ?? (customDraft.startMin + 60)) - customDraft.startMin)}
                                </div>
                            </div>

                            <div className="admin-todo-planner-bottom-actions-h">
                                <button
                                    type="button"
                                    className="admin-todo-planner-bottom-btn-cancel"
                                    onClick={() => setIsAddModalOpen(false)}
                                >
                                    {t('admin.actions.cancel', 'Discard')}
                                </button>
                                <button type="submit" className="admin-todo-planner-bottom-btn-save">
                                    {t('admin.todoSection.addBlock', 'Save')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : selectedBlock ? (
                <div className="admin-todo-planner-bottom-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-todo-planner-bottom-accent-bar" />
                    <div className="admin-todo-planner-bottom-row-h">
                        <div className="admin-todo-planner-bottom-title-box">
                            <span className="admin-todo-planner-bottom-accent-stripe" />
                            {!selectedBlock.isImmutable && !selectedBlock.todoId ? (
                                <input
                                    ref={titleInputRef}
                                    type="text"
                                    className="admin-todo-planner-bottom-title-field"
                                    value={selectedBlockTitle}
                                    onChange={(e) => handleTitleChange(selectedBlock.id, e.target.value)}
                                    onBlur={() => handleTitleBlur(selectedBlock.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.target.blur();
                                    }}
                                    placeholder={t('admin.todoSection.customBlockPlaceholder', 'Add title')}
                                    title={t('admin.todoSection.clickToRename', 'Click to edit title')}
                                />
                            ) : (
                                <div className="admin-todo-planner-bottom-static-title-wrap">
                                    <span className="admin-todo-planner-bottom-block-title">{selectedBlock.title}</span>
                                </div>
                            )}
                        </div>

                        {selectedBlock.isImmutable ? (
                            <div className="admin-todo-planner-bottom-time-row-h">
                                <span className="admin-todo-planner-bottom-time-text">
                                    {formatMinutesToTime(selectedBlock.startMin)} – {formatMinutesToTime(selectedBlock.startMin + (selectedBlock.durationMin || 60))}
                                </span>
                                <span className="admin-todo-planner-bottom-dur-pill">
                                    {formatDuration(selectedBlock.durationMin || 60)}
                                </span>
                                {selectedBlock.meetingUrl && (
                                    <a
                                        href={selectedBlock.meetingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="admin-todo-planner-meeting-btn"
                                    >
                                        Join Meeting ↗
                                    </a>
                                )}
                            </div>
                        ) : (
                            <div className="admin-todo-planner-bottom-time-pickers">
                                <div className="admin-todo-planner-bottom-field">
                                    <label className="admin-todo-planner-bottom-label">
                                        {t('admin.todoSection.startTime', 'Start')}
                                    </label>
                                    <select
                                        className="admin-todo-planner-bottom-select"
                                        value={selectedBlock.startMin}
                                        onChange={(e) => {
                                            const newStart = parseInt(e.target.value, 10);
                                            const currentDur = selectedBlock.durationMin || 60;
                                            const newDur = Math.max(5, Math.min(currentDur, 1440 - newStart));
                                            setBlocks((prev) =>
                                                prev.map((b) =>
                                                    b.id === selectedBlock.id && !b.isImmutable
                                                        ? { ...b, startMin: newStart, durationMin: newDur }
                                                        : b
                                                )
                                            );
                                        }}
                                    >
                                        {TIME_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="admin-todo-planner-bottom-field">
                                    <label className="admin-todo-planner-bottom-label">
                                        {t('admin.todoSection.endTime', 'End')}
                                    </label>
                                    <select
                                        className="admin-todo-planner-bottom-select"
                                        value={Math.min(1440, selectedBlock.startMin + (selectedBlock.durationMin || 60))}
                                        onChange={(e) => {
                                            const newEnd = parseInt(e.target.value, 10);
                                            const newDuration = Math.max(5, newEnd - selectedBlock.startMin);
                                            setBlocks((prev) =>
                                                prev.map((b) =>
                                                    b.id === selectedBlock.id && !b.isImmutable
                                                        ? { ...b, durationMin: newDuration }
                                                        : b
                                                )
                                            );
                                        }}
                                    >
                                        {getEndTimeOptions(selectedBlock.startMin).map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="admin-todo-planner-bottom-duration-display" title={t('admin.todoSection.duration', 'Duration')}>
                                    {formatDuration(selectedBlock.durationMin || 60)}
                                </div>

                                <button
                                    type="button"
                                    className="admin-todo-planner-bottom-icon-btn admin-todo-planner-bottom-trash-btn"
                                    onClick={(e) => handleDeleteBlock(selectedBlock.id, e)}
                                    title={t('admin.actions.delete', 'Delete Block')}
                                    aria-label={t('admin.actions.delete', 'Delete Block')}
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default TodoDayPlanner;
