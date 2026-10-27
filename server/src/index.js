import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, APPS, DB_FILE } from './config.js';
import { seedIfEmpty } from './db/seed.js';
import { attachRealtime } from './realtime.js';
import { app } from './app.js';

if (seedIfEmpty()) console.log(`Created a fresh database at ${DB_FILE} (starting logins are in README.md).`);

const built = APPS.filter(({ dir }) => fs.existsSync(path.join(dir, 'index.html')));
const server = http.createServer(app);
attachRealtime(server);

server.listen(PORT, () => {
  console.log(`Velan API on http://localhost:${PORT}${built.length ? ` (serving ${built.map((b) => b.base).join(', ')})` : ''}`);
});
