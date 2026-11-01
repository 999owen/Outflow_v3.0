const fs = require('fs');

let content = fs.readFileSync('settings.html', 'utf8');

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

// 4. Add Appearance panel
const appearancePanel = `
                    <!-- Appearance Panel -->
                    <div class="panel">
                        <div class="panel-header">
                            <h2>Appearance</h2>
                        </div>

                        <div class="setting-row">
                            <div class="setting-info">
                                <h3>Theme</h3>
                                <p>Select a color scheme for the application.</p>
                            </div>
                            <div>
                                <select id="theme-selector">
                                    <option value="default">Default (Dark Slate)</option>
                                    <option value="linear-dark">Linear Dark</option>
                                    <option value="nord">Nord Arctic</option>
                                    <option value="ios-frosted">iOS Frosted</option>
                                    <option value="light">Default Light</option>
                                </select>
                            </div>
                        </div>
                    </div>
`;
content = content.replace('<div class="panels-grid">', '<div class="panels-grid">\n' + appearancePanel);

// 5. Add script logic for theme
const scriptLogic = `
        const themeSelector = document.getElementById('theme-selector');
        themeSelector.value = localStorage.getItem('outflow_theme') || 'default';
        themeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('outflow_theme', newTheme);
            window.dispatchEvent(new Event('storage'));
        });
`;

content = content.replace('// Stay in sync if another tab clears or imports data', scriptLogic + '\n        // Stay in sync if another tab clears or imports data');

fs.writeFileSync('settings.html', content);
