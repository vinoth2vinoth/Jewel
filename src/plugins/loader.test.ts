import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadPlugins, loadPluginsByType } from './loader';

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-plugin-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('plugin loader - returns empty when no plugins dir', () => {
  withTempDir(dir => {
    assert.deepStrictEqual(loadPlugins(dir), []);
  });
});

test('plugin loader - loads valid verifier manifest', () => {
  withTempDir(dir => {
    const pluginDir = path.join(dir, '.jewel', 'plugins', 'echo-verifier');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      name: 'echo-verifier',
      version: '1.0.0',
      type: 'verifier',
      command: 'node -e "console.log(JSON.stringify({status:\'PASS\',findings:[]}))"'
    }), 'utf8');

    const plugins = loadPlugins(dir);
    assert.strictEqual(plugins.length, 1);
    assert.strictEqual(plugins[0].name, 'echo-verifier');
    assert.strictEqual(plugins[0].type, 'verifier');
  });
});

test('plugin loader - filters by type', () => {
  withTempDir(dir => {
    const base = path.join(dir, '.jewel', 'plugins');
    for (const spec of [
      { dir: 'v1', type: 'verifier' },
      { dir: 'c1', type: 'critic' }
    ]) {
      const pluginDir = path.join(base, spec.dir);
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
        name: spec.dir,
        version: '1.0.0',
        type: spec.type,
        command: 'node -e "process.exit(0)"'
      }), 'utf8');
    }

    assert.strictEqual(loadPluginsByType(dir, 'critic').length, 1);
    assert.strictEqual(loadPluginsByType(dir, 'verifier').length, 1);
  });
});

test('plugin loader - skips invalid manifest', () => {
  withTempDir(dir => {
    const pluginDir = path.join(dir, '.jewel', 'plugins', 'bad');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ name: 'bad' }), 'utf8');
    assert.deepStrictEqual(loadPlugins(dir), []);
  });
});
