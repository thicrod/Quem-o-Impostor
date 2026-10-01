import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const SERVER = process.env.VITE_DEV_SERVER_TARGET || 'http://localhost:3001';

// Dá um nome de cache novo ao service worker a cada build (limpa versões antigas).
function swBuildId() {
  let outDir = 'dist';
  return {
    name: 'sw-build-id',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const id = Date.now().toString(36);
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', id));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swBuildId()],
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
    rollupOptions: {
      output: {
        // Bibliotecas num arquivo separado: mudam pouco, então o navegador reaproveita
        // o cache delas quando só o código do jogo é atualizado.
        manualChunks(id) {
          // (o QR code continua separado: só é baixado quando alguém abre o QR)
          if (id.includes('node_modules') && !id.includes('qrcode-generator') && !id.includes('@fontsource')) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
