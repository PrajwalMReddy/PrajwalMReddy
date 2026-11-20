import React from 'react';
import { useContent } from '../../../utils/ContentContext';
import { formatUpdatedAt, getNotePreview, normalizeFolder } from './noteUtils';

const PinIcon = ({ size = 13, className = '' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-2l-2-2V5h1V3H6v2h1v8l-2 2v2z" />
    </svg>
);

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
    const { t, formatNumber, language } = useContent();
    return (
        <aside className="admin-notes-list" aria-label={t('admin.ui.noteSidebar.notesFileExplorer')}>
            <div className="admin-notes-list-heading">
                <div className="admin-notes-list-header-top">
                    <h2 className="admin-notes-list-title">{t('admin.nav.notes')}</h2>
                </div>
                <div className="admin-note-view-toggle" role="tablist" aria-label={t('admin.ui.noteSidebar.noteStatus')}>
                    <button
                        type="button"
                        className={noteView === 'active' ? 'active' : ''}
                        onClick={() => setNoteView('active')}
                        role="tab"
                        aria-selected={noteView === 'active'}
                    >
                        {t('admin.notesSection.active')} <span>{formatNumber(notes.filter((note) => !note.archived).length)}</span>
                    </button>
                    <button
                        type="button"
                        className={noteView === 'archived' ? 'active' : ''}
                        onClick={() => setNoteView('archived')}
                        role="tab"
                        aria-selected={noteView === 'archived'}
                    >
                        {t('admin.notesSection.archived')} <span>{formatNumber(notes.filter((note) => note.archived).length)}</span>
                    </button>
                </div>
            </div>

            <div className="admin-notes-tree">
                {noteView === 'archived' ? (
                    <>
                        {filteredNotes.map((note) => (
                            <button
                                type="button"
                                key={note.id}
                                className={`admin-note-list-item${
                                    selectedId === note.id ? ' active' : ''
                                }`}
                                onClick={() => selectNote(note)}
                            >
                                <strong>
                                    <span className="admin-note-item-title">
                                        {note.title || t('admin.notesSection.untitledNote')}
                                    </span>
                                    {note.pinned && (
                                        <span
                                            className="admin-note-pin-badge"
                                            title={t('admin.notesSection.pinned')}
                                            aria-label={t('admin.notesSection.pinned')}
                                        >
                                            <PinIcon size={13} />
                                        </span>
                                    )}
                                </strong>
                                <span>{formatUpdatedAt(note.updatedAt, language, formatNumber)}</span>
                                <p>{getNotePreview(note)}</p>
                            </button>
                        ))}

                        {filteredNotes.length === 0 && (
                            <p className="admin-notes-empty">{t('admin.notesSection.noArchived')}</p>
                        )}
                    </>
                ) : (
                    <>
                        {isCreatingFolder && (
                            <form
                                className="admin-note-new-folder-form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleCreateFolder(newFolderName);
                                }}
                            >
                                <span className="admin-note-folder-icon" aria-hidden="true">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                </span>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder={t('admin.notesSection.folderNamePlaceholder')}
                                    aria-label={t('admin.notesSection.newFolderNamePlaceholder')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setIsCreatingFolder(false);
                                            setNewFolderName('');
                                        }
                                    }}
                                />
                                <button type="submit" title={t('admin.notesSection.create')} aria-label={t('admin.notesSection.create')}>
                                    ✓
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreatingFolder(false);
                                        setNewFolderName('');
                                    }}
                                    title={t('admin.notesSection.cancel')}
                                    aria-label={t('admin.notesSection.cancel')}
                                >
                                    ✕
                                </button>
                            </form>
                        )}

                        {/* Folders */}
                        {allFolders.map((folderName) => {
                            const folderNotes = folderNotesMap[folderName] || [];
                            const totalInFolder = visibleNotes.filter((n) => normalizeFolder(n.folder) === folderName).length;
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
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                            </span>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                aria-label={t('admin.ui.noteSidebar.renameFolder')}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') setRenamingFolder(null);
                                                }}
                                            />
                                            <button
                                                type="submit"
                                                title={t('admin.ui.noteSidebar.saveFolderName')}
                                                aria-label={t('admin.ui.noteSidebar.saveFolderName')}
                                            >
                                                ✓
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRenamingFolder(null)}
                                                title={t('admin.ui.noteSidebar.cancel')}
                                                aria-label={t('admin.ui.noteSidebar.cancelRename')}
                                            >
                                                ✕
                                            </button>
                                        </form>
                                    ) : (
                                        <div
                                            className={`admin-note-folder-header${
                                                normalizeFolder(currentFolder) === folderName ? ' is-current-folder' : ''
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
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                            </span>
                                            <span className="admin-note-folder-title" title={folderName}>
                                                {folderName}
                                            </span>
                                            <span className="admin-note-folder-count">{formatNumber(totalInFolder)}</span>
                                            <div
                                                className="admin-note-folder-actions"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    className="admin-note-action-icon"
                                                    onClick={() => startNewNote(folderName)}
                                                    title={`${t('admin.notesSection.newNoteIn')} /${folderName}`}
                                                    aria-label={`${t('admin.notesSection.newNoteIn')} /${folderName}`}
                                                >
                                                    +
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-note-action-icon"
                                                    onClick={() => startRenamingFolder(folderName)}
                                                    title={t('admin.actions.edit')}
                                                    aria-label={t('admin.actions.edit')}
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-note-action-icon danger"
                                                    onClick={() => handleDeleteFolder(folderName)}
                                                    title={t('admin.actions.delete')}
                                                    aria-label={t('admin.actions.delete')}
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
                                                    <strong>
                                                        <span className="admin-note-item-title">
                                                            {note.title || t('admin.notesSection.untitledNote')}
                                                        </span>
                                                        {note.pinned && (
                                                            <span
                                                                className="admin-note-pin-badge"
                                                                title={t('admin.notesSection.pinned')}
                                                                aria-label={t('admin.notesSection.pinned')}
                                                            >
                                                                <PinIcon size={13} />
                                                            </span>
                                                        )}
                                                    </strong>
                                                    <span>{formatUpdatedAt(note.updatedAt, language, formatNumber)}</span>
                                                    <p>{getNotePreview(note)}</p>
                                                </button>
                                            ))}
                                            {folderNotes.length === 0 && (
                                                <button
                                                    type="button"
                                                    className="admin-note-empty-folder-btn"
                                                    onClick={() => startNewNote(folderName)}
                                                >
                                                    <span aria-hidden="true">+</span> {t('admin.notesSection.newNoteIn')} /{folderName}
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
                                <strong>
                                    <span className="admin-note-item-title">
                                        {note.title || t('admin.notesSection.untitledNote')}
                                    </span>
                                    {note.pinned && (
                                        <span
                                            className="admin-note-pin-badge"
                                            title={t('admin.notesSection.pinned')}
                                            aria-label={t('admin.notesSection.pinned')}
                                        >
                                            <PinIcon size={13} />
                                        </span>
                                    )}
                                </strong>
                                <span>{formatUpdatedAt(note.updatedAt, language, formatNumber)}</span>
                                <p>{getNotePreview(note)}</p>
                            </button>
                        ))}

                        {!filteredNotes.length && !allFolders.length && (
                            <p className="admin-notes-empty">{t('admin.notesSection.noNotes')}</p>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};

export default NoteSidebar;
