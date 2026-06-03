# Jewel Release Checklist

Use this checklist to verify build, tests, packaging, CLI commands, and dogfooding end-to-end before tagging and publishing a new Jewel release.

## 1. Local Code Build & Tests
Verify compilation and run the full test suite recursively:
- [ ] Run `npm run build` (Must pass with 0 errors)
- [ ] Run `npm test` (Must pass 100%, executing all 74+ compiled tests in `dist/**/*.test.js`)

## 2. CLI Execution & Version Check
Check basic CLI entry point and commands:
- [ ] Run `node dist/cli/index.js --help` (Prints usage help menu, options, and commands)
- [ ] Run `node dist/cli/index.js version` (Prints package version, Node version, platform, config lookup path)

## 3. Package Assembly Check
Perform a dry-run assembly check:
- [ ] Run `npm pack --dry-run`
- [ ] Verify package version shows correct release tag (e.g. `jewel-cli@0.4.0`)
- [ ] Verify `./bin/jewel.js` and compiled `dist/` files are included in the package contents
- [ ] Verify test files (e.g., `*.test.js`) are excluded from the files listing

## 4. Local Global Installation & Command Check
Verify global executable linkage:
- [ ] Run `npm pack` (Produces tarball `jewel-cli-*.tgz`)
- [ ] Run `npm install -g ./jewel-cli-*.tgz`
- [ ] Run `jewel --help` (Verifies global executable responds successfully)
- [ ] Run `jewel version`
- [ ] Run `npm uninstall -g jewel-cli` (Cleans up environment)

## 5. Dogfood Broken Project Flow
Ensure Jewel safely heals an example repository:
- [ ] Navigate to `examples/dogfood-broken-project`
- [ ] Clean previous build assets: `Remove-Item -Recurse -Force dist, .jewel -ErrorAction SilentlyContinue`
- [ ] Run `npm install`
- [ ] Run `npm test` (Must FAIL on math division test)
- [ ] Run the Jewel mock command:
  ```bash
  node ../../dist/cli/index.js run "fix the failing math test" --provider none --mock --files src/math.ts --yes
  ```
- [ ] Verify Jewel reports success: `[+] Success! Task verified and finalized.`
- [ ] Verify ONLY `src/math.ts` has been modified (no changes in `src/index.ts`)
- [ ] Run `npm test` again (Must PASS successfully)
- [ ] Inspect `.jewel/reports/latest-run.md` and `latest-run.json` to verify full run details (Jewel version, files changed, verify commands, diff guard, safe patch writer, etc.) are present and correct.
- [ ] Reset working tree clean before committing: `git restore src/math.ts` and clean up `dist` and `.jewel` folders.
