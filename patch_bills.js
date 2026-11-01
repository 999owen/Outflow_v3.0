const fs = require('fs');

let content = fs.readFileSync('bills.html', 'utf8');

// 1. Remove inline :root variables but keep --sidebar-width and other layout vars
content = content.replace(/:root\s*\{[^}]*\}/s, `
        :root {
            --sidebar-width: 240px;
            --font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
        }
`);

// 2. Add stylesheet and head script
content = content.replace('</head>', `
    <link rel="stylesheet" href="theme.css">
    <script>
      (function() {
        const savedTheme = localStorage.getItem('outflow_theme') || 'default';
        document.documentElement.setAttribute('data-theme', savedTheme);
      })();
    </script>
</head>`);

// 3. Replace static colors in style block
content = content.replace(/background-color:\s*#1F2937;/g, 'background-color: var(--hover-bg);');
content = content.replace(/background-color:\s*#1A1A1A;/g, 'background-color: var(--input-bg);');

// 4. Add logic to re-render charts and listen for themes
const scriptLogic = `
        window.addEventListener('storage', (e) => {
            if (e.key === 'outflow_theme' || !e.key) {
                const savedTheme = localStorage.getItem('outflow_theme') || 'default';
                document.documentElement.setAttribute('data-theme', savedTheme);
            }
        });
`;
content = content.replace('TrackerStore.subscribe(renderBills);', scriptLogic + '\n        TrackerStore.subscribe(renderBills);');

fs.writeFileSync('bills.html', content);
