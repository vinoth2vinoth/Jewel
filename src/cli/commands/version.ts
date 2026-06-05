import * as fs from 'fs';
import * as path from 'path';

export function runVersion(cwd: string = process.cwd()): void {
  let pkgVersion = '0.5.0-dev';
  try {
    const pkgPath = path.join(__dirname, '../../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgVersion = pkg.version || pkgVersion;
    } else {
      // Try adjacent path if running in dev typescript directly
      const devPkgPath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(devPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(devPkgPath, 'utf8'));
        pkgVersion = pkg.version || pkgVersion;
      }
    }
  } catch {}

  console.log(`Jewel version: ${pkgVersion}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform} (${process.arch})`);
  console.log(`Default configuration: Looks for jewel.config.json in the current working directory, falling back to built-in defaults.`);

  let activeConfigText = 'Active configuration: none (using defaults)';
  try {
    const configPath = path.join(cwd, 'jewel.config.json');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      const projectName = config && typeof config.projectName === 'string' ? config.projectName : '';
      activeConfigText = `Active configuration: found (project: "${projectName}")`;
    }
  } catch {}
  console.log(activeConfigText);
}
