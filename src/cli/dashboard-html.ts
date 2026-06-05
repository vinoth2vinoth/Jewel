export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jewel Live Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --panel-bg: rgba(18, 20, 29, 0.7);
      --border-color: rgba(255, 255, 255, 0.08);
      --primary: #5c62ec;
      --primary-glow: rgba(92, 98, 236, 0.4);
      --success: #10b981;
      --success-glow: rgba(16, 185, 129, 0.4);
      --danger: #ef4444;
      --danger-glow: rgba(239, 68, 68, 0.4);
      --warning: #f59e0b;
      --warning-glow: rgba(245, 158, 11, 0.4);
      --text: #e2e8f0;
      --text-muted: #64748b;
      --accent: #a855f7;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(92, 98, 236, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 40%),
        radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0);
      background-size: 100% 100%, 100% 100%, 24px 24px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Glassmorphism Classes */
    .glass {
      background: var(--panel-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 12px;
    }

    .container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-glow {
      width: 24px;
      height: 24px;
      background: var(--primary);
      border-radius: 50%;
      box-shadow: 0 0 16px var(--primary-glow);
      animation: pulse 2s infinite ease-in-out;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 24px var(--primary); }
    }

    .logo-text {
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: 0.1rem;
      background: linear-gradient(to right, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    .status-dot.connected {
      background: var(--success);
      box-shadow: 0 0 8px var(--success-glow);
    }

    .status-dot.disconnected {
      background: var(--danger);
      box-shadow: 0 0 8px var(--danger-glow);
    }

    /* Layout Grid */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 24px;
      align-items: start;
    }

    @media (max-width: 1024px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    .sidebar-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: sticky;
      top: 24px;
    }

    .card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .card-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
    }

    .task-desc {
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.5;
    }

    /* Timeline Steps */
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      padding-left: 20px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 10px;
      bottom: 10px;
      width: 2px;
      background: var(--border-color);
    }

    .timeline-step {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      padding: 8px 0;
    }

    .timeline-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bg);
      border: 2px solid var(--border-color);
      position: absolute;
      left: -20px;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .timeline-step.active .timeline-dot {
      border-color: var(--primary);
      background: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
    }

    .timeline-step.completed .timeline-dot {
      border-color: var(--success);
      background: var(--success);
      box-shadow: 0 0 10px var(--success-glow);
    }

    .timeline-step.failed .timeline-dot {
      border-color: var(--danger);
      background: var(--danger);
      box-shadow: 0 0 10px var(--danger-glow);
    }

    .timeline-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-muted);
      transition: color 0.3s ease;
    }

    .timeline-step.active .timeline-label {
      color: var(--text);
      font-weight: 600;
    }

    .timeline-step.completed .timeline-label {
      color: var(--text);
    }

    /* Main Area */
    .main-panel {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Terminal Console */
    .console-card {
      display: flex;
      flex-direction: column;
      height: 480px;
    }

    .console-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .console-tabs {
      display: flex;
      gap: 8px;
    }

    .console-tab {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 6px 12px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .console-tab.active {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }

    .console-body {
      flex: 1;
      background: #040508;
      border-radius: 0 0 12px 12px;
      padding: 16px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .ansi-blue { color: #5c62ec; }
    .ansi-green { color: #10b981; }
    .ansi-red { color: #ef4444; }
    .ansi-yellow { color: #f59e0b; }
    .ansi-muted { color: var(--text-muted); }

    /* Metadata details */
    .meta-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 0.9rem;
    }

    .meta-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .meta-key {
      color: var(--text-muted);
      font-weight: 500;
    }

    .meta-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 6px;
      border-radius: 4px;
      max-width: 60%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Modal Overlay styling */
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(4, 5, 8, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    .modal {
      width: 100%;
      max-width: 680px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      transform: translateY(20px);
      transition: transform 0.3s ease;
    }

    .overlay.active .modal {
      transform: translateY(0);
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .modal-description {
      font-size: 0.95rem;
      line-height: 1.5;
      color: #94a3b8;
    }

    .textarea-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    textarea {
      width: 100%;
      height: 100px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      color: var(--text);
      font-family: inherit;
      resize: none;
      outline: none;
    }

    textarea:focus {
      border-color: var(--primary);
      box-shadow: 0 0 6px var(--primary-glow);
    }

    .button-group {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 0 10px var(--primary-glow);
    }

    .btn-primary:hover {
      background: #4f55db;
      box-shadow: 0 0 15px var(--primary);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-danger {
      background: var(--danger);
      color: #fff;
      box-shadow: 0 0 10px var(--danger-glow);
    }

    .btn-danger:hover {
      background: #dc2626;
      box-shadow: 0 0 15px var(--danger);
    }

    .btn-warning {
      background: var(--warning);
      color: #fff;
      box-shadow: 0 0 10px var(--warning-glow);
    }

    .btn-warning:hover {
      background: #d97706;
      box-shadow: 0 0 15px var(--warning);
    }

    /* Diff Highlight */
    .diff-container {
      max-height: 240px;
      overflow-y: auto;
      background: #020305;
      padding: 12px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      line-height: 1.4;
      border: 1px solid var(--border-color);
    }

    .diff-line {
      display: block;
      white-space: pre-wrap;
    }

    .diff-add {
      color: #10b981;
      background: rgba(16, 185, 129, 0.08);
    }

    .diff-del {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.08);
    }

    /* AST Signature Tree Diff */
    .ast-tree-details {
      margin-top: 8px;
      padding: 6px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: rgba(255,255,255,0.02);
    }
    .ast-tree-summary {
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--accent);
      padding: 4px;
      user-select: none;
    }
    .ast-tree-summary:hover {
      text-decoration: underline;
    }
    .ast-tree-list {
      list-style: none;
      padding-left: 14px;
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
    }
    .ast-added {
      color: var(--success);
      margin-bottom: 2px;
    }
    .ast-deleted {
      color: var(--danger);
      margin-bottom: 2px;
    }

    /* Checklist */
    .checklist-container {
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: rgba(0,0,0,0.15);
      max-height: 120px;
      overflow-y: auto;
    }
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      cursor: pointer;
      color: var(--text);
    }
    .checklist-item input {
      cursor: pointer;
    }
    .file-diff-section {
      margin-bottom: 12px;
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 4px;
    }
    .file-diff-header {
      background: rgba(255,255,255,0.03);
      padding: 4px 8px;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: var(--text-muted);
    }

    /* Exit Banner */
    .exit-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin-top: 12px;
    }

    .exit-banner.completed {
      border-color: var(--success);
      background: rgba(16, 185, 129, 0.05);
    }

    .exit-banner.failed {
      border-color: var(--danger);
      background: rgba(239, 68, 68, 0.05);
    }

    .exit-message {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .findings-card {
      padding: 20px;
    }

    .findings-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .finding-item {
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .finding-item.BLOCK {
      border-color: var(--danger);
      background: rgba(239, 68, 68, 0.03);
    }

    .finding-item.WARN {
      border-color: var(--warning);
      background: rgba(245, 158, 11, 0.03);
    }

    .finding-item.PASS {
      border-color: var(--success);
      background: rgba(16, 185, 129, 0.03);
    }

    .finding-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    .finding-badge.BLOCK {
      background: var(--danger);
      color: #fff;
    }

    .finding-badge.WARN {
      background: var(--warning);
      color: #fff;
    }

    .finding-badge.PASS {
      background: var(--success);
      color: #fff;
    }
  </style>
</head>
<body>

  <div class="container">
    <header class="glass">
      <div class="logo-container">
        <div class="logo-glow"></div>
        <div class="logo-text">JEWEL PIPELINE</div>
      </div>
      <div class="connection-status">
        <div id="conn-dot" class="status-dot disconnected"></div>
        <span id="conn-text">Connecting...</span>
      </div>
    </header>

    <div class="dashboard-grid">
      <!-- Sidebar panels -->
      <div class="sidebar-panel">
        
        <!-- Task Details -->
        <div class="card glass">
          <div class="card-title">Task Context</div>
          <div id="task-text" class="task-desc">No task loaded.</div>
          <div class="meta-list">
            <div class="meta-item">
              <span class="meta-key">Session ID</span>
              <span id="session-id" class="meta-val">-</span>
            </div>
            <div class="meta-item">
              <span class="meta-key">Target Files</span>
              <span id="target-files" class="meta-val" title="-">-</span>
            </div>
            <div class="meta-item">
              <span class="meta-key">Provider / Model</span>
              <span id="provider-model" class="meta-val">-</span>
            </div>
          </div>
        </div>

        <!-- Pipeline Timeline -->
        <div class="card glass">
          <div class="card-title">Execution Timeline</div>
          <div class="timeline" id="timeline">
            <div class="timeline-step" id="step-init">
              <div class="timeline-dot"></div>
              <div class="timeline-label">Initialization</div>
            </div>
            <div class="timeline-step" id="step-planning">
              <div class="timeline-dot"></div>
              <div class="timeline-label">Task Planning</div>
            </div>
            <div class="timeline-step" id="step-review">
              <div class="timeline-dot"></div>
              <div class="timeline-label">Patch Review</div>
            </div>
            <div class="timeline-step" id="step-verification">
              <div class="timeline-dot"></div>
              <div class="timeline-label">Runner Verification</div>
            </div>
            <div class="timeline-step" id="step-critic">
              <div class="timeline-dot"></div>
              <div class="timeline-label">Critic Review</div>
            </div>
            <div class="timeline-step" id="step-finalizing">
              <div class="timeline-dot"></div>
              <div class="timeline-label">Session Finalizing</div>
            </div>
          </div>
        </div>

        <!-- Live API Cost Gauge -->
        <div class="card glass" id="cost-card" style="display: block;">
          <div class="card-title">Cumulative Session Cost</div>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 12px 0;">
            <div style="position: relative; width: 120px; height: 120px;">
              <svg width="120" height="120" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8"></circle>
                <circle id="cost-gauge-ring" cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" stroke-width="8" stroke-dasharray="314.16" stroke-dashoffset="314.16" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease;"></circle>
              </svg>
              <div style="position: absolute; top: 0; left: 0; width: 120px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <span id="cost-usd" style="font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 700; color: var(--text);">$0.00</span>
                <span id="cost-percent" style="font-size: 0.75rem; color: var(--text-muted);">0% of max</span>
              </div>
            </div>
            <div class="meta-list" style="width: 100%; margin-top: 8px;">
              <div class="meta-item">
                <span class="meta-key">Prompt Tokens</span>
                <span id="cost-prompt-tokens" class="meta-val">0</span>
              </div>
              <div class="meta-item">
                <span class="meta-key">Completion Tokens</span>
                <span id="cost-completion-tokens" class="meta-val">0</span>
              </div>
              <div class="meta-item">
                <span class="meta-key">Total Tokens</span>
                <span id="cost-total-tokens" class="meta-val">0</span>
              </div>
              <div class="meta-item">
                <span class="meta-key">Budget Limit</span>
                <span id="cost-limit" class="meta-val">No Limit</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Main panels -->
      <div class="main-panel">
        
        <!-- Live Console/Output -->
        <div class="card glass console-card">
          <div class="console-header">
            <div class="console-tabs" id="console-tabs">
              <button class="console-tab active" onclick="switchConsoleTab('all')">All logs</button>
            </div>
          </div>
          <div class="console-body" id="console-body">Initializing console connection...</div>
        </div>

        <!-- Findings / Critic Reports -->
        <div class="card glass findings-card" id="findings-card" style="display: none;">
          <div class="card-title">Critic Findings & Safety Check</div>
          <div class="findings-list" id="findings-list"></div>
        </div>

        <!-- Exit acknowledgment banner -->
        <div class="exit-banner glass completed" id="exit-banner-completed" style="display: none;">
          <div class="exit-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Task completed successfully!
          </div>
          <button class="btn btn-primary" onclick="submitExit()">Close Dashboard & Exit</button>
        </div>

        <div class="exit-banner glass failed" id="exit-banner-failed" style="display: none;">
          <div class="exit-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            Task execution failed.
          </div>
          <button class="btn btn-danger" onclick="submitExit()">Close Dashboard & Exit</button>
        </div>

      </div>
    </div>
  </div>

  <!-- Interactive Decision Overlay Dialog -->
  <div class="overlay" id="approval-overlay">
    <div class="modal glass" id="approval-modal">
      <div class="modal-header">
        <div class="logo-glow" id="modal-indicator"></div>
        <h3 class="modal-title" id="modal-title">Approval Required</h3>
      </div>
      <div class="modal-description" id="modal-desc">
        Please review the proposed contract/patch below and approve to proceed.
      </div>
      
      <!-- Optional diff rendering block -->
      <div class="diff-container" id="modal-diff-container" style="display: none;"></div>

      <div class="textarea-container" id="comment-container" style="display: none;">
        <label for="comment-text" style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">Provide feedback or correction hint (optional):</label>
        <textarea id="comment-text" placeholder="Explain what needs to be fixed..."></textarea>
      </div>

      <div class="button-group" id="modal-actions">
        <!-- Dynamically populated buttons -->
      </div>
    </div>
  </div>

  <script>
    const token = new URLSearchParams(window.location.search).get('token') || '';
    let eventSource = null;
    let activeConsoleTab = 'all';
    let rawLogs = '';
    let verificationLogs = {}; // commandKey -> logs

    function connect() {
      const connDot = document.getElementById('conn-dot');
      const connText = document.getElementById('conn-text');

      connDot.className = 'status-dot disconnected';
      connText.innerText = 'Connecting...';

      eventSource = new EventSource(\`/api/events?token=\${token}\`);

      eventSource.onopen = () => {
        connDot.className = 'status-dot connected';
        connText.innerText = 'Connected';
        document.getElementById('console-body').innerHTML = 'Connected. Waiting for log updates...';
      };

      eventSource.onerror = (err) => {
        connDot.className = 'status-dot disconnected';
        connText.innerText = 'Disconnected. Retrying...';
        console.error('SSE Error:', err);
      };

      eventSource.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          updateUI(state);
        } catch (e) {
          console.error('Failed to parse SSE payload:', e);
        }
      };
    }

    function switchConsoleTab(tab) {
      activeConsoleTab = tab;
      const tabs = document.querySelectorAll('.console-tab');
      tabs.forEach(t => t.classList.remove('active'));

      // Find the tab button to add active class
      const btn = Array.from(tabs).find(b => b.innerText.toLowerCase().includes(tab.toLowerCase()));
      if (btn) btn.classList.add('active');

      renderLogs();
    }

    function renderLogs() {
      const body = document.getElementById('console-body');
      if (activeConsoleTab === 'all') {
        body.innerHTML = formatLogs(rawLogs);
      } else {
        const cmdLogs = verificationLogs[activeConsoleTab] || '';
        body.innerHTML = formatLogs(cmdLogs);
      }
      body.scrollTop = body.scrollHeight;
    }

    function formatLogs(logs) {
      if (!logs) return '<span class="ansi-muted">No logs recorded for this tab.</span>';
      // Simple ANSI coloration conversion
      return logs
        .replace(/\\x1b\\[32m/g, '<span class="ansi-green">')
        .replace(/\\x1b\\[31m/g, '<span class="ansi-red">')
        .replace(/\\x1b\\[33m/g, '<span class="ansi-yellow">')
        .replace(/\\x1b\\[34m/g, '<span class="ansi-blue">')
        .replace(/\\x1b\\[0m/g, '</span>')
        .replace(/\\n/g, '<br>')
        .replace(/\\r/g, '');
    }

    function updateUI(state) {
      // 1. Task Meta
      document.getElementById('task-text').innerText = state.task || 'No task active';
      document.getElementById('session-id').innerText = state.sessionId || '-';
      document.getElementById('target-files').innerText = (state.files && state.files.length) ? state.files.join(', ') : '-';
      document.getElementById('target-files').title = (state.files && state.files.length) ? state.files.join(', ') : '-';
      
      const provider = state.overrides?.provider || '-';
      const model = state.overrides?.model || '-';
      document.getElementById('provider-model').innerText = \`\${provider} / \${model}\`;

      // 2. Timeline Step styling
      const steps = ['init', 'planning', 'review', 'verification', 'critic', 'finalizing'];
      steps.forEach(step => {
        const el = document.getElementById(\`step-\${step}\`);
        if (el) {
          el.className = 'timeline-step'; // Reset
        }
      });

      // Mark stages
      let currentStageIdx = steps.indexOf(state.stage);
      if (state.stage === 'failed') {
        currentStageIdx = steps.length - 1;
      }
      steps.forEach((step, idx) => {
        const el = document.getElementById(\`step-\${step}\`);
        if (el) {
          if (state.stage === 'failed' && idx === steps.indexOf(state.prevStage || 'init')) {
            el.className = 'timeline-step failed';
          } else if (idx < currentStageIdx) {
            el.className = 'timeline-step completed';
          } else if (idx === currentStageIdx) {
            el.className = 'timeline-step active';
          }
        }
      });

      // 3. Update Logs
      rawLogs = state.terminalLogs || '';
      
      // Update verification tabs
      const tabsContainer = document.getElementById('console-tabs');
      
      // Clear old tabs, keep 'All logs'
      tabsContainer.innerHTML = '<button class="console-tab' + (activeConsoleTab === 'all' ? ' active' : '') + '" onclick="switchConsoleTab(\\'all\\')">All logs</button>';
      
      if (state.verificationResults && state.verificationResults.length > 0) {
        state.verificationResults.forEach(r => {
          verificationLogs[r.commandKey] = \`Command: \${r.commandLine}\\nExit Code: \${r.exitCode !== undefined ? r.exitCode : '-'}\\nStatus: \${r.status}\\n\\nSTDOUT:\\n\${r.stdout}\\n\\nSTDERR:\\n\${r.stderr}\`;
          
          const tabBtn = document.createElement('button');
          tabBtn.className = 'console-tab' + (activeConsoleTab === r.commandKey ? ' active' : '');
          tabBtn.innerText = r.commandKey;
          tabBtn.onclick = () => switchConsoleTab(r.commandKey);
          tabsContainer.appendChild(tabBtn);
        });
      }
      renderLogs();

      // 3b. Update Cost Card
      if (state.cost) {
        const totalUSD = state.cost.totalUSD || 0;
        const maxCost = state.cost.maxCost || 0;
        const promptTokens = state.cost.promptTokens || 0;
        const completionTokens = state.cost.completionTokens || 0;
        const totalTokens = state.cost.totalTokens || 0;

        document.getElementById('cost-usd').innerText = \`$\${totalUSD.toFixed(4)}\`;
        document.getElementById('cost-prompt-tokens').innerText = promptTokens.toLocaleString();
        document.getElementById('cost-completion-tokens').innerText = completionTokens.toLocaleString();
        document.getElementById('cost-total-tokens').innerText = totalTokens.toLocaleString();

        const ring = document.getElementById('cost-gauge-ring');
        if (maxCost > 0) {
          document.getElementById('cost-limit').innerText = \`$\${maxCost.toFixed(2)}\`;
          const percentage = Math.min((totalUSD / maxCost) * 100, 100);
          document.getElementById('cost-percent').innerText = \`\${percentage.toFixed(1)}% of max\`;
          // Ring length = 2 * PI * r = 2 * 3.14159 * 50 = 314.16
          const offset = 314.16 - (percentage / 100) * 314.16;
          ring.setAttribute('stroke-dashoffset', offset.toString());
          if (percentage >= 90) {
            ring.setAttribute('stroke', 'var(--danger)');
          } else if (percentage >= 70) {
            ring.setAttribute('stroke', 'var(--warning)');
          } else {
            ring.setAttribute('stroke', 'var(--accent)');
          }
        } else {
          document.getElementById('cost-limit').innerText = 'No Limit';
          document.getElementById('cost-percent').innerText = '0% of max';
          ring.setAttribute('stroke-dashoffset', '314.16');
          ring.setAttribute('stroke', 'var(--accent)');
        }
      }

      // 4. Critic Findings
      const findingsCard = document.getElementById('findings-card');
      const findingsList = document.getElementById('findings-list');
      if (state.findings && state.findings.length > 0) {
        findingsCard.style.display = 'flex';
        findingsList.innerHTML = '';
        state.findings.forEach(f => {
          const item = document.createElement('div');
          item.className = \`finding-item \${f.type}\`;
          item.innerHTML = \`
            <div class="finding-badge \${f.type}">\${f.type}</div>
            <div style="font-weight: 500; margin-bottom: 4px;">\${f.title || 'Finding'}</div>
            <div class="ansi-muted">\${f.message}</div>
          \`;
          findingsList.appendChild(item);
        });
      } else {
        findingsCard.style.display = 'none';
      }

      // 5. Exit acknowledgment banner
      const bannerCompleted = document.getElementById('exit-banner-completed');
      const bannerFailed = document.getElementById('exit-banner-failed');
      if (state.stage === 'completed') {
        bannerCompleted.style.display = 'flex';
        bannerFailed.style.display = 'none';
      } else if (state.stage === 'failed') {
        bannerCompleted.style.display = 'none';
        bannerFailed.style.display = 'flex';
      } else {
        bannerCompleted.style.display = 'none';
        bannerFailed.style.display = 'none';
      }

      // 6. Modal overlay checks
      const overlay = document.getElementById('approval-overlay');
      if (state.awaitingApproval) {
        overlay.classList.add('active');
        setupApprovalModal(state.promptType, state.approvalDetails);
      } else {
        overlay.classList.remove('active');
      }
    }

    function setupApprovalModal(type, details) {
      const title = document.getElementById('modal-title');
      const desc = document.getElementById('modal-desc');
      const diffContainer = document.getElementById('modal-diff-container');
      const commentContainer = document.getElementById('comment-container');
      const actions = document.getElementById('modal-actions');
      const indicator = document.getElementById('modal-indicator');

      // Clear previous details
      diffContainer.style.display = 'none';
      diffContainer.innerHTML = '';
      commentContainer.style.display = 'none';
      document.getElementById('comment-text').value = '';
      actions.innerHTML = '';

      indicator.style.background = 'var(--primary)';
      indicator.style.boxShadow = '0 0 16px var(--primary-glow)';

      if (type === 'scope-expansion') {
        title.innerText = 'Scope Expansion Request';
        desc.innerText = details?.message || 'The agent requests to expand the scope to modify files that were not declared in the contract. Please review.';
        
        actions.innerHTML = \`
          <button class="btn btn-secondary" onclick="submitAction('reject')">Reject Scope</button>
          <button class="btn btn-primary" onclick="submitAction('approve')">Approve Scope</button>
        \`;
      } else if (type === 'patch-review') {
        title.innerText = 'Review Proposed Patch';
        desc.innerText = 'Review structural AST diffs and file changes below. Uncheck files to revert them. Approve to apply.';

        // 1. Checklist
        window.allApprovedFiles = [...(details?.files || [])];
        const checklistDiv = document.createElement('div');
        checklistDiv.className = 'checklist-container';
        
        const label = document.createElement('div');
        label.style.fontSize = '0.75rem';
        label.style.fontWeight = 'bold';
        label.style.color = 'var(--text-muted)';
        label.style.marginBottom = '4px';
        label.innerText = 'SELECT FILES TO APPLY:';
        checklistDiv.appendChild(label);

        (details?.files || []).forEach(file => {
          const itemLabel = document.createElement('label');
          itemLabel.className = 'checklist-item';
          
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = true;
          cb.onchange = (e) => {
            if (e.target.checked) {
              if (!window.allApprovedFiles.includes(file)) {
                window.allApprovedFiles.push(file);
              }
            } else {
              window.allApprovedFiles = window.allApprovedFiles.filter(f => f !== file);
            }
            updateDiffVisibility();
          };
          
          itemLabel.appendChild(cb);
          const txt = document.createTextNode(' ' + file);
          itemLabel.appendChild(txt);
          checklistDiv.appendChild(itemLabel);
        });
        diffContainer.appendChild(checklistDiv);

        // 2. AST Diff Explorer
        if (details?.astDiffs && details.astDiffs.length > 0) {
          const astHeading = document.createElement('div');
          astHeading.style.fontSize = '0.75rem';
          astHeading.style.fontWeight = 'bold';
          astHeading.style.color = 'var(--text-muted)';
          astHeading.style.marginTop = '12px';
          astHeading.innerText = 'STRUCTURAL AST DIFFERENCES:';
          diffContainer.appendChild(astHeading);

          details.astDiffs.forEach(astDiff => {
            const detailsEl = document.createElement('details');
            detailsEl.className = 'ast-tree-details';
            detailsEl.open = true;

            const summaryEl = document.createElement('summary');
            summaryEl.className = 'ast-tree-summary';
            summaryEl.innerText = \`\${astDiff.file} (\${astDiff.items.length} changes)\`;
            detailsEl.appendChild(summaryEl);

            const ul = document.createElement('ul');
            ul.className = 'ast-tree-list';

            astDiff.items.forEach(item => {
              const li = document.createElement('li');
              li.className = item.type === 'added' ? 'ast-added' : 'ast-deleted';
              // XSS Safe textContent insertion
              li.textContent = \`\${item.type === 'added' ? '[+]' : '[-]'} \${item.signature}\`;
              ul.appendChild(li);
            });

            detailsEl.appendChild(ul);
            diffContainer.appendChild(detailsEl);
          });
        }

        // 3. Diff content (split by file)
        const diffHeading = document.createElement('div');
        diffHeading.style.fontSize = '0.75rem';
        diffHeading.style.fontWeight = 'bold';
        diffHeading.style.color = 'var(--text-muted)';
        diffHeading.style.marginTop = '12px';
        diffHeading.style.marginBottom = '6px';
        diffHeading.innerText = 'FILE DIFFS:';
        diffContainer.appendChild(diffHeading);

        if (details?.diff) {
          diffContainer.style.display = 'block';
          renderDiffHTML(diffContainer, details.diff);
          updateDiffVisibility();
        }

        actions.innerHTML = \`
          <button class="btn btn-secondary" onclick="submitAction('reject')">Reject Patch</button>
          <button class="btn btn-primary" onclick="submitAction('approve')">Approve & Apply</button>
        \`;
      } else if (type === 'retry-choice') {
        title.innerText = 'Patch Verification Failed';
        desc.innerText = details?.message || 'The verification runner or critic review failed. Please choose the next step.';
        indicator.style.background = 'var(--warning)';
        indicator.style.boxShadow = '0 0 16px var(--warning-glow)';

        commentContainer.style.display = 'flex';

        actions.innerHTML = \`
          <button class="btn btn-danger" onclick="submitAction('abort')">Abort & Rollback</button>
          <button class="btn btn-secondary" onclick="submitAction('override')">Override & Proceed</button>
          <button class="btn btn-warning" onclick="submitAction('retry')">Retry with Comment</button>
        \`;
      }
    }

    function updateDiffVisibility() {
      const sections = document.querySelectorAll('.file-diff-section');
      sections.forEach(sec => {
        const file = sec.getAttribute('data-file');
        if (file === 'header') return;
        if (window.allApprovedFiles.includes(file)) {
          sec.style.display = 'block';
        } else {
          sec.style.display = 'none';
        }
      });
    }

    function renderDiffHTML(container, diffText) {
      if (!diffText || diffText.includes('Git diff preview is not available')) {
        const div = document.createElement('div');
        div.style.padding = '8px';
        div.style.color = 'var(--text-muted)';
        div.innerText = diffText || 'No diff preview available (full workspace restore only).';
        container.appendChild(div);
        return;
      }

      // Split diff by file blocks
      const sections = [];
      const lines = diffText.split('\n');
      let currentSection = null;

      for (const line of lines) {
        if (line.startsWith('diff --git ')) {
          if (currentSection) {
            sections.push(currentSection);
          }
          // Extract filename: e.g. diff --git a/src/cli/ui-server.ts b/src/cli/ui-server.ts
          let fileName = 'unknown';
          const parts = line.split(' b/');
          if (parts.length > 1) {
            fileName = parts[1].trim();
          } else {
            const match = line.match(/b\/(.+)$/);
            if (match) fileName = match[1].trim();
          }
          currentSection = {
            file: fileName,
            lines: [line]
          };
        } else {
          if (currentSection) {
            currentSection.lines.push(line);
          } else {
            currentSection = {
              file: 'header',
              lines: [line]
            };
          }
        }
      }
      if (currentSection) {
        sections.push(currentSection);
      }

      sections.forEach(sec => {
        const secDiv = document.createElement('div');
        secDiv.className = 'file-diff-section';
        secDiv.setAttribute('data-file', sec.file);

        const header = document.createElement('div');
        header.className = 'file-diff-header';
        header.innerText = sec.file;
        secDiv.appendChild(header);

        const body = document.createElement('div');
        body.style.padding = '8px';
        sec.lines.forEach(l => {
          const span = document.createElement('span');
          span.className = 'diff-line';
          if (l.startsWith('+')) {
            span.classList.add('diff-add');
          } else if (l.startsWith('-')) {
            span.classList.add('diff-del');
          }
          span.innerText = l;
          body.appendChild(span);
        });
        secDiv.appendChild(body);
        container.appendChild(secDiv);
      });
    }

    async function submitAction(action) {
      const comment = document.getElementById('comment-text').value;
      const body = { 
        action, 
        comment,
        approvedFiles: window.allApprovedFiles 
      };
      
      try {
        const res = await fetch('/api/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const errText = await res.text();
          alert(\`Action failed: \${errText}\`);
        }
      } catch (err) {
        console.error('Fetch Action Error:', err);
        alert('Failed to send decision to CLI.');
      }
    }

    async function submitExit() {
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({ action: 'exit' })
        });
      } catch (err) {
        console.error('Exit Action Error:', err);
      }
    }

    // Connect immediately
    connect();
  </script>
</body>
</html>`;
