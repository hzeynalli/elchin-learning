// Node loader so worker/src can run outside Wrangler: `.md` prompt files import as text (wrangler.toml [[rules]] Text).
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  import { readFile } from 'node:fs/promises';
  export async function load(url, context, next) {
    if (url.endsWith('.md')) { const text = await readFile(new URL(url), 'utf8'); return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(text) + ';' }; }
    return next(url, context);
  }`), import.meta.url);
