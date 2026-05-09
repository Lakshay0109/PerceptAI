const fs = require('fs');
let c = fs.readFileSync('src/components/ChartExtractorTab.tsx', 'utf8');
c = c.replace(/\\\$\\{/g, '${');
fs.writeFileSync('src/components/ChartExtractorTab.tsx', c);
