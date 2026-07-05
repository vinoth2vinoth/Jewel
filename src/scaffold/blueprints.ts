export type BlueprintId = 'static-site' | 'node-api' | 'fullstack';

export interface BlueprintFile {
  path: string;
  content: string;
}

export interface ProjectBlueprint {
  id: BlueprintId;
  name: string;
  description: string;
  /** Plain-language hints matched against the user's wizard answer */
  keywords: string[];
  files: BlueprintFile[];
  commands: {
    lint: string;
    typecheck: string;
    test: string;
    build: string;
    e2e: string;
  };
  /** Ordered starter milestones for `jewel build` on this project type */
  milestones: string[];
}

const STATIC_SITE_FILES: BlueprintFile[] = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Site</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1 id="title">Welcome to My Site</h1>
    <p id="tagline">Built safely with Jewel.</p>
    <button id="action-btn">Click me</button>
    <p id="click-count">Clicks: 0</p>
  </main>
  <script src="script.js"></script>
</body>
</html>
`
  },
  {
    path: 'styles.css',
    content: `:root {
  --bg: #0f172a;
  --fg: #e2e8f0;
  --accent: #34d399;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--fg);
  min-height: 100vh;
  display: grid;
  place-items: center;
}

main { text-align: center; padding: 2rem; }

h1 { color: var(--accent); margin-bottom: 0.5rem; }

button {
  margin-top: 1rem;
  padding: 0.6rem 1.4rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg);
  cursor: pointer;
}

button:hover { opacity: 0.9; }
`
  },
  {
    path: 'script.js',
    content: `let clicks = 0;

function incrementClicks() {
  clicks += 1;
  return clicks;
}

if (typeof document !== 'undefined') {
  const btn = document.getElementById('action-btn');
  const counter = document.getElementById('click-count');
  if (btn && counter) {
    btn.addEventListener('click', () => {
      counter.textContent = 'Clicks: ' + incrementClicks();
    });
  }
}

if (typeof module !== 'undefined') {
  module.exports = { incrementClicks };
}
`
  },
  {
    path: 'tests/site.test.js',
    content: `const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('index.html exists and has a title', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('<title>'));
  assert.ok(html.includes('id="title"'));
});

test('script increments click counter', () => {
  const { incrementClicks } = require(path.join(root, 'script.js'));
  const before = incrementClicks();
  const after = incrementClicks();
  assert.strictEqual(after, before + 1);
});
`
  },
  {
    path: 'package.json',
    content: `{
  "name": "PROJECT_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "node --test tests/*.test.js",
    "start": "npx serve . || echo Open index.html in your browser"
  }
}
`
  },
  {
    path: 'README.md',
    content: `# PROJECT_NAME

A static website scaffolded by Jewel.

## Run

Open \`index.html\` in your browser.

## Test

\`\`\`bash
npm test
\`\`\`

## Extend with Jewel

\`\`\`bash
jewel run "Add a dark/light theme toggle" --yes
\`\`\`
`
  }
];

const NODE_API_SERVER = `const http = require('http');

const items = [];
let nextId = 1;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  if (req.method === 'GET' && url.pathname === '/api/items') {
    return sendJson(res, 200, { items });
  }

  if (req.method === 'POST' && url.pathname === '/api/items') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
    if (!body || typeof body.name !== 'string' || body.name.trim() === '') {
      return sendJson(res, 400, { error: 'Field "name" is required' });
    }
    const item = { id: nextId++, name: body.name.trim() };
    items.push(item);
    return sendJson(res, 201, { item });
  }

  sendJson(res, 404, { error: 'Not found' });
}

function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch(() => sendJson(res, 500, { error: 'Internal error' }));
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () => {
    console.log('API listening on http://localhost:' + port);
  });
}

module.exports = { createServer };
`;

const NODE_API_TEST = `const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server.js');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, async () => {
      const port = server.address().port;
      const base = 'http://127.0.0.1:' + port;
      try {
        await fn(base);
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('GET /health returns ok', async () => {
  await withServer(async base => {
    const res = await fetch(base + '/health');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  });
});

test('POST /api/items creates an item, GET lists it', async () => {
  await withServer(async base => {
    const post = await fetch(base + '/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'first item' })
    });
    assert.strictEqual(post.status, 201);

    const list = await fetch(base + '/api/items');
    const body = await list.json();
    assert.ok(body.items.some(i => i.name === 'first item'));
  });
});

test('POST /api/items rejects missing name', async () => {
  await withServer(async base => {
    const res = await fetch(base + '/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });
});
`;

const NODE_API_FILES: BlueprintFile[] = [
  { path: 'src/server.js', content: NODE_API_SERVER },
  { path: 'tests/server.test.js', content: NODE_API_TEST },
  {
    path: 'package.json',
    content: `{
  "name": "PROJECT_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test tests/*.test.js"
  }
}
`
  },
  {
    path: 'README.md',
    content: `# PROJECT_NAME

A zero-dependency Node.js REST API scaffolded by Jewel.

## Run

\`\`\`bash
npm start
\`\`\`

## Endpoints

- \`GET /health\` — health check
- \`GET /api/items\` — list items
- \`POST /api/items\` — create item (JSON: \`{ "name": "..." }\`)

## Test

\`\`\`bash
npm test
\`\`\`

## Extend with Jewel

\`\`\`bash
jewel run "Add DELETE /api/items/:id endpoint with tests" --yes
\`\`\`
`
  }
];

const FULLSTACK_SERVER = NODE_API_SERVER.replace(
  `  if (req.method === 'GET' && url.pathname === '/health') {`,
  `  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const fs = require('fs');
    const path = require('path');
    const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(htmlPath));
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {`
);

const FULLSTACK_FILES: BlueprintFile[] = [
  { path: 'src/server.js', content: FULLSTACK_SERVER },
  { path: 'tests/server.test.js', content: NODE_API_TEST },
  {
    path: 'public/index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PROJECT_NAME</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; max-width: 640px; margin: 3rem auto; padding: 0 1rem; }
    h1 { color: #34d399; }
    input, button { padding: 0.5rem 0.8rem; font-size: 1rem; border-radius: 6px; border: 1px solid #334155; }
    input { background: #1e293b; color: #e2e8f0; }
    button { background: #34d399; color: #0f172a; border: none; cursor: pointer; margin-left: 0.5rem; }
    ul { margin-top: 1rem; padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>PROJECT_NAME</h1>
  <div>
    <input id="item-name" placeholder="New item name" />
    <button id="add-btn">Add</button>
  </div>
  <ul id="items"></ul>
  <script>
    async function loadItems() {
      const res = await fetch('/api/items');
      const data = await res.json();
      const list = document.getElementById('items');
      list.innerHTML = '';
      for (const item of data.items) {
        const li = document.createElement('li');
        li.textContent = item.name;
        list.appendChild(li);
      }
    }
    document.getElementById('add-btn').addEventListener('click', async () => {
      const input = document.getElementById('item-name');
      const name = input.value.trim();
      if (!name) return;
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      input.value = '';
      loadItems();
    });
    loadItems();
  </script>
</body>
</html>
`
  },
  {
    path: 'package.json',
    content: `{
  "name": "PROJECT_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test tests/*.test.js"
  }
}
`
  },
  {
    path: 'README.md',
    content: `# PROJECT_NAME

A zero-dependency full-stack app (Node API + web frontend) scaffolded by Jewel.

## Run

\`\`\`bash
npm start
\`\`\`

Then open http://localhost:3000

## Test

\`\`\`bash
npm test
\`\`\`

## Extend with Jewel

\`\`\`bash
jewel run "Add a delete button next to each item" --yes
\`\`\`
`
  }
];

export const BLUEPRINTS: ProjectBlueprint[] = [
  {
    id: 'static-site',
    name: 'Static Website',
    description: 'HTML/CSS/JS website — portfolio, landing page, or simple game. No server needed.',
    keywords: ['website', 'site', 'page', 'landing', 'portfolio', 'blog', 'html', 'static', 'game'],
    files: STATIC_SITE_FILES,
    commands: { lint: '', typecheck: '', test: 'npm test', build: '', e2e: '' },
    milestones: [
      'Add an About section with a short bio to index.html and style it',
      'Add a contact form with client-side validation (no backend submit)',
      'Add a dark/light theme toggle that persists in localStorage'
    ]
  },
  {
    id: 'node-api',
    name: 'Node.js REST API',
    description: 'JSON REST API using only Node built-ins. Health check, items CRUD starter, tests included.',
    keywords: ['api', 'rest', 'backend', 'server', 'json', 'endpoint', 'service'],
    files: NODE_API_FILES,
    commands: { lint: '', typecheck: '', test: 'npm test', build: '', e2e: '' },
    milestones: [
      'Add DELETE /api/items/:id endpoint with tests',
      'Add PUT /api/items/:id endpoint to rename an item, with tests',
      'Add simple request logging middleware that logs method, path, and status'
    ]
  },
  {
    id: 'fullstack',
    name: 'Full-Stack Web App',
    description: 'Node API + browser frontend in one project. Items list UI wired to the API, tests included.',
    keywords: ['fullstack', 'full-stack', 'app', 'webapp', 'web app', 'frontend and backend', 'todo', 'crud'],
    files: FULLSTACK_FILES,
    commands: { lint: '', typecheck: '', test: 'npm test', build: '', e2e: '' },
    milestones: [
      'Add a delete button next to each item in the frontend, wired to a new DELETE endpoint',
      'Add item counts and an empty-state message to the frontend',
      'Add input length validation (max 100 chars) on both frontend and backend with tests'
    ]
  }
];

export function getBlueprint(id: string): ProjectBlueprint | null {
  return BLUEPRINTS.find(b => b.id === id) || null;
}

/** Pick the best blueprint for a plain-language description. Defaults to fullstack. */
export function matchBlueprint(description: string): ProjectBlueprint {
  const lower = description.toLowerCase();
  let best: ProjectBlueprint = BLUEPRINTS[2];
  let bestScore = 0;
  for (const bp of BLUEPRINTS) {
    let score = 0;
    for (const kw of bp.keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = bp;
    }
  }
  return best;
}
