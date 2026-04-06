import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // Garantimos que o estado inicial seja um Array para não quebrar o Checkout.map
  const [cart, setCart] = useState([]);

  const carregarCarrinho = () => {
    const salvo = localStorage.getItem('carrinho_rodrigues');
    if (salvo) {
      try {
        const dados = JSON.parse(salvo);
        // Se for objeto {itens: [...]}, extraímos só a lista. Se for array, usamos direto.
        const listaApenas = Array.isArray(dados) ? dados : (dados.itens || []);
        setCart(listaApenas);
      } catch (e) {
        setCart([]);
      }
    } else {
      setCart([]);
    }
  };

  const adicionarItem = (novoItem) => {
    const salvo = localStorage.getItem('carrinho_rodrigues');
    const atual = salvo ? JSON.parse(salvo) : [];
    const listaAtual = Array.isArray(atual) ? atual : (atual.itens || []);
    
    const novaLista = [...listaAtual, novoItem];
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(novaLista));
    setCart(novaLista); // Atualiza o estado global como Array
  };

  const limparCarrinho = () => {
    localStorage.removeItem('carrinho_rodrigues');
    setCart([]);
  };

  useEffect(() => {
    carregarCarrinho();
    window.addEventListener('storage', carregarCarrinho);
    return () => window.removeEventListener('storage', carregarCarrinho);
  }, []);

  return (
    <CartContext.Provider value={{ cart, carregarCarrinho, adicionarItem, limparCarrinho }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);