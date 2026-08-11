import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

function localUsagePlugin() {
  return {
    name: 'token-sprite-local-usage',
    configureServer(server) {
      server.middlewares.use('/api/usage', async (_req, res) => {
        try {
          const { computeLocalUsage } = await import('./scripts/usage.mjs');
          const data = await computeLocalUsage();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/usage', async (_req, res) => {
        try {
          const { computeLocalUsage } = await import('./scripts/usage.mjs');
          const data = await computeLocalUsage();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [localUsagePlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        journal: 'journal.html', // 成长日记独立窗口
      },
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'release/**', '.worktrees/**'],
  },
});
