# Jewel Architecture

**Version**: 0.9.2
**Last Updated**: 2026-07-05

Jewel is an autonomous AI coding agent operating inside a transactional safety harness. The architecture prioritizes auditable safety logic, verification proof, and incremental agent autonomy.

## Goals

- Keep the core safety logic isolated and auditable
- Maintain a clear separation between CLI interface and safety engine
- Support extensible exploration and agent loops without sacrificing guardrails
- Enable strong dogfooding and benchmark-driven improvement

## High-Level Architecture

```
User
  |
  v
CLI (src/cli)  ── TUI shell, Web UI dashboard
  |
  +--> Commands (init, run, verify, rollback, doctor, tui...)
  |
  v
Exploration Layer (src/exploration)  <-- NEW
  |
  +--> RepoExplorer (list, glob, grep, read)
  +--> ContextBuilder (auto file discovery, enriched summaries)
  |
  v
Core Layer (src/core)
  |
  +--> Config, Session, Templates, Retry Policy
  |
  v
Agents Layer (src/agents)
  |
  +--> Provider adapters (OpenAI, Gemini, Anthropic, OpenRouter)
  +--> Prompt builder, structured JSON schemas
  |
  v
Safety Layer (src/safety)  <-- Heart of Jewel
  |
  +--> Policy, Path Policy, Diff Guard
  +--> Safe Patch Writer (full-file + search/replace hunks, rollback)
  +--> Secret Redactor, Critics
  |
  v
Verification Layer (src/verification)
  |
  +--> Runner (lint, typecheck, test, build, sandbox)
  |
  v
Storage & State (src/storage, .jewel/)
```

## Core Modules

### CLI Layer (`src/cli`)
Argument parsing, command dispatch, TUI interactive shell, and SSE Web UI dashboard.

Extracted run orchestration helpers:
- `run-helpers.ts` — UI broadcast, prompts, repo context assembly
- `run-report.ts` — session report generation

### Exploration Layer (`src/exploration`)
Autonomous codebase context without external dependencies:
- **`repo-explorer.ts`**: listDir, glob, grep, readFile, discoverRelevantFiles
- **`context-builder.ts`**: resolveFilesForTask (makes `--files` optional), enriched repo summaries

### Agent Tool Loop (`src/agents/tool-loop.ts`) — Phase 2
Multi-step read-only exploration before planning:
- Tools: `list_dir`, `glob`, `grep`, `read_file` (via `src/agents/tools/registry.ts`)
- LLM-driven steps via `adapter.decideToolStep()` with heuristic fallback
- Session memory: `.jewel/sessions/<id>/exploration-log.json`
- Config: `agentToolLoopEnabled`, `agentToolLoopMaxSteps`, `agentToolLoopMaxContextChars`

### Safety Layer (`src/safety`)
Transactional patch application with path escape prevention, protected file policy, dependency guards, and atomic rollback. Supports both full-file rewrites and targeted `edits[]` hunks.

### Verification Layer (`src/verification`)
Runs configured verification commands on host or inside Docker sandboxes. Includes test-change policy (blocks tampering with existing tests).

## Agent Run Loop

```
Task → Resolve Files (user scope or auto-discovery)
     → Tool Loop (list_dir / grep / read_file, up to N steps)
     → Plan (LLM contract)
     → Checkpoint (Git)
     → Patch (full-file or hunk edits)
     → Human Review (optional)
     → Verify → Critic → Retry (with feedback)
     → Report
```

## Benchmarks

Curated tasks live in `benchmarks/manifest.json`. Run with:

```bash
npm run benchmark        # mock provider
npm run benchmark:live   # configured real provider
```

Results are written to `.jewel/benchmarks/latest.json`.

## Current State

- 170+ unit/integration tests
- Interactive TUI (`jewel` with no args)
- Local Web UI dashboard (`--ui`)
- Auto file discovery when `--files` is omitted
- Targeted hunk edits in patch proposals

## Known Limitations

- `run.ts` orchestrator is still large (helpers extracted; further modularization planned)
- Exploration is keyword/heuristic based (no embedding index yet)
- No IDE extension yet (Phase 3)
- Plugin/MCP ecosystem not yet shipped (Phase 4)

## Roadmap

| Phase | Focus |
|---|---|
| 0 | Foundation: benchmarks, run.ts split, docs sync |
| 1 | Autonomous context: RepoExplorer, optional `--files`, hunk edits |
| 2 | Multi-step tool loop with budget guards |
| 3 | IDE extension, TUI polish, `jewel watch` |
| 4 | Plugin system, MCP server mode, public benchmark results |

---

*Updated as the architecture evolves.*
