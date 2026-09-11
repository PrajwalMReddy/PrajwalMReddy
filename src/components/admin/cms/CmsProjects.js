import React, { useEffect, useMemo, useState } from 'react';
import CmsImageUploader from './CmsImageUploader';
import CmsSectionsModal from './CmsSectionsModal';
import { getImage } from '../../../utils/componentUtils';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_PROJECT = {
    id: '',
    title: { en: '', kn: '' },
    description: { en: '', kn: '' },
    link: '',
    image: '',
    featured: false,
    section: 'programming',
};

const CmsProjects = ({ data, onSave, saving }) => {
    const { t, language, formatNumber } = useContent();
    const sections = data?.sections || [];
    const projects = data?.projects || [];

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        if (language === 'kn') {
            return obj.kn || obj.en || fallback;
        }
        return obj.en || obj.kn || fallback;
    };

    const [search, setSearch] = useState('');
    const [selectedSection, setSelectedSection] = useState('all');
    const [filterFeatured, setFilterFeatured] = useState('all'); // 'all' | 'featured' | 'unfeatured'

    // Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [editLangTab, setEditLangTab] = useState('en');

    // Sections Modal
    const [isSectionsModalOpen, setIsSectionsModalOpen] = useState(false);

    useEffect(() => {
        if (!isEditModalOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsEditModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditModalOpen]);

    const featuredCount = useMemo(() => {
        return projects.filter((p) => p.featured).length;
    }, [projects]);

    const filteredProjects = useMemo(() => {
        return projects.filter((p) => {
            const matchesSearch =
                !search ||
                (p.title?.en || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.title?.kn || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.description?.en || '').toLowerCase().includes(search.toLowerCase());

            const matchesSection = selectedSection === 'all' || p.section === selectedSection;
            const matchesFeatured =
                filterFeatured === 'all' ||
                (filterFeatured === 'featured' && p.featured) ||
                (filterFeatured === 'unfeatured' && !p.featured);

            return matchesSearch && matchesSection && matchesFeatured;
        });
    }, [projects, search, selectedSection, filterFeatured]);

    const handleToggleFeatured = async (projectIndex, e) => {
        e.stopPropagation();
        const updated = projects.map((p, idx) => {
            if (idx === projectIndex) {
                return { ...p, featured: !p.featured };
            }
            return p;
        });
        await onSave({ sections, projects: updated }, 'Project featured status updated');
    };

    const handleMoveOrder = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= projects.length) return;

        const updated = [...projects];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        await onSave({ sections, projects: updated }, 'Projects reordered');
    };

    const handleDelete = async (index) => {
        const project = projects[index];
        const title = project.title?.en || project.title || 'this project';
        if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

        const updated = projects.filter((_, idx) => idx !== index);
        await onSave({ sections, projects: updated }, `Deleted "${title}"`);
    };

    const handleOpenAddModal = () => {
        setEditingProject({
            ...DEFAULT_PROJECT,
            id: `project-${Date.now()}`,
            section: sections[0]?.id || 'programming',
        });
        setEditLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = (project, index) => {
        setEditingProject({
            ...project,
            _index: index,
            title: typeof project.title === 'string' ? { en: project.title, kn: '' } : { en: '', kn: '', ...project.title },
            description: typeof project.description === 'string' ? { en: project.description, kn: '' } : { en: '', kn: '', ...project.description },
        });
        setEditLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleSaveProjectModal = async (e) => {
        e.preventDefault();
        if (!editingProject.title?.en?.trim() && !editingProject.title?.kn?.trim()) {
            alert('A project title in English or Kannada is required');
            return;
        }

        const cleanProject = {
            ...editingProject,
            title: {
                en: (editingProject.title?.en || editingProject.title?.kn || '').trim(),
                kn: (editingProject.title?.kn || editingProject.title?.en || '').trim(),
            },
            description: {
                en: (editingProject.description?.en || editingProject.description?.kn || '').trim(),
                kn: (editingProject.description?.kn || editingProject.description?.en || '').trim(),
            },
        };
        delete cleanProject._index;

        let updated;
        if (editingProject._index !== undefined) {
            updated = projects.map((p, idx) => (idx === editingProject._index ? cleanProject : p));
        } else {
            updated = [cleanProject, ...projects];
        }

        setIsEditModalOpen(false);
        setEditingProject(null);
        await onSave({ sections, projects: updated }, 'Project saved successfully');
    };

    const handleSaveSections = async (updatedSections, message) => {
        await onSave({ sections: updatedSections, projects }, message);
    };

    return (
        <div className="cms-container">
            {/* Ergonomic Action Bar */}
            <div className="cms-action-bar">
                <div className="cms-action-bar-left">
                    <div className="cms-search-wrap">
                        <span className="cms-search-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.placeholders.searchProjects', 'Search projects...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>

                    <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allSections', 'All Sections')} ({formatNumber(sections.length)})</option>
                        {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                                {getLocalized(s.title, s.id)}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className={`cms-filter-pill ${filterFeatured === 'featured' ? 'active' : ''}`}
                        onClick={() => setFilterFeatured((prev) => (prev === 'featured' ? 'all' : 'featured'))}
                        title="Filter projects featured on Home Page"
                    >
                        ★ {t('admin.filters.featured', 'Featured')} ({formatNumber(featuredCount)})
                    </button>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredProjects.length)} {t('admin.messages.of', 'of')} {formatNumber(projects.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-secondary"
                        onClick={() => setIsSectionsModalOpen(true)}
                    >
                        {t('admin.actions.sections', 'Sections')}
                    </button>

                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddModal}
                    >
                        {t('admin.actions.addProject', '+ Add Project')}
                    </button>
                </div>
            </div>

            {/* Ergonomic Project Rows */}
            {filteredProjects.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noProjects', 'No projects found')}</p>
                    <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Try adjusting your search or add a new project.')}</p>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredProjects.map((project) => {
                        const originalIndex = projects.indexOf(project);
                        const displayImage = getImage(project.image);
                        const secObj = sections.find((s) => s.id === project.section);

                        return (
                            <div
                                key={project.id || originalIndex}
                                className={`cms-item-row ${project.featured ? 'featured' : ''}`}
                            >
                                <div className="cms-item-main">
                                    {displayImage ? (
                                        <img
                                            src={displayImage}
                                            alt={project.title?.en || 'Project'}
                                            className="cms-item-thumb"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="cms-item-thumb-placeholder">📁</div>
                                    )}

                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">
                                                {getLocalized(project.title, 'Untitled Project')}
                                            </h4>
                                            <span className="cms-tag cms-tag-section">
                                                {getLocalized(secObj?.title, project.section)}
                                            </span>
                                            {project.link && (
                                                <a
                                                    href={project.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="cms-item-link"
                                                    title={project.link}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    ↗ {project.link.replace(/^https?:\/\//, '')}
                                                </a>
                                            )}
                                        </div>
                                        <p className="cms-item-desc">
                                            {getLocalized(project.description, 'No description provided.')}
                                        </p>
                                    </div>
                                </div>

                                <div className="cms-item-actions">
                                    <button
                                        type="button"
                                        className={`cms-star-btn ${project.featured ? 'active' : ''}`}
                                        onClick={(e) => handleToggleFeatured(originalIndex, e)}
                                        title={project.featured ? 'Featured on Home (click to unfeature)' : 'Feature on Home'}
                                    >
                                        ★ {project.featured ? t('admin.actions.featured', 'Featured') : t('admin.actions.feature', 'Feature')}
                                    </button>

                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        onClick={() => handleMoveOrder(originalIndex, -1)}
                                        disabled={originalIndex === 0}
                                        title={t('admin.actions.moveUp', 'Move Up')}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        onClick={() => handleMoveOrder(originalIndex, 1)}
                                        disabled={originalIndex === projects.length - 1}
                                        title={t('admin.actions.moveDown', 'Move Down')}
                                    >
                                        ▼
                                    </button>

                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-secondary"
                                        onClick={() => handleOpenEditModal(project, originalIndex)}
                                    >
                                        {t('admin.actions.edit', 'Edit')}
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-danger"
                                        onClick={() => handleDelete(originalIndex)}
                                    >
                                        {t('admin.actions.delete', 'Delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Project Modal */}
            {isEditModalOpen && editingProject && (
                <div className="cms-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
                    <div className="cms-modal-content cms-modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">
                                {editingProject._index !== undefined
                                    ? t('admin.modals.editProject', 'Edit Project')
                                    : t('admin.modals.newProject', 'Add New Project')}
                            </h3>
                            <button
                                type="button"
                                className="cms-modal-close-btn"
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveProjectModal}>
                            <div className="cms-modal-body">
                                <div className="cms-lang-pills">
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${editLangTab === 'en' ? 'active' : ''}`}
                                        onClick={() => setEditLangTab('en')}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${editLangTab === 'kn' ? 'active' : ''}`}
                                        onClick={() => setEditLangTab('kn')}
                                    >
                                        ಕನ್ನಡ
                                    </button>
                                </div>

                                {editLangTab === 'en' && (
                                    <>
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.projectTitle', 'Project Title')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingProject.title?.en || ''}
                                                onChange={(e) =>
                                                    setEditingProject({
                                                        ...editingProject,
                                                        title: { ...editingProject.title, en: e.target.value },
                                                    })
                                                }
                                                placeholder="e.g. Personal Website"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.description', 'Description')}
                                            </label>
                                            <textarea
                                                className="cms-textarea"
                                                value={editingProject.description?.en || ''}
                                                onChange={(e) =>
                                                    setEditingProject({
                                                        ...editingProject,
                                                        description: { ...editingProject.description, en: e.target.value },
                                                    })
                                                }
                                                placeholder="Brief description of your project..."
                                            />
                                        </div>
                                    </>
                                )}

                                {editLangTab === 'kn' && (
                                    <>
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.projectTitle', 'Project Title')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingProject.title?.kn || ''}
                                                onChange={(e) =>
                                                    setEditingProject({
                                                        ...editingProject,
                                                        title: { ...editingProject.title, kn: e.target.value },
                                                    })
                                                }
                                                placeholder="ಉದಾ: ವೈಯಕ್ತಿಕ ಜಾಲತಾಣ"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.description', 'Description')}
                                            </label>
                                            <textarea
                                                className="cms-textarea"
                                                value={editingProject.description?.kn || ''}
                                                onChange={(e) =>
                                                    setEditingProject({
                                                        ...editingProject,
                                                        description: { ...editingProject.description, kn: e.target.value },
                                                    })
                                                }
                                                placeholder="ಯೋಜನೆಯ ವಿವರಣೆ..."
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            {t('admin.labels.sectionCategory', 'Section Category')}
                                        </label>
                                        <select
                                            className="cms-select"
                                            value={editingProject.section}
                                            onChange={(e) =>
                                                setEditingProject({ ...editingProject, section: e.target.value })
                                            }
                                        >
                                            {sections.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {getLocalized(s.title, s.id)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            {t('admin.labels.projectUrl', 'Live / Repository URL')}
                                        </label>
                                        <input
                                            type="url"
                                            className="cms-input"
                                            value={editingProject.link || ''}
                                            onChange={(e) =>
                                                setEditingProject({ ...editingProject, link: e.target.value })
                                            }
                                            placeholder="https://github.com/..."
                                        />
                                    </div>
                                </div>

                                <div className="cms-form-group">
                                    <label className="cms-checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="cms-checkbox"
                                            checked={Boolean(editingProject.featured)}
                                            onChange={(e) =>
                                                setEditingProject({ ...editingProject, featured: e.target.checked })
                                            }
                                        />
                                        <span>
                                            {t('admin.labels.featureOnHome', '★ Feature on Home Page')}{' '}
                                            <span className="cms-help-inline">
                                                {t('admin.labels.featureDescProj', '(Included in Featured Projects showcase)')}
                                            </span>
                                        </span>
                                    </label>
                                </div>

                                <div className="cms-form-group">
                                    <CmsImageUploader
                                        folder="img"
                                        label={t('admin.labels.imageUpload', 'Project Card Image')}
                                        value={editingProject.image || ''}
                                        onChange={(imgVal) =>
                                            setEditingProject({ ...editingProject, image: imgVal })
                                        }
                                        helpText="Choose from existing images or upload a new one."
                                    />
                                </div>
                            </div>

                            <div className="cms-modal-footer">
                                <button
                                    type="button"
                                    className="cms-btn cms-btn-secondary"
                                    onClick={() => setIsEditModalOpen(false)}
                                >
                                    {t('admin.actions.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="cms-btn cms-btn-primary"
                                    disabled={saving}
                                >
                                    {saving
                                        ? t('admin.actions.saving', 'Saving...')
                                        : (editingProject._index !== undefined
                                            ? t('admin.actions.save', 'Save Project')
                                            : t('admin.actions.addProject', 'Add Project'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Sections Modal */}
            <CmsSectionsModal
                isOpen={isSectionsModalOpen}
                onClose={() => setIsSectionsModalOpen(false)}
                title="Manage Project Sections"
                itemLabel="projects"
                sections={sections}
                items={projects}
                onSaveSections={handleSaveSections}
                saving={saving}
            />
        </div>
    );
};

export default CmsProjects;
