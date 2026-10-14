/**
 * Gmail OAuth Helper Script
 * Generates GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN for your personal Gmail.
 *
 * Usage:
 *   node scripts/gmail-login.js
 */

const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
    console.log('\n======================================================');
    console.log('       Gmail Integration OAuth Setup Helper           ');
    console.log('======================================================\n');
    console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
    console.log('2. Create a project (or select an existing one).');
    console.log('3. Enable the "Gmail API" (APIs & Services > Enable APIs and Services).');
    console.log('4. Configure the OAuth Consent Screen (User Type: External, Publishing Status: Testing, add your email as a Test User).');
    console.log('5. Create Credentials > OAuth client ID (Application Type: Web Application).');
    console.log('   Add Authorized Redirect URI: http://localhost:3333/callback\n');

    let clientId = process.env.GMAIL_CLIENT_ID;
    let clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId) {
        clientId = await ask('Enter your Google Client ID: ');
    }
    if (!clientSecret) {
        clientSecret = await ask('Enter your Google Client Secret: ');
    }

    clientId = clientId.trim();
    clientSecret = clientSecret.trim();

    if (!clientId || !clientSecret) {
        console.error('Client ID and Client Secret are required.');
        rl.close();
        return;
    }

    const redirectUri = 'http://localhost:3333/callback';
    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
    )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    console.log('\n------------------------------------------------------');
    console.log('Open this URL in your browser to authorize Gmail read access:');
    console.log('------------------------------------------------------\n');
    console.log(authUrl);
    console.log('\nWaiting for authorization callback on http://localhost:3333/callback ...\n');

    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost:3333');
            if (url.pathname === '/callback') {
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end(`<h2>Authorization Error</h2><p>${error}</p>`);
                    console.error('Authorization failed:', error);
                    server.close();
                    rl.close();
                    return;
                }

                if (code) {
                    // Exchange code for tokens
                    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            code,
                            client_id: clientId,
                            client_secret: clientSecret,
                            redirect_uri: redirectUri,
                            grant_type: 'authorization_code',
                        }),
                    });

                    const tokenData = await tokenRes.json();

                    if (tokenData.error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`<h2>Token Error</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
                        console.error('Token exchange error:', tokenData);
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h2>Authorization Successful!</h2><p>You can close this tab and return to the terminal.</p>');

                        console.log('\n======================================================');
                        console.log('             Gmail OAuth Token Received!              ');
                        console.log('======================================================\n');
                        console.log('Add these variables to your .env and Vercel project:\n');
                        console.log(`GMAIL_CLIENT_ID=${clientId}`);
                        console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
                        console.log(`GMAIL_REFRESH_TOKEN=${tokenData.refresh_token || 'N/A'}`);
                        console.log('\n======================================================\n');
                    }

                    server.close();
                    rl.close();
                }
            }
        } catch (err) {
            console.error('Callback error:', err);
            server.close();
            rl.close();
        }
    });

    server.listen(3333);
}

main().catch(console.error);
