/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#151E50',
        cloudPink: '#FFB7D5',
        cloudBlue: '#A7E8FF',
        cloudYellow: '#FFE9A7',
        cloudCream: '#FFF7FB'
      },
      boxShadow: {
        soft: '0 18px 50px rgba(21, 30, 80, 0.12)'
      }
    }
  },
  plugins: []
};
