import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Sugestão: Use a 3000 para o cliente, padrão de mercado
    strictPort: true, // Se a 3000 estiver ocupada, ele não pula pra outra, ele avisa
  }
})
