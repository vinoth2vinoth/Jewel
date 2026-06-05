import test from 'node:test';
import assert from 'node:assert';
import * as http from 'http';
import * as net from 'net';
import { UIServer } from './ui-server';

test('ui-server - starts on port 0, validates token, serves HTML, handles SSE, and handles actions', async (t) => {
  // 1. Initialize server on port 0 (ephemeral)
  const server = new UIServer({ startPort: 0 });
  await server.start(false); // Disable browser launch

  const url = server.getUrl();
  const token = server.getToken();
  assert.ok(url.startsWith('http://127.0.0.1:'));
  assert.ok(url.includes(`?token=${token}`));

  // Helper function for authorized fetch
  const fetchEndpoint = async (path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
    const port = (server as any).activePort;
    const targetUrl = `http://127.0.0.1:${port}${path}`;
    return fetch(targetUrl, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      body: options.body
    });
  };

  // Helper function for unauthorized fetch
  const fetchUnauthorized = async (path: string) => {
    const port = (server as any).activePort;
    const targetUrl = `http://127.0.0.1:${port}${path}`;
    return fetch(targetUrl);
  };

  // 2. Validate unauthorized access
  const unauthRes = await fetchUnauthorized('/');
  assert.strictEqual(unauthRes.status, 401);

  // 3. Validate authorized access serving index
  const indexRes = await fetchEndpoint('/');
  assert.strictEqual(indexRes.status, 200);
  const indexHtml = await indexRes.text();
  assert.ok(indexHtml.includes('<!DOCTYPE html>'));
  assert.ok(indexHtml.includes('JEWEL PIPELINE'));

  // 4. Validate getState endpoint
  const stateRes = await fetchEndpoint('/api/state');
  assert.strictEqual(stateRes.status, 200);
  const stateJson = await stateRes.json() as any;
  assert.strictEqual(stateJson.stage, 'init');
  assert.strictEqual(stateJson.awaitingApproval, false);

  // 5. Test SSE stream
  // We can connect to the SSE endpoint and verify it receives the initial state
  const ssePort = (server as any).activePort;
  const sseUrl = `http://127.0.0.1:${ssePort}/api/events?token=${token}`;
  
  const ssePromise = new Promise<string>((resolve, reject) => {
    const req = http.get(sseUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
        // Once we get a full event message, resolve
        if (data.includes('\n\n')) {
          req.destroy(); // Close connection
          resolve(data);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });

  const sseData = await ssePromise;
  assert.ok(sseData.startsWith('data: '));
  assert.ok(sseData.includes('"stage":"init"'));

  // 6. Test approval action resolver
  const approvalPromise = server.waitForApproval('patch-review', {
    message: 'Testing patch proposal',
    diff: '+++ test.ts'
  });

  // Action decision payload
  const actionRes = await fetchEndpoint('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' })
  });
  assert.strictEqual(actionRes.status, 200);

  const approvalResult = await approvalPromise;
  assert.strictEqual(approvalResult.action, 'approve');

  // 7. Test exit confirmation resolver
  const exitPromise = server.waitForExitConfirmation();
  const exitRes = await fetchEndpoint('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'exit' })
  });
  assert.strictEqual(exitRes.status, 200);
  await exitPromise; // Should resolve cleanly

  // 8. Clean up
  await server.close();
});

test('ui-server - port hunting collision logic', async (t) => {
  // Bind an raw HTTP server on port 3005
  const collisonServer = http.createServer((req, res) => res.end());
  await new Promise<void>((resolve) => collisonServer.listen(3005, '127.0.0.1', () => resolve()));

  // Start UIServer with startPort: 3005
  // It should detect EADDRINUSE on 3005 and hunt to 3006
  const server = new UIServer({ startPort: 3005 });
  await server.start(false);

  const activePort = (server as any).activePort;
  assert.strictEqual(activePort, 3006); // Must hunt to next available

  // Clean up
  await server.close();
  await new Promise<void>((resolve) => collisonServer.close(() => resolve()));
});

test('ui-server - limit payload checks', async (t) => {
  const server = new UIServer({ startPort: 0 });
  await server.start(false);

  const port = (server as any).activePort;
  const token = server.getToken();

  // Create a large body payload (>10KB)
  const largeBody = 'a'.repeat(12 * 1024);

  const targetUrl = `http://127.0.0.1:${port}/api/action`;
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'approve', comment: largeBody })
  }).catch(err => {
    // If socket is destroyed, fetch might fail, which is also a success indicator
    return { status: 413 } as any;
  });

  // Should return 413 Payload Too Large
  assert.ok(res.status === 413 || res.status === undefined);

  await server.close();
});
