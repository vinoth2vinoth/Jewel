# Windows PowerShell Smoke Test Guide

This guide describes how to verify the installation, initialization, diagnostics, and dogfood tests of Jewel on Windows using PowerShell.

## 1. Prerequisites Checks
Verify that the required dependencies are installed and available on your environment's PATH:

```powershell
# 1. Verify Node.js version (Node >= 18 is required)
node --version

# 2. Verify npm version
npm --version

# 3. Verify Git version
git --version
```

## 2. Local Packaging & Development Installation
To verify local code modifications during developer smoke tests, build and package the repository locally:

> [!NOTE]
> For standard end-users who are not developing Jewel, they simply install the official released package from the NPM registry directly via:
> ```powershell
> npm install -g jewel-cli
> ```

```powershell
# 1. Navigate to the Jewel project root
Set-Location "C:\Users\vinot\Documents\IM\Active Projects\Project Jewel"

# 2. Build the project
npm run build

# 3. Pack into a local tarball
npm pack

# 4. Install the package globally from the local tarball
npm install -g (Get-Item ./jewel-cli-*.tgz).FullName
```

## 3. Verify Global CLI Installation
Confirm that the `jewel` executable is on your environment path and executes correctly:

```powershell
# 1. Verify CLI help output
jewel --help

# 2. Verify CLI version information
jewel version
```

## 4. Run Diagnostics & Init in a Test Project
Test initialization and environment diagnosis inside a temporary directory:

```powershell
# 1. Create a temporary folder
New-Item -ItemType Directory -Path "$env:TEMP\jewel-smoke-test" -Force
Set-Location "$env:TEMP\jewel-smoke-test"

# 2. Initialize Git
git init

# 3. Initialize Jewel configuration, instructions and safety skills
jewel init

# 4. Run doctor diagnostic suite
jewel doctor

# 5. Run verification suite (should show SKIPPED if no commands configured)
jewel verify
```

## 5. Dogfood Project Integration Test
Test running Jewel against the packaged example project to resolve a broken unit test:

```powershell
# 1. Navigate to the dogfood project folder
Set-Location "C:\Users\vinot\Documents\IM\Active Projects\Project Jewel\examples\dogfood-broken-project"

# 2. Clean previous build artifacts
Remove-Item -Recurse -Force dist, .jewel -ErrorAction SilentlyContinue

# 3. Install dependencies and compile
npm install
npm run build

# 4. Run tests (Must fail on division-by-zero assertion)
npm test

# 5. Execute Jewel with the mock adapter to automatically fix math.ts
jewel run "fix the failing math test" --mock --files src/math.ts --yes

# 6. Run tests again (Must pass successfully)
npm test
```

## 6. Clean Up Global Installation
Uninstall Jewel global CLI when testing is completed:

```powershell
npm uninstall -g jewel-cli
```
