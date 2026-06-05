"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const path_policy_1 = require("./path-policy");
const config_1 = require("../core/config");
const dummyConfig = config_1.DEFAULT_CONFIG;
(0, node_test_1.default)('path-policy - matchesProtectedPattern patterns', () => {
    const patterns = dummyConfig.protectedFiles;
    // 1. src/auth/login.ts matches src/auth/**
    node_assert_1.default.ok((0, path_policy_1.matchesProtectedPattern)('src/auth/login.ts', patterns));
    // 2. src/auth/nested/session.ts matches src/auth/**
    node_assert_1.default.ok((0, path_policy_1.matchesProtectedPattern)('src/auth/nested/session.ts', patterns));
    // 3. migrations/001_init.sql matches migrations/**
    node_assert_1.default.ok((0, path_policy_1.matchesProtectedPattern)('migrations/001_init.sql', patterns));
    // 4. migrations/nested/002.sql matches migrations/**
    node_assert_1.default.ok((0, path_policy_1.matchesProtectedPattern)('migrations/nested/002.sql', patterns));
    // 5. .env matches .env
    node_assert_1.default.ok((0, path_policy_1.matchesProtectedPattern)('.env', patterns));
    // 6. .env.local matches .env.*
    node_assert_1.default.ok((0, path_policy_1.matchesProtectedPattern)('.env.local', patterns));
    // 7. src/components/Button.tsx does not match protected patterns
    node_assert_1.default.ok(!(0, path_policy_1.matchesProtectedPattern)('src/components/Button.tsx', patterns));
});
(0, node_test_1.default)('path-policy - Windows backslash paths normalize and match correctly', () => {
    const root = 'C:\\Project';
    // 8. Windows backslash paths normalize correctly
    const norm = (0, path_policy_1.normalizeRepoPath)('src\\auth\\login.ts', root);
    node_assert_1.default.strictEqual(norm, 'src/auth/login.ts');
    // 9. Windows backslash paths match protected glob patterns correctly
    const isProt = (0, path_policy_1.matchesProtectedPattern)(norm, dummyConfig.protectedFiles);
    node_assert_1.default.ok(isProt);
});
(0, node_test_1.default)('path-policy - boundary checks and escape detection', () => {
    const root = 'C:\\Project';
    // 10. Absolute paths are detected as escaping or absolute on all platforms
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, 'C:\\Project\\outside.txt') === true); // absolute inside
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, 'C:\\outside.txt') === true); // absolute outside
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, 'C:/Users/test/outside.txt') === true); // absolute forward-slash Windows
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, 'C:\\Users\\test\\outside.txt') === true); // absolute backslash Windows
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, '\\\\server\\share\\file.txt') === true); // UNC Windows
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, '//server/share/file.txt') === true); // UNC Windows forward-slash
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, '/tmp/outside.txt') === true); // absolute Unix
    // 11. ../ path escape attempts are detected
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, '../outside.txt') === true);
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, 'src/../../outside.txt') === true);
    node_assert_1.default.ok((0, path_policy_1.isPathInsideRoot)(root, 'src/components/Button.tsx') === true);
    node_assert_1.default.ok((0, path_policy_1.isPathInsideRoot)(root, 'Button.tsx') === true);
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, '../Project/Button.tsx') === true);
    node_assert_1.default.ok((0, path_policy_1.isPathInsideRoot)(root, '../outside/Button.tsx') === false); // escapes root
    // isSafeRepoRelativePath checks
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('../Project/Button.tsx'), false);
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('src/../Button.tsx'), false);
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('src/components/Button.tsx'), true);
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('math.js'), true);
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('C:\\Users\\test\\outside.txt'), false);
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('\\\\server\\share\\file.txt'), false);
    node_assert_1.default.strictEqual((0, path_policy_1.isSafeRepoRelativePath)('some\0file.txt'), false);
    // Null byte paths are blocked
    node_assert_1.default.ok((0, path_policy_1.isAbsoluteOrEscapingPath)(root, 'some\0file.txt') === true);
    node_assert_1.default.ok((0, path_policy_1.isPathInsideRoot)(root, 'some\0file.txt') === false);
    node_assert_1.default.throws(() => {
        (0, path_policy_1.assertPathInsideRoot)(root, '../outside.txt');
    }, /Path escape detected/);
});
(0, node_test_1.default)('path-policy - dependencies and lockfiles identification', () => {
    node_assert_1.default.ok((0, path_policy_1.isDependencyPath)('package.json') === true);
    node_assert_1.default.ok((0, path_policy_1.isDependencyPath)('src/package.json') === true);
    node_assert_1.default.ok((0, path_policy_1.isDependencyPath)('package-lock.json') === false);
    node_assert_1.default.ok((0, path_policy_1.isLockfilePath)('package-lock.json') === true);
    node_assert_1.default.ok((0, path_policy_1.isLockfilePath)('yarn.lock') === true);
    node_assert_1.default.ok((0, path_policy_1.isLockfilePath)('pnpm-lock.yaml') === true);
    node_assert_1.default.ok((0, path_policy_1.isLockfilePath)('bun.lockb') === true);
    node_assert_1.default.ok((0, path_policy_1.isLockfilePath)('package.json') === false);
});
