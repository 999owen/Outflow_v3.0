const fs = require('fs');

const files = ['dashboard.html', 'settings.html', 'entries.html', 'bills.html', 'grocery.html'];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace hardcoded border-radius
    content = content.replace(/border-radius:\s*12px;/g, 'border-radius: var(--card-radius);');

    // Replace hardcoded box-shadow
    content = content.replace(/box-shadow:\s*0 0 15px rgba\(0,0,0,0\.2\);/g, 'box-shadow: var(--card-shadow);');

    fs.writeFileSync(file, content);
});
