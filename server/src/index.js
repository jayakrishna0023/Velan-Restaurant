import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { PORT, APPS, UPLOAD_DIR, DB_FILE } from './config.js';
import { seedIfEmpty } from './db/seed.js';
import { api } from './http/routes.js';
import { identify, securityHeaders, errorHandler } from './http/middleware.js';
import { attachRealtime } from './realtime.js';

if (seedIfEmpty()) console.log(`Created a fresh database at ${DB_FILE} (starting logins are in README.md).`);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);

app.get('/healthz', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api', express.json({ limit: '5mb' }), identify, api);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));

// Built apps (npm run build). Each is a single-page app with its own fallback.
const built = APPS.filter(({ dir }) => fs.existsSync(path.join(dir, 'index.html')));
for (const { base, dir } of built) {
  app.use(base, express.static(dir, {
    index: false,
    setHeaders(res, file) {
      res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  const shell = path.join(dir, 'index.html');
  app.get(base === '/' ? '/{*rest}' : [base, `${base}/{*rest}`], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(shell);
  });
}

if (!built.length) {
  app.get('/', (_req, res) => res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Velan API</title>
<body style="font:16px system-ui;padding:40px;background:#140c09;color:#f7efe2">
<h1 style="font-weight:600">Velan API is running</h1>
<p>The apps are served by their own dev servers while you develop:</p>
<ul><li><a style="color:#e8b04a" href="http://localhost:5173">Customer website — localhost:5173</a></li>
<li><a style="color:#e8b04a" href="http://localhost:5174/admin/">Admin console — localhost:5174/admin/</a></li>
<li><a style="color:#e8b04a" href="http://localhost:5175/delivery/">Delivery app — localhost:5175/delivery/</a></li></ul>
<p>Run <code>npm run build</code> and <code>npm start</code> to serve everything from this port.</p></body>`));
}

app.use(errorHandler);

const server = http.createServer(app);
attachRealtime(server);
server.listen(PORT, () => {
  console.log(`Velan API on http://localhost:${PORT}${built.length ? ` (serving ${built.map((b) => b.base).join(', ')})` : ''}`);
});
