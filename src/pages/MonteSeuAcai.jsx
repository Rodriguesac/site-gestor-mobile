import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db } from '../services/firebase'; 
import { collection, onSnapshot } from 'firebase/firestore';

export default function MonteSeuAcai() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalSucesso, setModalSucesso] = useState(false);

  const [bases, setBases] = useState([]);
  const [recipientes, setRecipientes] = useState({});
  const [acompanhamentosGratis, setAcompanhamentosGratis] = useState([]);
  const [adicionaisPagos, setAdicionaisPagos] = useState([]);
  const [coberturas, setCoberturas] = useState([]);

  const [pedido, setPedido] = useState({
    base: '', baseNome: '', baseCat: '', tamanho: '',
    acompanhamentos: [], cobertura: '', adicionais: [],
    total: 0, nomePersonalizado: ''
  });

  const imagensPorCategoria = {
    'acai': 'https://www.selectasorvetes.com/wp-content/uploads/sites/2/2021/09/Sorbet_Acai_Com_Guaranajpg-1-scaled.jpeg',
    'cupuacu': 'https://i.ibb.co/G31jdQg0/Gemini-Generated-Image-j44kkwj44kkwj44k-1.jpg', 
    'casadinho': 'https://i.ibb.co/66a5ac.jpg', 
    'misto': 'https://i.ibb.co/BHk3Zk8N/Chat-GPT-Image-8-de-jan-de-2026-05-03-55.jpg',
    'creme': 'https://i.ibb.co/tbgM9v6/creme-ninho.jpg'
  };

  const definirImagem = (categoria) => {
    if (!categoria) return imagensPorCategoria['acai'];
    const chave = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return imagensPorCategoria[chave] || imagensPorCategoria['acai'];
  };

  useEffect(() => {
    const unsubBases = onSnapshot(collection(db, "bases"), (snap) => {
      setBases(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.disponivel));
    });
    const unsubPrecos = onSnapshot(collection(db, "cardapio_acai"), (snap) => {
      const data = {};
      snap.docs.forEach(d => { if(d.data().disponivel) data[d.id] = d.data(); });
      setRecipientes(data);
    });
    const unsubGratis = onSnapshot(collection(db, "acompanhamentos_gratis"), (snap) => {
      setAcompanhamentosGratis(snap.docs.filter(d => d.data().disponivel !== false).map(d => d.id));
    });
    const unsubCoberturas = onSnapshot(collection(db, "coberturas"), (snap) => {
      setCoberturas(snap.docs.filter(d => d.data().disponivel !== false).map(d => d.id));
    });
    const unsubAdicionais = onSnapshot(collection(db, "adicionais"), (snap) => {
      setAdicionaisPagos(snap.docs.map(d => ({ n: d.id, ...d.data() })).filter(a => a.disponivel));
      setLoading(false);
    });
    return () => { unsubBases(); unsubPrecos(); unsubGratis(); unsubCoberturas(); unsubAdicionais(); };
  }, []);

  const getLimite = () => recipientes[pedido.tamanho]?.limite || 0;

  const selecaoAleatoria = () => {
    const limite = getLimite();
    if (!limite) return;
    const embaralhados = [...acompanhamentosGratis].sort(() => 0.5 - Math.random());
    const selecionados = embaralhados.slice(0, Math.floor(Math.random() * limite) + 1);
    const cobAleatoria = coberturas[Math.floor(Math.random() * coberturas.length)];
    setPedido(prev => ({ ...prev, acompanhamentos: selecionados, cobertura: cobAleatoria }));
  };

  const selecionarTamanho = (t) => {
    const novoPrecoBase = recipientes[t][pedido.baseCat] || 0;
    setPedido(prev => ({ ...prev, tamanho: t, acompanhamentos: [], total: novoPrecoBase }));
  };

  const toggleGratis = (item) => {
    const limite = getLimite();
    setPedido(prev => {
      if (item === "PURA 🚫") return { ...prev, acompanhamentos: ["PURA 🚫"] };
      let novaLista = prev.acompanhamentos.filter(i => i !== "PURA 🚫");
      if (novaLista.includes(item)) {
        novaLista = novaLista.filter(i => i !== item);
      } else {
        if (novaLista.length >= limite) return prev;
        novaLista.push(item);
      }
      return { ...prev, acompanhamentos: novaLista };
    });
  };

  const toggleAdicional = (add) => {
    const preco = add.preco || add.p || 0;
    setPedido(prev => ({ ...prev, adicionais: [...prev.adicionais, add.n], total: prev.total + preco }));
  };

  const removerAdicional = (nome, preco) => {
    setPedido(prev => {
      const idx = prev.adicionais.indexOf(nome);
      if (idx > -1) {
        const nova = [...prev.adicionais];
        nova.splice(idx, 1);
        return { ...prev, adicionais: nova, total: prev.total - preco };
      }
      return prev;
    });
  };

  const finalizarParaCarrinho = () => {
    const itemFinal = {
      id: Date.now(),
      nome: `${pedido.tamanho} - ${pedido.baseNome}`,
      nomePersonalizado: pedido.nomePersonalizado || "Meu Açaí",
      detalhes: { ...pedido, foto: definirImagem(pedido.baseCat) },
      preco: pedido.total
    };
    const carrinho = JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 };
    carrinho.itens.push(itemFinal);
    carrinho.totalGeral += itemFinal.preco;
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(carrinho));
    window.dispatchEvent(new Event('storage'));
    setModalSucesso(true);
  };

  if (loading) return <div className="min-h-screen bg-[#0b0e13] flex items-center justify-center font-black italic text-[#82C91E]">CARREGANDO...</div>;

  return (
    <div className="min-h-[100dvh] bg-[#0b0e13] text-white flex flex-col relative overflow-hidden">
      
      {/* HEADER GAME STYLE */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#161922]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-4xl mx-auto px-5 py-3 flex justify-between items-center">
          <button onClick={() => navigate('/')} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 active:scale-90 transition-all">
            <Lucide.ChevronLeft size={20} className="text-[#82C91E]" />
          </button>
          
          <div className="text-center">
            <span className="text-[#82C91E] font-[1000] italic text-xl block leading-none tracking-tight">R$ {pedido.total.toFixed(2)}</span>
            <span className="text-zinc-500 font-bold text-[8px] uppercase tracking-widest mt-1">Nível {etapa} de 6</span>
          </div>

          <button onClick={selecaoAleatoria} className={`w-10 h-10 bg-[#82C91E]/10 text-[#82C91E] rounded-xl flex items-center justify-center border border-[#82C91E]/20 transition-all active:scale-95 ${etapa < 3 ? 'opacity-0' : 'opacity-100 animate-pulse'}`}>
            <Lucide.Sparkles size={18} />
          </button>
        </div>
        <div className="flex w-full h-1 bg-white/5">
          <div className="h-full bg-[#82C91E] transition-all duration-500" style={{ width: `${(etapa / 6) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-20 pb-36">
        <div className="max-w-4xl mx-auto">
          
          {/* 1. BASES - GRID 2 COLUNAS */}
          {etapa === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-[1000] italic uppercase mb-6 border-l-4 border-[#82C91E] pl-3">Sabor da <span className="text-[#82C91E]">Base</span></h2>
              <div className="grid grid-cols-2 gap-4">
                {bases.map(b => (
                  <button key={b.id} onClick={() => setPedido({...pedido, base: b.id, baseNome: b.nome, baseCat: b.cat})} 
                    className={`relative h-36 rounded-[2rem] overflow-hidden border-2 transition-all ${pedido.base === b.id ? 'border-[#82C91E] scale-95 shadow-[0_0_20px_rgba(130,201,30,0.3)]' : 'border-white/5 opacity-50'}`}>
                    <img src={definirImagem(b.cat)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="text-white font-black uppercase italic text-xs tracking-tighter">{b.nome}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. TAMANHOS - CARDS LADO A LADO */}
          {etapa === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-[1000] italic uppercase mb-6 border-l-4 border-[#82C91E] pl-3">Escolha o <span className="text-[#82C91E]">Copo</span></h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(recipientes).map(t => (
                  <button key={t} onClick={() => selecionarTamanho(t)} 
                    className={`p-6 rounded-[2rem] flex flex-col items-center justify-center border-2 transition-all gap-1 active:scale-95 ${pedido.tamanho === t ? 'border-[#82C91E] bg-[#82C91E]/10 shadow-lg' : 'border-white/5 bg-[#161922]'}`}>
                    <p className="font-[1000] uppercase italic text-2xl text-white leading-none">{t}</p>
                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Limite {recipientes[t].limite} itens</p>
                    <span className="font-black text-lg italic text-[#82C91E] mt-2">R$ {recipientes[t][pedido.baseCat]?.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. ACOMPANHAMENTOS - GRID 2 COLUNAS (TEXTO GRANDE) */}
          {etapa === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-6 border-l-4 border-[#82C91E] pl-3">
                <h2 className="text-xl font-[1000] italic uppercase">Acompanhamentos</h2>
                <span className="bg-[#82C91E] text-black px-4 py-1 rounded-full font-black text-xs italic">{pedido.acompanhamentos.length}/{getLimite()}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {acompanhamentosGratis.map(item => (
                  <button key={item} onClick={() => toggleGratis(item)} 
                    className={`h-24 rounded-2xl border-2 flex items-center justify-center text-center p-4 transition-all active:scale-90 ${pedido.acompanhamentos.includes(item) ? 'bg-[#82C91E] border-[#82C91E] text-black shadow-lg shadow-[#82C91E]/20' : 'bg-[#161922] border-white/5 text-zinc-300'}`}>
                    <span className="font-black uppercase italic text-sm leading-tight">{item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. COBERTURAS - GRID 2 COLUNAS (TEXTO GRANDE) */}
          {etapa === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-[1000] italic uppercase mb-6 border-l-4 border-[#82C91E] pl-3">Cobertura <span className="text-[#82C91E]">Final</span></h2>
              <div className="grid grid-cols-2 gap-3">
                {coberturas.map(c => (
                  <button key={c} onClick={() => setPedido({...pedido, cobertura: c})} 
                    className={`h-24 rounded-2xl border-2 flex items-center justify-center text-center p-4 transition-all active:scale-90 ${pedido.cobertura === c ? 'bg-[#82C91E]/20 border-[#82C91E] text-[#82C91E]' : 'bg-[#161922] border-white/5 text-zinc-400'}`}>
                    <span className="font-black uppercase italic text-sm leading-tight">{c}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. ADICIONAIS - GRID 2 COLUNAS */}
          {etapa === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-[1000] italic uppercase mb-6 border-l-4 border-[#82C91E] pl-3">Adicionar <span className="text-[#82C91E]">Extras</span></h2>
              <div className="grid grid-cols-2 gap-4">
                {adicionaisPagos.map(add => { 
                  const qtd = pedido.adicionais.filter(x => x === add.n).length; 
                  return (
                    <div key={add.n} className="p-5 bg-[#161922] border border-white/5 rounded-[2rem] flex flex-col items-center text-center">
                      <p className="text-[11px] uppercase font-[1000] italic text-white leading-tight mb-1">{add.n}</p>
                      <p className="text-[#82C91E] font-black text-xs italic mb-4">+ R$ {(add.preco || add.p || 0).toFixed(2)}</p>
                      <div className="flex items-center gap-4">
                        <button onClick={() => removerAdicional(add.n, add.preco || add.p)} className={`w-8 h-8 rounded-full flex items-center justify-center ${qtd > 0 ? 'bg-white/5 text-zinc-400' : 'opacity-0 pointer-events-none'}`}>
                          <Lucide.Minus size={18} strokeWidth={4} />
                        </button>
                        <span className="font-black text-lg text-[#82C91E]">{qtd}</span>
                        <button onClick={() => toggleAdicional(add)} className="w-8 h-8 bg-[#82C91E]/20 rounded-full flex items-center justify-center text-[#82C91E]">
                          <Lucide.Plus size={18} strokeWidth={4} />
                        </button>
                      </div>
                    </div>
                  ); 
                })}
              </div>
            </div>
          )}

          {/* 6. REVISÃO FINAL */}
          {etapa === 6 && (
            <div className="animate-in zoom-in-95">
              <h2 className="text-xl font-[1000] italic uppercase mb-6 border-l-4 border-[#82C91E] pl-3">Tudo <span className="text-[#82C91E]">Certo?</span></h2>
              <div className="bg-[#161922] rounded-[2.5rem] p-8 border border-white/5 space-y-6">
                <div className="flex items-center gap-5">
                   <img src={definirImagem(pedido.baseCat)} className="w-20 h-20 rounded-[1.5rem] object-cover border border-white/10" alt="" />
                   <div>
                     <p className="font-[1000] italic text-xl text-white uppercase leading-none">{pedido.baseNome}</p>
                     <p className="text-[#82C91E] font-black text-xs uppercase tracking-[3px] mt-2">{pedido.tamanho}</p>
                   </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Para quem é este açaí?</p>
                  <input 
                    type="text" placeholder="EX: AÇAÍ DA MARIA" 
                    className="w-full h-14 bg-black/40 border-2 border-white/5 rounded-2xl px-6 font-black uppercase italic text-sm focus:border-[#82C91E] outline-none transition-all"
                    value={pedido.nomePersonalizado}
                    onChange={e => setPedido({...pedido, nomePersonalizado: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER NAVEGAÇÃO */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0b0e13] via-[#0b0e13] to-transparent z-[200]">
        <div className="max-w-4xl mx-auto flex gap-4">
          {etapa > 1 && (
            <button onClick={() => setEtapa(etapa - 1)} className="w-16 h-16 bg-[#161922] border-2 border-white/10 text-zinc-500 rounded-3xl flex items-center justify-center active:scale-90 transition-all">
              <Lucide.ChevronLeft size={28} />
            </button>
          )}
          <button 
            disabled={etapa === 1 ? !pedido.base : etapa === 2 ? !pedido.tamanho : false}
            onClick={() => etapa === 6 ? finalizarParaCarrinho() : setEtapa(etapa + 1)}
            className="flex-1 bg-[#82C91E] text-black h-16 rounded-[1.5rem] font-[1000] uppercase italic text-sm flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(130,201,30,0.25)] active:scale-95 transition-all disabled:opacity-20"
          >
            {etapa === 6 ? 'Finalizar e Salvar' : 'Próximo Passo'}
            <Lucide.ChevronRight size={22} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* MODAL SUCESSO */}
      {modalSucesso && (
        <div className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-[#161922] w-full max-w-sm rounded-[3rem] p-10 border border-white/10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#82C91E] rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(130,201,30,0.4)]">
               <Lucide.Check size={40} className="text-black" strokeWidth={4} />
            </div>
            <h2 className="text-2xl font-[1000] italic uppercase text-white mb-8">Item na <span className="text-[#82C91E]">Sacola!</span></h2>
            <div className="space-y-4">
               <button onClick={() => { setModalSucesso(false); setEtapa(1); setPedido({base:'', baseNome:'', baseCat:'', tamanho:'', acompanhamentos:[], cobertura:'', adicionais:[], total:0, nomePersonalizado:''}); }}
                 className="w-full bg-white/5 text-white py-5 rounded-2xl font-black uppercase italic text-xs border border-white/10 active:scale-95 transition-all">
                 Montar Outro Açaí
               </button>
               <button onClick={() => navigate('/carrinho')}
                 className="w-full bg-[#82C91E] text-black py-5 rounded-2xl font-[1000] uppercase italic text-sm shadow-xl active:scale-95 transition-all">
                 Ir para Sacola
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}