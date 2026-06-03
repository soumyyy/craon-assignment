import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  '#0A0A0A',
          surface:  '#141414',
          elevated: '#1C1C1C',
          hover:    '#242424',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          muted:   '#A89F8C',
          subtle:  '#4A4540',
        },
        accent: {
          DEFAULT: '#C8B89A',
          hover:   '#D4C4A8',
        },
        bubble: {
          user: '#2A2520',
        },
        status: {
          success: '#4A7C59',
          warning: '#8A6A2A',
          error:   '#7A3A3A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
