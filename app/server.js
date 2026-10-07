import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkills, loadFixtures } from './load-fixtures.mjs';

const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const SKILLS = loadSkills().map(({ name, description, archetype, body, file }) =>
  ({ name, description, archetype, body, file }));
const FIXTURES = loadFixtures().map(({ app, label, root, ticks, reorderEvery, reorderAffects, listSize, designNote, components, dir, file }) =>
  ({ app, label, root, ticks, reorderEvery, reorderAffects, listSize, designNote, components, dir, file }));
const STATIC_FILES = new Map([
  ['/', ['text/html; charset=utf-8', 'index.html']],
  ['/guide.html', ['text/html; charset=utf-8', 'guide.html']],
  ['/styles.css', ['text/css; charset=utf-8', 'styles.css']],
  ['/app.js', ['text/javascript; charset=utf-8', 'app.js']],
  ['/inspector.mjs', ['text/javascript; charset=utf-8', 'inspector.mjs']],
  ['/simulator.mjs', ['text/javascript; charset=utf-8', 'simulator.mjs']],
  ['/rules.mjs', ['text/javascript; charset=utf-8', 'rules.mjs']],
].map(([path, [type, file]]) => [path, [type, readFileSync(join(PUBLIC, file))]]));
const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'permissions-policy': 'camera=(), geolocation=(), microphone=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
const JSON_TYPE = 'application/json; charset=utf-8';

export function createStaticServer() {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8' }).end('ok');
      return;
    }
    if (url.pathname === '/version') {
      res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': JSON_TYPE })
        .end(JSON.stringify({
          name: PACKAGE.name,
          version: PACKAGE.version,
          commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local',
        }));
      return;
    }
    if (url.pathname === '/api/skills') {
      res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': JSON_TYPE }).end(JSON.stringify(SKILLS));
      return;
    }
    if (url.pathname === '/api/fixtures') {
      res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': JSON_TYPE }).end(JSON.stringify(FIXTURES));
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const asset = STATIC_FILES.get(url.pathname);
      if (asset) {
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'cache-control': 'public, max-age=300',
          'content-type': asset[0],
        }).end(req.method === 'HEAD' ? undefined : asset[1]);
        return;
      }
    }
    res.writeHead(404, SECURITY_HEADERS).end('not found');
  });
}

export async function startProduction({ port = Number(process.env.PORT) || 3000 } = {}) {
  const server = createStaticServer();
  server.listen(port, '0.0.0.0');
  await once(server, 'listening');
  const close = () => new Promise((resolve) => server.close(resolve));
  return { server, close };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { server, close } = await startProduction();
  console.log(`Render Inspector listening on ${server.address().port}`);
  const shutdown = async () => { await close(); process.exit(0); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
