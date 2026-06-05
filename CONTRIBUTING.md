# Contributing to Jewel

We welcome community contributions! To ensure that modifications to Jewel maintain its rigorous safety-first focus, please follow these guidelines.

---

## 🚀 Getting Started

1. **Fork and Clone**: Fork this repository and clone it locally.
2. **Install Dependencies**: Run `npm install` to load dev-dependencies.
3. **Build the Project**: Run `npm run build` to compile the TypeScript compiler code.
4. **Run Unit Tests**: Run `npm test` to verify everything works correctly.
5. **Verify Fixtures**: Run `npm run verify:dogfood-fixture` to confirm the built-in dogfooding verification checks execute.

---

## 🛡️ Coding Standards & Principles

Jewel enforces Andrej Karpathy's software engineering principles inside its own codebase:
1. **Surgical Changes Only**: Do not refactor unrelated files in a pull request. Keep PRs focused on a single feature or bug fix.
2. **Zero Unnecessary External Dependencies**: Avoid adding npm dependencies unless approved by maintainers. Prefer standard Node.js built-ins.
3. **Strict Path Protection**: All files written by the CLI must be checked for path escape boundaries. Keep `safe-patch-writer.ts` protected.
4. **Secret Leak Audits**: Never commit unredacted credentials, private keys, or API tokens.

---

## 🤝 Pull Request Process

1. **Write Unit Tests**: Every feature or logic alteration must be covered by unit tests in `src/**/*.test.ts`.
2. **Ensure Verification Passing**: Both `npm test` and `npm run build` must compile and pass with 0 failures before a PR will be reviewed.
3. **Run Release Audit**: Before packaging or releasing, run:
   ```bash
   node dist/cli/index.js release-check
   ```
   This command must return 0 failures and 0 warnings.
4. **Developer Certificate of Origin (DCO)**: Sign off on all commits (`git commit -s`) to certify that you wrote the code or have the rights to submit it under the MIT License.
