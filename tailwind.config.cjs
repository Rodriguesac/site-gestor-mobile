/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Define a Montserrat como a fonte principal e única
        montserrat: ['Montserrat', 'sans-serif'],
      },
      colors: {
        // Cores oficiais da Rodrigues Açaí e Cia
        brand: {
          purple: "#4B0082",
          green: "#82C91E",
        },
        // Cores para o layout estilo Casino/Dark
        bg: {
          main: "#0a0212",
          card: "#160721",
        }
      },
      backgroundImage: {
        // Gradiente principal usado no Hero da Home
        'gradient-casino': 'linear-gradient(to right, #1d0b35, #0a0212)',
      },
      animation: {
        // Suporte para as animações de entrada e fade-in
        'in': 'fadeIn 0.7s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' },
        }
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}