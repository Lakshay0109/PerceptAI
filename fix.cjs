const fs = require('fs');
let c = fs.readFileSync('src/components/ChartExtractorTab.tsx', 'utf8');

// Replace \${ with ${
c = c.replace(/\\\$\\{/g, '${');

// replace actual newlines generated inside strings with \n if preceded by \n
c = c.replace(/\\n/g, '\\n');

fs.writeFileSync('src/components/ChartExtractorTab.tsx', c);
