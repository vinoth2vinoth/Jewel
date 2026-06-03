---
name: safe-shell
description: Use before running shell commands to avoid destructive or unsafe operations.
---

Rules:
1. Block destructive commands.
2. Block remote scripts piped into shell.
3. Block package installation unless approved.
4. Block git push unless approved.
5. Block commands that expose secrets.
6. Prefer read only commands first.
