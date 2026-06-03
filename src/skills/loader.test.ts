import test from 'node:test';
import assert from 'node:assert';
import { parseSkillContent } from './loader';

test('skill loader - parse skill markdown', () => {
  const md = `---
name: my-test-skill
description: A mock skill for testing parser.
---

Rules:
1. First test rule.
2. Second test rule.
- Third bullet point rule.
`;

  const skill = parseSkillContent(md);
  assert.strictEqual(skill.name, 'my-test-skill');
  assert.strictEqual(skill.description, 'A mock skill for testing parser.');
  assert.strictEqual(skill.rules.length, 3);
  assert.strictEqual(skill.rules[0], 'First test rule.');
  assert.strictEqual(skill.rules[1], 'Second test rule.');
  assert.strictEqual(skill.rules[2], 'Third bullet point rule.');
});
