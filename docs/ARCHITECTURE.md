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
jewel benchmark          # same harness via CLI
```

Results are written to `.jewel/benchmarks/latest.json` and `latest.md`.

### Plugin System (`src/plugins`) — Phase 4

Drop-in verifiers and critics via `.jewel/plugins/<name>/plugin.json`:
- **loader.ts** — discovers manifests
- **runner.ts** — executes plugin commands (JSON stdin/stdout)
- Hooks: verification runner + multi-agent critic review

Example: `examples/plugin-example/`

### MCP Server (`src/mcp`) — Phase 4

Stdio JSON-RPC server for Cursor / Claude Desktop:

```bash
jewel mcp
```

Tools: `jewel_verify`, `jewel_status`, `jewel_grep`, `jewel_read_file`, `jewel_run_preview`. See `docs/mcp-setup.md`.

### VS Code Extension — Phase 4+ (LSP + diff panel)

`extensions/jewel-vscode/` — Language Server client, session sidebar, diff preview webview, Problems panel diagnostics.

Start the language server standalone:

```bash
jewel lsp
```

Custom LSP requests: `jewel/listSessions`, `jewel/getSessionDiff`, `jewel/runVerify`.

## Current State

- 180+ unit/integration tests
- Interactive TUI (`jewel` with no args)
- Local Web UI dashboard (`--ui`)
- Auto file discovery when `--files` is omitted
- Targeted hunk edits in patch proposals
- Plugin system, MCP server, benchmark CLI

## Known Limitations

- `run.ts` orchestrator is still large (helpers extracted; further modularization planned)
- Exploration is keyword/heuristic based (no embedding index yet)
- VS Code extension requires `jewel lsp` on PATH (or `jewel.cliPath` setting)

## Roadmap

| Phase | Focus | Status |
|---|---|---|
| 0 | Foundation: benchmarks, run.ts split, docs sync | Done |
| 1 | Autonomous context: RepoExplorer, optional `--files`, hunk edits | Done |
| 2 | Multi-step tool loop with budget guards | Done |
| 3 | TUI polish, `jewel watch`, session resume | Done |
| 4 | Plugin system, MCP server, benchmark CLI, VS Code scaffold | Done |

## Phase 3 — Developer UX (shipped)

- **TUI**: `/history`, `/resume [session-id]` slash commands
- **CLI**: `jewel resume [session-id]`, `jewel watch [--interval ms] [--debounce ms] [--once]`
- **Web UI**: Repo exploration timeline step, live exploration log panel, retry hint placeholder
- **Session history**: `src/core/session-history.ts` reads `.jewel/sessions/` for resume

## Phase 4 — Ecosystem & Proof (shipped)

- **Plugins**: `.jewel/plugins/<name>/plugin.json` — verifier and critic hooks
- **MCP**: `jewel mcp` stdio server — see `docs/mcp-setup.md`
- **Benchmark CLI**: `jewel benchmark [--mock|--live]` with JSON + Markdown reports
- **VS Code extension**: LSP client, session sidebar, diff preview webview
- **Example plugin**: `examples/plugin-example/`

## Phase 5 — Competitive UX (shipped)

- **`jewel continue [session-id] "feedback"`** — bounded follow-up with session lineage
- **`jewel ship [session-id]`** — branch, commit, PR body template under `.jewel/ship/`
- **`--plan-only`** / **`requirePlanApproval`** — plan preview gate before checkpoint
- **Semantic index** — local `.jewel/index/semantic.json` for file discovery (no API cost)
- **Fast path** — low-risk single-file tasks skip tool loop and reduce critic depth
- **VS Code**: plan preview panel, diff approve/reject review artifacts

---

*Updated as the architecture evolves.*
