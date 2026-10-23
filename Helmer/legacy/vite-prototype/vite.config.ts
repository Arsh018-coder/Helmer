import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function directLinkPlugin(): Plugin {
  return {
    name: 'direct-terminal-link',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        setTimeout(() => {
          const address = server.httpServer?.address();
          const port = typeof address === 'object' && address ? address.port : 3000;
          console.log('\n\x1b[1m\x1b[32m  ✔ Helmer is running!\x1b[0m');
          console.log(`\x1b[1m\x1b[36m  ➜ Direct Link: \x1b[4mhttp://localhost:${port}/\x1b[0m\n`);
        }, 150);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    clearScreen: false,
    plugins: [react(), directLinkPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
