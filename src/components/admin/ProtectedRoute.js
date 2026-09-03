import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { authenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="admin-loading">
                <p>Checking session...</p>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
    }

    return children;
};

export default ProtectedRoute;
