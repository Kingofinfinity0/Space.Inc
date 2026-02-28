import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * SIMPLIFIED VITE CONFIG
 * 
 * REMOVED: Custom proxy plugin
 * REASON: Daily.co has enterprise-grade TURN/STUN fallback built-in
 * 
 * Trying to proxy WebRTC traffic ourselves:
 * - Adds complexity
 * - Introduces failure points
 * - Doesn't improve reliability (Daily already handles this)
 * 
 * Daily's built-in network stack includes:
 * - STUN servers
 * - TURN over UDP
 * - TURN over TCP
 * - TURN over TLS (443)
 * - Multiple geographic relays
 * - Automatic fallback switching
 * 
 * This is what you pay them for - use it!
 */

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [
      react()
    ],

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
