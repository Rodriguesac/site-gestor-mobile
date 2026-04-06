import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';

export default function Bebidas() {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState('Sucos');
  const [quantidadeSacola, setQuantidadeSacola] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [obs, setObs] = useState("");

  const categorias = ['Sucos', 'Refrigerantes', 'Energéticos', 'Fitness', 'Doces'];

  const produtosBebidas = [
    { id: 'b1', nome: 'Suco de Laranja 500ml', preco: 14.90, categoria: 'Sucos', desc: '100% natural, espremido na hora.', imagem: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400' },
    { id: 'b2', nome: 'Coca-Cola Lata', preco: 8.50, categoria: 'Refrigerantes', desc: '350ml bem gelada.', imagem: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400' },
    { id: 'b3', nome: 'Red Bull Energy', preco: 16.00, categoria: 'Energéticos', desc: '250ml de energia pura.', imagem: 'https://images.unsplash.com/photo-1622467820202-4099b244d56d?w=400' },
    { id: 'b4', nome: 'Água de Coco 500ml', preco: 12.00, categoria: 'Fitness', desc: 'Hidratação natural.', imagem: 'https://images.unsplash.com/photo-1510130335169-134d1152a4f0?w=400' },
    { id: 'b5', nome: 'Suco de Morango c/ Leite', preco: 16.50, categoria: 'Sucos', desc: 'Vitamina cremosa de morango.', imagem: 'https://images.unsplash.com/photo-1546173159-315724a9369b?w=400' },
    { id: 'd1', nome: 'Brigadeiro Gourmet', preco: 4.50, categoria: 'Doces', desc: 'Chocolate belga com granulado especial.', imagem: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400' },
    { id: 'd2', nome: 'Beijinho de Coco', preco: 4.00, categoria: 'Doces', desc: 'Coco fresco e um toque de leite condensado.', imagem: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400' },
    { id: 'd3', nome: 'Mini Brownie', preco: 7.90, categoria: 'Doces', desc: 'Bem recheado e com casquinha crocante.', imagem: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400' },
    { id: 'd4', nome: 'Palha Italiana', preco: 6.50, categoria: 'Doces', desc: 'O clássico de chocolate com biscoito.', imagem: 'https://images.unsplash.com/photo-1582176604445-21b173c35655?w=400' }
  ];

  useEffect(() => {
    const atualizarSacola = () => {
      const salvo = JSON.parse(localStorage.getItem('carrinho_rodrigues') || '{"itens":[]}');
      setQuantidadeSacola(salvo.itens.length);
    };
    atualizarSacola();
    window.addEventListener('storage', atualizarSacola);
    return () => window.removeEventListener('storage', atualizarSacola);
  }, []);

  const handleAdicionarAoCarrinho = (produto) => {
    const storageKey = 'carrinho_rodrigues';
    const carrinhoData = JSON.parse(localStorage.getItem(storageKey) || '{"itens":[], "totalGeral": 0}');
    
    const novoItem = {
      id: Date.now(),
      nome: produto.nome,
      nomePersonalizado: produto.categoria === 'Doces' ? "Doce" : "Bebida",
      foto: produto.imagem, 
      preco: Number(produto.preco),
      quantidade: 1,
      observacao: obs,
      detalhes: {
        acompanhamentos_detalhes: [],
        adicionais_detalhes: [],
        cobertura_detalhes: {}
      }
    };

    carrinhoData.itens.push(novoItem);
    carrinhoData.totalGeral = carrinhoData.itens.reduce((acc, item) => acc + Number(item.preco), 0);

    localStorage.setItem(storageKey, JSON.stringify(carrinhoData));
    window.dispatchEvent(new Event('storage'));

    setQuantidadeSacola(carrinhoData.itens.length);
    setShowToast(true);
    setProdutoSelecionado(null);
    setObs("");
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-home)] pb-32">
      <div className="p-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-12 h-12 bg-[var(--card-home)] rounded-2xl flex items-center justify-center border border-[var(--border-home)] text-[var(--text-home)]">
          <Lucide.ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-[1000] uppercase italic text-[var(--text-home)]">Cardápio</h1>
        <div className="w-12" />
      </div>

      <div className="flex gap-3 px-6 overflow-x-auto pb-4 no-scrollbar">
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setAbaAtiva(cat)}
            className={`px-6 py-3 rounded-2xl font-black uppercase italic text-xs whitespace-nowrap transition-all ${
              abaAtiva === cat ? 'bg-[#82C91E] text-black' : 'bg-[var(--card-home)] text-[var(--text-home)] border border-[var(--border-home)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 mt-4">
        {produtosBebidas.filter(p => p.categoria === abaAtiva).map(produto => (
          <motion.div
            layoutId={produto.id}
            key={produto.id}
            onClick={() => setProdutoSelecionado(produto)}
            className="bg-[var(--card-home)] p-3 rounded-[2.5rem] border border-[var(--border-home)] relative overflow-hidden group active:scale-95 transition-all shadow-lg"
          >
            <div className="aspect-square rounded-[2rem] overflow-hidden mb-3 relative">
              <img src={produto.imagem} className="w-full h-full object-cover" alt={produto.nome} />
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="text-[#82C91E] text-[10px] font-black italic">R$ {produto.preco.toFixed(2)}</span>
              </div>
            </div>
            <h3 className="text-[var(--text-home)] font-black uppercase italic text-[11px] leading-tight px-1 mb-2 line-clamp-2">{produto.nome}</h3>
            <button className="w-full bg-[var(--bg-home)] text-[var(--text-home)] py-3 rounded-2xl flex items-center justify-center border border-[var(--border-home)] group-hover:bg-[#82C91E] group-hover:text-black transition-colors">
              <Lucide.Plus size={16} strokeWidth={3} />
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {produtoSelecionado && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setProdutoSelecionado(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed bottom-0 left-0 right-0 bg-[var(--card-home)] rounded-t-[3rem] z-[101] p-8 border-t border-[var(--border-home)]">
              <div className="w-16 h-1.5 bg-zinc-700 rounded-full mx-auto mb-8 opacity-20" />
              <div className="flex gap-6 mb-8">
                <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-2 border-[#82C91E]">
                  <img src={produtoSelecionado.imagem} className="w-full h-full object-cover" alt={produtoSelecionado.nome} />
                </div>
                <div className="flex-1 pt-2">
                  <span className="bg-[#82C91E]/10 text-[#82C91E] px-3 py-1 rounded-full text-[10px] font-black uppercase italic">{produtoSelecionado.categoria}</span>
                  <h2 className="text-[var(--text-home)] text-2xl font-[1000] uppercase italic leading-tight mt-2">{produtoSelecionado.nome}</h2>
                  <p className="text-[var(--text-home)] opacity-50 text-xs font-bold mt-2 leading-relaxed">{produtoSelecionado.desc}</p>
                </div>
              </div>
              
              <div className="mb-8">
                <label className="text-[var(--text-home)] font-black uppercase italic text-xs mb-3 block opacity-40">Observações:</label>
                <textarea 
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder={produtoSelecionado.categoria === 'Doces' ? "Ex: Para presente..." : "Ex: Sem gelo..."}
                  className="w-full bg-[var(--bg-home)] border border-[var(--border-home)] rounded-2xl p-4 text-[var(--text-home)] text-sm font-bold focus:outline-none focus:border-[#82C91E] transition-all"
                  rows="3"
                />
              </div>

              <button 
                onClick={() => handleAdicionarAoCarrinho(produtoSelecionado)}
                className="w-full bg-[#82C91E] text-black py-5 rounded-[2rem] font-[1000] uppercase italic flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_10px_30px_rgba(130,201,30,0.3)]"
              >
                Adicionar à Sacola <Lucide.Check size={20} strokeWidth={3} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-[#82C91E] text-black px-6 py-3 rounded-full font-black uppercase italic text-xs z-[200] shadow-2xl flex items-center gap-2">
            <Lucide.ShoppingBag size={16} /> Item adicionado!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-8 left-6 right-6 z-50 max-w-2xl mx-auto">
        <button 
          onClick={() => navigate('/carrinho')}
          className={`w-full h-18 py-5 rounded-[2.5rem] font-black uppercase italic flex items-center justify-between px-8 shadow-2xl transition-all ${
            quantidadeSacola > 0 ? 'bg-[#82C91E] text-black scale-105' : 'bg-zinc-800 text-zinc-500 opacity-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Lucide.ShoppingBag size={24} />
              {quantidadeSacola > 0 && (
                <span className="absolute -top-2 -right-2 bg-black text-[#82C91E] text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                  {quantidadeSacola}
                </span>
              )}
            </div>
            <span className="text-sm tracking-tighter">Ver Sacola</span>
          </div>
          <Lucide.ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}