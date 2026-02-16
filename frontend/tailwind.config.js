/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          blue: '#dbeafe',
          cyan: '#cffafe',
          sky: '#e0f2fe',
          indigo: '#e0e7ff',
          slate: '#f1f5f9',
        },
      },
    },
  },
  plugins: [],
}
