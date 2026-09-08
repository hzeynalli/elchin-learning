// Cloudflare Worker — router, CORS lock, JWT verification, role guards. Endpoints per BRIEF §6.
import { bearer, verifySupabaseJWT } from './auth.js';
import { makeRepo } from './repo.js';
import { dashboard } from './dashboard.js';
import { manualTemplate, manualEntry } from './manual.js';
import { rewardsRoutes } from './rewards.js';
import { settingsRoutes } from './settings.js';
import { BudgetExceeded } from './anthropic.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {};
}

// route table: 'METHOD /path' → handler(ctx). Parent-only routes are listed in PARENT_ONLY.
const routes = {
  'GET /health': async ({ env, repo }) => ({ ok: true, llm: env.ANTHROPIC_API_KEY ? 'live' : 'mock', repo: repo?.mode ?? 'none', time: new Date().toISOString() }),
  'GET /dashboard': (ctx) => dashboard(ctx),
  'GET /manual-entry/template': () => manualTemplate(),
  'POST /manual-entry': (ctx) => manualEntry(ctx),
  ...rewardsRoutes,
  ...settingsRoutes,
};
const PARENT_ONLY = new Set(['POST /manual-entry', 'POST /rewards', 'POST /rewards/delete', 'POST /points', 'POST /settings', 'POST /map-results', 'POST /parent-mark', 'GET /export/csv', 'GET /export/weekly.pdf', 'GET /usage']);
const PUBLIC = new Set(['GET /health']);

// later phases register here (tests, coach, telemetry, bank, exports) — see registerRoutes()
export function registerRoutes(map, parentOnly = []) { Object.assign(routes, map); parentOnly.forEach((k) => PARENT_ONLY.add(k)); }

export async function handle(request, env, ctx) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const key = `${request.method} ${url.pathname.replace(/\/$/, '') || '/'}`;
  const handler = routes[key];
  if (!handler) return json({ error: 'not found' }, 404, cors);
  try {
    let user = null, profile = null, repo = null;
    if (!PUBLIC.has(key)) {
      const token = bearer(request);
      if (!token) return json({ error: 'missing bearer token' }, 401, cors);
      let payload;
      try { payload = await verifySupabaseJWT(token, env); } catch (e) { return json({ error: 'invalid token', detail: e.message }, 401, cors); }
      repo = makeRepo(env, token);
      profile = await repo.getProfile(payload.sub);
      if (!profile) return json({ error: 'no profile for this user' }, 403, cors);
      if (PARENT_ONLY.has(key) && profile.role !== 'parent') return json({ error: 'parent only' }, 403, cors);
      user = payload;
    } else { repo = env.SUPABASE_URL ? makeRepo(env, null) : null; }
    const studentId = profile ? (profile.role === 'student' ? profile.id : profile.student_id) : null;
    let body = null;
    if (request.method === 'POST') { try { body = await request.json(); } catch { body = {}; } }
    const result = await handler({ request, env, ctx, url, user, profile, studentId, repo, body, now: new Date() });
    if (result instanceof Response) { for (const [k, v] of Object.entries(cors)) result.headers.set(k, v); return result; }
    return json(result, 200, cors);
  } catch (e) {
    const status = e instanceof BudgetExceeded ? 402 : e.status || 500;
    if (status >= 500) console.error(key, e);
    return json({ error: e.message, code: e.name }, status, cors);
  }
}

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
  async scheduled(event, env, ctx) {
    const { refillBank } = await import('./bank.js').catch(() => ({ refillBank: null }));
    if (refillBank) ctx.waitUntil(refillBank(env));
  },
};
