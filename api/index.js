import { app } from '../server/src/app.js';
import { seedIfEmpty } from '../server/src/db/seed.js';

// Ensure data is seeded on cold start if database is empty
try {
  seedIfEmpty();
} catch (e) {
  // Non-fatal
}

export default function handler(req, res) {
  // In Vercel serverless functions, req.url may have /api stripped by routing rewrites.
  // Ensure it has the /api prefix so Express /api router handles it correctly.
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
}
