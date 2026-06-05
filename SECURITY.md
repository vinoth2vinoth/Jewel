# Security Policy

## Reporting a Vulnerability

We take the security of Jewel seriously. Because Jewel is a security harness designed to protect developer environments from untrusted AI code generation, any bypasses in sandboxing, path validation, command execution guards, or secret redactions are treated with high severity.

**Do not open public GitHub issues for security vulnerabilities.**

Instead, please report security vulnerabilities privately by emailing the maintainers or project owners. We will investigate the issue and coordinate a patched release quickly.

---

## 🔒 Safety & Security Design Guardrails

If you are researching or contributing to Jewel's security codebase, keep the following rules in mind:
1. **Un-sandboxed Commands are Dangerous**: Running tasks without setting `useSandbox: true` executes scripts directly on the host shell. Ensure that user warnings are displayed clearly when sandboxing is disabled.
2. **Strict Sanitization**: Paths are checked for null bytes, drive letter escapes, traversal, absolute addresses, and UNC targets.
3. **Secret Redaction**: Always audit verification logs and output reports to ensure keys and PATs are replaced by `[REDACTED]` tokens.
