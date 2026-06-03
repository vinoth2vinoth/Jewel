const { execSync } = require('child_process');

try {
  // Redirect stderr to stdout using 2>&1
  const output = execSync('npm pack --dry-run 2>&1', { encoding: 'utf8' });
  const lines = output.split('\n');
  let isListing = false;
  const packFilesList = [];
  for (const line of lines) {
    if (line.includes('Tarball Contents')) {
      isListing = true;
      continue;
    }
    if (line.includes('Tarball Details')) {
      isListing = false;
      continue;
    }
    if (isListing && line.trim() !== '') {
      const match = line.match(/npm\s+notice\s+(?:\d+(?:\.\d+)?[a-zA-Z]+\s+)?(.*)/);
      if (match) {
        const filename = match[1].trim();
        if (filename) {
          packFilesList.push(filename);
        }
      }
    }
  }

  console.log('Total files parsed:', packFilesList.length);
  console.log('Files:');
  console.log(JSON.stringify(packFilesList, null, 2));

  const hasWindowsSmoke = packFilesList.some(f => f.includes('docs/windows-smoke-test.md'));
  const hasRealProvider = packFilesList.some(f => f.includes('docs/real-provider-dogfood.md'));
  console.log('hasWindowsSmoke:', hasWindowsSmoke);
  console.log('hasRealProvider:', hasRealProvider);
} catch (err) {
  console.error(err);
}
