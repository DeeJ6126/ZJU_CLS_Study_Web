import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const githubPagesBase = '/ZJU_CLS_Study_Web/';

export default defineConfig({
  plugins: [vue()],
  base: process.env.GITHUB_PAGES === 'true' ? githubPagesBase : './',
  server: {
    proxy: {
      '/zjubio/api': {
        target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:5175',
        rewrite: (path) => path.replace(/^\/zjubio\/api/, '/api'),
      },
    },
  },
});
