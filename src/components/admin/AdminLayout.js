import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const AdminLayout = ({ children, title }) => {
    const { logout } = useAuth();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
    };

    const isDashboardActive = location.pathname === '/admin/home' || location.pathname === '/admin';

    return (
        <div className="admin-page">
            <header className="admin-header-bar">
                <div className="admin-header">
                    <nav className="admin-nav" aria-label="Admin navigation">
                        <Link
                            to="/admin/home"
                            className={`admin-nav-item ${isDashboardActive ? 'active' : ''}`}
                        >
                            Admin
                        </Link>
                        <Link
                            to="/admin/todo"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/todo') ? 'active' : ''}`}
                        >
                            To-Do
                        </Link>
                        <Link
                            to="/admin/notes"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/notes') ? 'active' : ''}`}
                        >
                            Notes
                        </Link>
                        <Link
                            to="/admin/budget"
                            className={`admin-nav-item ${location.pathname.startsWith('/admin/budget') ? 'active' : ''}`}
                        >
                            Budget
                        </Link>
                    </nav>

                    <div className="admin-header-right">
                        <Link to="/" className="admin-header-link" title="View public portfolio">
                            Site
                        </Link>
                        <button
                            type="button"
                            className="admin-header-logout"
                            onClick={handleLogout}
                            title="Sign out of admin"
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            <main className="admin-main">
                {title && <h1 className="admin-page-title">{title}</h1>}
                {children}
            </main>
        </div>
    );
};

export default AdminLayout;
