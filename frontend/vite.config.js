import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api calls are forwarded to the Django backend when VITE_USE_API=true
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
});
