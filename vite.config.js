import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const githubPagesBase = '/ZJU_CLS_Study_Web/';

export default defineConfig({
  plugins: [vue()],
  base: process.env.GITHUB_PAGES === 'true' ? githubPagesBase : './',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5175',
    },
  },
});
