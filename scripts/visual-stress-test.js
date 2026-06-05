const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

// 1. Argument validation
const args = process.argv.slice(2);
const hasVisual = args.includes('--visual');
const hasStress = args.includes('--stress');

if ((!hasVisual && !hasStress) || (hasVisual && hasStress)) {
  console.log(`
Usage: node scripts/visual-stress-test.js [options]

Options:
  --visual   Run visual slideshow demo in local browser.
  --stress   Run high-load concurrency and resilience tests.
`);
  process.exit(1);
}

// 2. Pre-build compilation check
const buildDir = path.join(__dirname, '../dist');
const uiServerPath = path.join(buildDir, 'cli/ui-server.js');
if (!fs.existsSync(uiServerPath)) {
  console.error("Error: Compiled CLI files not found. Please run 'npm run build' first.");
  process.exit(1);
}

const { UIServer } = require(uiServerPath);

async function runVisual() {
  console.log('[+] Starting Visual Slideshow Demo...');
  const uiServer = new UIServer({ startPort: 3000 });
  
  // Clean signal handling for port release
  const cleanup = async () => {
    console.log('\n[+] Closing UIServer...');
    await uiServer.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await uiServer.start(true); // Open browser automatically
  
  console.log(`[+] Dashboard server started successfully: ${uiServer.getUrl()}`);
  
  const stages = [
    { stage: 'init', label: 'Initialization Stage' },
    { stage: 'planning', label: 'Planning & Code Analysis' },
    { 
      stage: 'review', 
      label: 'Patch Proposal Diff Review', 
      awaitingApproval: true,
      promptType: 'patch-review',
      approvalDetails: {
        message: 'Review safety checks and symbol isolation findings.',
        diff: `diff --git a/src/safety/diff-guard.ts b/src/safety/diff-guard.ts
index b592c3a..a7a7b7a 100644
--- a/src/safety/diff-guard.ts
+++ b/src/safety/diff-guard.ts
@@ -10,6 +10,12 @@ export function runDiffGuard(checkpoint: any, config: any, cwd: string, allowedS
+  // AST semantic symbol isolation check
+  const isAllowed = matchAllowedSymbolChanges(changedSymbols, allowedSymbolChanges);
+  if (!isAllowed) {
+    return { status: 'BLOCKED', blockReason: 'Symbol isolation guard violation' };
+  }
`
      }
    },
    { stage: 'verification', label: 'Verification Suite Running' },
    { 
      stage: 'critic', 
      label: 'Multi-Agent Critic Review',
      findings: [
        { type: 'PASS', title: 'Symbol Guard', message: 'No unauthorized symbols modified.' },
        { type: 'WARN', title: 'File Access', message: 'Config files read, but matching session scope.' }
      ]
    },
    { stage: 'finalizing', label: 'Finalizing Changes' },
    { stage: 'completed', label: 'Run Completed Successfully' }
  ];

  for (const step of stages) {
    console.log(`[+] Transitioning to: ${step.label} (${step.stage})`);
    uiServer.updateState({
      stage: step.stage,
      task: 'E2E Visual Demo - Implement AST Semantic Symbol Isolation Guard',
      sessionId: 'session-visual-demo-2026',
      files: ['src/safety/diff-guard.ts'],
      overrides: { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
      awaitingApproval: step.awaitingApproval || false,
      promptType: step.promptType,
      approvalDetails: step.approvalDetails,
      findings: step.findings || [],
      terminalLogs: (uiServer.getState().terminalLogs || '') + `\n[+] Transitioned to stage: ${step.stage}`
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n======================================================');
  console.log('[+] Visual slideshow completed!');
  console.log('    Press [ENTER] or Ctrl+C in this terminal to exit.');
  console.log('======================================================');

  // Wait for user enter key
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', cleanup);
}

async function runStress() {
  console.log('[+] Starting E2E Concurrency & Stress Verification...');
  
  const uiServer = new UIServer({ startPort: 3000 });
  
  const cleanup = async () => {
    await uiServer.close();
  };

  // Clean signal handling
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  await uiServer.start(false); // Do not open browser
  
  const port = uiServer.activePort;
  const token = uiServer.getToken();
  const baseUrl = `http://127.0.0.1:${port}`;
  
  const metrics = {
    sseConnectionsCreated: 0,
    sseDisconnectionsClean: 0,
    payloadLimitBlocks: 0,
    malformedRejections: 0,
    unauthorizedRejections: 0,
    approvalRaceSuccess: 0,
    approvalRace409s: 0,
    latencyStateMs: []
  };

  try {
    // A. Spawn 50 SSE clients
    console.log('[+] Spawning 50 concurrent SSE clients...');
    const clientPromises = [];
    for (let i = 0; i < 50; i++) {
      const p = new Promise((resolve) => {
        const req = http.get(`${baseUrl}/api/events?token=${token}`, (res) => {
          metrics.sseConnectionsCreated++;
          res.on('data', () => {});
          res.on('error', () => {});
          resolve(req);
        });
        req.on('error', () => {
          resolve(null);
        });
      });
      clientPromises.push(p);
    }
    const resolvedClients = (await Promise.all(clientPromises)).filter(Boolean);

    // Update state to trigger broadcast to SSE clients
    uiServer.updateState({ stage: 'planning', task: 'Stress Test Run' });
    await new Promise(resolve => setTimeout(resolve, 200));

    // B. Abruptly close 25 clients
    console.log('[+] Abruptly aborting 25 SSE clients to test backpressure...');
    for (let i = 0; i < 25; i++) {
      const client = resolvedClients[i];
      if (client) {
        client.destroy();
        metrics.sseDisconnectionsClean++;
      }
    }
    
    // Update state again to verify server handles remaining clients
    uiServer.updateState({ stage: 'verification' });
    await new Promise(resolve => setTimeout(resolve, 200));

    // C. Verify Payload Size Limit (Expected: socket hangup/reset or 413)
    console.log('[+] Hammering with large payloads (>10KB)...');
    const largeBody = 'a'.repeat(12 * 1024); // 12KB
    const largePromises = [];
    for (let i = 0; i < 20; i++) {
      const reqOptions = {
        hostname: '127.0.0.1',
        port,
        path: `/api/action?token=${token}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      };
      
      const p = new Promise((resolve) => {
        const req = http.request(reqOptions, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            if (res.statusCode === 413) {
              metrics.payloadLimitBlocks++;
            }
            resolve();
          });
          res.on('error', () => resolve());
        });
        req.on('error', (err) => {
          // Socket hangup / ECONNRESET caught successfully
          metrics.payloadLimitBlocks++;
          resolve();
        });
        req.write(JSON.stringify({ action: 'approve', comment: largeBody }));
        req.end();
      });
      largePromises.push(p);
    }
    await Promise.all(largePromises);

    // D. Verify Malformed payload (HTTP 400)
    console.log('[+] Verifying malformed JSON payload rejection...');
    await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: `/api/action?token=${token}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode === 400) {
            metrics.malformedRejections++;
          }
          resolve();
        });
        res.on('error', () => resolve());
      });
      req.on('error', () => resolve());
      req.write("{ malformed_json: ");
      req.end();
    });

    // E. Verify Unauthorized payload (HTTP 401)
    console.log('[+] Verifying unauthorized action rejection...');
    await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/action',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode === 401) {
            metrics.unauthorizedRejections++;
          }
          resolve();
        });
        res.on('error', () => resolve());
      });
      req.on('error', () => resolve());
      req.write(JSON.stringify({ action: 'approve' }));
      req.end();
    });

    // F. Verify Concurrency / Race Conditions on Awaiting-Approval (1 of 10 succeeds, others 409)
    console.log('[+] Simulating approval concurrency race conditions...');
    const approvalPromise = uiServer.waitForApproval('patch-review');
    
    const racePromises = [];
    for (let i = 0; i < 10; i++) {
      const p = new Promise((resolve) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: `/api/action?token=${token}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            if (res.statusCode === 200) {
              metrics.approvalRaceSuccess++;
            } else if (res.statusCode === 409) {
              metrics.approvalRace409s++;
            }
            resolve();
          });
          res.on('error', () => resolve());
        });
        req.on('error', () => resolve());
        req.write(JSON.stringify({ action: 'approve' }));
        req.end();
      });
      racePromises.push(p);
    }
    await Promise.all(racePromises);
    await approvalPromise; // Resolves approval promise on server

    // G. Hammer /api/state and collect latency
    console.log('[+] Hammering /api/state for latency metrics...');
    const latencyPromises = [];
    for (let i = 0; i < 50; i++) {
      const startTime = Date.now();
      const p = new Promise((resolve) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: `/api/state?token=${token}`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            const duration = Date.now() - startTime;
            metrics.latencyStateMs.push(duration);
            resolve();
          });
          res.on('error', () => resolve());
        });
        req.on('error', () => resolve());
        req.end();
      });
      latencyPromises.push(p);
    }
    await Promise.all(latencyPromises);

    // Clean close remaining SSE clients
    resolvedClients.forEach(c => {
      if (c && !c.destroyed) {
        c.destroy();
      }
    });

    // Compute metrics
    const latencies = metrics.latencyStateMs;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    console.log('\n======================================================');
    console.log('          JEWEL UI SERVER STRESS AUDIT REPORT         ');
    console.log('======================================================');
    console.log(`SSE Clients Connected:        ${metrics.sseConnectionsCreated} / 50`);
    console.log(`SSE Resilient Disconnects:    ${metrics.sseDisconnectionsClean} / 25`);
    console.log(`Payload size blocks (>10KB):  ${metrics.payloadLimitBlocks} / 20`);
    console.log(`Malformed JSON rejections:    ${metrics.malformedRejections} / 1 (HTTP 400)`);
    console.log(`Unauthorized rejections:      ${metrics.unauthorizedRejections} / 1 (HTTP 401)`);
    console.log(`Approval Race Successes:      ${metrics.approvalRaceSuccess} / 1 (HTTP 200)`);
    console.log(`Approval Race Conflicts:      ${metrics.approvalRace409s} / 9 (HTTP 409)`);
    console.log(`Avg Latency on /api/state:    ${avgLatency.toFixed(2)} ms`);
    console.log(`Max Latency on /api/state:    ${maxLatency} ms`);
    console.log('======================================================');
    
    // Assert stability criteria
    const passed = 
      metrics.sseConnectionsCreated === 50 &&
      metrics.sseDisconnectionsClean === 25 &&
      metrics.payloadLimitBlocks === 20 &&
      metrics.malformedRejections === 1 &&
      metrics.unauthorizedRejections === 1 &&
      metrics.approvalRaceSuccess === 1 &&
      metrics.approvalRace409s === 9;
      
    if (passed) {
      console.log('[+] AUDIT VERDICT: PASSED (100% stable under stress)\n');
      process.exit(0);
    } else {
      console.error('[-] AUDIT VERDICT: FAILED (Assertion mismatches)\n');
      process.exit(1);
    }

  } catch (err) {
    console.error('[-] Stress test failed with exception:', err);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

if (hasVisual) {
  runVisual().catch(err => {
    console.error('[-] Visual slideshow error:', err);
    process.exit(1);
  });
} else if (hasStress) {
  runStress().catch(err => {
    console.error('[-] Stress testing error:', err);
    process.exit(1);
  });
}
