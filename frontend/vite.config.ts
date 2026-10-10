import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the JurisFlow client.
 *
 * The client is a pure SPA: every `/api/*` call is forwarded to the Flask
 * backend by the dev-server proxy below, so the browser, the fetch wrapper
 * (`src/services/apiClient.ts`) and the AI proxy all speak one origin.
 */
export default defineConfig(({ mode }) => {
  // Third argument `''` loads every variable, not only VITE_* ones, because
  // API_PORT is used by the proxy at build/dev time and must stay server-side.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.API_PORT || '5000';
  const apiTarget = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
