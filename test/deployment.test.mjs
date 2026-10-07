import test from 'node:test';
import assert from 'node:assert/strict';
import { startProduction } from '../app/server.js';

async function withServer(fn) {
  const { server, close } = await startProduction({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await close();
  }
}

test('GET /health returns ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
  });
});

test('GET /version returns name + version + commit', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/version`);
    const body = await res.json();
    assert.equal(body.name, '9-skill-react-best-practices-demo');
    assert.ok(body.version);
    assert.ok(body.commit);
  });
});

test('GET /api/skills serves the shelf parsed from examples/', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/skills`);
    assert.equal(res.status, 200);
    const skills = await res.json();
    assert.equal(skills.length, 2);
    assert.ok(skills.every((s) => s.name && s.description && s.archetype && s.body));
  });
});

test('GET /api/fixtures serves the three component trees', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/fixtures`);
    const fixtures = await res.json();
    assert.deepEqual(fixtures.map((f) => f.app).sort(),
      ['checkout', 'checkout-fixed', 'clean-but-broken']);
    assert.ok(fixtures.every((f) => f.root && f.components && f.ticks));
  });
});

test('static allowlist serves the lab; everything else 404s', async () => {
  await withServer(async (base) => {
    for (const path of ['/', '/guide.html', '/styles.css', '/app.js', '/inspector.mjs', '/simulator.mjs', '/rules.mjs']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, path);
    }
    for (const path of ['/package.json', '/../app/server.js', '/nope', '/api/skills/extra']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 404, path);
    }
  });
});

test('security headers are set on every response', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const missing = await fetch(`${base}/nope`);
    assert.equal(missing.headers.get('x-content-type-options'), 'nosniff');
  });
});
