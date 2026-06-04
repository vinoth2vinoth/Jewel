# Jewel Safety Policy

**Version**: 0.1 (Draft)
**Last Updated**: 2026-06-04

Jewel is a **strict, verification-first safety harness** for AI coding agents. Its purpose is not to maximize the amount of code an AI can write, but to ensure that AI-assisted coding remains **safe, disciplined, and controllable**.

This document defines the non-negotiable safety principles that Jewel enforces.

## Core Safety Principles

Jewel is built around these foundational principles (inspired by disciplined engineering practices):

1. **Think Before Coding**  
   AI agents must produce a clear plan before making any code changes.

2. **Surgical Changes Only**  
   Modifications must be minimal and directly related to the declared task.

3. **Strict Scope Enforcement**  
   AI agents can only modify files explicitly declared in the task contract.

4. **Verification Before Success**  
   No task is considered complete until all relevant verification steps (lint, typecheck, tests, etc.) pass.

5. **Human Oversight by Default**  
   Proposed changes must be reviewed by a human via diff preview before being applied (unless explicitly bypassed).

6. **Safe Patching with Rollback**  
   All file modifications go through a transactional safe-patch-writer that supports rollback on failure.

7. **Secret & Credential Protection**  
   Jewel automatically redacts sensitive information and blocks dangerous operations that could leak credentials.

8. **Never Fake Success**  
   Agents must not claim completion if verification fails or if changes are incomplete.

9. **Transparency & Auditability**  
   Every session produces clear reports, including plans, diffs, verification results, and token usage.

10. **Dogfooding First**  
    Jewel should be capable of being used on itself to continuously improve its own safety mechanisms.

## What Jewel Protects Against

- Unauthorized file modifications outside task scope
- Path traversal and escape attacks
- Accidental or malicious deletion of important files
- Leakage of secrets, API keys, or credentials in prompts or reports
- Uncontrolled broad refactors
- False claims of success without verification
- Dangerous shell commands

## Human Responsibilities

While Jewel provides strong guardrails, ultimate responsibility remains with the human user:

- Review diffs carefully before approval
- Ensure task descriptions are clear and scoped
- Do not bypass safety mechanisms without understanding the risks
- Regularly audit protected files and configuration

## Configuration Defaults (Strict Mode)

Jewel ships with conservative defaults:

- `maxFilesChanged`: 8
- `maxLinesChanged`: 500
- `requirePlanBeforeEdit`: true
- `requireVerificationBeforeDone`: true
- `allowProtectedFileChanges`: false
- `dangerousCommandPolicy`: "block"

These defaults can be adjusted in `jewel.config.json`, but loosening them should be done consciously.

## Scope of the Harness

Jewel focuses on the **safety and verification layer**. It does **not** aim to be:

- A full autonomous multi-agent coding system
- A replacement for human code review
- A guarantee of logical correctness (only mechanical verification)

## Enforcement

These policies are enforced through a combination of:

- Path and scope policies
- Diff guards
- Safe patch writer with transactional rollback
- Verification runner
- Human review gate
- Secret redaction

Any attempt to bypass these mechanisms without explicit configuration is considered a violation of Jewel’s safety contract.

---

*This policy is a living document and will evolve as Jewel matures.*