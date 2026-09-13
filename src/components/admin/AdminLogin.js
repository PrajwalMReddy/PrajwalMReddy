import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { useContent } from '../../utils/ContentContext';

const AdminLogin = () => {
    const { authenticated, login } = useAuth();
    const { t } = useContent();
    const location = useLocation();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        document.title = t('pageTitles.adminLogin', 'Admin Login | Prajwal Reddy');
    }, [t]);

    const rawFrom = location.state?.from;
    const from = (rawFrom && rawFrom !== '/admin/login' && rawFrom !== '/admin' && rawFrom !== '/admin/home')
        ? rawFrom
        : '/admin/todo';
    if (authenticated) {
        return <Navigate to={from} replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(password);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="admin-page admin-login-page">
            <div className="admin-login-card">
                <h1>{t('admin.login.title', 'Admin Access')}</h1>
                <p className="admin-login-subtitle">{t('admin.login.subtitle', 'Enter your password to continue.')}</p>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="admin-password">{t('admin.login.password', 'Password')}</label>
                    <input
                        id="admin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                    {error && <p className="admin-error">{error}</p>}
                    <button type="submit" disabled={submitting}>
                        {submitting
                            ? t('admin.login.signingIn', 'Signing in...')
                            : t('admin.login.signIn', 'Sign In')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
