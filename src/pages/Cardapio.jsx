import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Cardapio() {
  const navigate = useNavigate();
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
  const [carrinhoQtd, setCarrinhoQtd] = useState(0);

  const categorias = ['Todos', 'Açaís Prime', 'Combos Família', 'Bebidas', 'Adicionais', 'Doces'];

  const produtos = [
    { id: 'p1', nome: 'Açaí Rodrigues Tradicional', preco: '18.90', categoria: 'Açaís Prime', imagem: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400' },
    { id: 'p2', nome: 'Barca Rodrigues G', preco: '45.00', categoria: 'Combos Família', imagem: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400' },
    { id: 'p3', nome: 'Copo de Açaí 500ml', preco: '22.00', categoria: 'Açaís Prime', imagem: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=400' }
  ];

  useEffect(() => {
    const carregarQtd = () => {
      const salvo = localStorage.getItem('carrinho_rodrigues');
      if (salvo) {
        const dados = JSON.parse(salvo);
        const lista = Array.isArray(dados) ? dados : (dados.itens || []);
        setCarrinhoQtd(lista.length);
      }
    };
    carregarQtd();
    window.addEventListener('storage', carregarQtd);
    return () => window.removeEventListener('storage', carregarQtd);
  }, []);

  const adicionarAoCarrinho = (produto) => {
    const salvo = localStorage.getItem('carrinho_rodrigues');
    const carrinhoAtual = salvo ? JSON.parse(salvo) : { itens: [], totalGeral: 0 };
    const listaItens = Array.isArray(carrinhoAtual) ? carrinhoAtual : (carrinhoAtual.itens || []);
    const novosItens = [...listaItens, { ...produto, id: Date.now(), quantidade: 1 }];
    const novoTotal = novosItens.reduce((acc, item) => acc + Number(item.preco), 0);

    const novoCarrinho = { itens: novosItens, totalGeral: novoTotal };
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(novoCarrinho));
    setCarrinhoQtd(novosItens.length);
    window.dispatchEvent(new Event('storage'));
  };

  const produtosFiltrados = categoriaAtiva === 'Todos' 
    ? produtos 
    : produtos.filter(p => p.categoria === categoriaAtiva);

  return (
    <div className="min-h-screen bg-[#0b0e13] pb-32 text-left selection:bg-[#82C91E]/30">
      {/* HEADER: Gradiente sutil de cassino */}
      <header className="p-6 bg-[#161922] border-b border-white/5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <h1 className="text-xl font-[1000] uppercase italic tracking-tighter text-white">
          Nosso <span className="text-[#82C91E] drop-shadow-[0_0_8px_rgba(130,201,30,0.5)]">Cardápio</span>
        </h1>
        <Lucide.Search size={20} className="text-zinc-500" />
      </header>

      {/* CATEGORIAS: Estilo 'Stories' ou 'Game Tabs' */}
      <div className="flex gap-2 overflow-x-auto p-4 no-scrollbar bg-[#0b0e13]">
        {categorias.map(cat => (
          <button 
            key={cat} 
            onClick={() => setCategoriaAtiva(cat)}
            className={`px-5 py-2.5 rounded-xl font-black uppercase italic text-[10px] whitespace-nowrap transition-all duration-300 border ${
              categoriaAtiva === cat 
                ? 'bg-[#82C91E] text-[#0b0e13] border-[#82C91E] shadow-[0_0_20px_rgba(130,201,30,0.4)] scale-105' 
                : 'bg-[#1a1d29] text-zinc-500 border-white/5 hover:border-white/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* GRID DE PRODUTOS: Estilo Sloth Games */}
      <div className="grid grid-cols-2 gap-4 px-4 mt-2">
        {produtosFiltrados.map(produto => (
          <div key={produto.id} className="bg-[#161922] border border-white/5 rounded-[1.8rem] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-[#82C91E]/30 transition-all group active:scale-95">
            <div className="relative aspect-[4/5] mb-3 overflow-hidden rounded-[1.4rem] bg-[#0b0e13]">
              <img 
                src={produto.imagem} 
                alt={produto.nome} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" 
              />
              
              {/* Badge de Preço Flutuante (Estilo Win/Multiplier) */}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow-xl">
                <span className="text-[#82C91E] font-black italic text-[10px]">R$ {produto.preco}</span>
              </div>

              {/* Overlay de gradiente inferior para o texto */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#161922] via-transparent to-transparent opacity-60"></div>
            </div>
            
            <div className="px-2 pb-2">
              <h3 className="font-black italic text-[10px] text-zinc-100 leading-tight mb-3 uppercase h-8 line-clamp-2">
                {produto.nome}
              </h3>
              
              <button 
                onClick={() => adicionarAoCarrinho(produto)}
                className="w-full bg-[#212631] text-white py-3 rounded-xl font-[1000] uppercase italic text-[9px] flex items-center justify-center gap-2 border-b-2 border-black/40 hover:bg-[#82C91E] hover:text-[#0b0e13] hover:border-[#6ba318] transition-all group"
              >
                <Lucide.Plus size={14} className="group-hover:rotate-90 transition-transform" /> 
                Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER BAR (BOTÃO DE CARRINHO ESTILO 'GREEN DEPOSIT') */}
      {carrinhoQtd > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0b0e13] to-transparent z-50">
          <button 
            onClick={() => navigate('/carrinho')}
            className="w-full bg-[#82C91E] text-[#0b0e13] p-5 rounded-2xl font-[1000] uppercase italic flex items-center justify-between shadow-[0_15px_40px_rgba(130,201,30,0.4)] border-b-[6px] border-[#6ba318] active:border-b-0 active:translate-y-1 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-[#0b0e13]/10 p-2 rounded-lg">
                <Lucide.ShoppingBag size={22} strokeWidth={3} />
              </div>
              <span className="text-sm tracking-tighter">Minha Sacola</span>
            </div>
            <div className="bg-[#0b0e13] text-[#82C91E] px-4 py-1.5 rounded-xl text-sm font-black shadow-inner">
              {carrinhoQtd}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}