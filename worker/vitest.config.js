export default {
  test: { include: ['src/**/*.test.js', 'generators/**/*.test.js'], testTimeout: 8000 },
  // prompts/*.md are imported as raw strings by the Worker (wrangler rule) — mirror that for tests
  assetsInclude: ['**/*.md'],
  plugins: [{ name: 'md-raw', transform(code, id) { if (id.endsWith('.md')) return { code: `export default ${JSON.stringify(code)};`, map: null }; } }],
};
