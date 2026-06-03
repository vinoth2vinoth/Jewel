import * as fs from 'fs';
import * as path from 'path';

export interface Skill {
  name: string;
  description: string;
  rules: string[];
  rawContent: string;
}

export function loadSkills(cwd: string = process.cwd()): Skill[] {
  const skillsDir = path.join(cwd, '.jewel', 'skills');
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const skills: Skill[] = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        try {
          const content = fs.readFileSync(skillFile, 'utf8');
          const skill = parseSkillContent(content);
          skills.push(skill);
        } catch {
          // Skip malformed skill files
        }
      }
    }
  }

  return skills;
}

export function parseSkillContent(content: string): Skill {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let name = '';
  let description = '';
  let rules: string[] = [];

  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx).trim();
        const val = line.substring(colonIdx + 1).trim();
        if (key === 'name') {
          name = val;
        } else if (key === 'description') {
          description = val;
        }
      }
    }
  }

  // Parse rules (typically lines starting with numbers or list markers after the frontmatter)
  const remainingContent = frontmatterMatch ? content.substring(frontmatterMatch[0].length) : content;
  const lines = remainingContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
      rules.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
    }
  }

  return {
    name: name || 'unnamed',
    description: description || '',
    rules,
    rawContent: content
  };
}
