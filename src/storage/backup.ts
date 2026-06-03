import * as fs from 'fs';
import * as path from 'path';

export function backupDirectory(src: string, dest: string, ignoreList: string[] = ['.git', 'node_modules', '.jewel']): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (ignoreList.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      backupDirectory(srcPath, destPath, ignoreList);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function restoreDirectory(src: string, dest: string, ignoreList: string[] = ['.git', 'node_modules', '.jewel']): void {
  // First, safely remove existing files in dest that are not in the ignore list
  const entries = fs.readdirSync(dest, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) {
      continue;
    }
    const targetPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }

  // Copy files back from backup
  if (fs.existsSync(src)) {
    const backupEntries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of backupEntries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        backupDirectory(srcPath, destPath, ignoreList);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
