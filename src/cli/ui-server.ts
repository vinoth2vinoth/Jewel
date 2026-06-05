import * as http from 'http';
import * as crypto from 'crypto';
import * as cp from 'child_process';
import * as net from 'net';
import { DASHBOARD_HTML } from './dashboard-html';
import { redactSecrets } from '../safety/secret-redactor';
import { ASTFileDiff } from '../safety/diff-guard';

export interface UIState {
  stage: 'init' | 'planning' | 'review' | 'verification' | 'critic' | 'finalizing' | 'completed' | 'failed';
  prevStage?: 'init' | 'planning' | 'review' | 'verification' | 'critic' | 'finalizing' | 'completed' | 'failed';
  task?: string;
  sessionId?: string;
  files?: string[];
  overrides?: {
    provider?: string;
    model?: string;
  };
  terminalLogs: string;
  verificationResults?: Array<{
    commandKey: string;
    commandLine: string;
    status: string;
    exitCode?: number;
    stdout: string;
    stderr: string;
  }>;
  findings?: Array<{
    type: 'BLOCK' | 'WARN' | 'PASS';
    title: string;
    message: string;
  }>;
  awaitingApproval: boolean;
  promptType?: 'scope-expansion' | 'patch-review' | 'retry-choice';
  approvalDetails?: {
    message?: string;
    diff?: string;
    files?: string[];
    astDiffs?: ASTFileDiff[];
  };
  cost?: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalUSD: number;
    maxCost?: number;
  };
}

export class UIServer {
  private startPort: number;
  private token: string;
  private server: http.Server | null = null;
  private activePort: number | null = null;
  private clients: Set<http.ServerResponse> = new Set();
  private state: UIState;

  private approvalResolver: ((val: { action: 'approve' | 'reject' | 'retry' | 'override' | 'abort', comment?: string, approvedFiles?: string[] }) => void) | null = null;
  private exitResolver: (() => void) | null = null;

  constructor(options: { startPort?: number } = {}) {
    this.startPort = options.startPort !== undefined ? options.startPort : 3000;
    this.token = crypto.randomUUID();
    this.state = {
      stage: 'init',
      terminalLogs: '',
      awaitingApproval: false
    };
  }

  public getUrl(): string {
    if (this.activePort === null) {
      throw new Error('Server has not started yet.');
    }
    return `http://127.0.0.1:${this.activePort}/?token=${this.token}`;
  }

  public getToken(): string {
    return this.token;
  }

  public getState(): UIState {
    return this.state;
  }

  public start(autoOpenBrowser = true): Promise<void> {
    return new Promise((resolve, reject) => {
      let currentPort = this.startPort;

      const tryBind = () => {
        const server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        server.on('error', (err: any) => {
          if (this.startPort === 0) {
            reject(err);
            return;
          }
          if (err.code === 'EADDRINUSE') {
            currentPort++;
            if (currentPort > this.startPort + 100) {
              reject(new Error(`Unable to find an available port in range [${this.startPort}, ${this.startPort + 100}]`));
            } else {
              tryBind();
            }
          } else {
            reject(err);
          }
        });

        server.listen(currentPort, '127.0.0.1', () => {
          this.server = server;
          const address = server.address() as net.AddressInfo;
          this.activePort = address.port;
          
          if (autoOpenBrowser) {
            this.launchBrowser();
          }
          resolve();
        });
      };

      tryBind();
    });
  }

  private launchBrowser(): void {
    const url = this.getUrl();
    const command = process.platform === 'win32'
      ? `cmd /c start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

    try {
      const child = cp.exec(command);
      child.on('error', (err) => {
        console.warn(`[Warning] Failed to launch default browser: ${err.message}`);
      });
    } catch (err: any) {
      console.warn(`[Warning] Failed to launch default browser: ${err.message}`);
    }
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = req.url ? req.url.split('?')[0] : '';

    // Authorization Middleware
    if (!this.isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Static content
    if (parsedUrl === '/' || parsedUrl === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(DASHBOARD_HTML);
      return;
    }

    // SSE Events
    if (parsedUrl === '/api/events' && req.method === 'GET') {
      req.socket.setKeepAlive(true);
      req.socket.setTimeout(0);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });
      // Push current state immediately
      const initialPayload = redactSecrets(JSON.stringify(this.state));
      res.write(`data: ${initialPayload}\n\n`);

      this.clients.add(res);

      req.on('close', () => {
        this.clients.delete(res);
      });
      return;
    }

    // Get current state
    if (parsedUrl === '/api/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(redactSecrets(JSON.stringify(this.state)));
      return;
    }

    // Post action decision
    if (parsedUrl === '/api/action' && req.method === 'POST') {
      let body = '';
      let limitBreached = false;

      req.on('data', (chunk) => {
        if (limitBreached) return;
        body += chunk.toString();
        if (body.length > 10 * 1024) { // 10KB
          limitBreached = true;
          req.destroy();
        }
      });

      req.on('error', () => {
        // ignore to prevent crashing
      });

      req.on('end', () => {
        if (limitBreached) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload Too Large' }));
          return;
        }

        try {
           const parsed = JSON.parse(body);
          const { action, comment, approvedFiles } = parsed;

          if (!action || typeof action !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid or missing action.' }));
            return;
          }

          if (action === 'exit') {
            if (this.exitResolver) {
              this.exitResolver();
              this.exitResolver = null;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (['approve', 'reject', 'retry', 'override', 'abort'].includes(action)) {
            if (!this.approvalResolver) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No active approval request.' }));
              return;
            }
            const resolver = this.approvalResolver;
            this.approvalResolver = null;
            this.updateState({ awaitingApproval: false });
            resolver({ action: action as any, comment, approvedFiles });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
          }

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unknown action.' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  private isAuthorized(req: http.IncomingMessage): boolean {
    if (req.url) {
      try {
        const queryParams = new URL(req.url, 'http://localhost').searchParams;
        const queryToken = queryParams.get('token');
        if (queryToken === this.token) {
          return true;
        }
      } catch {
        // ignore parsing errors
      }
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1] === this.token) {
        return true;
      }
    }

    return false;
  }

  public updateState(partial: Partial<UIState>): void {
    const prevStage = partial.stage && partial.stage !== this.state.stage ? this.state.stage : this.state.prevStage;
    this.state = {
      ...this.state,
      ...partial,
      prevStage
    };
    this.broadcastState();
  }

  private broadcastState(): void {
    const payload = redactSecrets(JSON.stringify(this.state));
    for (const client of this.clients) {
      try {
        if (client.writable && !client.writableEnded) {
          client.write(`data: ${payload}\n\n`);
        } else {
          this.clients.delete(client);
        }
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  public waitForApproval(
    promptType: 'scope-expansion' | 'patch-review' | 'retry-choice',
    details?: { message?: string; diff?: string; files?: string[]; astDiffs?: ASTFileDiff[] }
  ): Promise<{ action: 'approve' | 'reject' | 'retry' | 'override' | 'abort'; comment?: string; approvedFiles?: string[] }> {
    return new Promise((resolve) => {
      this.approvalResolver = resolve;
      this.updateState({
        awaitingApproval: true,
        promptType,
        approvalDetails: details
      });
    });
  }

  public waitForExitConfirmation(): Promise<void> {
    return new Promise((resolve) => {
      this.exitResolver = resolve;
    });
  }

  public async close(): Promise<void> {
    if (this.server && this.server.listening) {
      for (const client of this.clients) {
        try {
          client.end();
        } catch {
          // ignore
        }
      }
      this.clients.clear();

      if (typeof (this.server as any).closeAllConnections === 'function') {
        try {
          (this.server as any).closeAllConnections();
        } catch {
          // ignore
        }
      }

      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}
