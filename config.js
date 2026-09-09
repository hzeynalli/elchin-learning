// Public configuration — safe to commit (the anon key is public by design; RLS protects the data).
// WORKER_URL: set after `npx wrangler deploy` (workers.dev URL) or a custom domain. Dev override without editing:
//   localStorage.setItem('elchin.worker_url', 'http://localhost:8787')
window.ELCHIN_CONFIG = {
  SUPABASE_URL: 'https://vwyrphshpikkpbybghye.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3eXJwaHNocGlra3BieWJnaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTM2NTMsImV4cCI6MjEwNDQ2OTY1M30.dkQMS8h9C_HdRhp0L3k9v7O4UOVAKShcWyBkeq1VwfE',
  WORKER_URL: (typeof localStorage !== 'undefined' && localStorage.getItem('elchin.worker_url')) || 'https://elchin-learning.hzeynalli.workers.dev',
  DUE_DATE: '2026-10-01',
  TIMEZONE: 'Asia/Baku',
};
