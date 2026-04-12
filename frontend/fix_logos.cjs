const fs = require('fs');
const path = require('path');

const files = [
    'src/components/GiveMoneyModal.jsx',
    'src/components/Sidebar.jsx'
];

function camelCase(str) {
    if (str === 'delete') return 'deleteImg';
    if (str === 'group') return 'groupIcon';
    if (str === 'request') return 'requestIcon';
    return str.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
}

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Find all unique logo names
    const regex = /src=["']\.\.\/\.\.\/logo\/([^.]+)\.png["']/g;
    let match;
    const importsNeeded = new Set();
    
    while ((match = regex.exec(content)) !== null) {
        let name = match[1];
        importsNeeded.add(name);
    }
    
    if (importsNeeded.size === 0) continue;
    
    // Add imports after the last import line
    let importStrs = [];
    for (const name of importsNeeded) {
        importStrs.push(`import ${camelCase(name)} from "../../logo/${name}.png";`);
    }
    
    const importBlock = importStrs.join('\n') + '\n';
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
            lastImportIdx = i;
        }
    }
    
    if (lastImportIdx !== -1) {
        lines.splice(lastImportIdx + 1, 0, importBlock);
    }
    
    content = lines.join('\n');
    
    // Replace all occurrences
    content = content.replace(/src=["']\.\.\/\.\.\/logo\/([^.]+)\.png["']/g, (match, name) => {
        return `src={${camelCase(name)}}`;
    });
    
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
}
