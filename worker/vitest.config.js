import { readFileSync } from 'node:fs';

export default {
  test: { include: ['src/**/*.test.js', 'generators/**/*.test.js'], testTimeout: 8000 },
  // prompts/*.md are imported as text by the Worker (wrangler [[rules]] type = "Text"); mirror that in tests.
  plugins: [{
    name: 'md-as-text', enforce: 'pre',
    load(id) { if (id.endsWith('.md')) return `export default ${JSON.stringify(readFileSync(id, 'utf8'))};`; },
  }],
};
