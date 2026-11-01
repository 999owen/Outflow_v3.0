const fs = require('fs');
let content = fs.readFileSync('grocery.html', 'utf8');

// Replace hardcoded chart colors with computed CSS variables
content = content.replace(/legend: \{\s*labels: \{ color: '#8B949E' \}\s*\}/, `legend: {
                                labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() }
                            }`);

content = content.replace(/scales: \{\s*x: \{\s*ticks: \{ color: '#8B949E' \},\s*grid: \{ color: '#2D333B', drawBorder: false \}\s*\},\s*y: \{\s*ticks: \{ color: '#8B949E' \},\s*grid: \{ color: '#2D333B', drawBorder: false \},\s*beginAtZero: true\s*\}\s*\}/, `scales: {
                            x: {
                                ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() },
                                grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim(), drawBorder: false }
                            },
                            y: {
                                ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() },
                                grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim(), drawBorder: false },
                                beginAtZero: true
                            }
                        }`);

fs.writeFileSync('grocery.html', content);
