import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

// Safely parses a fetch Response as JSON. If the body isn't valid JSON
// (e.g. the server crashed and returned a plain-text/HTML error page),
// this throws a readable error instead of letting `res.json()` throw a
// raw "Unexpected token" SyntaxError.
async function parseJsonResponse(res) {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            res.ok
                ? 'Server returned an unexpected response.'
                : `Server error (${res.status}). Please try again.`
        );
    }
}

export const AuthProvider = ({ children }) => {
    const [authenticated, setAuthenticated] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkSession = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/session', { credentials: 'include' });
            const data = await parseJsonResponse(res);
            setAuthenticated(Boolean(data.authenticated));
        } catch {
            setAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const login = async (password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password }),
        });
        const data = await parseJsonResponse(res);
        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }
        setAuthenticated(true);
        return data;
    };

    const logout = async () => {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
        setAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ authenticated, loading, login, logout, checkSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
