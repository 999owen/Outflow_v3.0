const fs = require('fs');
let content = fs.readFileSync('dashboard.html', 'utf8');

// Replace hardcoded chart colors with computed CSS variables
content = content.replace(/legend: \{\s*display: true,\s*labels: \{ color: '#8B949E', boxWidth: 12 \}\s*\}/, `legend: {
                            display: true,
                            labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim(), boxWidth: 12 }
                        }`);

content = content.replace(/tooltip: \{\s*backgroundColor: 'rgba\(16, 16, 16, 0.9\)',/g, `tooltip: {
                            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-tooltip-bg').trim(),`);

content = content.replace(/scales: \{\s*x: \{ display: true, grid: \{ display: false \}, ticks: \{ color: '#8B949E' \} \},\s*y: \{ display: true, grid: \{ color: '#2D333B' \}, ticks: \{ color: '#8B949E' \}, beginAtZero: true \}\s*\}/, `scales: {
                        x: { display: true, grid: { display: false }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() } },
                        y: { display: true, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() }, beginAtZero: true }
                    }`);

content = content.replace(/legend: \{\s*position: 'right',\s*labels: \{ color: '#E6EDF3', font: \{ size: 11 \}, padding: 10, boxWidth: 12 \}\s*\}/, `legend: {
                                position: 'right',
                                labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim(), font: { size: 11 }, padding: 10, boxWidth: 12 }
                            }`);

fs.writeFileSync('dashboard.html', content);
