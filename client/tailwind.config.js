const path = require('path');

module.exports = {
  content: [
    path.join(__dirname, "./index.html"),
    path.join(__dirname, "./src/**/*.{js,ts,jsx,tsx}")
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#111112',
          panel: '#1E222D',
          border: '#2A2E39',
          primary: '#D1D4DC',
          secondary: '#8A91A5'
        },
        light: {
          bg: '#FFFFFF',
          panel: '#F8F9FA',
          border: '#E0E3EB',
          primary: '#131722',
          secondary: '#787B86'
        },
        bullish: '#089981',
        bearish: '#F23645',
        accent: '#2962FF',
        brand: {
          primary: '#2962FF',
          gold: '#E0B034'
        }
      }
    }
  },
  plugins: []
}
