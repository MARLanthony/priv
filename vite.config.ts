import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // `loadEnv(..., '')` reads every variable, not just the VITE_-prefixed ones,
  // so the proxy can follow API_PORT from .env.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.API_PORT || '4001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      /*
      * The real auth API in `server/` (Flask -> MySQL). It is only reached
       * when the MSW mock steps aside, i.e. with VITE_AUTH_BACKEND=mysql:
       * mocked routes are intercepted by the service worker before they hit the
       * network, and every other /api route stays mocked as before.
       */
      proxy: {
        '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false },
      },
    },
    build: {
      rollupOptions: {
        output: {
          /*
           * Keep the framework and the animation library in their own chunks:
           * they change far less often than app code, so browsers can keep them
           * cached across deploys, and they download in parallel on first visit.
           */
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
    },
  };
});
