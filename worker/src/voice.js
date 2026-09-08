// Voice through the Worker (docs/08): ElevenLabs TTS (eleven_v3, Russian-capable) and Scribe STT. Keys never reach the
// browser. If the key is missing the endpoints answer 503 and the browser falls back to the Web Speech API.
// Model ids per docs/08 — verify against the ElevenLabs docs when the key is added (HANDOFF §2).
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

export const voiceRoutes = {
  /** body: { text, lang? } → audio/mpeg stream */
  'POST /tts': async ({ env, body }) => {
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) throw bad('Voice is not configured yet (ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID). Using the browser voice instead.', 503);
    const text = String(body?.text || '').slice(0, 1500);
    if (!text) throw bad('text required');
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}/stream?output_format=mp3_44100_64`, {
      method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: env.ELEVENLABS_TTS_MODEL || 'eleven_v3', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2 } }),
    });
    if (!r.ok) throw bad(`TTS failed: ${r.status} ${(await r.text()).slice(0, 200)}`, 502);
    return new Response(r.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  },
  /** multipart/form-data with `audio` (webm/ogg/wav) → { text } */
  'POST /stt': async ({ env, request }) => {
    if (!env.ELEVENLABS_API_KEY) throw bad('Speech recognition is not configured yet (ELEVENLABS_API_KEY). Using the browser recogniser instead.', 503);
    const form = await request.formData();
    const audio = form.get('audio');
    if (!audio) throw bad('audio required');
    const out = new FormData();
    out.append('file', audio, 'speech.webm');
    out.append('model_id', env.ELEVENLABS_STT_MODEL || 'scribe_v1');
    out.append('language_code', String(form.get('lang') || 'en'));
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }, body: out });
    if (!r.ok) throw bad(`STT failed: ${r.status} ${(await r.text()).slice(0, 200)}`, 502);
    const j = await r.json();
    return { text: j.text || '' };
  },
  /** Telemetry batches (docs/07 §2): { session_id, events: [{kind, at, payload?}] } every 30 s */
  'POST /telemetry': async ({ repo, studentId, body }) => {
    const events = Array.isArray(body?.events) ? body.events.slice(0, 200) : [];
    const rows = events.filter((e) => e && typeof e.kind === 'string').map((e) => ({ student_id: studentId, session_id: body.session_id || null, kind: e.kind.slice(0, 32), at: e.at || new Date().toISOString(), payload: e.payload || null }));
    if (rows.length) await repo.insertTelemetry(rows);
    return { ok: true, stored: rows.length };
  },
};
