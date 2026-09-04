import React from 'react';
import { formatUpdatedAt, getNotePreview } from './noteUtils';

const NoteSidebar = ({
    noteView,
    setNoteView,
    notes,
    allFolders,
    folderNotesMap,
    visibleNotes,
    rootNotes,
    filteredNotes,
    expandedFolders,
    toggleFolder,
    currentFolder,
    selectedId,
    selectNote,
    isCreatingFolder,
    setIsCreatingFolder,
    newFolderName,
    setNewFolderName,
    handleCreateFolder,
    renamingFolder,
    setRenamingFolder,
    renameValue,
    setRenameValue,
    handleRenameFolder,
    startRenamingFolder,
    handleDeleteFolder,
    startNewNote,
}) => {
    return (
        <aside className="admin-notes-list" aria-label="Notes file explorer">
            <div className="admin-notes-list-heading">
                <div className="admin-notes-list-header-top">
                    <h2 className="admin-notes-list-title">Notes</h2>
                </div>
                <div className="admin-note-view-toggle" role="tablist" aria-label="Note status">
                    <button
                        type="button"
                        className={noteView === 'active' ? 'active' : ''}
                        onClick={() => setNoteView('active')}
                        role="tab"
                        aria-selected={noteView === 'active'}
                    >
                        Active <span>{notes.filter((note) => !note.archived).length}</span>
                    </button>
                    <button
                        type="button"
                        className={noteView === 'archived' ? 'active' : ''}
                        onClick={() => setNoteView('archived')}
                        role="tab"
                        aria-selected={noteView === 'archived'}
                    >
                        Archived <span>{notes.filter((note) => note.archived).length}</span>
                    </button>
                </div>
            </div>

            <div className="admin-notes-tree">
                {isCreatingFolder && (
                    <form
                        className="admin-note-new-folder-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleCreateFolder(newFolderName);
                        }}
                    >
                        <span className="admin-note-folder-icon" aria-hidden="true">
                            📁
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="folder name"
                            aria-label="New folder name"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setIsCreatingFolder(false);
                                    setNewFolderName('');
                                }
                            }}
                        />
                        <button type="submit" title="Create folder" aria-label="Confirm new folder">
                            ✓
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreatingFolder(false);
                                setNewFolderName('');
                            }}
                            title="Cancel"
                            aria-label="Cancel new folder"
                        >
                            ✕
                        </button>
                    </form>
                )}

                {/* Folders */}
                {allFolders.map((folderName) => {
                    const folderNotes = folderNotesMap[folderName] || [];
                    const totalInFolder = visibleNotes.filter((n) => n.folder === folderName).length;
                    const isExpanded = expandedFolders.has(folderName);
                    const isRenaming = renamingFolder === folderName;

                    return (
                        <div
                            className={`admin-note-folder-group${isExpanded ? ' is-expanded' : ''}`}
                            key={folderName}
                        >
                            {isRenaming ? (
                                <form
                                    className="admin-note-rename-folder-form"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleRenameFolder(folderName, renameValue);
                                    }}
                                >
                                    <span className="admin-note-folder-icon" aria-hidden="true">
                                        📁
                                    </span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        aria-label="Rename folder"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') setRenamingFolder(null);
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        title="Save folder name"
                                        aria-label="Save folder name"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRenamingFolder(null)}
                                        title="Cancel"
                                        aria-label="Cancel rename"
                                    >
                                        ✕
                                    </button>
                                </form>
                            ) : (
                                <div
                                    className={`admin-note-folder-header${
                                        currentFolder === folderName ? ' is-current-folder' : ''
                                    }`}
                                    onClick={() => toggleFolder(folderName)}
                                    role="button"
                                    tabIndex="0"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleFolder(folderName);
                                        }
                                    }}
                                    aria-expanded={isExpanded}
                                >
                                    <span className="admin-note-folder-chevron" aria-hidden="true">
                                        {isExpanded ? '▾' : '▸'}
                                    </span>
                                    <span className="admin-note-folder-icon" aria-hidden="true">
                                        {isExpanded ? '📂' : '📁'}
                                    </span>
                                    <span className="admin-note-folder-title" title={folderName}>
                                        {folderName}
                                    </span>
                                    <span className="admin-note-folder-count">{totalInFolder}</span>
                                    <div
                                        className="admin-note-folder-actions"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            className="admin-note-action-icon"
                                            onClick={() => startNewNote(folderName)}
                                            title={`New note in /${folderName}`}
                                            aria-label={`New note in /${folderName}`}
                                        >
                                            +
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-note-action-icon"
                                            onClick={() => startRenamingFolder(folderName)}
                                            title="Rename folder"
                                            aria-label="Rename folder"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-note-action-icon danger"
                                            onClick={() => handleDeleteFolder(folderName)}
                                            title="Delete folder"
                                            aria-label="Delete folder"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isExpanded && (
                                <div className="admin-note-folder-children">
                                    {folderNotes.map((note) => (
                                        <button
                                            type="button"
                                            key={note.id}
                                            className={`admin-note-list-item is-nested${
                                                selectedId === note.id ? ' active' : ''
                                            }`}
                                            onClick={() => selectNote(note)}
                                        >
                                            <strong>{note.title || 'Untitled note'}</strong>
                                            <span>{formatUpdatedAt(note.updatedAt)}</span>
                                            <p>{getNotePreview(note)}</p>
                                        </button>
                                    ))}
                                    {folderNotes.length === 0 && (
                                        <button
                                            type="button"
                                            className="admin-note-empty-folder-btn"
                                            onClick={() => startNewNote(folderName)}
                                        >
                                            <span aria-hidden="true">+</span> New note in /{folderName}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Top-level Linux-style Root Notes directly under / */}
                {rootNotes.map((note) => (
                    <button
                        type="button"
                        key={note.id}
                        className={`admin-note-list-item is-root${
                            selectedId === note.id ? ' active' : ''
                        }`}
                        onClick={() => selectNote(note)}
                    >
                        <strong>{note.title || 'Untitled note'}</strong>
                        <span>{formatUpdatedAt(note.updatedAt)}</span>
                        <p>{getNotePreview(note)}</p>
                    </button>
                ))}

                {!filteredNotes.length && !allFolders.length && (
                    <p className="admin-notes-empty">No notes found.</p>
                )}
            </div>
        </aside>
    );
};

export default NoteSidebar;
