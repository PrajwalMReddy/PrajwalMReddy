const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/styles/admin/budget.css');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix the truncated form grid around line 83-100
const formGridTarget = `.admin-budget-form-grid {
    display: grid;
    grid-template-columns: 95px 145px minmax(200px, 2fr) minmax(160px, 1.3fr) 140px auto;
    gap: 0.85rem;
    align-items: flex-end;
}

@media (max-width: 1200px) {
    min-width: 0;
}`;

const formGridReplacement = `.admin-budget-form-grid {
    display: grid;
    grid-template-columns: 95px 145px minmax(200px, 2fr) minmax(160px, 1.3fr) 140px auto;
    gap: 0.85rem;
    align-items: flex-end;
}

@media (max-width: 1200px) {
    .admin-budget-form-grid {
        grid-template-columns: 85px 135px 1fr 1fr 130px auto;
        gap: 0.65rem;
    }
}

@media (max-width: 960px) {
    .admin-budget-form-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
    }

    .admin-budget-form-actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
        margin-top: 0.25rem;
    }
}

@media (max-width: 600px) {
    .admin-budget-form-grid {
        grid-template-columns: 1fr;
        gap: 0.55rem;
    }

    .admin-budget-form-actions {
        width: 100%;
    }

    .admin-budget-form-actions button {
        width: 100%;
    }
}

.admin-field-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
}`;

content = content.replace(/\r\n/g, '\n');

if (content.includes(formGridTarget)) {
  content = content.replace(formGridTarget, formGridReplacement);
} else {
  console.log('formGridTarget not found exactly, searching substring...');
}

// 2. Add -webkit-overflow-scrolling: touch to .admin-table-scroll
const scrollTarget = `.admin-table-scroll {
    width: 100%;
    overflow-x: auto;
}`;

const scrollReplacement = `.admin-table-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}`;

content = content.replace(scrollTarget, scrollReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated budget.css!');
