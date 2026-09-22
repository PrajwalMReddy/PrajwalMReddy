import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { useContent } from '../../utils/ContentContext';

const AdminLayout = ({ children, title, documentTitle }) => {
    const { logout } = useAuth();
    const location = useLocation();
    const { t } = useContent();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
    };

    const getLocalizedTitle = (tTitle) => {
        if (!tTitle) return '';
        if (tTitle === 'Admin Dashboard' || tTitle === 'Dashboard') return t('admin.titles.dashboard', tTitle);
        if (tTitle === 'Content Management System') return t('admin.titles.cms', tTitle);
        if (tTitle === 'Budget Manager') return t('admin.titles.budget', tTitle);
        if (tTitle === 'To-Do List' || tTitle === 'To-Do Manager') return t('admin.todoSection.title', t('admin.titles.todo', tTitle));
        if (tTitle === 'Notes & Ideas' || tTitle === 'Notes Manager') return t('admin.notesSection.title', t('admin.titles.notes', tTitle));
        if (tTitle === 'Networking' || tTitle === 'Networking Manager') return t('admin.titles.networking', tTitle);
        return tTitle;
    };

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mobileMenuOpen]);

    useEffect(() => {
        if (documentTitle) {
            document.title = documentTitle;
            return;
        }

        if (location.pathname === '/admin' || location.pathname === '/admin/' || location.pathname === '/admin/home' || location.pathname === '/admin/dashboard') {
            document.title = t('pageTitles.admin', 'Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/todo')) {
            document.title = t('pageTitles.adminTodo', 'To-Do | Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/notes')) {
            document.title = t('pageTitles.adminNotes', 'Notes | Admin | Prajwal Reddy');
        } else if (location.pathname.startsWith('/admin/networking')) {
            document.title = t('pageTitles.adminNetworking', 'Networking | Admin | Prajwal Reddy');
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

    const isAdminActive = location.pathname === '/admin' || location.pathname === '/admin/' || location.pathname === '/admin/home' || location.pathname === '/admin/dashboard';

    return (
        <div className="admin-page">
            <header className="admin-header-bar">
                <div className="admin-header">
                    {/* Mobile Hamburger Button */}
                    <button
                        type="button"
                        className="admin-hamburger-btn"
                        onClick={() => setMobileMenuOpen((prev) => !prev)}
                        aria-label="Toggle admin navigation menu"
                        aria-expanded={mobileMenuOpen}
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    {/* Mobile Header Title */}
                    <div className="admin-mobile-header-brand">
                        <span>{getLocalizedTitle(title) || 'Admin'}</span>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="admin-nav" aria-label="Admin navigation">
                        <Link
                            to="/admin"
                            className={`admin-nav-item ${isAdminActive ? 'active' : ''}`}
                        >
                            {t('admin.nav.admin', 'Admin')}
                        </Link>
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
                        <Link
                            to="/admin/networking"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/networking') ? 'active' : ''}`}
                        >
                            {t('admin.nav.networking', 'Networking')}
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

                    {/* Desktop Right Header Actions */}
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

            {/* Mobile Drawer Overlay */}
            <div
                className={`admin-mobile-overlay ${mobileMenuOpen ? 'open' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
            />

            {/* Mobile Side Drawer Navigation */}
            <aside className={`admin-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`} aria-label="Mobile admin navigation">
                <div className="admin-mobile-drawer-header">
                    <span className="admin-mobile-drawer-title">Admin Navigation</span>
                    <button
                        type="button"
                        className="admin-mobile-drawer-close"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        ✕
                    </button>
                </div>

                <div className="admin-mobile-drawer-content">
                    <nav className="admin-mobile-nav">
                        <Link
                            to="/admin"
                            className={`admin-mobile-nav-item ${isAdminActive ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.admin', 'Admin')}
                        </Link>
                        <Link
                            to="/admin/todo"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/todo') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.todo', 'To-Do')}
                        </Link>
                        <Link
                            to="/admin/notes"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/notes') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.notes', 'Notes')}
                        </Link>
                        <Link
                            to="/admin/budget"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/budget') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.budget', 'Budget')}
                        </Link>
                        <Link
                            to="/admin/networking"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/networking') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.networking', 'Networking')}
                        </Link>
                        <span className="admin-mobile-nav-divider" aria-hidden="true" />
                        <Link
                            to="/admin/cms"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/cms') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.cms', 'CMS')}
                        </Link>
                        <Link
                            to="/admin/konami"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/konami') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.konami', 'Konami')}
                        </Link>
                    </nav>

                    <div className="admin-mobile-drawer-footer">
                        <Link
                            to="/"
                            className="admin-mobile-link"
                            onClick={() => setMobileMenuOpen(false)}
                            title={t('admin.nav.viewSite', 'View public portfolio')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            <span>{t('admin.nav.site', 'View Site')}</span>
                        </Link>
                        <button
                            type="button"
                            className="admin-mobile-logout"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                handleLogout();
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span>{t('admin.nav.logout', 'Log out')}</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="admin-main">
                {title && <h1 className="admin-page-title">{getLocalizedTitle(title)}</h1>}
                {typeof children === 'function' ? children({}) : children}
            </main>
        </div>
    );
};

export default AdminLayout;
