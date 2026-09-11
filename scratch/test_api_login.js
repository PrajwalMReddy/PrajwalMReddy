const http = require('http');

// Let's test logging into dev-api
const postData = JSON.stringify({ password: 'your-password' });
// Wait, let's see what password hashes to ADMIN_PASSWORD_HASH
// In .env: ADMIN_PASSWORD_HASH=$2a$12$PGsaOwHW9J.d3CWjhTvvOuIM.eAXQQLOPj2dcB3pOJWfb0/uitifi
// Let's check hash-password.js or see what password was used.
console.log('Testing...');
