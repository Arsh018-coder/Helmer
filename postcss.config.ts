/**
 * PostCSS config for Tailwind v4.
 * Tailwind v4 ships its own PostCSS plugin (@tailwindcss/postcss) instead of
 * the webpack integration used previously via @tailwindcss/vite.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
