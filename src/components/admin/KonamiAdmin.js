import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import '../../konami-admin.css';

const GRID_HEIGHT = 16;
const DEFAULT_WIDTH = 40;

const TOOLS = [
    { id: 'P', label: 'Spawn Point', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a7 7 0 0 1 13 0v2"/></svg>, className: 'konami-cell-spawn' },
    { id: '#', label: 'Ground Block', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>, className: 'konami-cell-block' },
    { id: 'C', label: 'Coin', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>, className: 'konami-cell-coin' },
    { id: 'E', label: 'Enemy', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="14" x="3" y="6" rx="2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>, className: 'konami-cell-enemy' },
    { id: 'F', label: 'Finish Flag', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>, className: 'konami-cell-flag' },
    { id: '.', label: 'Eraser', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/></svg>, className: 'konami-cell-empty' },
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
    const { t } = useContent();
    const [levels, setLevels] = useState([]);
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeTool, setActiveTool] = useState(TOOLS[0].id);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [widthInput, setWidthInput] = useState('');

    const isMouseDown = useRef(false);

    // Global mouseup to stop drag painting
    useEffect(() => {
        const handleMouseUp = () => {
            isMouseDown.current = false;
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

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
                                name: lvl.name || `Level ${idx + 1}`,
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
            // If completely uninitialized or error, default to empty or 1 template
            setLevels([]);
        } catch (err) {
            console.error('Error loading levels:', err);
            showToast('Failed to load levels from server');
            setLevels([]);
        } finally {
            setLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchLevels();
    }, [fetchLevels]);

    const currentLevel = levels.length > 0 ? (levels[activeLevelIdx] || levels[0] || null) : null;

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

            // If placing spawn 'P' or flag 'F', remove existing one to keep unique
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
        const tool = e.button === 2 ? '.' : activeTool; // Right-click erases
        setCell(r, c, tool);
    };

    const handleCellMouseEnter = (r, c, e) => {
        if (!isMouseDown.current) return;
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
        if (!window.confirm('Clear all obstacles in this level?')) return;
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
            name: `Level ${nextNum}`,
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

        const levelName = levelToDelete.name || `Level ${idx + 1}`;
        if (!window.confirm(`Delete ${levelName}?`)) return;

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
                showToast(updatedPersisted.length === 0 ? 'All custom levels deleted (Infinite mode active)' : `${levelName} deleted`);
            } else {
                showToast('Failed to save deletion');
            }
        } catch (err) {
            console.error('Error saving deletion:', err);
            showToast('Network error while deleting level');
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
                const levelName = currentLevel.name || `Level ${activeLevelIdx + 1}`;
                if (info.storage && info.storage.filesystem && !info.storage.database) {
                    showToast(`${levelName} saved locally to disk (MongoDB offline)`);
                } else {
                    showToast(`${levelName} saved successfully!`);
                }
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(`Failed to save: ${err.error || 'Server error'}`);
            }
        } catch (err) {
            console.error('Error saving level:', err);
            showToast('Network error while saving level');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Konami Level Editor">
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading levels...
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Konami Level Editor">
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
                                    {lvl.name || `Level ${idx + 1}`}
                                </button>
                                <button
                                    type="button"
                                    className="konami-tab-delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteLevel(idx);
                                    }}
                                    title={`Delete ${lvl.name || 'Level ' + (idx + 1)}`}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="konami-add-level-btn"
                            onClick={handleAddLevel}
                            title="Add a new custom level"
                        >
                            + Add Level
                        </button>
                    </div>

                    <div className="konami-topbar-actions">
                        <button
                            type="button"
                            className="konami-delete-btn"
                            onClick={() => handleDeleteLevel(activeLevelIdx)}
                            disabled={saving || !currentLevel}
                            title={currentLevel ? `Delete ${currentLevel.name || 'this level'}` : 'No level selected'}
                        >
                            Delete Level
                        </button>
                        <button
                            type="button"
                            className="konami-save-btn"
                            onClick={handleSave}
                            disabled={saving || !currentLevel}
                            title={currentLevel ? `Save ${currentLevel.name || 'this level'}` : 'No level selected'}
                        >
                            {saving ? 'Saving...' : 'Save Level'}
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
                                <span>Name:</span>
                                <input
                                    type="text"
                                    value={currentLevel.name || ''}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    style={{ width: '130px' }}
                                />
                            </label>

                            <label className="konami-input-group">
                                <span>Width:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={widthInput}
                                    onChange={handleWidthInputChange}
                                    onBlur={handleWidthInputBlur}
                                    onKeyDown={handleWidthInputKeyDown}
                                    style={{ width: '85px' }}
                                    title="Enter any level width"
                                />
                            </label>
                        </div>

                        {/* Palette Selector */}
                        <div className="konami-palette">
                            {TOOLS.map((tool) => (
                                <button
                                    key={tool.id}
                                    type="button"
                                    className={`konami-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                                    onClick={() => setActiveTool(tool.id)}
                                >
                                    <span>{tool.icon}</span>
                                    <span>{tool.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Quick Helper Actions */}
                        <div className="konami-quick-actions">
                            <button
                                type="button"
                                className="konami-secondary-btn"
                                onClick={handleFillBottomRow}
                                title="Fill bottom row with solid blocks"
                            >
                                Fill Floor
                            </button>
                            <button
                                type="button"
                                className="konami-secondary-btn"
                                onClick={handleClearLevel}
                                title="Clear all blocks in level"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* Interactive 16-Row Grid */}
                {currentLevel && (
                    <div
                        className="konami-grid-viewport"
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <div className="konami-grid-table">
                            {/* Column numbers header */}
                            <div className="konami-grid-header-row">
                                {Array.from({ length: currentLevel.width }).map((_, c) => (
                                    <div key={c} className="konami-grid-col-num">
                                        {c % 5 === 0 ? c : ''}
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

                                        return (
                                            <div
                                                key={c}
                                                className={`konami-grid-cell ${cellClass}`}
                                                onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                                                onMouseEnter={(e) => handleCellMouseEnter(r, c, e)}
                                                title={`Row ${r}, Col ${c}: ${cellChar}`}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Toast Message */}
                {toast && <div className="konami-toast">{toast}</div>}
            </div>
        </AdminLayout>
    );
};

export default KonamiAdmin;
