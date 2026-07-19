/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans JP'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
      }
    }
  },
  plugins: [],
};
