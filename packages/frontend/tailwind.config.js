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
          DEFAULT: '#009056',
          dark: '#038450',
          light: '#66BC9A',
        },
        secondary: {
          DEFAULT: '#FFE16F',
        },
        grey: {
          900: '#282828',
          800: '#414141',
          700: '#5B5B5B',
          600: '#757575',
          500: '#9B9B9B',
          400: '#B9B9B9',
          300: '#E1E1E1',
          200: '#F5F5F5',
          100: '#FAFAFA',
        },
        success: '#28A745',
        error: '#DC3545',
        warning: '#FFC107',
        info: '#17A2B8',
      },
      fontFamily: {
        heading: ['Bolivar', 'Roboto', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        'm': '2px 2px 16px rgba(115, 115, 115, 0.16), 2px 8px 8px rgba(115, 115, 115, 0.04)',
      },
    },
  },
  plugins: [],
}
