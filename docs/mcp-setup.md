# Jewel MCP Server Setup

Jewel exposes a Model Context Protocol (MCP) server over stdio so Cursor, Claude Desktop, and other MCP clients can call Jewel tools.

## Start the server

```bash
jewel mcp
```

## Cursor configuration

Add to `.cursor/mcp.json` (or Cursor MCP settings):

```json
{
  "mcpServers": {
    "jewel": {
      "command": "jewel",
      "args": ["mcp"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

Use an absolute path to `jewel` if it is not on PATH.

## Available tools

| Tool | Description |
|------|-------------|
| `jewel_verify` | Run configured verification commands |
| `jewel_status` | List recent Jewel sessions |
| `jewel_grep` | Search repo files (args: `query`, optional `filePattern`) |
| `jewel_read_file` | Read a repo file (args: `path`) |
| `jewel_run_preview` | Dry-run task contract preview (args: `task`, optional `files`) |

## Plugins

Place custom verifiers and critics under `.jewel/plugins/<name>/plugin.json`. See `examples/plugin-example/`.

## VS Code extension (LSP)

The VS Code extension connects to `jewel lsp` over stdio. Configure in Cursor/VS Code settings or use defaults when `jewel` is on PATH.

See `extensions/jewel-vscode/README.md` for development setup.
