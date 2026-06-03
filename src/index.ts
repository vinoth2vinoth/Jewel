// Import all unit tests to enable centralized execution in environments
// where the test runner resolves directory arguments as CommonJS modules.
import './core/config.test';
import './core/session.test';
import './safety/policy.test';
import './safety/path-policy.test';
import './safety/safe-patch-writer.test';
import './safety/diff-guard.test';
import './safety/critic.test';
import './storage/git.test';
import './verification/runner.test';
import './agents/adapter.test';
import './skills/loader.test';
import './cli/commands/doctor.test';
import './cli/commands/audit.test';
import './cli/commands/diff.test';
import './cli/commands/rollback.test';
