// Public configuration — safe to commit (the anon key is public by design; RLS protects the data).
// WORKER_URL: set after `npx wrangler deploy` (workers.dev URL) or a custom domain. Dev override without editing:
//   localStorage.setItem('elchin.worker_url', 'http://localhost:8787')
// FEATURES: the full AI coach loop is parked (decision of 9 Sep 2026); Nala the buddy (10 Sep) guides, explains wrong
//   answers, speaks, and files bug reports. Flip coach to true to bring the old Coach tab back.
// Preview without logging in (design review, no data is written): open the site with ?preview=1  (add &role=parent).
window.ELCHIN_CONFIG = {
  SUPABASE_URL: 'https://vwyrphshpikkpbybghye.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3eXJwaHNocGlra3BieWJnaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTM2NTMsImV4cCI6MjEwNDQ2OTY1M30.dkQMS8h9C_HdRhp0L3k9v7O4UOVAKShcWyBkeq1VwfE',
  WORKER_URL: (typeof localStorage !== 'undefined' && localStorage.getItem('elchin.worker_url')) || 'https://elchin-learning.hzeynalli.workers.dev',
  DUE_DATE: '2026-10-01',
  TIMEZONE: 'Asia/Baku',
  FEATURES: { coach: false, voice: false, buddy: true },  // buddy = Nala (text). voice: off since 10 Sep (cost) — flip to true to bring back the speaker/mic; ElevenLabs secrets stay set
  // Terms shown on the Map and in the parent's Unlock panel. Grade-4 skills are "Last year"; Grade-5 skills split by planned month.
  TERMS: [
    { id: 'past', label: 'Last year', hint: 'Grade 4 — make sure nothing was forgotten', match: (s) => Number(s.grade) < 5 },
    { id: 's1', label: 'Semester 1', hint: 'September to January', match: (s) => !s.planned_month || s.planned_month < '2027-02' },
    { id: 's2', label: 'Semester 2', hint: 'February to June', match: () => true },
  ],
};
