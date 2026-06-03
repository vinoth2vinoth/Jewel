const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getTestFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTestFiles(fullPath));
    } else if (file.endsWith('.test.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Please run npm run build first.');
  process.exit(1);
}

const testFiles = getTestFiles(distDir);
if (testFiles.length === 0) {
  console.log('No test files found in dist.');
  process.exit(0);
}

console.log(`Found ${testFiles.length} test files to execute.`);

const result = spawnSync('node', ['--test', ...testFiles], { stdio: 'inherit' });

process.exit(result.status === null ? 1 : result.status);
