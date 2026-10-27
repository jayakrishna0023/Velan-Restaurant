// Common Vite settings for the three apps. Each app runs its own dev server and
// proxies the API, uploads and the Socket.IO connection to the Node server.
import react from '@vitejs/plugin-react';

export function velanApp({ base, port }) {
  const api = process.env.VELAN_API || 'http://localhost:4000';
  return {
    base,
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom', 'framer-motion', 'leaflet', 'socket.io-client'] },
    server: {
      port,
      strictPort: true,
      host: true,
      proxy: {
        '/api': api,
        '/uploads': api,
        '/socket.io': { target: api, ws: true },
      },
    },
    preview: { port },
    build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  };
}
