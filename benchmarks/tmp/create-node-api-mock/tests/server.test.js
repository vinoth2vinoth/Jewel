const test = require('node:test');
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
