/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#04C99E',
          600: '#03B08A',
          700: '#028E6F',
          800: '#026D55',
          900: '#014D3D',
        },
      },
    },
  },
  plugins: [],
};
