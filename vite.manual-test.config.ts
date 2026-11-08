import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The normal App/Auth/Supabase graph is deliberately absent from this artifact.
export default defineConfig({
  plugins: [react()], base: '/', publicDir: false,
  build: {outDir: 'dist-manual-test', rollupOptions: {input: 'authoring-week-preview.html'}},
});
