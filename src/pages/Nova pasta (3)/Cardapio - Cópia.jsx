import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function Cardapio() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [catAtiva, setCatAtiva] = useState('Todos');
  const [carrinhoQtd, setCarrinhoQtd] = useState(0);
  const [loading, setLoading] = useState(true);

  // FIX: Função de carregar quantidade com trava de segurança
  const carregarQtd = () => {
    try {
      const data = JSON.parse(localStorage.getItem('carrinho_rodrigues'));
      // A trava: se data for null ou itens não existir, usa um array vazio []
      const itens = data?.itens || (Array.isArray(data) ? data : []);
      setCarrinhoQtd(itens.length); 
    } catch (e) {
      setCarrinhoQtd(0);
    }
  };

  useEffect(() => {
    carregarQtd();
    const unsubProdutos = onSnapshot(query(collection(db, "produtos"), orderBy("nome")), (snap) => {
      const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProdutos(lista);
      
      // Gera categorias únicas
      const cats = ['Todos', ...new Set(lista.map(p => p.categoria).filter(Boolean))];
      setCategorias(cats);
      setLoading(false);
    });

    window.addEventListener('cartUpdated', carregarQtd);
    return () => {
      unsubProdutos();
      window.removeEventListener('cartUpdated', carregarQtd);
    };
  }, []);

  const produtosFiltrados = catAtiva === 'Todos' 
    ? produtos 
    : produtos.filter(p => p.categoria === catAtiva);

  if (loading) return <div className="h-screen flex items-center justify-center text-white font-black italic text-xl bg-transparent uppercase">Carregando Cardápio...</div>;

  return (
    <div className="flex flex-col min-h-full bg-transparent font-sans overflow-x-hidden pb-32">
      
      {/* HEADER PADRONIZADO */}
      <header className="shrink-0 px-6 pt-10 pb-6 bg-white rounded-b-[2.5rem] shadow-xl z-20 mx-2 mt-2">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate('/')} className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
            <Lucide.ChevronLeft size={22} />
          </button>
          <h1 className="font-[1000] italic uppercase text-xl tracking-tighter text-[#4B0082]">O Melhor <span className="text-[#82C91E]">Açaí</span></h1>
          <button onClick={() => navigate('/carrinho')} className="relative w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
            <Lucide.ShoppingBag size={20} />
            {carrinhoQtd > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#82C91E] text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {carrinhoQtd}
              </span>
            )}
          </button>
        </div>

        {/* CATEGORIAS (PILLS) */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCatAtiva(cat)}
              className={`px-6 py-3 rounded-2xl whitespace-nowrap text-[10px] font-black uppercase italic tracking-widest transition-all ${
                catAtiva === cat 
                ? 'bg-[#4B0082] text-white shadow-lg shadow-[#4B0082]/20' 
                : 'bg-slate-50 text-slate-400 border border-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* LISTA DE PRODUTOS */}
      <main className="flex-1 px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {produtosFiltrados.map(produto => (
            <div key={produto.id} className="bg-white rounded-[2.5rem] p-4 flex gap-4 shadow-xl border border-white/20 active:scale-[0.98] transition-all">
              <div className="w-24 h-24 shrink-0">
                <img 
                  src={produto.imagem_url || produto.imagem} 
                  className="w-full h-full rounded-3xl object-cover bg-slate-50" 
                  alt={produto.nome}
                />
              </div>
              <div className="flex-1 text-left flex flex-col justify-center">
                <h3 className="font-[1000] uppercase italic text-sm text-[#4B0082] leading-tight mb-1">{produto.nome}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight line-clamp-2 mb-2">{produto.descricao}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-[#82C91E] font-[1000] italic text-lg">R$ {Number(produto.preco).toFixed(2)}</span>
                  <button 
                    onClick={() => navigate('/monte-seu-acai')} // Redireciona para personalizar
                    className="w-8 h-8 bg-[#4B0082] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90"
                  >
                    <Lucide.Plus size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CARD DE MONTAGEM PERSONALIZADA (DESTAQUE) */}
        <div className="mt-8">
          <button 
            onClick={() => navigate('/monte-seu-acai')}
            className="w-full bg-[#82C91E] p-8 rounded-[3rem] shadow-2xl shadow-[#82C91E]/20 flex items-center justify-between group overflow-hidden relative"
          >
            <div className="relative z-10 text-left">
              <h2 className="text-2xl font-[1000] italic uppercase text-black leading-none mb-1">Monte do <br/>Seu Jeito</h2>
              <p className="text-black/50 text-[10px] font-black uppercase tracking-widest">Toque para começar</p>
            </div>
            <Lucide.Zap size={60} className="text-black/10 absolute -right-2 -bottom-2 group-hover:scale-125 transition-transform" strokeWidth={3} />
            <div className="relative z-10 bg-black text-white p-4 rounded-2xl shadow-xl">
              <Lucide.ArrowRight size={24} />
            </div>
          </button>
        </div>
      </main>

      {/* BOTÃO FLUTUANTE DE CARRINHO (OPCIONAL) */}
      {carrinhoQtd > 0 && (
        <div className="fixed bottom-8 left-0 right-0 px-8 z-50">
          <button 
            onClick={() => navigate('/carrinho')}
            className="w-full h-16 bg-[#4B0082] rounded-[2rem] shadow-2xl flex items-center justify-between px-8 text-white active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-[#82C91E] text-black w-7 h-7 rounded-full flex items-center justify-center font-black text-xs">{carrinhoQtd}</div>
              <span className="font-black uppercase italic text-sm tracking-tighter">Ver Sacola</span>
            </div>
            <span className="font-black italic text-lg">Próximo</span>
          </button>
        </div>
      )}
    </div>
  );
}