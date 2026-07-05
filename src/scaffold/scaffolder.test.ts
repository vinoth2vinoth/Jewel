import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { BLUEPRINTS, getBlueprint, matchBlueprint } from './blueprints';
import { scaffoldProject, buildJewelConfigForBlueprint } from './scaffolder';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-scaffold-'));
}

test('blueprints - registry has three blueprints with files and milestones', () => {
  assert.strictEqual(BLUEPRINTS.length, 3);
  for (const bp of BLUEPRINTS) {
    assert.ok(bp.files.length > 0, `${bp.id} has files`);
    assert.ok(bp.milestones.length > 0, `${bp.id} has milestones`);
    assert.strictEqual(bp.commands.test, 'npm test');
  }
  assert.ok(getBlueprint('node-api'));
  assert.strictEqual(getBlueprint('unknown'), null);
});

test('blueprints - matchBlueprint picks by plain-language keywords', () => {
  assert.strictEqual(matchBlueprint('a portfolio website for my art').id, 'static-site');
  assert.strictEqual(matchBlueprint('a REST API backend for orders').id, 'node-api');
  assert.strictEqual(matchBlueprint('a todo web app with frontend and backend').id, 'fullstack');
  // Unknown descriptions default to fullstack
  assert.strictEqual(matchBlueprint('xyzzy').id, 'fullstack');
});

test('scaffolder - creates project files, config, and blueprint marker', () => {
  const dir = tempDir();
  try {
    const bp = getBlueprint('node-api')!;
    const result = scaffoldProject(bp, { projectName: 'My API!', targetDir: dir, gitInit: false });

    assert.ok(result.projectDir.endsWith('my-api'), 'project name is sanitized');
    assert.ok(fs.existsSync(path.join(result.projectDir, 'src', 'server.js')));
    assert.ok(fs.existsSync(path.join(result.projectDir, 'tests', 'server.test.js')));
    assert.ok(fs.existsSync(path.join(result.projectDir, '.jewel', 'blueprint.json')));

    const config = JSON.parse(fs.readFileSync(path.join(result.projectDir, 'jewel.config.json'), 'utf8'));
    assert.strictEqual(config.projectName, 'my-api');
    assert.strictEqual(config.commands.test, 'npm test');
    assert.strictEqual(config.mode, 'strict');

    const marker = JSON.parse(fs.readFileSync(path.join(result.projectDir, '.jewel', 'blueprint.json'), 'utf8'));
    assert.strictEqual(marker.blueprintId, 'node-api');

    const pkg = JSON.parse(fs.readFileSync(path.join(result.projectDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.name, 'my-api');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffolder - refuses to overwrite a non-empty directory', () => {
  const dir = tempDir();
  try {
    const target = path.join(dir, 'busy');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'keep.txt'), 'data');
    const bp = getBlueprint('static-site')!;
    assert.throws(() => {
      scaffoldProject(bp, { projectName: 'busy', targetDir: dir, gitInit: false });
    }, /already exists/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffolder - deepseek provider is written into config', () => {
  const bp = getBlueprint('static-site')!;
  const json = buildJewelConfigForBlueprint(bp, 'demo', 'deepseek', 'deepseek-v4-flash');
  const config = JSON.parse(json);
  assert.strictEqual(config.provider, 'deepseek');
  assert.strictEqual(config.model, 'deepseek-v4-flash');
});

test('scaffolder - scaffolded blueprints pass their own starter tests', () => {
  const dir = tempDir();
  try {
    for (const bp of BLUEPRINTS) {
      const result = scaffoldProject(bp, { projectName: `check-${bp.id}`, targetDir: dir, gitInit: false });
      execSync('node --test tests/', { cwd: result.projectDir, stdio: 'pipe', timeout: 60_000 });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
