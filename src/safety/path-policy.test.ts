import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import {
  normalizeRepoPath,
  isPathInsideRoot,
  assertPathInsideRoot,
  matchesProtectedPattern,
  isProtectedPath,
  isDependencyPath,
  isLockfilePath,
  isAbsoluteOrEscapingPath
} from './path-policy';
import { DEFAULT_CONFIG } from '../core/config';

const dummyConfig = DEFAULT_CONFIG;

test('path-policy - matchesProtectedPattern patterns', () => {
  const patterns = dummyConfig.protectedFiles;

  // 1. src/auth/login.ts matches src/auth/**
  assert.ok(matchesProtectedPattern('src/auth/login.ts', patterns));

  // 2. src/auth/nested/session.ts matches src/auth/**
  assert.ok(matchesProtectedPattern('src/auth/nested/session.ts', patterns));

  // 3. migrations/001_init.sql matches migrations/**
  assert.ok(matchesProtectedPattern('migrations/001_init.sql', patterns));

  // 4. migrations/nested/002.sql matches migrations/**
  assert.ok(matchesProtectedPattern('migrations/nested/002.sql', patterns));

  // 5. .env matches .env
  assert.ok(matchesProtectedPattern('.env', patterns));

  // 6. .env.local matches .env.*
  assert.ok(matchesProtectedPattern('.env.local', patterns));

  // 7. src/components/Button.tsx does not match protected patterns
  assert.ok(!matchesProtectedPattern('src/components/Button.tsx', patterns));
});

test('path-policy - Windows backslash paths normalize and match correctly', () => {
  const root = 'C:\\Project';
  
  // 8. Windows backslash paths normalize correctly
  const norm = normalizeRepoPath('src\\auth\\login.ts', root);
  assert.strictEqual(norm, 'src/auth/login.ts');

  // 9. Windows backslash paths match protected glob patterns correctly
  const isProt = matchesProtectedPattern(norm, dummyConfig.protectedFiles);
  assert.ok(isProt);
});

test('path-policy - boundary checks and escape detection', () => {
  const root = 'C:\\Project';

  // 10. Absolute paths are detected as escaping or absolute on all platforms
  assert.ok(isAbsoluteOrEscapingPath(root, 'C:\\Project\\outside.txt') === true); // absolute inside
  assert.ok(isAbsoluteOrEscapingPath(root, 'C:\\outside.txt') === true); // absolute outside
  assert.ok(isAbsoluteOrEscapingPath(root, 'C:/Users/test/outside.txt') === true); // absolute forward-slash Windows
  assert.ok(isAbsoluteOrEscapingPath(root, 'C:\\Users\\test\\outside.txt') === true); // absolute backslash Windows
  assert.ok(isAbsoluteOrEscapingPath(root, '\\\\server\\share\\file.txt') === true); // UNC Windows
  assert.ok(isAbsoluteOrEscapingPath(root, '//server/share/file.txt') === true); // UNC Windows forward-slash
  assert.ok(isAbsoluteOrEscapingPath(root, '/tmp/outside.txt') === true); // absolute Unix

  // 11. ../ path escape attempts are detected
  assert.ok(isAbsoluteOrEscapingPath(root, '../outside.txt') === true);
  assert.ok(isAbsoluteOrEscapingPath(root, 'src/../../outside.txt') === true);
  
  // Inside checks
  assert.ok(isPathInsideRoot(root, 'src/components/Button.tsx') === true);
  assert.ok(isPathInsideRoot(root, 'Button.tsx') === true);
  assert.ok(isPathInsideRoot(root, '../Project/Button.tsx') === true); // resolves inside C:\Project
  assert.ok(isPathInsideRoot(root, '../outside/Button.tsx') === false); // escapes root

  // Null byte paths are blocked
  assert.ok(isAbsoluteOrEscapingPath(root, 'some\0file.txt') === true);
  assert.ok(isPathInsideRoot(root, 'some\0file.txt') === false);

  assert.throws(() => {
    assertPathInsideRoot(root, '../outside.txt');
  }, /Path escape detected/);
});

test('path-policy - dependencies and lockfiles identification', () => {
  assert.ok(isDependencyPath('package.json') === true);
  assert.ok(isDependencyPath('src/package.json') === true);
  assert.ok(isDependencyPath('package-lock.json') === false);

  assert.ok(isLockfilePath('package-lock.json') === true);
  assert.ok(isLockfilePath('yarn.lock') === true);
  assert.ok(isLockfilePath('pnpm-lock.yaml') === true);
  assert.ok(isLockfilePath('bun.lockb') === true);
  assert.ok(isLockfilePath('package.json') === false);
});
