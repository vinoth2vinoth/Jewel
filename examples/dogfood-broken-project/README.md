# Jewel CLI Dogfooding Demo Project

This is a minimal demonstration project designed to showcase how Jewel CLI secures coding edits, runs build/test verification steps, and manages rollback workflows.

## Initial State
This project contains a simple math library with a bug.
- `src/math.ts` has a division function that does not throw an error on division by zero.
- `src/math.test.ts` has a test asserting that division by zero throws `"Cannot divide by zero"`.

If you run the test suite now, it fails:
```bash
npm run build
npm test
# Result: FAIL (test "divide throws error on division by zero" fails)
```

## Running Jewel with Provider `none` (Mock Mode)
You can run Jewel using the mock adapter to automatically fix this issue:
```bash
# Execute Jewel run using the globally installed CLI and mock adapter
jewel run "fix the failing math test" --mock --files src/math.ts --yes
```

Jewel will:
1. Load config and skills.
2. Initialize a secure session.
3. Commit or checkpoint your current workspace state.
4. Run the Mock Agent to propose a patch.
5. Validate that the patch only touches `src/math.ts` (declared file scope).
6. Write the patch to `src/math.ts` safely.
7. Run the verification commands (`npm run build && npm run test`).
8. Finalize the run and output a pass report.

After Jewel completes, you can run the test suite again:
```bash
npm test
# Result: PASS
```

## Running Jewel with Real Providers
If you have configured API keys (e.g., `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`), you can run the real LLM models to fix the bug:
```bash
# Example using OpenAI (requires OPENAI_API_KEY environment variable)
jewel run "fix the division by zero bug in src/math.ts by throwing an error" --provider openai --files src/math.ts
```

This will run real prompt engineering planning, patch generation, and critic steps. If the proposed code fails tests or edits unauthorized files, Jewel will automatically roll back the changes to restore the working directory state.
