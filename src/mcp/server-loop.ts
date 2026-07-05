import { handleToolCall } from './tools';
import { startMcpServer, writeMcpMessage } from './transport';

const TOOLS = [
  { name: 'jewel_verify', description: 'Run Jewel verification commands.', inputSchema: { type: 'object', properties: {} } },
  { name: 'jewel_status', description: 'List recent Jewel sessions.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'jewel_grep', description: 'Search repo files.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'jewel_read_file', description: 'Read a repo file.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'jewel_run_preview', description: 'Preview task contract dry-run.', inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] } }
];

export function runMcpServerLoop(cwd: string = process.cwd()): void {
  startMcpServer(cwd, (msg) => {
    const id = msg.id;
    const method = msg.method as string;
    const params = (msg.params || {}) as Record<string, unknown>;

    if (method === 'initialize') {
      writeMcpMessage({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'jewel-mcp', version: '0.10.0' }
        }
      });
      return;
    }

    if (method === 'tools/list') {
      writeMcpMessage({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      return;
    }

    if (method === 'tools/call') {
      const name = params.name as string;
      const args = (params.arguments || {}) as Record<string, unknown>;
      handleToolCall(name, args, cwd)
        .then(result => {
          writeMcpMessage({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false }
          });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          writeMcpMessage({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: message }], isError: true }
          });
        });
      return;
    }

    if (id !== undefined) {
      writeMcpMessage({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
    }
  });
}
