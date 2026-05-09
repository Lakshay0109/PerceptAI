const fs = require('fs');
const content = fs.readFileSync('src/components/ChartExtractorTab.tsx', 'utf8');
const fixed = content.split('\\\\`').join('\`');
fs.writeFileSync('src/components/ChartExtractorTab.tsx', fixed);
