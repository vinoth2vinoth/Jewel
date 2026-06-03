---
name: verification-first
description: Use before declaring work complete.
---

Rules:
1. Run configured verification commands.
2. Capture real stdout and stderr.
3. Report pass or fail honestly.
4. Never claim success if a command failed.
5. If a command is missing, report it as skipped, not passed.
6. Produce a final verification summary.
