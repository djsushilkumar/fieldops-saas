import type { Config } from 'tailwindcss';
import designTokensPreset from '@fieldops/design-tokens/tailwind.preset.js';

const config: Config = {
  presets: [designTokensPreset],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
