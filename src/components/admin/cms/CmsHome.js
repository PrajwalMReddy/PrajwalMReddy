import React, { useEffect, useMemo, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_HOME_DATA = {
    title: { en: 'Hello World!', kn: 'ನಮಸ್ಕಾರ!' },
    intro: { en: "I'm [ˈprɐ.dʒʋəl ˈrɛ.ɖːi]", kn: 'ನಾನು ಪ್ರಜ್ವಲ ರೆಡ್ಡಿ' },
    subtitle: { en: 'a student, programmer, and builder.', kn: 'ಕಲಿಗ, ಹಮ್ಮುಗ, ಮತ್ತು ಕಟ್ಟುಗ.' },
    description: {
        en: 'I am a college student at Cornell University, studying a double major in Linguistics and Computer Science, with a specialization in Economics. I am also passionate about Urban Planning, often developing applications that focus on issues in these areas. My other non-academic interests include world building and conlanging.',
        kn: 'ನಾನು ಕೊರ್ನೆಲ ಮೇಲ್ಕಲಿಮನೆಯಲ್ಲಿ ಕಲಿಗರಾಗಿದ್ದೇನೆ. ನುಡಿಯರಿಮೆ, ಎಣಿಯರಿಮೆ, ಮತ್ತು ಸೊಮ್ಮರಿಮೆಯನ್ನು ಓದುತ್ತಿದ್ದೇನೆ. ಅಶ್ಟೇ ಅಲ್ಲ, ನಗರ ಹಮ್ಮುಗೆಯ ಮೇಲೆ ತುಂಬಾ ಇಶ್ಟಪಡುತೇನೆ. ನನ್ನ ಇತರ ಆಸಕ್ತಿಗಳಲ್ಲಿ ಪ್ರಪಂಚ ಕಟ್ಟುವಿಕೆ ಮತ್ತು ನುಡಿ ಕಟ್ಟುವಿಕೆ ಎರಡು.',
    },
    skillsTitle: { en: 'My Programming Skills', kn: 'ನನ್ನ ಹಮ್ಮುಗಾರಿಕೆಯ ಕಲಿಕೆಗಳು' },
    skills: [
        { id: 'python', name: { en: 'Python', kn: 'ಪಾಯ್ತನ್' } },
        { id: 'javaKotlin', name: { en: 'Java and Kotlin', kn: 'ಜಾವ ಮತ್ತು ಕಾಟ್ಲಿನ್' } },
        { id: 'cpp', name: { en: 'C and C++', kn: 'ಸಿ ಮತ್ತು ಸಿ++' } },
        { id: 'dartFlutter', name: { en: 'Dart + Flutter', kn: 'ಡಾರ್ಟ್ + ಪ್ಲಟರ್' } },
        { id: 'php', name: { en: 'PHP', kn: 'ಪಿ.ಏಚ್.ಪಿ.' } },
        { id: 'sql', name: { en: 'SQL + MySQL', kn: 'ಸೀಕ್ವಲ್ + ಮಯ್ಸೀಕ್ವಲ್' } },
        { id: 'web', name: { en: 'HTML + CSS + JavaScript', kn: 'ಏಚ್.ಟಿ.ಎಮ್.ಎಲ್. + ಸಿ.ಎಸ್.ಎಸ್. + ಜಾವಸ್ಕ್ರಿಪ್ಟ್' } },
        { id: 'rust', name: { en: 'Rust', kn: 'ರಸ್ಟ್' } },
        { id: 'arduino', name: { en: 'Arduino', kn: 'ಆರ್ಡ್ವೀನೊ' } },
    ],
};

const DEFAULT_SKILL = {
    id: '',
    name: { en: '', kn: '' },
};

const CmsHome = ({ data, onSave, saving }) => {
    const { t, language, formatNumber } = useContent();

    const [formState, setFormState] = useState(() => {
        if (data && (data.title || data.skills)) {
            return {
                title: { en: data.title?.en ?? DEFAULT_HOME_DATA.title.en, kn: data.title?.kn ?? DEFAULT_HOME_DATA.title.kn },
                intro: { en: data.intro?.en ?? DEFAULT_HOME_DATA.intro.en, kn: data.intro?.kn ?? DEFAULT_HOME_DATA.intro.kn },
                subtitle: { en: data.subtitle?.en ?? DEFAULT_HOME_DATA.subtitle.en, kn: data.subtitle?.kn ?? DEFAULT_HOME_DATA.subtitle.kn },
                description: { en: data.description?.en ?? DEFAULT_HOME_DATA.description.en, kn: data.description?.kn ?? DEFAULT_HOME_DATA.description.kn },
                skillsTitle: { en: data.skillsTitle?.en ?? DEFAULT_HOME_DATA.skillsTitle.en, kn: data.skillsTitle?.kn ?? DEFAULT_HOME_DATA.skillsTitle.kn },
                skills: Array.isArray(data.skills) ? data.skills : DEFAULT_HOME_DATA.skills,
            };
        }
        return DEFAULT_HOME_DATA;
    });

    const [langTab, setLangTab] = useState(language || 'en');

    // Sync tab when global language changes
    useEffect(() => {
        if (language) {
            setLangTab(language);
        }
    }, [language]);

    // Skills state
    const [searchSkills, setSearchSkills] = useState('');
    const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
    const [editingSkillIdx, setEditingSkillIdx] = useState(null);
    const [skillState, setSkillState] = useState(DEFAULT_SKILL);
    const [skillModalLang, setSkillModalLang] = useState(language || 'en');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsSkillModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (data && (data.title || data.skills)) {
            setFormState({
                title: { en: data.title?.en ?? DEFAULT_HOME_DATA.title.en, kn: data.title?.kn ?? DEFAULT_HOME_DATA.title.kn },
                intro: { en: data.intro?.en ?? DEFAULT_HOME_DATA.intro.en, kn: data.intro?.kn ?? DEFAULT_HOME_DATA.intro.kn },
                subtitle: { en: data.subtitle?.en ?? DEFAULT_HOME_DATA.subtitle.en, kn: data.subtitle?.kn ?? DEFAULT_HOME_DATA.subtitle.kn },
                description: { en: data.description?.en ?? DEFAULT_HOME_DATA.description.en, kn: data.description?.kn ?? DEFAULT_HOME_DATA.description.kn },
                skillsTitle: { en: data.skillsTitle?.en ?? DEFAULT_HOME_DATA.skillsTitle.en, kn: data.skillsTitle?.kn ?? DEFAULT_HOME_DATA.skillsTitle.kn },
                skills: Array.isArray(data.skills) ? data.skills : DEFAULT_HOME_DATA.skills,
            });
        }
    }, [data]);

    const handleTextChange = (field, lang, value) => {
        setFormState((prev) => ({
            ...prev,
            [field]: {
                ...prev[field],
                [lang]: value,
            },
        }));
    };

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        const current = langTab || language;
        const alt = current === 'kn' ? 'en' : 'kn';
        return obj[current] || obj[alt] || Object.values(obj).find((v) => typeof v === 'string' && v.trim() !== '') || fallback;
    };

    const handleSaveHero = async (e) => {
        if (e) e.preventDefault();
        await onSave(formState, t('admin.messages.saveSuccess', 'Homepage details updated'));
    };

    // --- Skills Handlers ---
    const filteredSkills = useMemo(() => {
        return formState.skills.filter((s) => {
            const enName = typeof s.name === 'object' ? s.name.en || '' : s.name || '';
            const knName = typeof s.name === 'object' ? s.name.kn || '' : '';
            return !searchSkills || enName.toLowerCase().includes(searchSkills.toLowerCase()) || knName.toLowerCase().includes(searchSkills.toLowerCase());
        });
    }, [formState.skills, searchSkills]);

    const handleMoveSkill = async (idx, direction) => {
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= formState.skills.length) return;

        const updated = [...formState.skills];
        const [moved] = updated.splice(idx, 1);
        updated.splice(targetIdx, 0, moved);

        const newHome = { ...formState, skills: updated };
        setFormState(newHome);
        await onSave(newHome, 'Skills reordered');
    };

    const handleDeleteSkill = async (idx) => {
        const skill = formState.skills[idx];
        const name = getLocalized(skill.name, 'this skill');
        if (!window.confirm(`${t('admin.messages.confirmDelete', 'Are you sure you want to delete this item?')} (${name})`)) return;

        const updated = formState.skills.filter((_, i) => i !== idx);
        const newHome = { ...formState, skills: updated };
        setFormState(newHome);
        await onSave(newHome, `Deleted "${name}"`);
    };

    const handleOpenAddSkill = () => {
        setEditingSkillIdx(null);
        setSkillState({ id: `skill-${Date.now()}`, name: { en: '', kn: '' } });
        setSkillModalLang(langTab || language || 'kn');
        setIsSkillModalOpen(true);
    };

    const handleOpenEditSkill = (skill, idx) => {
        setEditingSkillIdx(idx);
        setSkillState({
            id: skill.id || `skill-${idx}`,
            name: {
                en: typeof skill.name === 'object' ? (skill.name.en ?? '') : (skill.name ?? ''),
                kn: typeof skill.name === 'object' ? (skill.name.kn ?? '') : '',
            },
        });
        setSkillModalLang(langTab || 'en');
        setIsSkillModalOpen(true);
    };

    const handleSaveSkillModal = async (e) => {
        e.preventDefault();
        if (!skillState.name.en.trim() && !skillState.name.kn.trim()) {
            alert(language === 'kn' ? 'ದಯವಿಟ್ಟು ಕಲಿಕೆಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.' : 'Please enter a skill name.');
            return;
        }

        const cleanSkill = {
            id: skillState.id || `skill-${Date.now()}`,
            name: {
                en: (skillState.name.en || skillState.name.kn || '').trim(),
                kn: (skillState.name.kn || skillState.name.en || '').trim(),
            },
        };

        let updated;
        if (editingSkillIdx !== null) {
            updated = formState.skills.map((s, idx) => (idx === editingSkillIdx ? cleanSkill : s));
        } else {
            updated = [...formState.skills, cleanSkill];
        }

        const newHome = { ...formState, skills: updated };
        setFormState(newHome);
        setIsSkillModalOpen(false);
        await onSave(newHome, editingSkillIdx !== null ? 'Skill updated' : 'Skill added');
    };

    return (
        <div className="cms-container">
            {/* Action Bar */}
            <div className="cms-action-bar">
                <div className="cms-action-bar-left">
                    <div className="cms-lang-pills">
                        <button
                            type="button"
                            className={`cms-lang-pill-btn ${langTab === 'en' ? 'active' : ''}`}
                            onClick={() => setLangTab('en')}
                        >
                            {t('admin.labels.english', 'English')}
                        </button>
                        <button
                            type="button"
                            className={`cms-lang-pill-btn ${langTab === 'kn' ? 'active' : ''}`}
                            onClick={() => setLangTab('kn')}
                        >
                            {t('admin.labels.kannada', 'ಕನ್ನಡ')}
                        </button>
                    </div>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleSaveHero}
                        disabled={saving}
                    >
                        {saving ? t('admin.actions.saving', 'Saving...') : t('admin.actions.save', 'Save Changes')}
                    </button>
                </div>
            </div>

            {/* SECTION 1: HERO & INTRODUCTION */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                    <h3 className="cms-form-heading" style={{ fontSize: '1.05rem', margin: 0 }}>
                        {t('admin.home.heroHeading', 'Hero & Introduction')} ({langTab === 'en' ? t('admin.labels.english', 'English') : t('admin.labels.kannada', 'Kannada')})
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        {t('admin.home.heroDesc', 'Configure the greeting, tagline, role, and bio displayed at the top of your homepage')}
                    </p>
                </div>

                <div className="cms-form-row" style={{ marginBottom: '0.85rem' }}>
                    <div className="cms-form-group">
                        <label className="cms-form-label">{t('admin.home.titleGreeting', 'Title / Greeting')}</label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.title[langTab] || ''}
                            onChange={(e) => handleTextChange('title', langTab, e.target.value)}
                            placeholder={langTab === 'en' ? 'e.g. Hello World!' : 'ಉದಾ: ನಮಸ್ಕಾರ!'}
                        />
                    </div>
                    <div className="cms-form-group">
                        <label className="cms-form-label">{t('admin.home.introLine', 'Name & Pronunciation Line')}</label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.intro[langTab] || ''}
                            onChange={(e) => handleTextChange('intro', langTab, e.target.value)}
                            placeholder={langTab === 'en' ? "e.g. I'm [ˈprɐ.dʒʋəl ˈrɛ.ɖːi]" : 'ಉದಾ: ನಾನು ಪ್ರಜ್ವಲ ರೆಡ್ಡಿ'}
                        />
                    </div>
                </div>

                <div className="cms-form-group" style={{ marginBottom: '0.85rem' }}>
                    <label className="cms-form-label">{t('admin.home.taglineRole', 'Tagline / Role')}</label>
                    <input
                        type="text"
                        className="cms-input"
                        value={formState.subtitle[langTab] || ''}
                        onChange={(e) => handleTextChange('subtitle', langTab, e.target.value)}
                        placeholder={langTab === 'en' ? 'e.g. a student, programmer, and builder.' : 'ಉದಾ: ಕಲಿಗ, ಹಮ್ಮುಗ, ಮತ್ತು ಕಟ್ಟುಗ.'}
                    />
                </div>

                <div className="cms-form-group">
                    <label className="cms-form-label">{t('admin.home.bioDesc', 'Bio / Detailed Description')}</label>
                    <textarea
                        className="cms-textarea"
                        rows={4}
                        value={formState.description[langTab] || ''}
                        onChange={(e) => handleTextChange('description', langTab, e.target.value)}
                        placeholder={langTab === 'en' ? 'I am a college student at Cornell University...' : 'ನಾನು ಕಾರ್ನೆಲ್ ವಿಶ್ವವಿದ್ಯಾಲಯದ ವಿದ್ಯಾರ್ಥಿ...'}
                    />
                </div>
            </div>

            {/* SECTION 2: PROGRAMMING SKILLS */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    {/* Section Heading Input */}
                    <div className="cms-form-group" style={{ margin: 0, flex: '1 1 360px', maxWidth: '520px' }}>
                        <label className="cms-form-label">
                            {t('admin.home.skillsSectionHeading', 'Section Heading on Homepage')} ({langTab === 'en' ? t('admin.labels.english', 'English') : t('admin.labels.kannada', 'Kannada')})
                        </label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.skillsTitle[langTab] || ''}
                            onChange={(e) => handleTextChange('skillsTitle', langTab, e.target.value)}
                            placeholder={langTab === 'en' ? 'e.g. My Programming Skills' : 'ಉದಾ: ನನ್ನ ಹಮ್ಮುಗಾರಿಕೆಯ ಕಲಿಕೆಗಳು'}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                            {t('admin.home.skillsSectionHeadingHelp', 'The title displayed above the skill pills on your homepage.')}
                        </span>
                    </div>

                    <div style={{ paddingTop: '1.45rem' }}>
                        <button
                            type="button"
                            className="cms-btn cms-btn-primary"
                            onClick={handleOpenAddSkill}
                        >
                            {t('admin.actions.addSkill', '+ Add Skill')}
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div style={{ marginBottom: '1rem' }}>
                    <div className="cms-search-wrap" style={{ maxWidth: '320px' }}>
                        <span className="cms-search-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.placeholders.searchSkills', 'Search skills...')}
                            value={searchSkills}
                            onChange={(e) => setSearchSkills(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>
                </div>

                {filteredSkills.length === 0 ? (
                    <div className="cms-empty-state">
                        <p className="cms-empty-title">{t('admin.messages.noSkills', 'No skills found')}</p>
                        <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Try adjusting your search or add a new item.')}</p>
                    </div>
                ) : (
                    <div className="cms-list">
                        {filteredSkills.map((skill) => {
                            const originalIdx = formState.skills.indexOf(skill);
                            const displayName = getLocalized(skill.name, 'Untitled Skill');

                            return (
                                <div key={skill.id || originalIdx} className="cms-item-row">
                                    <div className="cms-item-main">
                                        <div className="cms-item-content">
                                            <div className="cms-item-header">
                                                <h4 className="cms-item-title">{displayName}</h4>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="cms-item-actions">
                                        <button
                                            type="button"
                                            className="cms-btn-icon"
                                            onClick={() => handleMoveSkill(originalIdx, -1)}
                                            disabled={originalIdx === 0}
                                            title={t('admin.actions.moveUp', 'Move Up')}
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            className="cms-btn-icon"
                                            onClick={() => handleMoveSkill(originalIdx, 1)}
                                            disabled={originalIdx === formState.skills.length - 1}
                                            title={t('admin.actions.moveDown', 'Move Down')}
                                        >
                                            ▼
                                        </button>
                                        <button
                                            type="button"
                                            className="cms-btn cms-btn-sm cms-btn-secondary"
                                            onClick={() => handleOpenEditSkill(skill, originalIdx)}
                                        >
                                            {t('admin.actions.edit', 'Edit')}
                                        </button>
                                        <button
                                            type="button"
                                            className="cms-btn cms-btn-sm cms-btn-danger"
                                            onClick={() => handleDeleteSkill(originalIdx)}
                                        >
                                            {t('admin.actions.delete', 'Delete')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Add / Edit Skill */}
            {isSkillModalOpen && (
                <div className="cms-modal-backdrop" onClick={() => setIsSkillModalOpen(false)}>
                    <div className="cms-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">{editingSkillIdx !== null ? t('admin.modals.editSkill', 'Edit Skill') : t('admin.modals.newSkill', 'Add New Skill')}</h3>
                            <button type="button" className="cms-modal-close-btn" onClick={() => setIsSkillModalOpen(false)}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveSkillModal}>
                            <div className="cms-modal-body">
                                <div className="cms-lang-pills" style={{ marginBottom: '1.25rem' }}>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${skillModalLang === 'en' ? 'active' : ''}`}
                                        onClick={() => setSkillModalLang('en')}
                                    >
                                        {t('admin.labels.english', 'English')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${skillModalLang === 'kn' ? 'active' : ''}`}
                                        onClick={() => setSkillModalLang('kn')}
                                    >
                                        {t('admin.labels.kannada', 'ಕನ್ನಡ')}
                                    </button>
                                </div>

                                {skillModalLang === 'en' ? (
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.skillName', 'Skill Name')} ({t('admin.labels.english', 'English')})</label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={skillState.name.en}
                                            onChange={(e) => setSkillState((prev) => ({ ...prev, name: { ...prev.name, en: e.target.value } }))}
                                            placeholder={t('admin.placeholders.skillName', 'e.g. Python')}
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.skillName', 'Skill Name')} ({t('admin.labels.kannada', 'Kannada')})</label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={skillState.name.kn}
                                            onChange={(e) => setSkillState((prev) => ({ ...prev, name: { ...prev.name, kn: e.target.value } }))}
                                            placeholder="ಉದಾ: ಪಾಯ್ತನ್"
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="cms-modal-footer">
                                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setIsSkillModalOpen(false)}>
                                    {t('admin.actions.cancel', 'Cancel')}
                                </button>
                                <button type="submit" className="cms-btn cms-btn-primary">
                                    {editingSkillIdx !== null ? t('admin.actions.save', 'Save Changes') : t('admin.actions.addSkill', '+ Add Skill')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CmsHome;
