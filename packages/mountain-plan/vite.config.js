import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/index.js', formats: ['es'], fileName: 'index' },
    cssCodeSplit: false,
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@carbon\//],
      output: { assetFileNames: (asset) => asset.name?.endsWith('.css') ? 'style.css' : 'assets/[name]-[hash][extname]' },
    },
  },
});
