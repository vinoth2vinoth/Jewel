import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONFIG_CONTENT, AGENTS_MD_CONTENT, DEFAULT_SKILLS } from '../../core/templates';

export function runInit(cwd: string = process.cwd()): void {
  console.log('Initializing Jewel in', cwd);

  const stats = {
    created: [] as string[],
    skipped: [] as string[],
    backedUp: [] as string[]
  };

  // 1. jewel.config.json
  const configPath = path.join(cwd, 'jewel.config.json');
  if (fs.existsSync(configPath)) {
    // If it exists, skip
    stats.skipped.push('jewel.config.json (already exists)');
  } else {
    fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, 'utf8');
    stats.created.push('jewel.config.json');
  }

  // 2. AGENTS.md
  const agentsMdPath = path.join(cwd, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    stats.skipped.push('AGENTS.md (already exists)');
  } else {
    fs.writeFileSync(agentsMdPath, AGENTS_MD_CONTENT, 'utf8');
    stats.created.push('AGENTS.md');
  }

  // 3. Create .jewel structure
  const dotJewelDir = path.join(cwd, '.jewel');
  const folders = [
    '',
    'skills',
    'reports',
    'sessions'
  ];

  for (const f of folders) {
    const dir = path.join(dotJewelDir, f);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      if (f) stats.created.push(`.jewel/${f} directory`);
    } else {
      if (f) stats.skipped.push(`.jewel/${f} directory (already exists)`);
    }
  }

  // 4. Create default skills
  const skillsDir = path.join(dotJewelDir, 'skills');
  for (const skill of DEFAULT_SKILLS) {
    const skillFolder = path.join(skillsDir, skill.folder);
    const skillFilePath = path.join(skillFolder, 'SKILL.md');

    if (!fs.existsSync(skillFolder)) {
      fs.mkdirSync(skillFolder, { recursive: true });
    }

    if (fs.existsSync(skillFilePath)) {
      stats.skipped.push(`.jewel/skills/${skill.folder}/SKILL.md (already exists)`);
    } else {
      fs.writeFileSync(skillFilePath, skill.content, 'utf8');
      stats.created.push(`.jewel/skills/${skill.folder}/SKILL.md`);
    }
  }

  // Print results
  console.log('\n--- Initialization Report ---');
  if (stats.created.length > 0) {
    console.log('\nCreated:');
    stats.created.forEach(item => console.log(`  [+] ${item}`));
  }
  if (stats.skipped.length > 0) {
    console.log('\nSkipped:');
    stats.skipped.forEach(item => console.log(`  [-] ${item}`));
  }
  if (stats.backedUp.length > 0) {
    console.log('\nBacked Up:');
    stats.backedUp.forEach(item => console.log(`  [~] ${item}`));
  }
  console.log('\nJewel initialized successfully.');
}
