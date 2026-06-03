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
          primary:  '#080808',
          surface:  '#0f0f0f',
          elevated: '#181818',
          hover:    '#202020',
        },
        cream: {
          DEFAULT: '#EDE8DF',
          muted:   '#8A8278',
          subtle:  '#333028',
        },
        accent: {
          DEFAULT: '#C9B99A',
          hover:   '#D5C7AE',
          dim:     'rgba(201,185,154,0.15)',
        },
        bubble: { user: '#161410' },
        status: {
          success: '#4D7C5F',
          warning: '#7A6030',
          error:   '#7A3535',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          mid:     'rgba(255,255,255,0.11)',
        },
      },
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
    },
  },
  plugins: [],
};
export default config;
