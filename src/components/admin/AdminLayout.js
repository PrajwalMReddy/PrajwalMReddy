import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { useContent } from '../../utils/ContentContext';

const AdminLayout = ({ children, title, documentTitle }) => {
    const { logout } = useAuth();
    const location = useLocation();
    const { t } = useContent();

    const handleLogout = async () => {
        await logout();
    };

    const getLocalizedTitle = (tTitle) => {
        if (!tTitle) return '';
        if (tTitle === 'Content Management System') return t('admin.titles.cms', tTitle);
        if (tTitle === 'Budget Manager') return t('admin.titles.budget', tTitle);
        if (tTitle === 'To-Do List' || tTitle === 'To-Do Manager') return t('admin.todoSection.title', t('admin.titles.todo', tTitle));
        if (tTitle === 'Notes & Ideas' || tTitle === 'Notes Manager') return t('admin.notesSection.title', t('admin.titles.notes', tTitle));
        return tTitle;
    };

    useEffect(() => {
        if (documentTitle) {
            document.title = documentTitle;
            return;
        }

        if (location.pathname.startsWith('/admin/todo')) {
            document.title = t('pageTitles.adminTodo', 'To-Do | Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/notes')) {
            document.title = t('pageTitles.adminNotes', 'Notes | Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/budget')) {
            document.title = t('pageTitles.adminBudget', 'Budget | Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/cms')) {
            document.title = t('pageTitles.adminCms', 'CMS | Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/konami')) {
            document.title = t('pageTitles.adminKonami', 'Konami | Admin | Prajwal Reddy');
        } else if (title) {
            const localized = getLocalizedTitle(title);
            document.title = `${localized} | Admin | Prajwal Reddy`;
        } else {
            document.title = 'Admin | Prajwal Reddy';
        }
    }, [location.pathname, title, documentTitle, t]);

    return (
        <div className="admin-page">
            <header className="admin-header-bar">
                <div className="admin-header">
                    <nav className="admin-nav" aria-label="Admin navigation">
                        <Link
                            to="/admin/todo"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/todo') ? 'active' : ''}`}
                        >
                            {t('admin.nav.todo', 'To-Do')}
                        </Link>
                        <Link
                            to="/admin/notes"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/notes') ? 'active' : ''}`}
                        >
                            {t('admin.nav.notes', 'Notes')}
                        </Link>
                        <Link
                            to="/admin/budget"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/budget') ? 'active' : ''}`}
                        >
                            {t('admin.nav.budget', 'Budget')}
                        </Link>
                        <span className="admin-nav-divider" aria-hidden="true" />
                        <Link
                            to="/admin/cms"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/cms') ? 'active' : ''}`}
                        >
                            {t('admin.nav.cms', 'CMS')}
                        </Link>
                        <Link
                            to="/admin/konami"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/konami') ? 'active' : ''}`}
                        >
                            {t('admin.nav.konami', 'Konami')}
                        </Link>
                    </nav>

                    <div className="admin-header-right">
                        <Link to="/" className="admin-header-link" title={t('admin.nav.viewSite', 'View public portfolio')}>
                            {t('admin.nav.site', 'Site')}
                        </Link>
                        <button
                            type="button"
                            className="admin-header-logout"
                            onClick={handleLogout}
                            title={t('admin.nav.signOut', 'Sign out of admin')}
                        >
                            {t('admin.nav.logout', 'Log out')}
                        </button>
                    </div>
                </div>
            </header>

            <main className="admin-main">
                {title && <h1 className="admin-page-title">{getLocalizedTitle(title)}</h1>}
                {children}
            </main>
        </div>
    );
};

export default AdminLayout;
