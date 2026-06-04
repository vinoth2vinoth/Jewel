# Jewel Architecture

**Version**: 0.1 (Draft)
**Last Updated**: 2026-06-04

This document describes the high-level architecture and design decisions of Jewel.

## Goals

- Keep the core safety logic isolated and auditable
- Maintain a clear separation between CLI interface and safety engine
- Support extensibility without increasing complexity
- Enable strong dogfooding capabilities

## High-Level Architecture

```
User
  |
  v
CLI (src/cli)
  |
  +--> Commands (init, run, verify, rollback, doctor...)
  |
  v
Core Layer (src/core)
  |
  +--> Config
  +--> Session Management
  +--> Templates
  |
  v
Safety Layer (src/safety)  <-- Most critical
  |
  +--> Policy Engine
  +--> Path Policy
  +--> Diff Guard
  +--> Safe Patch Writer (with rollback)
  +--> Secret Redactor
  +--> Critic
  |
  v
Verification Layer (src/verification)
  |
  +--> Runner (lint, typecheck, test, build...)
  |
  v
Storage & State
```

## Core Modules

### 1. CLI Layer (`src/cli`)
- Responsible for argument parsing and command dispatching
- Thin layer that delegates to domain logic
- Currently contains many command implementations under `commands/`

### 2. Core Layer (`src/core`)
- Manages configuration loading
- Handles session lifecycle and state
- Provides shared utilities and templates

### 3. Safety Layer (`src/safety`) — **Heart of Jewel**
This is the most important and mature module. It includes:

- **Policy** (`policy.ts`): Core rules and configuration enforcement
- **Path Policy** (`path-policy.ts`): Prevents path traversal and out-of-scope edits
- **Diff Guard** (`diff-guard.ts`): Validates proposed changes
- **Safe Patch Writer** (`safe-patch-writer.ts`): Transactional file writing with rollback support
- **Secret Redactor** (`secret-redactor.ts`): Removes sensitive data from logs/reports
- **Critic** (`critic.ts`): Reviews proposed changes against safety rules

### 4. Verification Layer (`src/verification`)
- Runs configured verification commands (lint, typecheck, tests, etc.)
- Currently implemented via `runner.ts`

### 5. Other Modules
- `agents/`: LLM provider adapters
- `skills/`: Extensible capabilities (early stage)
- `storage/`: Session and report storage

## Key Design Decisions

### Safety by Default
Jewel prioritizes safety over convenience. Many features (human review, strict scope, verification) are enabled by default.

### Transactional Safety
All file modifications should go through the `safe-patch-writer` to ensure atomicity and rollback capability.

### Human-in-the-Loop
Even when using real LLM providers, Jewel keeps a human review gate unless explicitly disabled.

### Dogfooding
The architecture should support Jewel being used on its own codebase effectively.

## Current State & Known Limitations

- The `run` command is currently quite large and should be refactored
- Some modules have inconsistent interfaces
- The skills and agents layers are still early
- Better dependency management would improve maintainability

## Future Directions

- Introduce a service container / dependency injection
- Design a plugin system for custom rules and verifiers
- Improve observability and structured logging
- Consider a web UI for session management (long term)

---

*This document will be updated as the architecture evolves.*