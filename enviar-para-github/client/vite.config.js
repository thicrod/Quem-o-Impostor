import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const SERVER = process.env.VITE_DEV_SERVER_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // permite testar pelo celular na mesma rede (http://SEU-IP:5173)
    port: 5173,
    proxy: {
      '/socket.io': { target: SERVER, ws: true, changeOrigin: true },
      '/health': { target: SERVER },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
