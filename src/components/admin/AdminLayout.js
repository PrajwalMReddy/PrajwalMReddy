import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const AdminLayout = ({ children, title }) => {
    const { logout } = useAuth();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-left">
                    <Link to="/admin/budget" className="admin-brand">Admin</Link>
                    <nav className="admin-nav" aria-label="Admin navigation">
                        <Link
                            to="/admin/budget"
                            className={location.pathname.startsWith('/admin/budget') ? 'active' : ''}
                        >
                            Budget
                        </Link>
                        <Link
                            to="/admin/todo"
                            className={location.pathname.startsWith('/admin/todo') ? 'active' : ''}
                        >
                            To-do
                        </Link>
                    </nav>
                </div>
                <div className="admin-header-right">
                    <Link to="/" className="admin-link">Site</Link>
                    <button type="button" className="admin-logout-btn" onClick={handleLogout}>
                        Log out
                    </button>
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
