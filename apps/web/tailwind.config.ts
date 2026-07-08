// Tailwind v4 uses the CSS file as config via @import and @theme.
// This file is kept for backwards-compatible tooling integration.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
};

export default config;
