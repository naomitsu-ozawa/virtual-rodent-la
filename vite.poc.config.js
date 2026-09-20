import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist-poc',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        poc: resolve(process.cwd(), 'cornerstone-poc.html'),
      },
    },
  },
});
