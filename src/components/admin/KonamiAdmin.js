import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import '../../konami-admin.css';

const GRID_HEIGHT = 16;
const DEFAULT_WIDTH = 40;

const TOOL_DEFS = [
    { id: 'P', key: 'spawnPoint', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a7 7 0 0 1 13 0v2"/></svg>, className: 'konami-cell-spawn' },
    { id: '#', key: 'groundBlock', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>, className: 'konami-cell-block' },
    { id: 'C', key: 'coin', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>, className: 'konami-cell-coin' },
    { id: 'E', key: 'enemy', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="14" x="3" y="6" rx="2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>, className: 'konami-cell-enemy' },
    { id: 'F', key: 'finishFlag', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>, className: 'konami-cell-flag' },
    { id: '.', key: 'eraser', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/></svg>, className: 'konami-cell-empty' },
];

function createDefaultGrid(width = DEFAULT_WIDTH) {
    const grid = [];
    for (let r = 0; r < GRID_HEIGHT; r++) {
        const row = [];
        for (let c = 0; c < width; c++) {
            // Default bottom row is ground, spawn at (2, 14), flag at (width - 3, 14)
            if (r === GRID_HEIGHT - 1) {
                row.push('#');
            } else if (r === GRID_HEIGHT - 2 && c === 2) {
                row.push('P');
            } else if (r === GRID_HEIGHT - 2 && c === width - 3) {
                row.push('F');
            } else {
                row.push('.');
            }
        }
        grid.push(row);
    }
    return grid;
}

const KonamiAdmin = () => {
    const { t, formatNumber } = useContent();
    const [levels, setLevels] = useState([]);
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeTool, setActiveTool] = useState(TOOL_DEFS[0].id);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [widthInput, setWidthInput] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [marqueeSelection, setMarqueeSelection] = useState(null);
    const [groupDragPreview, setGroupDragPreview] = useState(null);

    const currentLevel = levels.length > 0 ? (levels[activeLevelIdx] || levels[0] || null) : null;

    const marqueeStartCell = useRef(null);
    const isMarqueeActive = useRef(false);
    const groupDragAnchor = useRef(null);
    const isDraggingGroup = useRef(false);
    const selectedGroupRef = useRef(null);
    const groupDragPreviewRef = useRef(null);
    const isMouseDown = useRef(false);

    useEffect(() => {
        selectedGroupRef.current = selectedGroup;
    }, [selectedGroup]);

    // Reset selection when switching levels
    useEffect(() => {
        setSelectedGroup(null);
        selectedGroupRef.current = null;
        setMarqueeSelection(null);
        setGroupDragPreview(null);
        groupDragPreviewRef.current = null;
    }, [activeLevelIdx]);

    const moveGroup = useCallback((group, deltaR, deltaC) => {
        if (!group || (deltaR === 0 && deltaC === 0)) return;

        setLevels((prevLevels) => {
            const updatedLevels = [...prevLevels];
            const level = { ...updatedLevels[activeLevelIdx] };
            if (!level) return prevLevels;
            const newGrid = level.grid.map((row) => [...row]);

            const elements = [];
            for (let r = group.rMin; r <= group.rMax; r++) {
                for (let c = group.cMin; c <= group.cMax; c++) {
                    const char = newGrid[r][c];
                    if (char && char !== '.') {
                        elements.push({ r, c, char });
                        newGrid[r][c] = '.';
                    }
                }
            }

            elements.forEach(({ r, c, char }) => {
                const targetR = r + deltaR;
                const targetC = c + deltaC;
                if (targetR >= 0 && targetR < GRID_HEIGHT && targetC >= 0 && targetC < level.width) {
                    newGrid[targetR][targetC] = char;
                }
            });

            level.grid = newGrid;
            updatedLevels[activeLevelIdx] = level;
            return updatedLevels;
        });

        const maxW = (levels[activeLevelIdx] ? levels[activeLevelIdx].width : DEFAULT_WIDTH);
        const minDeltaR = -group.rMin;
        const maxDeltaR = GRID_HEIGHT - 1 - group.rMax;
        const minDeltaC = -group.cMin;
        const maxDeltaC = maxW - 1 - group.cMax;

        const clampedDeltaR = Math.max(minDeltaR, Math.min(maxDeltaR, deltaR));
        const clampedDeltaC = Math.max(minDeltaC, Math.min(maxDeltaC, deltaC));

        const newGroup = {
            rMin: group.rMin + clampedDeltaR,
            rMax: group.rMax + clampedDeltaR,
            cMin: group.cMin + clampedDeltaC,
            cMax: group.cMax + clampedDeltaC,
        };
        setSelectedGroup(newGroup);
        selectedGroupRef.current = newGroup;
    }, [activeLevelIdx, levels]);

    const handleFillSelection = useCallback((fillChar = '#') => {
        const currGroup = selectedGroupRef.current || selectedGroup;
        if (!currentLevel || !currGroup) return;
        const tool = (activeTool && activeTool !== 'SELECT') ? activeTool : fillChar;
        setLevels(prevLevels => {
            const updated = [...prevLevels];
            const level = { ...updated[activeLevelIdx] };
            if (!level) return prevLevels;
            const newGrid = level.grid.map(row => [...row]);
            for (let r = currGroup.rMin; r <= currGroup.rMax; r++) {
                for (let c = currGroup.cMin; c <= currGroup.cMax; c++) {
                    if (tool === 'P' || tool === 'F') {
                        for (let gr = 0; gr < GRID_HEIGHT; gr++) {
                            for (let gc = 0; gc < level.width; gc++) {
                                if (newGrid[gr][gc] === tool) newGrid[gr][gc] = '.';
                            }
                        }
                    }
                    newGrid[r][c] = tool;
                }
            }
            level.grid = newGrid;
            updated[activeLevelIdx] = level;
            return updated;
        });
    }, [currentLevel, selectedGroup, activeTool, activeLevelIdx]);

    const handleClearSelection = useCallback(() => {
        const currGroup = selectedGroupRef.current || selectedGroup;
        if (!currentLevel || !currGroup) return;
        setLevels(prevLevels => {
            const updated = [...prevLevels];
            const level = { ...updated[activeLevelIdx] };
            if (!level) return prevLevels;
            const newGrid = level.grid.map(row => [...row]);
            for (let r = currGroup.rMin; r <= currGroup.rMax; r++) {
                for (let c = currGroup.cMin; c <= currGroup.cMax; c++) {
                    newGrid[r][c] = '.';
                }
            }
            level.grid = newGrid;
            updated[activeLevelIdx] = level;
            return updated;
        });
    }, [currentLevel, selectedGroup, activeLevelIdx]);

    // Global mouseup to commit marquee or group drag
    useEffect(() => {
        const handleMouseUp = () => {
            isMouseDown.current = false;
            if (isMarqueeActive.current) {
                isMarqueeActive.current = false;
                marqueeStartCell.current = null;
                setMarqueeSelection((curr) => {
                    if (curr) {
                        setSelectedGroup(curr);
                        selectedGroupRef.current = curr;
                    }
                    return null;
                });
            } else if (isDraggingGroup.current) {
                isDraggingGroup.current = false;
                groupDragAnchor.current = null;
                const preview = groupDragPreviewRef.current;
                const currGroup = selectedGroupRef.current;
                if (preview && currGroup && (preview.deltaR !== 0 || preview.deltaC !== 0)) {
                    moveGroup(currGroup, preview.deltaR, preview.deltaC);
                }
                groupDragPreviewRef.current = null;
                setGroupDragPreview(null);
            }
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [moveGroup]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const currGroup = selectedGroupRef.current;
            if (!currGroup) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Escape') {
                setSelectedGroup(null);
                selectedGroupRef.current = null;
                setMarqueeSelection(null);
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handleClearSelection();
                return;
            }

            let deltaR = 0;
            let deltaC = 0;
            if (e.key === 'ArrowUp') deltaR = -1;
            else if (e.key === 'ArrowDown') deltaR = 1;
            else if (e.key === 'ArrowLeft') deltaC = -1;
            else if (e.key === 'ArrowRight') deltaC = 1;

            if (deltaR !== 0 || deltaC !== 0) {
                e.preventDefault();
                moveGroup(currGroup, deltaR, deltaC);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [moveGroup, handleClearSelection]);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    // Load levels from API
    const fetchLevels = useCallback(async () => {
        setLoading(true);
        try {
            let res = await fetch('/api/konami/levels', { credentials: 'include' });
            if (res.status === 404) {
                res = await fetch('/api/cms/content?type=konami', { credentials: 'include' });
            }
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    if (data.length > 0) {
                        const normalized = data.map((lvl, idx) => {
                            let g = lvl.grid || lvl.map;
                            const w = lvl.width || (Array.isArray(g) && g[0] ? g[0].length : DEFAULT_WIDTH);
                            if (Array.isArray(g) && g.length === GRID_HEIGHT) {
                                g = g.map(row => (typeof row === 'string' ? row.split('') : [...row]));
                            } else {
                                g = createDefaultGrid(w);
                            }
                            return {
                                ...lvl,
                                id: lvl.id || `level-${idx + 1}`,
                                name: lvl.name || `${t('editor.nameLabel', 'Level')} ${idx + 1}`,
                                width: w,
                                height: GRID_HEIGHT,
                                grid: g
                            };
                        });
                        setLevels(normalized);
                    } else {
                        setLevels([]);
                    }
                    return;
                }
            }
            setLevels([]);
        } catch (err) {
            console.error(t('logs.konamiLevelsLoadError'), err);
            showToast(t('editor.failedLoadLevels'));
            setLevels([]);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchLevels();
    }, [fetchLevels]);

    // Sync input value when switching levels or on initial load
    useEffect(() => {
        if (currentLevel) {
            setWidthInput(String(currentLevel.width || DEFAULT_WIDTH));
        }
    }, [activeLevelIdx, currentLevel?.width]);

    // Apply cell change
    const setCell = (rowIdx, colIdx, toolId) => {
        if (!currentLevel) return;

        setLevels(prevLevels => {
            const updatedLevels = [...prevLevels];
            const level = { ...updatedLevels[activeLevelIdx] };
            const newGrid = level.grid.map(row => [...row]);

            if (toolId === 'P' || toolId === 'F') {
                for (let r = 0; r < GRID_HEIGHT; r++) {
                    for (let c = 0; c < level.width; c++) {
                        if (newGrid[r][c] === toolId) {
                            newGrid[r][c] = '.';
                        }
                    }
                }
            }

            newGrid[rowIdx][colIdx] = toolId;
            level.grid = newGrid;
            updatedLevels[activeLevelIdx] = level;
            return updatedLevels;
        });
    };

    // Cell interactions
    const handleCellMouseDown = (r, c, e) => {
        e.preventDefault();
        isMouseDown.current = true;

        const currGroup = selectedGroupRef.current;

        // 1. If clicking inside existing selection, ALWAYS initiate group drag
        if (
            currGroup &&
            r >= currGroup.rMin &&
            r <= currGroup.rMax &&
            c >= currGroup.cMin &&
            c <= currGroup.cMax
        ) {
            isDraggingGroup.current = true;
            groupDragAnchor.current = { r, c };
            const initialPreview = { deltaR: 0, deltaC: 0 };
            groupDragPreviewRef.current = initialPreview;
            setGroupDragPreview(initialPreview);
            return;
        }

        // 2. If SELECT tool or shiftKey, start new marquee selection box
        if (activeTool === 'SELECT' || e.shiftKey) {
            isMarqueeActive.current = true;
            marqueeStartCell.current = { r, c };
            setMarqueeSelection({ rMin: r, rMax: r, cMin: c, cMax: c });
            setSelectedGroup(null);
            selectedGroupRef.current = null;
            return;
        }

        // 3. Otherwise normal painting: deselect group if any, and set cell
        if (currGroup) {
            setSelectedGroup(null);
            selectedGroupRef.current = null;
        }
        const tool = e.button === 2 ? '.' : activeTool; // Right-click erases
        setCell(r, c, tool);
    };

    const handleCellMouseEnter = (r, c, e) => {
        if (!isMouseDown.current) return;

        if (isDraggingGroup.current && groupDragAnchor.current) {
            const currGroup = selectedGroupRef.current;
            if (currGroup) {
                const maxW = (currentLevel ? currentLevel.width : DEFAULT_WIDTH);
                const desiredDeltaR = r - groupDragAnchor.current.r;
                const desiredDeltaC = c - groupDragAnchor.current.c;

                const minDeltaR = -currGroup.rMin;
                const maxDeltaR = GRID_HEIGHT - 1 - currGroup.rMax;
                const minDeltaC = -currGroup.cMin;
                const maxDeltaC = maxW - 1 - currGroup.cMax;

                const deltaR = Math.max(minDeltaR, Math.min(maxDeltaR, desiredDeltaR));
                const deltaC = Math.max(minDeltaC, Math.min(maxDeltaC, desiredDeltaC));

                const nextPreview = { deltaR, deltaC };
                groupDragPreviewRef.current = nextPreview;
                setGroupDragPreview(nextPreview);
            }
            return;
        }

        if (isMarqueeActive.current && marqueeStartCell.current) {
            const rMin = Math.min(marqueeStartCell.current.r, r);
            const rMax = Math.max(marqueeStartCell.current.r, r);
            const cMin = Math.min(marqueeStartCell.current.c, c);
            const cMax = Math.max(marqueeStartCell.current.c, c);
            setMarqueeSelection({ rMin, rMax, cMin, cMax });
            return;
        }

        if (activeTool === 'SELECT') {
            return;
        }

        const tool = e.buttons === 2 ? '.' : activeTool;
        setCell(r, c, tool);
    };

    // Width changer: allows any custom width
    const applyWidth = (newWidth) => {
        const width = Math.max(1, parseInt(newWidth, 10) || 1);
        setLevels(prevLevels => {
            const updated = [...prevLevels];
            const level = { ...updated[activeLevelIdx] };
            if (!level) return prevLevels;
            const oldWidth = level.width;
            const newGrid = [];

            for (let r = 0; r < GRID_HEIGHT; r++) {
                const oldRow = level.grid[r] || [];
                const newRow = [];
                for (let c = 0; c < width; c++) {
                    if (c < oldWidth) {
                        newRow.push(oldRow[c] || '.');
                    } else {
                        // Pad with ground on bottom row, empty on other rows
                        newRow.push(r === GRID_HEIGHT - 1 ? '#' : '.');
                    }
                }
                newGrid.push(newRow);
            }

            // Ensure spawn P and flag F exist within the new boundary
            let hasSpawn = false;
            let hasFlag = false;
            for (let r = 0; r < GRID_HEIGHT; r++) {
                for (let c = 0; c < width; c++) {
                    if (newGrid[r][c] === 'P') hasSpawn = true;
                    if (newGrid[r][c] === 'F') hasFlag = true;
                }
            }
            if (!hasSpawn && GRID_HEIGHT >= 2) {
                const spawnCol = Math.min(2, width - 1);
                newGrid[GRID_HEIGHT - 2][spawnCol] = 'P';
            }
            if (!hasFlag && width > 1 && GRID_HEIGHT >= 2) {
                const flagCol = width - 1;
                newGrid[GRID_HEIGHT - 2][flagCol] = 'F';
            }

            level.width = width;
            level.grid = newGrid;
            updated[activeLevelIdx] = level;
            return updated;
        });
    };

    const handleWidthInputChange = (e) => {
        const val = e.target.value;
        setWidthInput(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= 1) {
            applyWidth(parsed);
        }
    };

    const handleWidthInputBlur = () => {
        const parsed = parseInt(widthInput, 10);
        if (isNaN(parsed) || parsed < 1) {
            setWidthInput(String(currentLevel ? currentLevel.width : DEFAULT_WIDTH));
        } else {
            applyWidth(parsed);
            setWidthInput(String(parsed));
        }
    };

    const handleWidthInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    // Rename level
    const handleNameChange = (name) => {
        setLevels(prev => {
            const updated = [...prev];
            updated[activeLevelIdx] = { ...updated[activeLevelIdx], name };
            return updated;
        });
    };

    // Quick helpers
    const handleFillBottomRow = () => {
        if (!currentLevel) return;
        setLevels(prev => {
            const updated = [...prev];
            const level = { ...updated[activeLevelIdx] };
            const newGrid = level.grid.map((row, r) =>
                r === GRID_HEIGHT - 1 ? Array(level.width).fill('#') : [...row]
            );
            level.grid = newGrid;
            updated[activeLevelIdx] = level;
            return updated;
        });
    };

    const handleClearLevel = () => {
        if (!window.confirm(t('editor.confirmClearObstacles'))) return;
        setLevels(prev => {
            const updated = [...prev];
            const level = { ...updated[activeLevelIdx] };
            const newGrid = [];
            for (let r = 0; r < GRID_HEIGHT; r++) {
                if (r === GRID_HEIGHT - 1) {
                    newGrid.push(Array(level.width).fill('#'));
                } else if (r === GRID_HEIGHT - 2) {
                    const row = Array(level.width).fill('.');
                    row[2] = 'P';
                    row[Math.max(3, level.width - 3)] = 'F';
                    newGrid.push(row);
                } else {
                    newGrid.push(Array(level.width).fill('.'));
                }
            }
            level.grid = newGrid;
            updated[activeLevelIdx] = level;
            return updated;
        });
    };

    // Add Level
    const handleAddLevel = () => {
        const nextNum = levels.length + 1;
        const newLevel = {
            id: `level-${Date.now()}`,
            name: `${t('editor.nameLabel', 'Level')} ${nextNum}`,
            width: DEFAULT_WIDTH,
            height: GRID_HEIGHT,
            grid: createDefaultGrid(DEFAULT_WIDTH)
        };
        setLevels(prev => [...prev, newLevel]);
        setActiveLevelIdx(levels.length);
    };

    // Delete Level (auto-persists only the selected level)
    const handleDeleteLevel = async (idx = activeLevelIdx) => {
        const levelToDelete = levels[idx] || currentLevel;
        if (!levelToDelete) return;

        const levelName = levelToDelete.name || `${t('editor.nameLabel', 'Level')} ${idx + 1}`;
        if (!window.confirm((t('editor.confirmDeleteLevel') || 'Delete {name}?').replace('{name}', levelName))) return;

        const updatedLocal = levels.filter((_, i) => i !== idx);
        setLevels(updatedLocal);
        setActiveLevelIdx(prev => Math.max(0, Math.min(prev, updatedLocal.length - 1)));

        // Auto-save deletion immediately to API so changes are permanent
        setSaving(true);
        try {
            let persisted = [];
            try {
                let fetchRes = await fetch('/api/konami/levels', { credentials: 'include' });
                if (fetchRes.status === 404) {
                    fetchRes = await fetch('/api/cms/content?type=konami', { credentials: 'include' });
                }
                if (fetchRes.ok) {
                    const data = await fetchRes.json();
                    if (Array.isArray(data)) persisted = data;
                }
            } catch (fetchErr) {
                persisted = levels;
            }

            const targetId = levelToDelete.id;
            const updatedPersisted = persisted.filter((lvl, i) => {
                if (targetId && lvl.id) return lvl.id !== targetId;
                return i !== idx;
            });

            let res = await fetch('/api/konami/levels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ levels: updatedPersisted })
            });

            if (res.status === 404) {
                res = await fetch('/api/cms/content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ type: 'konami', data: updatedPersisted })
                });
            }

            if (res.ok) {
                showToast(updatedPersisted.length === 0 ? t('editor.allDeletedInfiniteActive') : (t('editor.levelDeletedToast') || '{name} deleted').replace('{name}', levelName));
            } else {
                showToast(t('editor.failedSaveDeletion'));
            }
        } catch (err) {
            console.error(t('logs.konamiLevelDeleteError'), err);
            showToast(t('editor.networkErrorDeleting'));
        } finally {
            setSaving(false);
        }
    };

    // Save only currently selected level to API
    const handleSave = async () => {
        if (!currentLevel) return;
        setSaving(true);
        try {
            let persisted = [];
            try {
                let fetchRes = await fetch('/api/konami/levels', { credentials: 'include' });
                if (fetchRes.status === 404) {
                    fetchRes = await fetch('/api/cms/content?type=konami', { credentials: 'include' });
                }
                if (fetchRes.ok) {
                    const data = await fetchRes.json();
                    if (Array.isArray(data)) persisted = data;
                }
            } catch (fetchErr) {
                persisted = levels;
            }

            let updated = [...persisted];
            const targetId = currentLevel.id;
            const existingIdx = updated.findIndex((lvl, i) => (targetId && lvl.id === targetId) || i === activeLevelIdx);

            if (existingIdx >= 0) {
                updated[existingIdx] = currentLevel;
            } else if (activeLevelIdx < updated.length) {
                updated[activeLevelIdx] = currentLevel;
            } else {
                updated.push(currentLevel);
            }

            let res = await fetch('/api/konami/levels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ levels: updated })
            });

            if (res.status === 404) {
                res = await fetch('/api/cms/content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ type: 'konami', data: updated })
                });
            }

            if (res.ok) {
                const info = await res.json().catch(() => ({}));
                const levelName = currentLevel.name || `${t('editor.nameLabel', 'Level')} ${activeLevelIdx + 1}`;
                if (info.storage && info.storage.filesystem && !info.storage.database) {
                    showToast((t('editor.levelSavedDisk') || '{name} saved locally to disk (MongoDB offline)').replace('{name}', levelName));
                } else {
                    showToast((t('editor.levelSavedSuccess') || '{name} saved successfully!').replace('{name}', levelName));
                }
            } else {
                const err = await res.json().catch(() => ({}));
                showToast((t('editor.failedSave') || 'Failed to save: {error}').replace('{error}', err.error || 'Server error'));
            }
        } catch (err) {
            console.error(t('logs.konamiLevelSaveError'), err);
            showToast(t('editor.networkErrorSaving'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title={t('editor.title')}>
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('editor.loadingLevels')}
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={t('editor.title')}>
            <div className="konami-admin-shell">
                {/* Level Navigation Tabs & Actions */}
                <div className="konami-admin-topbar">
                    <div className="konami-levels-nav">
                        {levels.map((lvl, idx) => (
                            <div key={lvl.id || idx} className={`konami-tab-item ${idx === activeLevelIdx ? 'active' : ''}`}>
                                <button
                                    type="button"
                                    className="konami-level-tab"
                                    onClick={() => setActiveLevelIdx(idx)}
                                >
                                    {lvl.name || `${t('editor.nameLabel', 'Level')} ${idx + 1}`}
                                </button>
                                <button
                                    type="button"
                                    className="konami-tab-delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteLevel(idx);
                                    }}
                                    title={(t('editor.deleteLevelTitle') || 'Delete {name}').replace('{name}', lvl.name || `Level ${idx + 1}`)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="konami-add-level-btn"
                            onClick={handleAddLevel}
                            title={t('editor.addNewLevelTitle')}
                        >
                            {t('editor.addLevel')}
                        </button>
                    </div>

                    <div className="konami-topbar-actions">
                        <button
                            type="button"
                            className="konami-delete-btn"
                            onClick={() => handleDeleteLevel(activeLevelIdx)}
                            disabled={saving || !currentLevel}
                            title={currentLevel ? (t('editor.deleteLevelTitle') || 'Delete {name}').replace('{name}', currentLevel.name || 'this level') : t('editor.noLevelSelected')}
                        >
                            {t('editor.deleteLevel')}
                        </button>
                        <button
                            type="button"
                            className="konami-save-btn"
                            onClick={handleSave}
                            disabled={saving || !currentLevel}
                            title={currentLevel ? (t('editor.saveLevelTitle') || 'Save {name}').replace('{name}', currentLevel.name || 'this level') : t('editor.noLevelSelected')}
                        >
                            {saving ? t('editor.saving') : t('editor.saveLevel')}
                        </button>
                    </div>
                </div>

                {/* Empty State when no custom levels exist */}
                {levels.length === 0 && (
                    <p className="admin-empty">{t('admin.noCustomLevels', 'No custom levels')}</p>
                )}

                {/* Level Metadata & Tools Panel */}
                {currentLevel && (
                    <div className="konami-toolbar-panel">
                        {/* Meta Settings */}
                        <div className="konami-meta-controls">
                            <label className="konami-input-group">
                                <span>{t('editor.nameLabel')}</span>
                                <input
                                    type="text"
                                    value={currentLevel.name || ''}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    style={{ width: '130px' }}
                                />
                            </label>

                            <label className="konami-input-group">
                                <span>{t('editor.widthLabel')}</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={widthInput}
                                    onChange={handleWidthInputChange}
                                    onBlur={handleWidthInputBlur}
                                    onKeyDown={handleWidthInputKeyDown}
                                    style={{ width: '85px' }}
                                    title={t('editor.widthTitle')}
                                />
                            </label>
                        </div>

                        {/* Palette Selector */}
                        <div className="konami-palette">
                            {TOOL_DEFS.map((tool) => (
                                <button
                                    key={tool.id}
                                    type="button"
                                    className={`konami-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                                    onClick={() => setActiveTool(tool.id)}
                                >
                                    <span>{tool.icon}</span>
                                    <span>{t(`editor.${tool.key}`)}</span>
                                </button>
                            ))}
                        </div>

                        {/* Bulk Edit Actions Group */}
                        <div className="konami-bulk-group" role="group" aria-label={t('editor.bulkActions', 'Bulk Edit')}>
                            <span className="konami-bulk-label">{t('editor.bulkActions', 'Bulk Edit')}</span>
                            <div className="konami-bulk-actions">
                                <button
                                    type="button"
                                    className={`konami-bulk-btn ${activeTool === 'SELECT' ? 'active' : ''}`}
                                    onClick={() => setActiveTool(prev => prev === 'SELECT' ? '#' : 'SELECT')}
                                    title={t('editor.selectGroupTitle', 'Click and drag to group elements together, then drag group to move')}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/>
                                        <path d="m14 14 5-5m-4 0h4v4"/>
                                    </svg>
                                    <span>{t('editor.selectGroup', 'Select & Move')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="konami-bulk-btn"
                                    onClick={handleFillBottomRow}
                                    title={t('editor.fillBottomTitle')}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 19h16M4 15h16M4 11h16"/>
                                    </svg>
                                    <span>{t('editor.fillFloor', 'Fill Floor')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="konami-bulk-btn konami-bulk-btn-danger"
                                    onClick={handleClearLevel}
                                    title={t('editor.clearAllTitle')}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                    <span>{t('editor.clear', 'Clear')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Interactive 16-Row Grid */}
                {currentLevel && (
                    <>
                        {selectedGroup && (
                            <div className="konami-group-floating-container">
                                <div className="konami-group-floating-bar" role="status">
                                    <span className="konami-group-pill-badge">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                                            <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/>
                                        </svg>
                                        <span>
                                            {t('editor.groupSelectedCount', '{w}×{h} elements grouped')
                                                .replace('{w}', formatNumber ? formatNumber(selectedGroup.cMax - selectedGroup.cMin + 1) : (selectedGroup.cMax - selectedGroup.cMin + 1))
                                                .replace('{h}', formatNumber ? formatNumber(selectedGroup.rMax - selectedGroup.rMin + 1) : (selectedGroup.rMax - selectedGroup.rMin + 1))}
                                        </span>
                                    </span>
                                    <div className="konami-group-nudge-cluster" aria-label={t('editor.nudgeGroup', 'Nudge group')}>
                                        <button
                                            type="button"
                                            className="konami-group-nudge-btn"
                                            onClick={() => moveGroup(selectedGroup, 0, -1)}
                                            disabled={selectedGroup.cMin <= 0}
                                            title={t('editor.nudgeLeft', 'Nudge Left (Left Arrow)')}
                                        >
                                            ◀
                                        </button>
                                        <button
                                            type="button"
                                            className="konami-group-nudge-btn"
                                            onClick={() => moveGroup(selectedGroup, -1, 0)}
                                            disabled={selectedGroup.rMin <= 0}
                                            title={t('editor.nudgeUp', 'Nudge Up (Up Arrow)')}
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            className="konami-group-nudge-btn"
                                            onClick={() => moveGroup(selectedGroup, 1, 0)}
                                            disabled={selectedGroup.rMax >= GRID_HEIGHT - 1}
                                            title={t('editor.nudgeDown', 'Nudge Down (Down Arrow)')}
                                        >
                                            ▼
                                        </button>
                                        <button
                                            type="button"
                                            className="konami-group-nudge-btn"
                                            onClick={() => moveGroup(selectedGroup, 0, 1)}
                                            disabled={selectedGroup.cMax >= (currentLevel ? currentLevel.width - 1 : DEFAULT_WIDTH - 1)}
                                            title={t('editor.nudgeRight', 'Nudge Right (Right Arrow)')}
                                        >
                                            ▶
                                        </button>
                                    </div>
                                    <span className="konami-group-pill-hint">
                                        {t('editor.groupMoveHint', 'Drag group to move • Arrow keys nudge')}
                                    </span>
                                    <div className="konami-group-pill-divider" aria-hidden="true" />
                                    <div className="konami-group-pill-actions">
                                        <button
                                            type="button"
                                            className="konami-group-action-btn"
                                            onClick={() => handleFillSelection('#')}
                                            title={t('editor.fillSelectionTitle', 'Fill selected area with ground blocks')}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                            </svg>
                                            <span>{t('editor.fillGroup', 'Fill')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="konami-group-action-btn konami-group-action-danger"
                                            onClick={handleClearSelection}
                                            title={t('editor.clearSelectionTitle', 'Erase elements in selected area (Delete)')}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
                                                <path d="M22 21H7"/>
                                            </svg>
                                            <span>{t('editor.clearGroup', 'Clear')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="konami-group-action-btn konami-group-action-close"
                                            onClick={() => {
                                                setSelectedGroup(null);
                                                setMarqueeSelection(null);
                                                setGroupDragPreview(null);
                                            }}
                                            title={t('editor.deselectGroup', 'Deselect group (Esc)')}
                                        >
                                            ✕ <span>{t('editor.deselect', 'Deselect')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    <div
                        className={`konami-grid-viewport${groupDragPreview ? ' is-dragging-group' : ''}`}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <div className="konami-grid-table">
                            {/* Column numbers header */}
                            <div className="konami-grid-header-row">
                                {Array.from({ length: currentLevel.width }).map((_, c) => (
                                    <div key={c} className="konami-grid-col-num">
                                        {c % 5 === 0 ? formatNumber(c) : ''}
                                    </div>
                                ))}
                            </div>

                            {/* 16 Rows */}
                            {currentLevel.grid.map((row, r) => (
                                <div key={r} className="konami-grid-row">
                                    {row.map((cellChar, c) => {
                                        let cellClass = 'konami-cell-empty';
                                        if (cellChar === '#') cellClass = 'konami-cell-block';
                                        else if (cellChar === 'C') cellClass = 'konami-cell-coin';
                                        else if (cellChar === 'E') cellClass = 'konami-cell-enemy';
                                        else if (cellChar === 'F') cellClass = 'konami-cell-flag';
                                        else if (cellChar === 'P') cellClass = 'konami-cell-spawn';

                                        const activeBox = marqueeSelection || selectedGroup;
                                        const isInGroup = activeBox && r >= activeBox.rMin && r <= activeBox.rMax && c >= activeBox.cMin && c <= activeBox.cMax;
                                        const isPreviewTarget = groupDragPreview && selectedGroup &&
                                            r >= selectedGroup.rMin + groupDragPreview.deltaR &&
                                            r <= selectedGroup.rMax + groupDragPreview.deltaR &&
                                            c >= selectedGroup.cMin + groupDragPreview.deltaC &&
                                            c <= selectedGroup.cMax + groupDragPreview.deltaC;

                                        const toolDef = TOOL_DEFS.find(tDef => tDef.id === cellChar);
                                        const typeName = toolDef ? t(`editor.${toolDef.key}`) : cellChar;

                                        return (
                                            <div
                                                key={c}
                                                className={`konami-grid-cell ${cellClass}${isInGroup ? ' is-group-selected' : ''}${isPreviewTarget ? ' is-preview-target' : ''}`}
                                                onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                                                onMouseEnter={(e) => handleCellMouseEnter(r, c, e)}
                                                title={(t('editor.cellTooltip') || 'Row {row}, Col {col}: {type}').replace('{row}', formatNumber(r)).replace('{col}', formatNumber(c)).replace('{type}', typeName)}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    </>
                )}

                {/* Toast Message */}
                {toast && <div className="konami-toast">{toast}</div>}
            </div>
        </AdminLayout>
    );
};

export default KonamiAdmin;
