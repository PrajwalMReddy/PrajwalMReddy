#!/usr/bin/env node
/**
 * Microsoft Outlook Graph Login Utility (Device Code Flow)
 * Based on Microsoft Graph JavaScript Tutorial & OAuth Device Code RFC
 * 
 * Usage: node scripts/outlook-login.js [CLIENT_ID]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { initiateDeviceCodeFlow, pollDeviceCodeToken, getOutlookUserProfile, fetchOutlookEmails, fetchOutlookCalendar } = require('../services/outlook');

const envPath = path.resolve(__dirname, '../.env');

function loadEnv() {
    if (!fs.existsSync(envPath)) return {};
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const idx = trimmed.indexOf('=');
            if (idx !== -1) {
                env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            }
        }
    }
    return env;
}

function updateEnvKey(key, value) {
    if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, `${key}=${value}\n`, 'utf8');
        return;
    }
    let content = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
    } else {
        content += `\n${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    process.env[key] = value;
}

async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('========================================================');
    console.log('  Microsoft Graph Outlook Authenticator (Personal / Work)');
    console.log('========================================================\n');

    const env = loadEnv();
    for (const [k, v] of Object.entries(env)) {
        process.env[k] = v;
    }

    let clientId = process.argv[2] || process.env.MS_GRAPH_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;

    if (!clientId) {
        console.log('To authenticate with Microsoft Graph, you need an Azure Client ID (Application ID).');
        console.log('1. Go to https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade');
        console.log('2. Click "New registration" -> Supported accounts: "Accounts in any organizational directory and personal Microsoft accounts"');
        console.log('3. Platform: Mobile and desktop applications -> Redirect URI: https://login.microsoftonline.com/common/oauth2/nativeclient\n');
        clientId = await prompt('Enter your Microsoft Azure Client ID: ');
    }

    if (!clientId) {
        console.error('Error: Client ID is required.');
        process.exit(1);
    }

    updateEnvKey('MS_GRAPH_CLIENT_ID', clientId);

    console.log('\n[1/3] Requesting Device Code from Microsoft...');
    try {
        const deviceData = await initiateDeviceCodeFlow(clientId);
        
        console.log('\n--------------------------------------------------------');
        console.log(deviceData.message);
        console.log('--------------------------------------------------------');
        console.log(`\nDirect link: ${deviceData.verification_uri || 'https://microsoft.com/devicelogin'}`);
        console.log(`Your Code:   \x1b[1m\x1b[32m${deviceData.user_code}\x1b[0m\n`);
        console.log('[2/3] Waiting for authentication in browser (polling every 5s)...');

        const intervalMs = (deviceData.interval || 5) * 1000;
        const expiresAt = Date.now() + (deviceData.expires_in || 900) * 1000;

        let tokens = null;
        while (Date.now() < expiresAt) {
            await new Promise((r) => setTimeout(r, intervalMs));
            tokens = await pollDeviceCodeToken(deviceData.device_code, clientId, process.env.MS_GRAPH_CLIENT_SECRET);

            if (tokens.access_token) {
                break;
            }

            if (tokens.error) {
                if (tokens.error === 'authorization_pending') {
                    process.stdout.write('.');
                    continue;
                }
                if (tokens.error === 'slow_down') {
                    await new Promise((r) => setTimeout(r, 5000));
                    continue;
                }
                throw new Error(`Auth failed: ${tokens.error_description || tokens.error}`);
            }
        }

        if (!tokens || !tokens.access_token) {
            throw new Error('Device code expired before sign-in completed.');
        }

        console.log('\n\n[3/3] Authentication Successful!');
        updateEnvKey('MS_GRAPH_REFRESH_TOKEN', tokens.refresh_token);
        process.env.MS_GRAPH_ACCESS_TOKEN = tokens.access_token;

        console.log('Saved MS_GRAPH_REFRESH_TOKEN to .env.');

        // Verify Graph connection
        const user = await getOutlookUserProfile();
        console.log(`\nConnected as: ${user.displayName} (${user.email})`);

        const emails = await fetchOutlookEmails(3);
        console.log(`Inbox: ${emails.unreadCount} unread emails found.`);

        const calendar = await fetchOutlookCalendar('today');
        console.log(`Calendar: ${calendar.todayCount} meeting(s) scheduled for today.`);

        console.log('\n Microsoft Outlook integration is 100% operational!');
        process.exit(0);
    } catch (err) {
        console.error('\nAuthentication error:', err.message);
        process.exit(1);
    }
}

main();
