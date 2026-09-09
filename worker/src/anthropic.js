// One LLM helper for the whole Worker (docs/08). Models are pinned in wrangler.toml vars, never aliases.
// - Cost ledger + daily budget cap (GAPS.md): every call records tokens → USD in llm_usage; when the day's spend
//   reaches DAILY_BUDGET_USD the helper throws BudgetExceeded and callers fall back to practice-only.
// - Prompt caching on the system prompt (stable prefix first; volatile runtime values go in the first user turn).
// - Fable 5.1: thinking is always on (no `thinking` param), no sampling params, `refusal` stop reason handled.
//   Sonnet 5 / Fable 5.1 have no `temperature`: the "temperature 0" in prompts/*.md is approximated with effort "low".
// - MOCK mode when ANTHROPIC_API_KEY is unset: deterministic canned replies so the whole UI works without a key.
import Anthropic from '@anthropic-ai/sdk';
// Organisation-level API keys must name a workspace on every request (400 otherwise). Set the ANTHROPIC_WORKSPACE_ID
// secret, or use a key created inside a workspace and leave it unset.
const wsHeaders = (env) => (env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : undefined);

// USD per million tokens — platform.claude.com pricing table, Sep 2026 (cache read ≈ 10 % of input except Fable 5.1).
export const PRICES = {
  'claude-fable-5-1':          { in: 10, out: 50, cache_read: 0.25, cache_write: 12.5 },
  'claude-sonnet-5':           { in: 2,  out: 10, cache_read: 0.2,  cache_write: 2.5 },
  'claude-haiku-4-5-20251001': { in: 1,  out: 5,  cache_read: 0.1,  cache_write: 1.25 },
  'claude-haiku-4-5':          { in: 1,  out: 5,  cache_read: 0.1,  cache_write: 1.25 },
};
export function usdFor(model, usage = {}) {
  const p = PRICES[model] || { in: 10, out: 50, cache_read: 1, cache_write: 12.5 };
  const M = 1e6;
  return ((usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out +
    (usage.cache_read_input_tokens || 0) * p.cache_read + (usage.cache_creation_input_tokens || 0) * p.cache_write) / M;
}
export class BudgetExceeded extends Error { constructor(msg) { super(msg); this.name = 'BudgetExceeded'; this.status = 402; } }
export const isMock = (env) => !env.ANTHROPIC_API_KEY;

export function extractJSON(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch {}
  const s = Math.min(...['{', '['].map((c) => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  if (!isFinite(s)) return null;
  const e = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

async function checkBudget(env, repo) {
  const budget = Number(env.DAILY_BUDGET_USD || 3);
  const spent = repo?.usageToday ? await repo.usageToday() : 0;
  if (spent >= budget) throw new BudgetExceeded(`Daily LLM budget of USD ${budget} reached (spent ${spent.toFixed(2)})`);
}
async function record(repo, model, purpose, usage) {
  if (!repo?.recordUsage || !usage) return;
  try {
    await repo.recordUsage({ model, purpose, input_tokens: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0), output_tokens: usage.output_tokens || 0, usd: usdFor(model, usage) });
  } catch (e) { console.warn('usage record failed', e.message); }
}
function buildParams(env, { model, system, messages, max_tokens, effort }) {
  const params = { model, max_tokens: max_tokens ?? 1024, messages };
  // system: a string (cached as one block) or an array of blocks — put the stable text first, cache_control on it,
  // volatile per-turn values after (docs/08: prompt caching for the coach system prompt + skill explanation)
  if (Array.isArray(system)) params.system = system.map((b, i) => (typeof b === 'string' ? { type: 'text', text: b, ...(i === 0 ? { cache_control: { type: 'ephemeral' } } : {}) } : b));
  else if (system) params.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  if (effort && !model.startsWith('claude-haiku')) params.output_config = { effort };
  return params;
}

/**
 * Non-streaming call. Returns { text, json?, usage, refusal? }.
 * @param {object} o { purpose, model, system, messages, max_tokens, json, effort }
 */
export async function llm(env, repo, o) {
  await checkBudget(env, repo);
  if (isMock(env)) return mock(o);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 3, defaultHeaders: wsHeaders(env) });
  const res = await client.messages.create(buildParams(env, o));
  await record(repo, o.model, o.purpose, res.usage);
  if (res.stop_reason === 'refusal') return { refusal: true, category: res.stop_details?.category ?? null, text: '', usage: res.usage };
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const out = { text, usage: res.usage, stop_reason: res.stop_reason };
  if (o.json) {
    out.json = extractJSON(text);
    if (out.json == null) {                                   // one repair attempt: ask for JSON only
      const res2 = await client.messages.create(buildParams(env, { ...o, messages: [...o.messages, { role: 'assistant', content: text }, { role: 'user', content: 'Reply with only the JSON, no prose.' }] }));
      await record(repo, o.model, o.purpose, res2.usage);
      const t2 = res2.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      out.json = extractJSON(t2); out.text = t2;
    }
  }
  return out;
}

/**
 * Streaming call → a Response with Server-Sent Events: `data: {"delta":"..."}` … `data: {"done":true,"text":"…"}`.
 * onFinal(fullText, usage) runs after the stream ends (e.g. to store the coach turn).
 */
export async function llmStreamResponse(env, repo, o, onFinal, extraHeaders = {}) {
  await checkBudget(env, repo);
  const enc = new TextEncoder();
  const headers = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...extraHeaders };
  if (isMock(env)) {
    const m = mock(o);
    const stream = new ReadableStream({
      async start(c) {
        for (const word of m.text.split(/(?<=\s)/)) { c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: word })}\n\n`)); }
        let meta = null; try { meta = onFinal ? await onFinal(m.text, null) : null; } catch (e) { meta = { error: e.message }; }
        c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, text: m.text, meta })}\n\n`)); c.close();
      },
    });
    return new Response(stream, { headers });
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, defaultHeaders: wsHeaders(env) });
  const s = client.messages.stream(buildParams(env, o));
  let text = '';
  const stream = new ReadableStream({
    async start(c) {
      try {
        for await (const ev of s) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { text += ev.delta.text; c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: ev.delta.text })}\n\n`)); }
        }
        const final = await s.finalMessage();
        await record(repo, o.model, o.purpose, final.usage);
        if (final.stop_reason === 'refusal') { text = o.refusalText || "Let's get back to our skill — what do you think the first step is?"; c.enqueue(enc.encode(`data: ${JSON.stringify({ delta: text, refusal: true })}\n\n`)); }
        let meta = null; try { meta = onFinal ? await onFinal(text, final.usage) : null; } catch (e) { meta = { error: e.message }; }
        c.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, text, meta })}\n\n`));
      } catch (e) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
      } finally { c.close(); }
    },
  });
  return new Response(stream, { headers });
}

// ---------------------------------------------------------------------------------------------------------------
// MOCK mode — deterministic, keyed by purpose. Lets the UI, tests and the parent flows run with no API key.
function mock(o) {
  const last = [...(o.messages || [])].reverse().find((m) => m.role === 'user');
  const userText = typeof last?.content === 'string' ? last.content : (last?.content || []).map((b) => b.text || '').join(' ');
  switch (o.purpose) {
    case 'mark': {                                              // heuristic keyword overlap vs rubric → low confidence → parent queue
      const rub = /Expected answer \/ rubric:\s*([\s\S]*?)\nStudent answer:\s*([\s\S]*)$/i.exec(userText);
      const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
      const a = new Set(norm(rub?.[1])), b = new Set(norm(rub?.[2]));
      const hit = [...a].filter((w) => b.has(w)).length, rate = a.size ? hit / a.size : 0;
      const json = { correct: rate >= 0.5, partial: Math.round(rate * 100) / 100, confidence: 0.6, feedback: rate >= 0.5 ? 'You named the key idea — nice.' : 'Look again at the question: what exactly is it asking you to show?' };
      return { text: JSON.stringify(json), json, usage: null, mock: true };
    }
    case 'verify': return { text: '{"ok":true,"slip":true,"reason":"mock"}', json: { ok: true, slip: true, reason: 'mock' }, usage: null, mock: true };
    case 'solve': return { text: '{"answer":null}', json: { answer: null }, usage: null, mock: true };
    case 'guard': return { text: '{"off_topic":false}', json: { off_topic: false }, usage: null, mock: true };
    case 'generate': {
      const n = Number(/Count:\s*(\d+)/.exec(userText)?.[1] || 3);
      const items = Array.from({ length: n }, (_, i) => ({ stem: `[MOCK item ${i + 1}] Which sentence is written correctly?`, format: 'mc4', options: ['the dog run fast.', 'The dog runs fast.', 'the Dog runs fast', 'The dog run fast.'], answer: 'B', distractor_rationale: { A: 'capitalisation and agreement', C: 'capitalisation', D: 'subject–verb agreement' }, explanation: 'A sentence starts with a capital letter and the verb must agree with the subject.', rule: 'Subject–verb agreement; capitalisation' }));
      return { text: JSON.stringify(items), json: items, usage: null, mock: true };
    }
    case 'story': {                                              // word-problem wording around a generated skeleton
      const json = { stem: `[MOCK story] ${userText.slice(0, 80)}…` };
      return { text: JSON.stringify(json), json, usage: null, mock: true };
    }
    case 'summary': return { text: 'Parent summary (mock): worked on one skill; next step is a practice set.', usage: null, mock: true };
    case 'coach':
    default: {
      const t = userText.toLowerCase();
      let text;
      if (/\[session_end\]/.test(t)) text = 'Tell me in one sentence what you learned today. Next time we start with a practice set. You checked your answer without being asked — that is the move.\n[PARENT_SUMMARY]\nWorked on the skill with two explanations; ready for practice.';
      else if (/\[start\]/.test(t)) text = "Let's start with what you already know: if you have 5 boxes with 12 pencils each, how would you find the total? Just tell me your first step.";
      else if (/don'?t (know|understand)|не понимаю/.test(t)) text = 'No problem — one step at a time. Look only at the ones column first. What do you get there?';
      else if (/(\d+)/.test(t)) text = 'You lined up the place values — that is exactly the move. Now the next column: what goes there?\n[READY_FOR_PRACTICE]';
      else text = "Good. Now say the rule back to me in your own words — what do you do first, and why?";
      return { text, usage: null, mock: true };
    }
  }
}
