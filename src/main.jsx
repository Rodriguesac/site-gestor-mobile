import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css' // OBRIGATÓRIO: Para carregar o fundo preto e Tailwind

// Importe os seus contextos (ajuste o caminho se necessário)
import { CartProvider } from './context/CartContext' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* O CartProvider precisa abraçar o App para as funções de compra funcionarem */}
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
