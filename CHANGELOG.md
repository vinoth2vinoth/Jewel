# Changelog

All notable changes to the Jewel project will be documented in this file.

## [0.8.0] - 2026-06-05

This release introduces major safety hardening features, budget protections, interactive loops, and version updates to `0.8.0`.

### Added
- **Phase 1: Test Coverage Guard**: Ensures AI modifications do not decrease test coverage or fall below a specified coverage floor (configured via `minCoverage` and `coverageReportPath`).
- **Phase 2: Runtime Process Auditing**: Hardens the verification runner by auditing child process executions during tests, blocking unapproved binaries (`curl`, `wget`, `ssh`) and unrequested network/file access.
- **Phase 3: Interactive Override & Debug Loop**: Provides developer prompts on verification checks failures, permitting Custom Hints `[r]`, Hard Overrides `[o]`, or Aborting `[a]`.
- **Phase 4: Session Cost & Budget Guard**: Automatically tracks LLM token usage and pricing per provider, terminating execution with `BUDGET_EXCEEDED` if cumulative cost exceeds `maxSessionCost`.
- Dedicated **Plan Auditor** sub-agent integration for Spec-Driven Development (SDD) compliance.

---

## [0.7.2] - 2026-06-05

### Added
- Real Provider validation features for Google Gemini and OpenRouter.
- Recursive JSON Schema cleaning to support strict structured output schemas for Google Gemini API compatibility.

---

## [0.7.1] - 2026-06-05

### Added
- Initial support and validation guides for Gemini and OpenRouter integration.

---

## [0.7.0] - 2026-06-03

### Added
- Release checklist readiness commands (`jewel release-check`).
- Git-based transaction checkpointing and rollback capabilities.
- Report redaction audit to automatically strip credentials and API keys from run output logs.
- Initial dogfood project test-fixture sandbox for broken project validation.

---

## [0.5.0] - 2026-06-03

### Added
- Initial release hardening and dogfooding validation guides.

---

## [0.2.0] - 2026-06-03

### Added
- Safety hardening features (Diff Guard boundaries, path traversal prevention, file-write protections).

---

## [0.1.0] - 2026-06-03

### Added
- Initial project structure, config loader, and base LLM provider adapters.
- Basic CLI entry points (`init`, `run`, `status`, `version`).
