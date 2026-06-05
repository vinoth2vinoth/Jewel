"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Import all unit tests to enable centralized execution in environments
// where the test runner resolves directory arguments as CommonJS modules.
require("./core/config.test");
require("./core/session.test");
require("./safety/policy.test");
require("./safety/path-policy.test");
require("./safety/safe-patch-writer.test");
require("./safety/diff-guard.test");
require("./safety/critic.test");
require("./storage/git.test");
require("./verification/runner.test");
require("./agents/adapter.test");
require("./skills/loader.test");
require("./cli/commands/doctor.test");
require("./cli/commands/audit.test");
require("./cli/commands/diff.test");
require("./cli/commands/rollback.test");
require("./agents/prompt-builder.test");
require("./agents/json-response.test");
require("./agents/provider-factory.test");
require("./agents/providers/openai-adapter.test");
require("./safety/secret-redactor.test");
require("./cli/commands/run.test");
