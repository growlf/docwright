import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  server: {
    host: process.env.VITE_HOST || '0.0.0.0',
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    // Reverse-proxied deployments must allow their external hostname or Vite's
    // default host check 403s the Host header. Kept deployment-agnostic: set
    // DOCWRIGHT_ALLOWED_HOSTS (comma-separated) in the deployment's env.
    allowedHosts: process.env.DOCWRIGHT_ALLOWED_HOSTS
      ? process.env.DOCWRIGHT_ALLOWED_HOSTS.split(',').map((h) => h.trim())
      : ['localhost', 'docwright-dev.bms.local'],
    fs: {
      allow: ['..'],
    },
  },
};
