# Jewel Plugin Example

Copy this folder into your project's `.jewel/plugins/example-critic/`:

```bash
mkdir -p .jewel/plugins/example-critic
cp examples/plugin-example/* .jewel/plugins/example-critic/
```

Plugins declare a `plugin.json` manifest and a command that reads JSON context on stdin and prints JSON on stdout:

```json
{ "status": "PASS" | "WARN" | "BLOCK" | "FAIL", "findings": ["..."], "requiredActions": ["..."] }
```

Types:
- **verifier** — runs during `jewel verify` / task verification
- **critic** — runs during post-patch critic review
