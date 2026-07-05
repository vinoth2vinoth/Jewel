# Jewel VS Code Extension

Native VS Code integration for [Jewel CLI](https://github.com/vinoth2vinoth/Jewel): LSP diagnostics, session sidebar, and diff preview panel.

## Features

| Feature | Description |
|---------|-------------|
| **LSP diagnostics** | Verification failures appear in the Problems panel with file/line links |
| **Session sidebar** | Jewel activity bar lists recent sessions with status badges |
| **Diff preview panel** | Webview shows git diff, findings, and per-file "Open in Diff Editor" |
| **Status bar** | Quick verify + live overall status |
| **Commands** | Run Task, Verify, Status, Refresh Sessions, Open Latest Diff |

## Prerequisites

- Jewel CLI built or installed (`jewel` on PATH)
- A workspace with `jewel.config.json` (run `jewel init`)

## Development setup

```bash
# From repo root — build Jewel CLI
npm run build

# Install extension dependencies
cd extensions/jewel-vscode
npm install
```

### VS Code settings (Extension Development Host)

When debugging from the Jewel repo, point the extension at the local build:

```json
{
  "jewel.cliPath": "node",
  "jewel.cliArgs": ["C:/path/to/Project Jewel/dist/cli/index.js"],
  "jewel.useLspSubcommand": true
}
```

With global `jewel` on PATH, defaults work out of the box:

```json
{
  "jewel.cliPath": "jewel",
  "jewel.useLspSubcommand": true
}
```

Press **F5** in VS Code with `extensions/jewel-vscode` open to launch the Extension Development Host.

## Commands

- **Jewel: Run Task** — run `jewel run` in terminal
- **Jewel: Verify** — LSP verify (falls back to terminal)
- **Jewel: Open Latest Session Diff** — diff preview for most recent session
- **Jewel: Refresh Sessions** — reload session tree

## Architecture

```text
VS Code Extension
  ├── Language Client → jewel lsp (stdio)
  │     ├── publishDiagnostics (verification failures)
  │     ├── jewel/listSessions
  │     └── jewel/getSessionDiff
  ├── Sessions TreeView
  └── Diff Webview + vscode.diff editor
```

See also: [docs/mcp-setup.md](../../docs/mcp-setup.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
