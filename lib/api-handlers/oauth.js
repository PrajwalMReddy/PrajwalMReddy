const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../db');
const { isAuthenticated, verifyPassword } = require('../auth');

const CLIENTS_COLL = 'oauth_clients';
const CODES_COLL = 'oauth_codes';
const TOKENS_COLL = 'oauth_tokens';

// Base URL resolver
function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'] || 'www.prajwalmreddy.com';
    return `${proto}://${host}`;
}

// PKCE S256 verification
function verifyCodeChallenge(verifier, challenge, method) {
    if (!challenge) return true;
    if (method === 'plain') return verifier === challenge;
    
    // Default: S256 (SHA256 Base64URL)
    const hash = crypto.createHash('sha256').update(verifier).digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return hash === challenge;
}

// -------------------------------------------------------------
// 1. OAuth Discovery Endpoints (RFC 8414 & RFC 9728)
// -------------------------------------------------------------
function getDiscoveryMetadata(baseUrl) {
    return {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
        token_endpoint: `${baseUrl}/api/mcp/token`,
        registration_endpoint: `${baseUrl}/api/mcp/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        scopes_supported: ['mcp:all', 'mcp:read', 'mcp:write']
    };
}

function getProtectedResourceMetadata(baseUrl) {
    return {
        resource: `${baseUrl}/api/mcp`,
        authorization_servers: [baseUrl],
        scopes_supported: ['mcp:all', 'mcp:read', 'mcp:write'],
        bearer_methods_supported: ['header']
    };
}

// -------------------------------------------------------------
// 2. Dynamic Client Registration (RFC 7591)
// -------------------------------------------------------------
async function handleRegister(req, res, db) {
    const body = req.body || {};
    const clientName = body.client_name || 'MCP Client';
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : (body.redirect_uri ? [body.redirect_uri] : []);

    const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
    const clientSecret = `sec_${crypto.randomBytes(24).toString('hex')}`;

    const clientDoc = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
        response_types: body.response_types || ['code'],
        token_endpoint_auth_method: body.token_endpoint_auth_method || 'none',
        createdAt: new Date()
    };

    await db.collection(CLIENTS_COLL).insertOne(clientDoc);

    return res.status(201).json({
        client_id: clientId,
        client_secret: clientSecret,
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: clientDoc.grant_types,
        response_types: clientDoc.response_types,
        token_endpoint_auth_method: clientDoc.token_endpoint_auth_method
    });
}

// -------------------------------------------------------------
// 3. Authorization Endpoint (/api/mcp/authorize & /api/mcp/oauth/authorize)
// -------------------------------------------------------------
async function handleAuthorize(req, res, db) {
    const query = req.query || {};
    const body = req.body || {};

    const clientId = query.client_id || body.client_id;
    const redirectUri = query.redirect_uri || body.redirect_uri;
    const state = query.state || body.state || '';
    const codeChallenge = query.code_challenge || body.code_challenge || '';
    const codeChallengeMethod = query.code_challenge_method || body.code_challenge_method || 'S256';
    const scope = query.scope || body.scope || 'mcp:all';

    let clientName = 'AI Connector / MCP Client';
    if (clientId) {
        try {
            const registeredClient = await db.collection(CLIENTS_COLL).findOne({ client_id: clientId });
            if (registeredClient?.client_name) {
                clientName = registeredClient.client_name;
            }
        } catch (_) {}
    }

    if (!redirectUri && req.method !== 'POST') {
        return res.status(400).send('Missing redirect_uri in authorization request.');
    }

    // Process approval submission
    if (req.method === 'POST') {
        const userSecretKey = (body.secret_key || query.secret_key || '').trim();
        const validSecretKey = process.env.MCP_SECRET_KEY || process.env.ADMIN_PASSWORD;

        let isAuthed = isAuthenticated(req);
        if (!isAuthed && userSecretKey) {
            if (userSecretKey === validSecretKey || userSecretKey === process.env.ADMIN_PASSWORD) {
                isAuthed = true;
            } else {
                try {
                    isAuthed = await verifyPassword(userSecretKey);
                } catch (_) {
                    isAuthed = false;
                }
            }
        }

        if (!isAuthed) {
            return res.status(401).json({
                error: 'Invalid password or MCP Secret Key. Please check your credentials.'
            });
        }

        if (!redirectUri) {
            return res.status(400).json({ error: 'Missing redirect_uri in authorization request.' });
        }

        const code = `code_${crypto.randomBytes(20).toString('hex')}`;
        const codeDoc = {
            code,
            client_id: clientId,
            client_name: clientName,
            redirect_uri: redirectUri,
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
            scope,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        };

        await db.collection(CODES_COLL).insertOne(codeDoc);

        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        const acceptsJson = req.headers['accept']?.includes('application/json') || req.headers['content-type']?.includes('application/json');
        if (acceptsJson) {
            return res.status(200).json({
                success: true,
                redirect_url: redirectUrl.toString()
            });
        }

        res.writeHead(302, { Location: redirectUrl.toString() });
        return res.end();
    }

    // Render Full-Fledged UI with Dark/Light Mode & English/Kannada Locales
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorize MCP Client | Prajwal Reddy</title>
    <link rel="icon" href="/hurricane.ico" type="image/x-icon">
    <style>
        :root {
            --primary: #2C3E50;
            --secondary: #4A6B8A;
            --accent: #7D9BA6;
            --bg: #F5F7FA;
            --text: #2C3E50;
            --text-muted: #5e748d;
            --card-bg: #FFFFFF;
            --card-border: rgba(125, 155, 166, 0.25);
            --card-shadow: 0 12px 36px -4px rgba(44, 62, 80, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03);
            --item-bg: #F8FAFC;
            --item-border: rgba(125, 155, 166, 0.2);
            --input-bg: #FFFFFF;
            --input-border: #cbd5e1;
            --focus-ring: rgba(74, 107, 138, 0.2);
            --btn-bg: #4A6B8A;
            --btn-hover: #3d5973;
            --badge-bg: rgba(74, 107, 138, 0.12);
            --badge-text: #2C3E50;
        }
        body.dark-mode {
            --primary: #F5F7FA;
            --secondary: #AAB7B8;
            --accent: #7D9BA6;
            --bg: #181A1B;
            --text: #F5F7FA;
            --text-muted: #AAB7B8;
            --card-bg: #1F2326;
            --card-border: rgba(255, 255, 255, 0.1);
            --card-shadow: 0 16px 40px -4px rgba(0, 0, 0, 0.5);
            --item-bg: #181A1B;
            --item-border: rgba(255, 255, 255, 0.08);
            --input-bg: #23272A;
            --input-border: rgba(255, 255, 255, 0.12);
            --focus-ring: rgba(125, 155, 166, 0.3);
            --btn-bg: #4A6B8A;
            --btn-hover: #5d7e9e;
            --badge-bg: rgba(125, 155, 166, 0.16);
            --badge-text: #E8EDF2;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease; }
        body {
            font-family: "Calibri", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem 1rem;
            line-height: 1.5;
        }
        .auth-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 20px;
            padding: 2.25rem 2rem;
            width: 100%;
            max-width: 460px;
            box-shadow: var(--card-shadow);
            position: relative;
        }
        .auth-header {
            margin-bottom: 1.15rem;
        }
        .auth-header h1 {
            font-size: 1.45rem;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.01em;
            line-height: 1.25;
        }
        .auth-subtitle {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-bottom: 1.4rem;
            line-height: 1.45;
        }
        .client-highlight {
            color: var(--text);
            font-weight: 600;
        }
        .permissions-card {
            background: var(--item-bg);
            border: 1px solid var(--item-border);
            border-radius: 12px;
            padding: 1rem 1.15rem;
            margin-bottom: 1.5rem;
        }
        .permissions-heading {
            font-size: 0.76rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: var(--accent);
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .permissions-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .permission-item {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            font-size: 0.88rem;
            color: var(--text);
        }
        .permission-item .check {
            color: #10b981;
            font-weight: bold;
            font-size: 0.9rem;
        }
        .input-group {
            margin-bottom: 1.4rem;
        }
        .input-group label {
            display: block;
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 0.45rem;
        }
        .input-wrap {
            position: relative;
        }
        .input-wrap input {
            width: 100%;
            height: 44px;
            padding: 0.6rem 2.8rem 0.6rem 0.95rem;
            background: var(--input-bg);
            color: var(--text);
            border: 1.5px solid var(--input-border);
            border-radius: 10px;
            font-size: 0.95rem;
            font-family: inherit;
        }
        .input-wrap input:focus {
            outline: none;
            border-color: var(--secondary);
            box-shadow: 0 0 0 3px var(--focus-ring);
        }
        .toggle-pw-btn {
            position: absolute;
            right: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.25rem;
            transition: color 0.15s ease;
        }
        .toggle-pw-btn:hover {
            color: var(--text);
        }
        .error-alert {
            background-color: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            padding: 0.65rem 0.9rem;
            border-radius: 8px;
            font-size: 0.85rem;
            margin-bottom: 1.2rem;
            display: none;
            line-height: 1.4;
        }
        .btn-approve {
            width: 100%;
            height: 46px;
            background: var(--btn-bg);
            color: #ffffff;
            border: none;
            border-radius: 24px;
            font-size: 0.98rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(74, 107, 138, 0.3);
            transition: all 0.2s ease;
        }
        .btn-approve:hover:not(:disabled) {
            background: var(--btn-hover);
            transform: translateY(-1px);
        }
        .btn-approve:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .card-footer {
            margin-top: 1.25rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.82rem;
            color: var(--text-muted);
        }
        .card-footer a {
            color: var(--secondary);
            text-decoration: none;
            font-weight: 600;
        }
        .card-footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="auth-card">
        <div class="auth-header">
            <h1 id="ui-title">Authorize MCP Client</h1>
        </div>

        <p class="auth-subtitle" id="ui-subtitle">
            <span class="client-highlight" id="ui-client-name">${clientName}</span> is requesting secure connection to your personal website MCP server.
        </p>

        <div class="permissions-card">
            <div class="permissions-heading">
                <span id="ui-perms-title">Granted Capabilities</span>
                <span>5 Modules</span>
            </div>
            <ul class="permissions-list">
                <li class="permission-item"><span class="check">✓</span> <span id="perm-notes">Notes &amp; Knowledge Base</span></li>
                <li class="permission-item"><span class="check">✓</span> <span id="perm-todos">Tasks &amp; To-Do Management</span></li>
                <li class="permission-item"><span class="check">✓</span> <span id="perm-budget">Financial Ledger &amp; Budget Stats</span></li>
                <li class="permission-item"><span class="check">✓</span> <span id="perm-crm">Networking Contacts &amp; CRM</span></li>
                <li class="permission-item"><span class="check">✓</span> <span id="perm-cms">Portfolio CMS &amp; Content</span></li>
            </ul>
        </div>

        <div id="error-box" class="error-alert"></div>

        <form id="auth-form">
            <div class="input-group">
                <label for="admin-password" id="ui-label-auth">Password or MCP Secret Key</label>
                <div class="input-wrap">
                    <input
                        id="admin-password"
                        type="password"
                        name="secret_key"
                        placeholder="Enter admin password or secret key"
                        autocomplete="current-password"
                        required
                        autofocus
                    />
                    <button type="button" class="toggle-pw-btn" id="toggle-pw" aria-label="Toggle password visibility">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>
            </div>

            <button type="submit" id="submit-btn" class="btn-approve">
                <span id="ui-btn-text">Approve &amp; Connect</span>
            </button>
        </form>

        <div class="card-footer">
            <span id="ui-secure-text">Protected by OAuth 2.0 PKCE.</span>
            <a href="/" id="ui-cancel-link">Return to Website</a>
        </div>
    </div>

    <script>
        const i18n = {
            en: {
                title: 'Authorize MCP Client',
                subtitle: 'is requesting secure connection to your personal website MCP server.',
                permsTitle: 'Granted Capabilities',
                notes: 'Notes & Knowledge Base',
                todos: 'Tasks & To-Do Management',
                budget: 'Financial Ledger & Budget Stats',
                crm: 'Networking Contacts & CRM',
                cms: 'Portfolio CMS & Content',
                labelAuth: 'Password or MCP Secret Key',
                placeholder: 'Enter admin password or secret key',
                btnText: 'Approve & Connect',
                connecting: 'Connecting...',
                approved: 'Approved! Redirecting...',
                secureText: 'Protected by OAuth 2.0 PKCE.',
                cancelLink: 'Return to Website',
                errorFallback: 'Authorization failed. Please check your credentials.'
            },
            kn: {
                title: 'MCP ಸಂಪರ್ಕ ಅಧಿಕೃತಗೊಳಿಸಿ',
                subtitle: 'ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ವೆಬ್‌ಸೈಟ್ MCP ಸರ್ವರ್‌ಗೆ ಸುರಕ್ಷಿತ ಸಂಪರ್ಕವನ್ನು ಕೋರುತ್ತಿದೆ.',
                permsTitle: 'ನೀಡಲಾದ ಸವಲತ್ತುಗಳು',
                notes: 'ಟಿಪ್ಪಣಿಗಳು ಮತ್ತು ಜ್ಞಾನ ಭಂಡಾರ',
                todos: 'ಕಾರ್ಯಗಳು ಮತ್ತು ಮಾಡಬೇಕಾದ ಪಟ್ಟಿ',
                budget: 'ಆರ್ಥಿಕ ಲೆಕ್ಕ ಮತ್ತು ಬಜೆಟ್ ಅಂಕಿಅಂಶಗಳು',
                crm: 'ಸಂಪರ್ಕಗಳು ಮತ್ತು ನೆಟ್‌ವರ್ಕಿಂಗ್',
                cms: 'ವೆಬ್‌ಸೈಟ್ ಸಿಎಂಎಸ್ ಮತ್ತು ವಿಷಯ',
                labelAuth: 'ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ MCP ಸೀಕ್ರೆಟ್ ಕೀ',
                placeholder: 'ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಸೀಕ್ರೆಟ್ ಕೀ ನಮೂದಿಸಿ',
                btnText: 'ಅನುಮೋದಿಸಿ ಮತ್ತು ಸಂಪರ್ಕಿಸಿ',
                connecting: 'ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ...',
                approved: 'ಅನುಮೋದಿಸಲಾಗಿದೆ! ಮರುನಿರ್ದೇಶಿಸಲಾಗುತ್ತಿದೆ...',
                secureText: 'OAuth 2.0 PKCE ನಿಂದ ರಕ್ಷಿಸಲ್ಪಟ್ಟಿದೆ.',
                cancelLink: 'ವೆಬ್‌ಸೈಟ್‌ಗೆ ಹಿಂತಿರುಗಿ',
                errorFallback: 'ದೃಢೀಕರಣ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ.'
            }
        };

        // Inherit language setting from existing site localStorage
        const savedLang = localStorage.getItem('language') || localStorage.getItem('site_lang') || 'en';
        const currentLang = (savedLang === 'kn') ? 'kn' : 'en';

        function updateLocale() {
            const t = i18n[currentLang];
            document.getElementById('ui-title').textContent = t.title;
            const client = ${JSON.stringify(clientName)};
            document.getElementById('ui-subtitle').innerHTML = '<span class="client-highlight">' + client + '</span> ' + t.subtitle;
            document.getElementById('ui-perms-title').textContent = t.permsTitle;
            document.getElementById('perm-notes').textContent = t.notes;
            document.getElementById('perm-todos').textContent = t.todos;
            document.getElementById('perm-budget').textContent = t.budget;
            document.getElementById('perm-crm').textContent = t.crm;
            document.getElementById('perm-cms').textContent = t.cms;
            document.getElementById('ui-label-auth').textContent = t.labelAuth;
            document.getElementById('admin-password').placeholder = t.placeholder;
            document.getElementById('ui-btn-text').textContent = t.btnText;
            document.getElementById('ui-secure-text').textContent = t.secureText;
            document.getElementById('ui-cancel-link').textContent = t.cancelLink;
        }

        // Inherit theme setting from existing site localStorage or system preferences
        const storedDarkMode = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDarkMode = (storedDarkMode !== null) ? (storedDarkMode === 'true') : (localStorage.getItem('theme') === 'dark' || prefersDark);
        
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        updateLocale();

        // Password visibility toggle
        const togglePw = document.getElementById('toggle-pw');
        const pwInput = document.getElementById('admin-password');
        const eyeIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        const eyeOffIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

        togglePw.addEventListener('click', () => {
            const isPw = pwInput.type === 'password';
            pwInput.type = isPw ? 'text' : 'password';
            togglePw.innerHTML = isPw ? eyeOffIcon : eyeIcon;
        });

        // Form submission
        const form = document.getElementById('auth-form');
        const errorBox = document.getElementById('error-box');
        const submitBtn = document.getElementById('submit-btn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorBox.style.display = 'none';
            submitBtn.disabled = true;
            document.getElementById('ui-btn-text').textContent = i18n[currentLang].connecting;

            const payload = {
                client_id: ${JSON.stringify(clientId || '')},
                redirect_uri: ${JSON.stringify(redirectUri || '')},
                state: ${JSON.stringify(state || '')},
                code_challenge: ${JSON.stringify(codeChallenge || '')},
                code_challenge_method: ${JSON.stringify(codeChallengeMethod || '')},
                scope: ${JSON.stringify(scope || '')},
                approved: 'true',
                secret_key: pwInput.value
            };

            try {
                const res = await fetch('/api/mcp/authorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (res.ok && data.redirect_url) {
                    document.getElementById('ui-btn-text').textContent = i18n[currentLang].approved;
                    window.location.href = data.redirect_url;
                } else {
                    errorBox.textContent = data.error || i18n[currentLang].errorFallback;
                    errorBox.style.display = 'block';
                    submitBtn.disabled = false;
                    document.getElementById('ui-btn-text').textContent = i18n[currentLang].btnText;
                }
            } catch (err) {
                errorBox.textContent = i18n[currentLang].errorFallback;
                errorBox.style.display = 'block';
                submitBtn.disabled = false;
                document.getElementById('ui-btn-text').textContent = i18n[currentLang].btnText;
            }
        });
    </script>
</body>
</html>`);
}

// -------------------------------------------------------------
// 4. Token Endpoint (/api/mcp/token & /api/mcp/oauth/token)
// -------------------------------------------------------------
async function handleToken(req, res, db) {
    const body = req.body || {};
    const grantType = body.grant_type || 'authorization_code';

    if (grantType === 'authorization_code') {
        const { code, redirect_uri, code_verifier } = body;

        if (!code) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code' });
        }

        const codeDoc = await db.collection(CODES_COLL).findOne({ code });
        if (!codeDoc) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
        }

        // Validate expiry
        if (new Date() > new Date(codeDoc.expiresAt)) {
            await db.collection(CODES_COLL).deleteOne({ _id: codeDoc._id });
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code has expired' });
        }

        // Validate PKCE if challenge was set
        if (codeDoc.code_challenge && code_verifier) {
            const isValid = verifyCodeChallenge(code_verifier, codeDoc.code_challenge, codeDoc.code_challenge_method);
            if (!isValid) {
                return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
            }
        }

        // Delete used auth code (single use)
        await db.collection(CODES_COLL).deleteOne({ _id: codeDoc._id });

        // Issue Access Token & Refresh Token
        const accessToken = `mcp_oauth_${crypto.randomBytes(32).toString('hex')}`;
        const refreshToken = `mcp_ref_${crypto.randomBytes(32).toString('hex')}`;
        const expiresIn = 31536000; // 1 year

        const tokenDoc = {
            access_token: accessToken,
            refresh_token: refreshToken,
            client_id: codeDoc.client_id,
            client_name: codeDoc.client_name || 'MCP Client',
            scope: codeDoc.scope || 'mcp:all',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + expiresIn * 1000)
        };

        await db.collection(TOKENS_COLL).insertOne(tokenDoc);

        return res.status(200).json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            refresh_token: refreshToken,
            scope: codeDoc.scope || 'mcp:all'
        });
    }

    if (grantType === 'refresh_token') {
        const { refresh_token } = body;
        const tokenDoc = await db.collection(TOKENS_COLL).findOne({ refresh_token });
        if (!tokenDoc) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
        }

        const newAccessToken = `mcp_oauth_${crypto.randomBytes(32).toString('hex')}`;
        const expiresIn = 31536000;

        await db.collection(TOKENS_COLL).updateOne(
            { _id: tokenDoc._id },
            { $set: { access_token: newAccessToken, updatedAt: new Date() } }
        );

        return res.status(200).json({
            access_token: newAccessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            scope: tokenDoc.scope || 'mcp:all'
        });
    }

    return res.status(400).json({ error: 'unsupported_grant_type', error_description: `Grant type ${grantType} is not supported` });
}

// -------------------------------------------------------------
// 5. Admin Token Management (/api/mcp/tokens)
// -------------------------------------------------------------
async function handleTokensManagement(req, res, db) {
    if (!isAuthenticated(req)) {
        const authHeader = req.headers['authorization'] || '';
        const apiKey = req.headers['x-api-key'] || '';
        const validKey = process.env.MCP_SECRET_KEY || process.env.ADMIN_PASSWORD;
        const provided = authHeader.replace(/^Bearer\s+/i, '').trim() || String(apiKey).trim();

        if (!provided || provided !== validKey) {
            return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
        }
    }

    if (req.method === 'GET') {
        const tokens = await db.collection(TOKENS_COLL).find({}).sort({ createdAt: -1 }).toArray();
        const clients = await db.collection(CLIENTS_COLL).find({}).sort({ createdAt: -1 }).toArray();

        const safeTokens = tokens.map(t => ({
            id: t._id.toString(),
            client_id: t.client_id,
            client_name: t.client_name || 'MCP Client',
            scope: t.scope,
            token_prefix: t.access_token ? `${t.access_token.slice(0, 14)}...` : '',
            createdAt: t.createdAt,
            expiresAt: t.expiresAt
        }));

        return res.status(200).json({
            tokens: safeTokens,
            clients: clients.map(c => ({
                id: c._id.toString(),
                client_id: c.client_id,
                client_name: c.client_name,
                redirect_uris: c.redirect_uris,
                createdAt: c.createdAt
            }))
        });
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
        const tokenId = req.body?.tokenId || req.query?.id;
        if (!tokenId) {
            return res.status(400).json({ error: 'tokenId is required.' });
        }

        try {
            const query = ObjectId.isValid(tokenId) ? { _id: new ObjectId(tokenId) } : { access_token: tokenId };
            const delRes = await db.collection(TOKENS_COLL).deleteOne(query);
            return res.status(200).json({ success: true, deletedCount: delRes.deletedCount });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// -------------------------------------------------------------
// Main OAuth Handler
// -------------------------------------------------------------
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const url = new URL(req.url, `https://${req.headers.host || 'www.prajwalmreddy.com'}`);
    const pathname = url.pathname;
    const baseUrl = getBaseUrl(req);

    // 1. Discovery Endpoints
    if (pathname.endsWith('/oauth-authorization-server') || pathname.endsWith('/.well-known/oauth-authorization-server')) {
        return res.status(200).json(getDiscoveryMetadata(baseUrl));
    }

    if (pathname.endsWith('/oauth-protected-resource') || pathname.endsWith('/.well-known/oauth-protected-resource')) {
        return res.status(200).json(getProtectedResourceMetadata(baseUrl));
    }

    const db = await connectToDatabase();

    // 2. Admin Token Management
    if (pathname === '/api/mcp/tokens' || pathname === '/api/mcp/tokens/revoke') {
        return await handleTokensManagement(req, res, db);
    }

    // 3. Dynamic Client Registration
    if (pathname.endsWith('/register') && req.method === 'POST') {
        return await handleRegister(req, res, db);
    }

    // 4. Authorization Endpoint
    if (pathname.endsWith('/authorize')) {
        return await handleAuthorize(req, res, db);
    }

    // 5. Token Endpoint
    if (pathname.endsWith('/token') && req.method === 'POST') {
        return await handleToken(req, res, db);
    }

    return res.status(404).json({ error: 'Not Found', path: pathname });
};

module.exports.getDiscoveryMetadata = getDiscoveryMetadata;
module.exports.getProtectedResourceMetadata = getProtectedResourceMetadata;
