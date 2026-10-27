import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const PRODUCTION = process.env.NODE_ENV === 'production';
export const PORT = Number(process.env.PORT) || 4000;
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_FILE = path.join(DATA_DIR, 'velan.db');
// Demo customers, a month of past orders and demo riders make the dashboards
// meaningful on a laptop. Off in production unless SEED_DEMO=true.
export const SEED_DEMO = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !PRODUCTION;
export const SESSION_DAYS = 60;

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpjkccggvbmvfgiusczf.supabase.co';
export const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwamtjY2dndmJtdmZnaXVzY3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNzI3NjEsImV4cCI6MjEwODY0ODc2MX0.bNIQ5rbFMWORoHtNtLoQpYsvK_V5AUYUhNIDTEyNPQQ';

// Built front-ends served by `npm start` (after `npm run build`).
export const APPS = [
  { base: '/admin', dir: path.join(ROOT, 'apps', 'admin', 'dist') },
  { base: '/delivery', dir: path.join(ROOT, 'apps', 'delivery', 'dist') },
  { base: '/', dir: path.join(ROOT, 'apps', 'customer', 'dist') },
];
