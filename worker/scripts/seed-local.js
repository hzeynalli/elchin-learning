// Seed (and optionally refill) the item bank from this machine instead of through the Worker.
// Why: the free Cloudflare plan allows 50 subrequests per invocation and the seed needs more.
// Usage: node scripts/seed-local.js            (reads ../.env: SUPABASE_SERVICE_KEY, optional ANTHROPIC_API_KEY)
//        node scripts/seed-local.js --refill 8 (also run refillBank with that many Claude calls; needs ANTHROPIC_API_KEY)
import { readFileSync } from 'node:fs';
import { makeRepo } from '../src/repo.js';
import { seedFromData, refillBank } from '../src/bank.js';
const envFile = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const env = { SUPABASE_URL: 'https://vwyrphshpikkpbybghye.supabase.co', SUPABASE_SERVICE_KEY: envFile.SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY: envFile.ANTHROPIC_API_KEY, MODEL_GEN: 'claude-sonnet-5', MODEL_GUARD: 'claude-haiku-4-5-20251001', DAILY_BUDGET_USD: '3', TIMEZONE: 'Asia/Baku', ...process.env };
if (!env.SUPABASE_SERVICE_KEY) { console.error('SUPABASE_SERVICE_KEY missing in .env'); process.exit(1); }
const repo = makeRepo(env, null);
const j = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const passages = [...j('../../data/passages/fables.json').passages, ...j('../../data/passages/informational.json').passages];
const items = [...j('../../data/items/lu_grammar_mechanics.json').items, ...j('../../data/items/lu_writing.json').items, ...j('../../data/items/science.json').items];
console.log('seed:', JSON.stringify(await seedFromData(repo, { passages, items })));
const i = process.argv.indexOf('--refill');
if (i > 0) { if (!env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY missing in .env — refill skipped'); process.exit(1); } console.log('refill:', JSON.stringify(await refillBank(env, repo, { maxCalls: Number(process.argv[i + 1] || 8) }))); }
