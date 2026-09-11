const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/styles/admin/todo.css');
let content = fs.readFileSync(filePath, 'utf8');

const targetStart = '/* Two columns */\n@media (max-width: 720px) {';
const targetEnd = '/* ============================================================\n   Todo Modal\n   ============================================================ */';

const normalized = content.replace(/\r\n/g, '\n');
const startIndex = normalized.indexOf(targetStart);
const endIndex = normalized.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find target boundaries', { startIndex, endIndex });
  process.exit(1);
}

const replacement = `/* Two columns on tablets */
@media (max-width: 720px) {
    .admin-todo-top-dashboard {
        grid-template-columns: 1fr;
    }

    .admin-todo-overview {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: 1fr;
    }

    .admin-todo-stat {
        padding: 0.7rem;
    }

    .admin-todo-board {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
    }

    .admin-todo-column-body {
        max-height: none;
    }
}

@media (max-width: 600px) {
    .admin-todo-top-dashboard .admin-todo-form {
        padding: 1rem;
    }

    .admin-todo-title-field,
    .admin-todo-date-field,
    .admin-todo-priority-field {
        flex: 1 1 100% !important;
        width: 100% !important;
    }

    .admin-todo-submit {
        width: 100% !important;
    }
}

/* One column / mobile phones */
@media (max-width: 520px) {
    .admin-todo-overview {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(2, 1fr);
    }

    .admin-todo-form-row {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .admin-todo-board {
        grid-template-columns: 1fr;
    }

    .admin-todo-card {
        padding: 0.8rem;
    }

    .admin-todo-modal-row {
        grid-template-columns: 1fr;
        gap: 0.75rem;
    }

    .admin-todo-modal-header,
    .admin-todo-modal-body,
    .admin-todo-modal-footer {
        padding: 1rem;
    }
}

`;

const newContent = normalized.slice(0, startIndex) + replacement + normalized.slice(endIndex);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully cleaned up todo.css responsive block!');
