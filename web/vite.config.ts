import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    // IPv4 loopback explicitly: node otherwise binds ::1 only on this
    // machine, and `tailscale serve` (which mirrors the dashboard to the
    // tailnet for the laptop) can only proxy to 127.0.0.1. Still
    // loopback-only — nothing is exposed to the LAN.
    host: '127.0.0.1',
    // Vite blocks unfamiliar Host headers; the tailnet name arrives via the
    // tailscale-serve proxy. This one host only — never `true`.
    allowedHosts: ['desktop-78urcea.tail000378.ts.net'],
    port: 5173,
    // Dev server talks to the Express API. In production Express serves the
    // built assets itself, so there is no proxy and no CORS either way.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
