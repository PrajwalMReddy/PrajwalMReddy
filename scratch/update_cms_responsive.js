const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/admin/cms/cms.css');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

const target = `/* Responsive */
@media (max-width: 640px) {
    .cms-item-row {
        flex-direction: column;
        align-items: flex-start;
    }
    .cms-item-actions {
        width: 100%;
        justify-content: flex-end;
        padding-top: 0.5rem;
        border-top: 1px solid #f1f5f9;
    }
    .cms-action-bar {
        flex-direction: column;
        align-items: stretch;
    }
    .cms-search-wrap {
        max-width: 100%;
    }
    .cms-form-row {
        grid-template-columns: 1fr;
    }
}`;

const replacement = `/* Responsive */
@media (max-width: 640px) {
    .cms-item-row {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
    }
    .cms-item-actions {
        width: 100%;
        justify-content: flex-end;
        padding-top: 0.5rem;
        border-top: 1px solid #f1f5f9;
        flex-wrap: wrap;
    }
    .cms-action-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.65rem;
    }
    .cms-action-bar-left,
    .cms-action-bar-right {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
    }
    .cms-search-wrap {
        max-width: 100%;
        width: 100%;
    }
    .cms-select {
        width: 100%;
    }
    .cms-form-row {
        grid-template-columns: 1fr;
    }
    .cms-modal-backdrop {
        padding: 0.65rem;
    }
    .cms-modal-content {
        max-height: 95vh;
    }
    .cms-markdown-large-textarea {
        min-height: 280px;
        height: 40vh;
        padding: 0.75rem;
        font-size: 0.875rem;
    }
    .cms-section-form-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
}

@media (max-width: 480px) {
    .cms-modal-header,
    .cms-modal-body,
    .cms-modal-footer {
        padding: 0.85rem;
    }
    .cms-item-thumb {
        width: 42px;
        height: 42px;
    }
}`;

if (!content.includes(target)) {
  console.error('Target responsive block not found in cms.css');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated cms.css responsive styles!');
