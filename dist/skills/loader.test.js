"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const loader_1 = require("./loader");
(0, node_test_1.default)('skill loader - parse skill markdown', () => {
    const md = `---
name: my-test-skill
description: A mock skill for testing parser.
---

Rules:
1. First test rule.
2. Second test rule.
- Third bullet point rule.
`;
    const skill = (0, loader_1.parseSkillContent)(md);
    node_assert_1.default.strictEqual(skill.name, 'my-test-skill');
    node_assert_1.default.strictEqual(skill.description, 'A mock skill for testing parser.');
    node_assert_1.default.strictEqual(skill.rules.length, 3);
    node_assert_1.default.strictEqual(skill.rules[0], 'First test rule.');
    node_assert_1.default.strictEqual(skill.rules[1], 'Second test rule.');
    node_assert_1.default.strictEqual(skill.rules[2], 'Third bullet point rule.');
});
