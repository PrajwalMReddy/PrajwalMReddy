import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AdminLayout from './AdminLayout';

const NOTES_API = '/api/notes';
const BLOCK_TYPES = {
    text: {label: 'Text', icon: 'T', placeholder: 'Write something...', span: 2, height: 3},
    heading: {label: 'Heading', icon: 'H', placeholder: 'Section heading', span: 3, height: 2},
    todo: {label: 'Checklist', icon: '[]', placeholder: 'A task to remember', span: 1, height: 4},
    callout: {label: 'Callout', icon: '!', placeholder: 'A useful thought or reminder', span: 1, height: 4},
    table: {label: 'Table', icon: '#', placeholder: 'Table cell', span: 2, height: 6},
    quote: {label: 'Quote', icon: '"', placeholder: 'A line worth keeping', span: 1, height: 4},
    divider: {label: 'Divider', icon: '-', placeholder: '', span: 3, height: 1},
};

const createBlock = (type = 'text') => ({
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: '',
    checked: false,
    span: BLOCK_TYPES[type].span,
    height: BLOCK_TYPES[type].height,
    rows: type === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined,
});

const blocksFromNote = (note) => Array.isArray(note.blocks) && note.blocks.length
    ? note.blocks.map((block, index) => ({
        ...block,
        span: block.span || BLOCK_TYPES[block.type]?.span || 1,
        height: block.height || BLOCK_TYPES[block.type]?.height || 3,
        position: block.position || {col: (index % 3) * 4 + 1, row: Math.floor(index / 3) * 6 + 1},
    }))
    : [{...createBlock('text'), text: note.content || ''}];

const rectanglesOverlap = (first, second) => first.col < second.col + second.width
    && first.col + first.width > second.col
    && first.row < second.row + second.height
    && first.row + first.height > second.row;

const findFreePosition = (blocks, block) => {
    const width = Math.min((block.span || 1) * 4, 12);
    const height = Math.min(block.height || 3, 30);
    const occupied = blocks.map((item) => ({
        col: item.position?.col || 1,
        row: item.position?.row || 1,
        width: Math.min((item.span || 1) * 4, 12),
        height: Math.min(item.height || 3, 30),
    }));

    for (let row = 1; row <= 31 - height; row += 1) {
        for (let col = 1; col <= 13 - width; col += 1) {
            const candidate = {col, row, width, height};
            if (!occupied.some((item) => rectanglesOverlap(candidate, item))) return {col, row};
        }
    }

    return {col: 1, row: 30 - height};
};

const formatUpdatedAt = (value) => {
    if (!value) return 'Not saved yet';
    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const NotesAdmin = () => {
    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState({title: '', content: '', blocks: [createBlock()]});
    const [search, setSearch] = useState('');
    const [noteView, setNoteView] = useState('active');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [draggingBlockId, setDraggingBlockId] = useState(null);
    const [dropPreview, setDropPreview] = useState(null);
    const boardRef = useRef(null);
    const resizeSessionRef = useRef(null);

    const request = useCallback(async (url, options = {}) => {
        const hasBody = options.body !== undefined;
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                ...(hasBody ? {'Content-Type': 'application/json'} : {}),
                ...options.headers,
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return data;
    }, []);

    const loadNotes = useCallback(async () => {
        try {
            setError('');
            const data = await request(NOTES_API);
            setNotes(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [request]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const visibleNotes = useMemo(() => notes.filter((note) => noteView === 'archived' ? note.archived : !note.archived), [notes, noteView]);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return visibleNotes;
        return visibleNotes.filter((note) =>
            `${note.title} ${note.content}`.toLowerCase().includes(term)
        );
    }, [search, visibleNotes]);

    const selectNote = (note) => {
        setSelectedId(note.id);
        setDraft({title: note.title, content: note.content, blocks: blocksFromNote(note)});
        setError('');
    };

    const startNewNote = () => {
        setSelectedId(null);
        setDraft({title: '', content: '', blocks: [createBlock()]});
        setError('');
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (!draft.title.trim()) {
            setError('Give the note a title before saving.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const content = draft.blocks.map((block) => block.text || '').join('\n\n');
            const saved = await request(
                selectedId ? `${NOTES_API}/${selectedId}` : NOTES_API,
                {
                    method: selectedId ? 'PUT' : 'POST',
                    body: JSON.stringify({...draft, content}),
                }
            );
            setNotes((current) => {
                const withoutSaved = current.filter((note) => note.id !== saved.id);
                return [saved, ...withoutSaved];
            });
            setSelectedId(saved.id);
            setDraft({title: saved.title, content: saved.content, blocks: blocksFromNote(saved)});
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateBlock = (id, changes) => setDraft((current) => ({
        ...current,
        blocks: current.blocks.map((block) => block.id === id ? {...block, ...changes} : block),
    }));

    const addBlock = (type, afterId = null) => setDraft((current) => {
        const next = createBlock(type);
        next.position = findFreePosition(current.blocks, next);
        const index = afterId ? current.blocks.findIndex((block) => block.id === afterId) + 1 : current.blocks.length;
        return {...current, blocks: [...current.blocks.slice(0, index), next, ...current.blocks.slice(index)]};
    });

    const removeBlock = (id) => setDraft((current) => ({
        ...current,
        blocks: current.blocks.length === 1 ? current.blocks : current.blocks.filter((block) => block.id !== id),
    }));

    const moveBlock = (fromId, toId) => setDraft((current) => {
        const fromIndex = current.blocks.findIndex((block) => block.id === fromId);
        const toIndex = current.blocks.findIndex((block) => block.id === toId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
        const next = [...current.blocks];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return {...current, blocks: next};
    });

    const placeBlock = (id, col, row) => updateBlock(id, {position: {col, row}});

    const getTableRowCapacity = (block) => Math.max(2, (block.height || 3) - 2);
    const getTableColumnCount = (block) => Math.max(1, block.rows?.[0]?.length || 1);

    const resizeTableColumns = (block, columnCount) => {
        const nextColumnCount = Math.max(1, Math.min(8, Number(columnCount)));
        const rows = block.rows.map((row) => Array.from({length: nextColumnCount}, (_, index) => row[index] || ''));
        updateBlock(block.id, {rows});
    };

    const resizeTableRows = (block, rowCount) => {
        const nextRowCount = Math.max(2, Math.min(getTableRowCapacity(block), Number(rowCount)));
        const columnCount = getTableColumnCount(block);
        const rows = Array.from({length: nextRowCount}, (_, index) => block.rows[index] || Array.from({length: columnCount}, () => ''))
            .map((row) => Array.from({length: columnCount}, (_, index) => row[index] || ''));
        updateBlock(block.id, {rows});
    };

    const getBoardMetrics = () => {
        if (!boardRef.current) return null;
        const board = boardRef.current;
        const bounds = board.getBoundingClientRect();
        const styles = window.getComputedStyle(board);
        const paddingX = parseFloat(styles.paddingLeft) || 0;
        const gap = parseFloat(styles.columnGap) || 0;
        const contentWidth = bounds.width - paddingX - (parseFloat(styles.paddingRight) || 0);
        return {
            bounds,
            paddingX,
            paddingY: parseFloat(styles.paddingTop) || 0,
            gap,
            cellWidth: (contentWidth - gap * 11) / 12,
            rowHeight: parseFloat(styles.gridTemplateRows.split(' ')[0]) + (parseFloat(styles.rowGap) || 0),
        };
    };

    const startBlockResize = (event, block) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const metrics = getBoardMetrics();
        const blockBounds = event.currentTarget.parentElement.getBoundingClientRect();
        const startColumn = metrics
            ? Math.floor((blockBounds.left - metrics.bounds.left - metrics.paddingX) / (metrics.cellWidth + metrics.gap)) + 1
            : block.position?.col || 1;
        resizeSessionRef.current = {
            id: block.id,
            startX: event.clientX,
            startY: event.clientY,
            startSpan: block.span || 1,
            startHeight: block.height || 3,
            maxSpan: Math.max(1, Math.min(3, Math.floor((13 - startColumn) / 4))),
            rowHeight: metrics?.rowHeight || 30,
            cellWidth: metrics?.cellWidth || 30,
            gap: metrics?.gap || 0,
        };
    };

    const updateBlockResize = (event, block) => {
        const session = resizeSessionRef.current;
        if (!session || session.id !== block.id) return;
        const widthDelta = Math.round((event.clientX - session.startX) / ((session.cellWidth + session.gap) * 4));
        const heightDelta = Math.round((event.clientY - session.startY) / session.rowHeight);
        const width = Math.max(1, Math.min(session.maxSpan, session.startSpan + widthDelta));
        const height = Math.max(1, Math.min(30, session.startHeight + heightDelta));
        if (width !== block.span || height !== block.height) updateBlock(block.id, {span: width, height});
    };

    const finishBlockResize = (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        resizeSessionRef.current = null;
    };

    const fitTextareaValue = (event) => {
        const textarea = event.currentTarget;
        const value = textarea.value;
        let low = 0;
        let high = value.length;
        let fitted = value;

        textarea.value = value;
        if (textarea.scrollHeight <= textarea.clientHeight) return value;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            textarea.value = value.slice(0, middle);
            if (textarea.scrollHeight <= textarea.clientHeight) {
                fitted = textarea.value;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        textarea.value = fitted;
        return fitted;
    };

    const startBlockDrag = (event, id) => {
        if (event.target.closest('input, textarea, select, button')) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingBlockId(id);
        const block = draft.blocks.find((item) => item.id === id);
        if (block) setDropPreview(block.position || {col: 1, row: 1});
    };

    const finishBlockDrag = (event, id) => {
        if (draggingBlockId !== id) return;
        if (dropPreview) placeBlock(id, dropPreview.col, dropPreview.row);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setDraggingBlockId(null);
        setDropPreview(null);
    };

    const getDropPreviewBlock = () => draft.blocks.find((block) => block.id === draggingBlockId);

    const isPreviewCell = (col, row) => {
        if (!dropPreview) return false;
        const block = getDropPreviewBlock();
        if (!block) return false;
        const width = (block.span || 1) * 4;
        const height = block.height || 3;
        return col >= dropPreview.col && col < dropPreview.col + width && row >= dropPreview.row && row < dropPreview.row + height;
    };

    const renderPreviewCells = () => {
        const block = getDropPreviewBlock();
        if (!dropPreview || !block) return null;
        const width = Math.min((block.span || 1) * 4, 12);
        const height = Math.min(block.height || 3, 30);
        return <div
            className="admin-note-drop-preview"
            style={{gridColumn: `${dropPreview.col} / span ${width}`, gridRow: `${dropPreview.row} / span ${height}`}}
            aria-label={`Drop position: column ${dropPreview.col}, row ${dropPreview.row}`}
        >
            <span aria-hidden="true"/>
        </div>;
    };

    const updateDropPreview = (event) => {
        if (!draggingBlockId || !boardRef.current) return;
        const block = getDropPreviewBlock();
        if (!block) return;
        const board = boardRef.current;
        const metrics = getBoardMetrics();
        if (!metrics) return;
        const {bounds, paddingX, paddingY, gap, cellWidth, rowHeight} = metrics;
        const width = Math.min((block.span || 1) * 4, 12);
        const height = Math.min(block.height || 3, 30);
        const rawCol = Math.floor((event.clientX - bounds.left - paddingX) / (cellWidth + gap)) + 1;
        const rawRow = Math.floor((event.clientY - bounds.top - paddingY) / rowHeight) + 1;
        const col = Math.max(1, Math.min(rawCol, 13 - width));
        const row = Math.max(1, Math.min(rawRow, 31 - height));
        setDropPreview((current) => current && current.col === col && current.row === row ? current : {col, row});
    };

    const renderBlock = (block, index) => {
        const type = BLOCK_TYPES[block.type] || BLOCK_TYPES.text;
        const position = block.position || {col: (index % 3) * 4 + 1, row: Math.floor(index / 3) * 6 + 1};
        return (
            <div
                className={`admin-note-block admin-note-block-${block.type} admin-note-block-span-${block.span || 1}${draggingBlockId === block.id ? ' is-dragging' : ''}`}
                key={block.id} style={{
                gridColumn: `${position.col} / span ${(block.span || 1) * 4}`,
                gridRow: `${position.row} / span ${block.height || 3}`
            }} onPointerDown={(event) => startBlockDrag(event, block.id)} onPointerMove={(event) => {
                if (draggingBlockId === block.id) updateDropPreview(event);
            }} onPointerUp={(event) => finishBlockDrag(event, block.id)}>
                <span className="admin-note-block-grip" title="Drag to reorder" aria-hidden="true">::</span>
                {block.type === 'divider' ? <hr/> : block.type === 'table' ? (
                    <div className="admin-note-table-wrap">
                        <div className="admin-note-table-controls" aria-label="Table controls">
                            <span className="admin-note-table-label">Table</span>
                            <span className="admin-note-table-control-label">Columns</span>
                            <button type="button"
                                    onClick={() => resizeTableColumns(block, getTableColumnCount(block) - 1)}
                                    disabled={getTableColumnCount(block) === 1} aria-label="Remove column"
                                    title="Remove column">-
                            </button>
                            <strong>{getTableColumnCount(block)}</strong>
                            <button type="button"
                                    onClick={() => resizeTableColumns(block, getTableColumnCount(block) + 1)}
                                    disabled={getTableColumnCount(block) === 8} aria-label="Add column"
                                    title="Add column">+
                            </button>
                            <span className="admin-note-table-control-label">Rows</span>
                            <button type="button" onClick={() => resizeTableRows(block, block.rows.length - 1)}
                                    disabled={block.rows.length === 2} aria-label="Remove row" title="Remove row">-
                            </button>
                            <strong>{block.rows.length}</strong>
                            <button type="button" onClick={() => resizeTableRows(block, block.rows.length + 1)}
                                    disabled={block.rows.length === getTableRowCapacity(block)} aria-label="Add row"
                                    title="Add row">+
                            </button>
                        </div>
                        <table>
                            <tbody>{block.rows.map((row, rowIndex) => <tr
                                key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td
                                key={`${block.id}-${rowIndex}-${cellIndex}`}><input value={cell}
                                                                                    aria-label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`}
                                                                                    placeholder={type.placeholder}
                                                                                    onChange={(event) => {
                                                                                        const rows = block.rows.map((currentRow) => [...currentRow]);
                                                                                        rows[rowIndex][cellIndex] = event.target.value;
                                                                                        updateBlock(block.id, {rows});
                                                                                    }}/></td>)}</tr>)}</tbody>
                        </table>
                    </div>
                ) : (
                    <>{block.type === 'todo' && <input type="checkbox" checked={block.checked}
                                                       onChange={(event) => updateBlock(block.id, {checked: event.target.checked})}
                                                       aria-label="Mark task complete"/>}<textarea value={block.text}
                                                                                                   onChange={(event) => updateBlock(block.id, {text: fitTextareaValue(event)})}
                                                                                                   placeholder={type.placeholder}
                                                                                                   aria-label={type.label}
                                                                                                   rows={block.type === 'text' ? 3 : 1}/></>
                )}
                <button type="button" className="admin-note-block-remove" onClick={() => removeBlock(block.id)}
                        aria-label="Remove block">x
                </button>
                {block.type !== 'divider' &&
                    <button type="button" className="admin-note-block-resize" aria-label="Resize widget"
                            title="Resize widget" onPointerDown={(event) => startBlockResize(event, block)}
                            onPointerMove={(event) => updateBlockResize(event, block)} onPointerUp={finishBlockResize}
                            onPointerCancel={finishBlockResize}>⤢</button>}
            </div>
        );
    };

    const handleDelete = async () => {
        if (!selectedId || !window.confirm('Delete this note?')) return;

        setSaving(true);
        setError('');
        try {
            await request(`${NOTES_API}/${selectedId}`, {method: 'DELETE'});
            setNotes((current) => current.filter((note) => note.id !== selectedId));
            startNewNote();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async () => {
        const selectedNote = notes.find((note) => note.id === selectedId);
        if (!selectedNote) return;

        const archived = !selectedNote.archived;
        setSaving(true);
        setError('');
        try {
            await request(`${NOTES_API}/${selectedId}`, {
                method: 'PUT',
                body: JSON.stringify({archived}),
            });
            setNotes((current) => current.map((note) => note.id === selectedId ? {...note, archived} : note));
            startNewNote();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminLayout title="Notes">
            <div className="admin-notes-toolbar">
                <label className="admin-notes-search">
                    <span>Search notes</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search title or content"
                    />
                </label>
                <button type="button" className="admin-notes-new" onClick={startNewNote}>
                    New note
                </button>
            </div>

            {error && <p className="admin-error">{error}</p>}
            {loading && <p className="admin-loading-text">Loading notes...</p>}

            {!loading && (
                <div className="admin-notes-layout">
                    <aside className="admin-notes-list" aria-label="Notes list">
                        <div className="admin-notes-list-heading">
                            <div className="admin-note-view-toggle" role="tablist" aria-label="Note status">
                                <button type="button" className={noteView === 'active' ? 'active' : ''}
                                        onClick={() => setNoteView('active')} role="tab"
                                        aria-selected={noteView === 'active'}>
                                    Active <span>{notes.filter((note) => !note.archived).length}</span>
                                </button>
                                <button type="button" className={noteView === 'archived' ? 'active' : ''}
                                        onClick={() => setNoteView('archived')} role="tab"
                                        aria-selected={noteView === 'archived'}>
                                    Archived <span>{notes.filter((note) => note.archived).length}</span>
                                </button>
                            </div>
                        </div>
                        {filteredNotes.map((note) => (
                            <button
                                type="button"
                                key={note.id}
                                className={`admin-note-list-item${selectedId === note.id ? ' active' : ''}`}
                                onClick={() => selectNote(note)}
                            >
                                <strong>{note.title}</strong>
                                <span>{formatUpdatedAt(note.updatedAt)}</span>
                                <p>{note.content.replace(/\s+/g, ' ').trim() || 'Empty note'}</p>
                            </button>
                        ))}
                        {!filteredNotes.length && <p className="admin-notes-empty">No notes found.</p>}
                    </aside>

                    <section className="admin-note-editor" aria-label="Note editor">
                        <form onSubmit={handleSave}>
                            <div className="admin-note-editor-header">
                                <input
                                    className="admin-note-title"
                                    value={draft.title}
                                    onChange={(event) => setDraft({...draft, title: event.target.value})}
                                    placeholder="Untitled note"
                                    aria-label="Note title"
                                />
                                <div className="admin-note-actions">
                                    {selectedId &&
                                        <button type="button" className="archive" onClick={handleArchiveToggle}
                                                disabled={saving}>{noteView === 'archived' ? 'Unarchive' : 'Archive'}</button>}
                                    {selectedId && <button type="button" className="danger" onClick={handleDelete}
                                                           disabled={saving}>Delete</button>}
                                    <button type="submit" className="primary"
                                            disabled={saving}>{saving ? 'Saving...' : 'Save note'}</button>
                                </div>
                            </div>
                            <div className="admin-note-board-shell">
                                <div className="admin-note-widget-palette" aria-label="Widget palette">
                                    <span>Widgets</span>
                                    {Object.entries(BLOCK_TYPES).map(([blockType, item]) => <button type="button"
                                                                                                    key={blockType}
                                                                                                    onClick={() => addBlock(blockType)}>
                                        <b>{item.icon}</b>{item.label}</button>)}
                                </div>
                                <div className="admin-note-blocks" ref={boardRef}>
                                    {Array.from({length: 360}, (_, cellIndex) => {
                                        const col = cellIndex % 12 + 1;
                                        const row = Math.floor(cellIndex / 12) + 1;
                                        return <div
                                            className={`admin-note-grid-cell${isPreviewCell(col, row) ? ' is-preview' : ''}`}
                                            key={`${col}-${row}`} style={{gridColumn: col, gridRow: row}}
                                            aria-label={`Board column ${col}, row ${row}`}/>;
                                    })}
                                    {draggingBlockId && renderPreviewCells()}
                                    {draft.blocks.map(renderBlock)}
                                </div>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </AdminLayout>
    );
};

export default NotesAdmin;
