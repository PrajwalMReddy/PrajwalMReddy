const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
}

const { createToken } = require('../lib/auth');
const token = createToken('admin');

async function test() {
    const res = await fetch('http://localhost:3000/api/cms/content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `admin_session=${token}`
        },
        body: JSON.stringify({
            type: 'research',
            data: require('../public/research/metadata.json')
        })
    });
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Response:', body);
}

test();
