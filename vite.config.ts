import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Security headers applied in dev/preview. Production hosting mirrors these via
// vercel.json / public/_headers so the deployed app has the same CSP.
const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'voxelqr-security-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Three.js is the bulk of the bundle and is loaded lazily with the scene, so
    // the first paint is not blocked by it.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
    },
  },
});
