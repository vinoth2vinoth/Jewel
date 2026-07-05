const http = require('http');

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
