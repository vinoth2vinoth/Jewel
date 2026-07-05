import { runMcpServerLoop } from '../../mcp/server-loop';

export function runMcp(cwd: string = process.cwd()): void {
  console.error('[jewel-mcp] MCP server listening on stdio (Cursor/Claude Desktop compatible)');
  runMcpServerLoop(cwd);
}
