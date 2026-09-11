const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetPath = path.resolve('src/styles/admin/common.css');
const lines = execSync('git show HEAD:src/admin.css', { maxBuffer: 20 * 1024 * 1024 }).toString('utf8').split('\n');

const headerMobile = [
  '',
  '@media (max-width: 540px) {',
  '    .admin-header {',
  '        padding: 0.5rem 0.85rem;',
  '        gap: 0.5rem;',
  '    }',
  '',
  '    .admin-nav {',
  '        gap: 0.85rem;',
  '        overflow-x: auto;',
  '        white-space: nowrap;',
  '        -webkit-overflow-scrolling: touch;',
  '        scrollbar-width: none;',
  '        flex: 1 1 auto;',
  '        min-width: 0;',
  '    }',
  '',
  '    .admin-nav::-webkit-scrollbar {',
  '        display: none;',
  '    }',
  '',
  '    .admin-nav-item {',
  '        font-size: 14.5px;',
  '        padding: 0.35rem 0;',
  '        flex-shrink: 0;',
  '    }',
  '',
  '    .admin-header-right {',
  '        gap: 0.85rem;',
  '        flex-shrink: 0;',
  '    }',
  '',
  '    .admin-header-link,',
  '    .admin-header-logout {',
  '        font-size: 14px;',
  '    }',
  '',
  '    .admin-main {',
  '        padding: 1.25rem 0.85rem 3rem 0.85rem;',
  '    }',
  '',
  '    .admin-page-title {',
  '        font-size: 22px;',
  '        margin-bottom: 14px;',
  '    }',
  '}'
];

const formMobile = [
  '',
  '@media (max-width: 600px) {',
  '    .admin-form-grid {',
  '        grid-template-columns: 1fr;',
  '        gap: 0.55rem;',
  '    }',
  '',
  '    .admin-form-actions {',
  '        width: 100%;',
  '    }',
  '',
  '    .admin-form-actions button {',
  '        width: 100%;',
  '    }',
  '}'
];

const commonLines = [
  '/* ============================================================',
  '   ADMIN COMMON: Theme Tokens, Resets, Shell & Layout',
  '   ============================================================ */',
  ...lines.slice(0, 289),
  ...headerMobile,
  '',
  '/* ============================================================',
  '   ADMIN COMMON: Generic Forms, Buttons & Actions',
  '   ============================================================ */',
  ...lines.slice(471, 594),
  ...formMobile,
  '',
  '/* ============================================================',
  '   ADMIN COMMON: Messages, Alerts & Generic Stats',
  '   ============================================================ */',
  ...lines.slice(4417, 4524),
];

fs.writeFileSync(targetPath, commonLines.join('\n').replace(/\r\n/g, '\n'), 'utf8');
console.log('Successfully regenerated common.css without budget overlap!');
