const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/db/client.test.ts', 'utf8');

// Fix duplicate workspacePath
content = content.replace(/workspacePath: '[^']+',\s*workspacePath: '[^']+',/g, "workspacePath: '/tmp/claude-sessions/sess_test123/test',");

// Add workspacePath where missing (for /path1)
content = content.replace(
  /rootDirectory: '\/path1',\s*branchName:/g,
  "rootDirectory: '/path1',\n        workspacePath: '/tmp/claude-sessions/sess_1/path1',\n        branchName:"
);

// Add workspacePath where missing (for /path2)
content = content.replace(
  /rootDirectory: '\/path2',\s*branchName:/g,
  "rootDirectory: '/path2',\n        workspacePath: '/tmp/claude-sessions/sess_2/path2',\n        branchName:"
);

// Add workspacePath where missing (for /test/integration)
content = content.replace(
  /rootDirectory: '\/test\/integration',\s*branchName:/g,
  "rootDirectory: '/test/integration',\n        workspacePath: '/tmp/claude-sessions/sess_integration/integration',\n        branchName:"
);

// Write back
fs.writeFileSync('src/db/client.test.ts', content);
console.log('Fixed db/client.test.ts');
