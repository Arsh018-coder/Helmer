import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const nextConfig = (phase: string): NextConfig => {
  if (phase === PHASE_DEVELOPMENT_SERVER && !process.env.__HELMER_LINK_PRINTED) {
    process.env.__HELMER_LINK_PRINTED = '1';
    const port = process.env.PORT || 3000;
    setTimeout(() => {
      console.log('\n\x1b[1m\x1b[32m  ✔ Helmer is running!\x1b[0m');
      console.log(`\x1b[1m\x1b[36m  ➜ Direct Link: \x1b[4mhttp://localhost:${port}/\x1b[0m\n`);
    }, 150);
  }

  return {
    reactStrictMode: true,
  };
};

export default nextConfig;
