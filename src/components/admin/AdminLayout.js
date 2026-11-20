import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { useContent } from '../../utils/ContentContext';

const AdminLayout = ({ children, title, documentTitle, actions }) => {
    const { logout } = useAuth();
    const location = useLocation();
    const { t } = useContent();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
    };

    // Pages pass titles that are already translated.
    const getLocalizedTitle = (tTitle) => tTitle || '';

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
            document.title = t('pageTitles.admin');
        } else if (location.pathname.startsWith('/admin/todo')) {
            document.title = t('pageTitles.adminTodo');
        } else if (location.pathname.startsWith('/admin/notes')) {
            document.title = t('pageTitles.adminNotes');
        } else if (location.pathname.startsWith('/admin/networking')) {
            document.title = t('pageTitles.adminNetworking');
        } else if (location.pathname.startsWith('/admin/budget')) {
            document.title = t('pageTitles.adminBudget');
        } else if (location.pathname.startsWith('/admin/cms')) {
            document.title = t('pageTitles.adminCms');
        } else if (location.pathname.startsWith('/admin/konami')) {
            document.title = t('pageTitles.adminKonami');
        } else if (title) {
            const localized = getLocalizedTitle(title);
            document.title = t('pageTitles.adminSection', { title: localized });
        } else {
            document.title = t('pageTitles.admin');
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
                        aria-label={t('admin.nav.toggleMenu')}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    {/* Mobile Header Title */}
                    <div className="admin-mobile-header-brand">
                        <span>{getLocalizedTitle(title) || t('admin.nav.admin')}</span>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="admin-nav" aria-label={t('admin.ui.adminLayout.adminNavigation')}>
                        <Link
                            to="/admin"
                            className={`admin-nav-item ${isAdminActive ? 'active' : ''}`}
                        >
                            {t('admin.nav.admin')}
                        </Link>
                        <Link
                            to="/admin/todo"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/todo') ? 'active' : ''}`}
                        >
                            {t('admin.nav.todo')}
                        </Link>
                        <Link
                            to="/admin/notes"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/notes') ? 'active' : ''}`}
                        >
                            {t('admin.nav.notes')}
                        </Link>
                        <Link
                            to="/admin/budget"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/budget') ? 'active' : ''}`}
                        >
                            {t('admin.nav.budget')}
                        </Link>
                        <Link
                            to="/admin/networking"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/networking') ? 'active' : ''}`}
                        >
                            {t('admin.nav.networking')}
                        </Link>
                        <span className="admin-nav-divider" aria-hidden="true" />
                        <Link
                            to="/admin/cms"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/cms') ? 'active' : ''}`}
                        >
                            {t('admin.nav.cms')}
                        </Link>
                        <Link
                            to="/admin/konami"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/konami') ? 'active' : ''}`}
                        >
                            {t('admin.nav.konami')}
                        </Link>
                    </nav>

                    {/* Desktop Right Header Actions */}
                    <div className="admin-header-right">
                        <Link to="/" className="admin-header-link" title={t('admin.nav.viewSite')}>
                            {t('admin.nav.site')}
                        </Link>
                        <button
                            type="button"
                            className="admin-header-logout"
                            onClick={handleLogout}
                            title={t('admin.nav.signOut')}
                        >
                            {t('admin.nav.logout')}
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
            <aside className={`admin-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`} aria-label={t('admin.nav.navigation')}>
                <div className="admin-mobile-drawer-header">
                    <span className="admin-mobile-drawer-title">{t('admin.nav.navigation')}</span>
                    <button
                        type="button"
                        className="admin-mobile-drawer-close"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label={t('admin.nav.closeMenu')}
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
                            {t('admin.nav.admin')}
                        </Link>
                        <Link
                            to="/admin/todo"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/todo') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.todo')}
                        </Link>
                        <Link
                            to="/admin/notes"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/notes') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.notes')}
                        </Link>
                        <Link
                            to="/admin/budget"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/budget') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.budget')}
                        </Link>
                        <Link
                            to="/admin/networking"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/networking') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.networking')}
                        </Link>
                        <span className="admin-mobile-nav-divider" aria-hidden="true" />
                        <Link
                            to="/admin/cms"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/cms') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.cms')}
                        </Link>
                        <Link
                            to="/admin/konami"
                            className={`admin-mobile-nav-item ${location.pathname.startsWith('/admin/konami') ? 'active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t('admin.nav.konami')}
                        </Link>
                    </nav>

                    <div className="admin-mobile-drawer-footer">
                        <Link
                            to="/"
                            className="admin-mobile-link"
                            onClick={() => setMobileMenuOpen(false)}
                            title={t('admin.nav.viewSite')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            <span>{t('admin.nav.site')}</span>
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
                            <span>{t('admin.nav.logout')}</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="admin-main">
                {title ? (
                    <div className="admin-page-header-row">
                        <h1 className="admin-page-title">{getLocalizedTitle(title)}</h1>
                        {actions && <div className="admin-page-header-actions">{actions}</div>}
                    </div>
                ) : (
                    actions && <div className="admin-page-header-actions" style={{ marginBottom: '1.5rem' }}>{actions}</div>
                )}
                {typeof children === 'function' ? children({}) : children}
            </main>
        </div>
    );
};

export default AdminLayout;
