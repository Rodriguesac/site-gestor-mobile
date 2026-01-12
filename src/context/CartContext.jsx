import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ itens: [], totalGeral: 0 });

  const carregarCarrinho = () => {
    const salvo = localStorage.getItem('carrinho_rodrigues');
    if (salvo) {
      try {
        const dados = JSON.parse(salvo);
        if (Array.isArray(dados)) {
          // Converte array antigo para objeto novo
          const total = dados.reduce((acc, i) => acc + (Number(i.preco || i.total) * (i.quantidade || 1)), 0);
          setCart({ itens: dados, totalGeral: total });
        } else {
          setCart(dados);
        }
      } catch (e) {
        setCart({ itens: [], totalGeral: 0 });
      }
    }
  };

  useEffect(() => {
    carregarCarrinho();
    window.addEventListener('storage', carregarCarrinho);
    return () => window.removeEventListener('storage', carregarCarrinho);
  }, []);

  return (
    <CartContext.Provider value={{ cart, carregarCarrinho }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);