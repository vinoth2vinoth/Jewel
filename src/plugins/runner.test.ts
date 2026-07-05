import test from 'node:test';
import assert from 'node:assert';
import { runPlugin } from './runner';
import { JewelPluginManifest } from './types';

const passPlugin: JewelPluginManifest = {
  name: 'pass-json',
  version: '1.0.0',
  type: 'verifier',
  command: process.platform === 'win32'
    ? 'node -e "console.log(JSON.stringify({status:\'PASS\',findings:[\'ok\']}))"'
    : "node -e \"console.log(JSON.stringify({status:'PASS',findings:['ok']}))\""
};

const warnPlugin: JewelPluginManifest = {
  name: 'warn-json',
  version: '1.0.0',
  type: 'critic',
  command: process.platform === 'win32'
    ? 'node -e "console.log(JSON.stringify({status:\'WARN\',findings:[\'check this\']}))"'
    : "node -e \"console.log(JSON.stringify({status:'WARN',findings:['check this']}))\""
};

test('plugin runner - parses PASS JSON output', () => {
  const result = runPlugin(passPlugin, { cwd: process.cwd() });
  assert.strictEqual(result.status, 'PASS');
  assert.ok(result.findings.includes('ok'));
});

test('plugin runner - parses WARN JSON output', () => {
  const result = runPlugin(warnPlugin, { cwd: process.cwd() });
  assert.strictEqual(result.status, 'WARN');
  assert.ok(result.findings.some(f => f.includes('check this')));
});

test('plugin runner - returns WARN on invalid JSON', () => {
  const plugin: JewelPluginManifest = {
    name: 'bad',
    version: '1.0.0',
    type: 'verifier',
    command: process.platform === 'win32'
      ? 'node -e "console.log(\'not json\')"'
      : "node -e \"console.log('not json')\""
  };
  const result = runPlugin(plugin, { cwd: process.cwd() });
  assert.strictEqual(result.status, 'WARN');
  assert.ok(result.findings.some(f => f.includes('non-JSON')));
});
