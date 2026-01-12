import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function Carrinho() {
  const navigate = useNavigate();
  const [carrinho, setCarrinho] = useState({ itens: [], totalGeral: 0 });
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [itemSelecionado, setItemSelecionado] = useState(null);

  const carregarDados = () => {
    const salvo = JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 };
    // Normalização para garantir que os preços sejam números
    const itensValidados = (salvo.itens || []).map(item => ({
      ...item,
      preco: Number(item.preco) || 0
    }));
    setCarrinho({ itens: itensValidados, totalGeral: Number(salvo.totalGeral) || 0 });

    const endSalvo = localStorage.getItem('@RodriguesAcai:endereco') || localStorage.getItem('endereco_rodrigues');
    if (endSalvo) {
      const parsed = JSON.parse(endSalvo);
      setTaxaEntrega(Number(parsed.taxa) || 0);
    }
  };

  useEffect(() => {
    carregarDados();
    window.addEventListener('storage', carregarDados);
    return () => window.removeEventListener('storage', carregarDados);
  }, []);

  const salvarCarrinho = (novoCarrinho) => {
    setCarrinho(novoCarrinho);
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(novoCarrinho));
    window.dispatchEvent(new Event('storage'));
  };

  const removerItem = (index, e) => {
    e.stopPropagation();
    const novosItens = [...carrinho.itens];
    const itemRemovido = novosItens.splice(index, 1)[0];
    const novoTotal = Math.max(0, carrinho.totalGeral - itemRemovido.preco);
    salvarCarrinho({ itens: novosItens, totalGeral: novoTotal });
  };

  const duplicarItem = (index, e) => {
    e.stopPropagation();
    const itemOriginal = carrinho.itens[index];
    const itemCopia = { ...itemOriginal, id: Date.now() + Math.random() };
    const novosItens = [...carrinho.itens, itemCopia];
    const novoTotal = carrinho.totalGeral + itemOriginal.preco;
    salvarCarrinho({ itens: novosItens, totalGeral: novoTotal });
  };

  const totalFinal = carrinho.totalGeral + taxaEntrega;

  return (
    <div className="flex flex-col h-screen bg-[#0b0e13] text-white overflow-hidden font-sans">
      
      {/* HEADER DE AÇÃO PREMIUM */}
      <header className="bg-[#161922] border-b border-white/5 sticky top-0 z-[100] px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"
            >
              <Lucide.ArrowLeft size={24} className="text-[#82C91E]" />
            </button>
            <div>
              <h1 className="font-[1000] italic uppercase text-2xl tracking-tighter leading-none">
                Minha <span className="text-[#82C91E]">Sacola</span>
              </h1>
              <p className="text-[10px] font-bold text-zinc-500 uppercase italic mt-1 tracking-widest">
                Rodrigues Açaí Delivery
              </p>
            </div>
          </div>
          <div className="bg-[#82C91E]/10 border border-[#82C91E]/20 px-4 py-2 rounded-2xl">
            <span className="text-[#82C91E] font-black italic text-sm">{carrinho.itens.length} {carrinho.itens.length === 1 ? 'ITEM' : 'ITENS'}</span>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO SCROLLÁVEL */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {carrinho.itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 opacity-40">
              <Lucide.ShoppingBag size={80} strokeWidth={1} className="text-zinc-600 mb-4" />
              <p className="font-black italic uppercase tracking-widest text-sm">Sacola Vazia</p>
              <button onClick={() => navigate('/')} className="mt-6 text-[#82C91E] font-black uppercase underline decoration-2">Voltar ao Cardápio</button>
            </div>
          ) : (
            <>
              {/* BOTÃO ADICIONAR MAIS PRODUTOS (ESTILO CARD) */}
              <button 
                onClick={() => navigate('/cardapio')}
                className="w-full bg-[#161922] border border-dashed border-white/10 rounded-[2.5rem] p-6 flex items-center justify-center gap-4 group active:scale-[0.98] transition-all"
              >
                <div className="w-12 h-12 bg-[#82C91E]/10 rounded-full flex items-center justify-center text-[#82C91E] group-hover:bg-[#82C91E] group-hover:text-black transition-all">
                  <Lucide.Plus size={24} strokeWidth={3} />
                </div>
                <div className="text-left">
                  <p className="font-black italic uppercase text-sm leading-none text-white">Montar outro açaí</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase italic mt-1">Ou adicionar bebidas e extras</p>
                </div>
              </button>

              {/* LISTA DE ITENS */}
              <div className="grid gap-4">
                {carrinho.itens.map((item, index) => (
                  <div 
                    key={index} 
                    onClick={() => setItemSelecionado(item)}
                    className="bg-[#161922] rounded-[2.5rem] p-5 border border-white/5 flex gap-4 items-center relative active:bg-[#1c212b] transition-all cursor-pointer group"
                  >
                    <div className="relative flex-shrink-0">
                      <img 
                        src={item.detalhes?.foto || item.foto || 'https://i.ibb.co/66a5ac.jpg'} 
                        className="w-20 h-20 rounded-3xl object-cover border border-white/10" 
                        alt="" 
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-black italic uppercase text-sm text-white truncate leading-tight">
                        {item.nome}
                      </h3>
                      {item.nomePersonalizado && (
                        <p className="text-[9px] text-[#82C91E] font-black italic uppercase mt-1">
                          P/ {item.nomePersonalizado}
                        </p>
                      )}
                      <p className="text-xl font-[1000] italic text-white mt-2">
                        <span className="text-[#82C91E] text-xs mr-0.5 font-black uppercase tracking-tighter italic">R$</span>
                        {item.preco.toFixed(2)}
                      </p>
                    </div>

                    {/* BOTÕES DE CONTROLE LATERAIS */}
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={(e) => duplicarItem(index, e)}
                        className="w-11 h-11 bg-white/5 text-zinc-400 rounded-2xl flex items-center justify-center active:bg-[#82C91E] active:text-black transition-all"
                        title="Duplicar Item"
                      >
                        <Lucide.Copy size={18} />
                      </button>
                      <button 
                        onClick={(e) => removerItem(index, e)}
                        className="w-11 h-11 bg-red-500/10 text-red-500/50 rounded-2xl flex items-center justify-center active:bg-red-500 active:text-white transition-all"
                      >
                        <Lucide.Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* RESUMO DE VALORES (FINANCEIRO) */}
              <div className="bg-gradient-to-b from-[#161922] to-transparent rounded-[3rem] p-8 border border-white/5 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase italic tracking-[2px]">
                  <span>Subtotal</span>
                  <span className="text-white text-sm tracking-normal">R$ {carrinho.totalGeral.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase italic tracking-[2px]">
                  <div className="flex items-center gap-2">
                    <Lucide.MapPin size={12} className="text-[#82C91E]" />
                    <span>Entrega</span>
                  </div>
                  <span className="text-[#82C91E] text-sm tracking-normal font-bold">
                    {taxaEntrega === 0 ? 'GRÁTIS' : `R$ ${taxaEntrega.toFixed(2)}`}
                  </span>
                </div>
                <div className="h-px bg-white/5 my-2"></div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-black text-zinc-400 uppercase italic tracking-widest block mb-1">Total a Pagar</span>
                    <p className="text-4xl font-[1000] italic text-white tracking-tighter leading-none">
                      <span className="text-[#82C91E] text-lg mr-1 italic font-black uppercase">R$</span>
                      {totalFinal.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right pb-1 text-zinc-500">
                    <p className="text-[8px] font-bold uppercase tracking-widest">Pagamento na</p>
                    <p className="text-[10px] font-black uppercase text-white">Entrega</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="h-44" />
        </div>
      </div>

      {/* BOTÃO FINALIZAR (Sempre visível acima da Navbar inferior) */}
      {carrinho.itens.length > 0 && (
        <div className="fixed bottom-[90px] left-0 right-0 px-6 py-4 bg-gradient-to-t from-[#0b0e13] via-[#0b0e13]/90 to-transparent z-[200]">
          <button 
            onClick={() => navigate('/checkout')}
            className="w-full max-w-4xl mx-auto bg-[#82C91E] text-black h-18 py-5 rounded-[2rem] font-[1000] uppercase italic flex items-center justify-center gap-4 shadow-[0_20px_50px_rgba(130,201,30,0.3)] active:scale-95 transition-all text-lg"
          >
            Finalizar Meu Pedido
            <Lucide.ArrowRight size={24} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* MODAL DE DETALHES DO ITEM (O "Sheet" Profissional) */}
      {itemSelecionado && (
        <div 
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/90 backdrop-blur-sm p-0 animate-in fade-in duration-300"
          onClick={() => setItemSelecionado(null)}
        >
          <div 
            className="bg-[#161922] w-full max-w-xl rounded-t-[3.5rem] p-8 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom-full duration-500"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            
            <div className="flex items-center gap-6 mb-8">
              <img 
                src={itemSelecionado.detalhes?.foto || itemSelecionado.foto} 
                className="w-24 h-24 rounded-[2rem] object-cover shadow-2xl" 
                alt="" 
              />
              <div>
                <h2 className="text-2xl font-[1000] italic uppercase text-[#82C91E] leading-none">{itemSelecionado.nome}</h2>
                <p className="text-white font-black italic text-xl mt-2">R$ {itemSelecionado.preco.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-3 custom-scrollbar">
              {itemSelecionado.detalhes?.baseNome && (
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-zinc-500 uppercase mb-1 italic tracking-widest">Base do Pedido:</p>
                  <p className="text-zinc-200 font-black italic text-lg uppercase">{itemSelecionado.detalhes.baseNome}</p>
                </div>
              )}

              {itemSelecionado.detalhes?.acompanhamentos?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-[#82C91E] uppercase mb-3 italic tracking-widest">Acompanhamentos Grátis:</p>
                  <div className="flex flex-wrap gap-2">
                    {itemSelecionado.detalhes.acompanhamentos.map((ac, i) => (
                      <span key={i} className="bg-white/5 text-zinc-300 px-4 py-2 rounded-2xl text-[11px] font-bold border border-white/5 italic">
                        {ac}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {itemSelecionado.detalhes?.adicionais?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-purple-400 uppercase mb-3 italic tracking-widest">Adicionais Extras:</p>
                  <div className="flex flex-wrap gap-2">
                    {itemSelecionado.detalhes.adicionais.map((ad, i) => (
                      <span key={i} className="bg-purple-500/10 text-purple-300 px-4 py-2 rounded-2xl text-[11px] font-bold border border-purple-500/20 italic">
                        + {ad}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setItemSelecionado(null)} 
              className="w-full bg-[#82C91E] text-black py-5 rounded-3xl font-[1000] uppercase italic mt-10 shadow-xl active:scale-95 transition-all"
            >
              Conferido, Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}