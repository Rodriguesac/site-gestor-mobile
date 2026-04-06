import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db } from '../services/firebase'; 
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIGURAÇÕES VISUAIS DE MARCA ---
const iconesEtapa = [
  { id: 1, Icon: Lucide.IceCream, label: 'Base' },
  { id: 2, Icon: Lucide.Maximize, label: 'Tamanho' },
  { id: 3, Icon: Lucide.Apple, label: 'Grátis' },
  { id: 4, Icon: Lucide.Droplets, label: 'Calda' },
  { id: 5, Icon: Lucide.PlusCircle, label: 'Extras' },
  { id: 6, Icon: Lucide.Utensils, label: 'Utensílio' },
  { id: 7, Icon: Lucide.ClipboardCheck, label: 'Revisão' }
];

export default function MonteSeuAcai() {
  const navigate = useNavigate();
  
  // --- ESTADOS DE DADOS (FIREBASE) ---
  const [loading, setLoading] = useState(true);
  const [bases, setBases] = useState([]);
  const [recipientes, setRecipientes] = useState({});
  const [gratis, setGratis] = useState([]);
  const [adicionais, setAdicionais] = useState([]);
  const [coberturas, setCoberturas] = useState([]);
  const [colheres, setColheres] = useState([]);

  // --- ESTADO DO PEDIDO INTELIGENTE ---
  const [etapa, setEtapa] = useState(1);
  const [pedido, setPedido] = useState({
    idLocal: null,
    baseId: '',
    baseNome: '',
    precoChave: '', 
    tamanho: '',
    acompanhamentos: [], // IDs dos itens grátis
    coberturaId: '',     // ID da cobertura
    colher: '',
    adicionais: [],      // [{id, nome, preco, qtd}]
    total: 0,
    foto: '',
    logoBase: '',
    observacao: '',
    tipo: 'Personalizado'
  });

  // Função para feedback tátil em dispositivos móveis
  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(40); };

  // --- 1. SINCRONIZAÇÃO EM TEMPO REAL (REAL-TIME ENGINE) ---
  useEffect(() => {
    const fetchRealtime = (path, setter) => {
      return onSnapshot(collection(db, path), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(i => i.disponivel !== false && i.disponivel !== "false") // Blindagem extra
          .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
        setter(data);
      });
    };

    const unsubBases = fetchRealtime("bases", setBases);
    const unsubGratis = fetchRealtime("acompanhamentos_gratis", setGratis);
    const unsubAdds = fetchRealtime("adicionais", setAdicionais);
    const unsubCobre = fetchRealtime("coberturas", setCoberturas);
    const unsubColher = fetchRealtime("colheres", setColheres);
    
    const unsubCopo = onSnapshot(collection(db, "cardapio_acai"), (s) => {
      const d = {}; 
      s.docs.forEach(doc => { 
        if (doc.data().disponivel !== false && doc.data().disponivel !== "false") {
            d[doc.id] = { id: doc.id, ...doc.data() }; 
        }
      });
      setRecipientes(d);
      setLoading(false);
    });

    return () => {
      unsubBases(); unsubGratis(); unsubAdds(); 
      unsubCobre(); unsubColher(); unsubCopo();
    };
  }, []);

  // --- 2. MOTOR DE CÁLCULO DE PREÇO DINÂMICO ---
  useEffect(() => {
    if (!pedido.tamanho || !recipientes[pedido.tamanho]) return;
    
    const precoBaseCopo = Number(recipientes[pedido.tamanho][pedido.precoChave]) || 0;
    const somaAdicionais = pedido.adicionais.reduce((acc, item) => acc + (Number(item.preco) * item.qtd), 0);
    
    setPedido(prev => ({ ...prev, total: precoBaseCopo + somaAdicionais }));
  }, [pedido.tamanho, pedido.adicionais, pedido.precoChave, recipientes]);

  // --- 3. LÓGICA DE NAVEGAÇÃO E VALIDAÇÃO BLINDADA ---
  const handleNext = () => {
    vibrar();
    if (etapa === 1 && !pedido.baseId) return;
    if (etapa === 2 && !pedido.tamanho) return;
    setEtapa(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleGratis = (item) => {
    vibrar();
    const limite = recipientes[pedido.tamanho]?.limite || 0;
    setPedido(prev => {
      const isSelected = prev.acompanhamentos.includes(item.id);
      if (isSelected) return { ...prev, acompanhamentos: prev.acompanhamentos.filter(id => id !== item.id) };
      if (prev.acompanhamentos.length < limite) return { ...prev, acompanhamentos: [...prev.acompanhamentos, item.id] };
      return prev;
    });
  };

  const updateAdicional = (item, operacao) => {
    vibrar();
    setPedido(prev => {
      const itemExistente = prev.adicionais.find(a => a.id === item.id);
      let novaLista;

      if (operacao === '+') {
        novaLista = itemExistente 
          ? prev.adicionais.map(a => a.id === item.id ? { ...a, qtd: a.qtd + 1 } : a)
          : [...prev.adicionais, { id: item.id, nome: item.nome, preco: item.preco, qtd: 1 }];
      } else {
        novaLista = itemExistente?.qtd > 1
          ? prev.adicionais.map(a => a.id === item.id ? { ...a, qtd: a.qtd - 1 } : a)
          : prev.adicionais.filter(a => a.id !== item.id);
      }
      return { ...prev, adicionais: novaLista };
    });
  };

  // --- 4. INTEGRAÇÃO FINAL: SALVAR NA SACOLA COM PERFEIÇÃO PARA O PDV ---
  const salvarNaSacola = (repetir = 1) => {
    vibrar();
    const carrinhoAtual = JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 };
    
    const nomeCobertura = coberturas.find(c => c.id === pedido.coberturaId)?.nome || '';

    const nomesGratis = gratis
      .filter(g => pedido.acompanhamentos.includes(g.id))
      .map(g => g.nome);

    const adicionaisOrdenados = adicionais
      .filter(a => pedido.adicionais.some(pa => pa.id === a.id))
      .map(a => {
          const itemNoPedido = pedido.adicionais.find(pa => pa.id === a.id);
          return { ...itemNoPedido };
      });

    const itemFormatado = {
      idLocal: Date.now(),
      id: Date.now(),
      nome: `Monte Seu Açaí (${pedido.tamanho})`,
      baseNome: pedido.baseNome,
      tamanho: pedido.tamanho,
      total: pedido.total,
      quantidade: 1,
      foto: pedido.foto,
      tipo: 'Personalizado',
      observacao: pedido.observacao,
      // Estrutura exata que o PDV e o Carrinho esperam ler
      detalhes: {
        baseNome: pedido.baseNome,
        tamanho: pedido.tamanho,
        cobertura_detalhes: nomeCobertura,
        acompanhamentos_detalhes: nomesGratis,
        adicionais_detalhes: adicionaisOrdenados,
        colher: pedido.colher || 'Não solicitada',
        foto: pedido.foto
      }
    };

    for (let i = 0; i < repetir; i++) {
      carrinhoAtual.itens.push({ ...itemFormatado, idLocal: Date.now() + i });
    }

    carrinhoAtual.totalGeral = carrinhoAtual.itens.reduce((acc, curr) => acc + (curr.total * (curr.quantidade || 1)), 0);
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(carrinhoAtual));
    
    // Dispara o evento pro carrinho atualizar o header global se existir
    window.dispatchEvent(new Event('cartUpdated'));
    navigate('/carrinho');
  };

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================
  if (loading) return (
    <div className="h-screen bg-[#4B0082] flex flex-col items-center justify-center gap-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-14 h-14 border-[5px] border-[#82C91E] border-t-transparent rounded-full shadow-[0_0_20px_rgba(130,201,30,0.5)]" />
      <span className="text-white font-black italic uppercase tracking-widest text-xs animate-pulse">Sincronizando Cardápio...</span>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#4B0082] font-['Montserrat'] flex flex-col items-center pb-40 relative">
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none z-0"></div>
      
      {/* HEADER DINÂMICO PREMIUM */}
      <header className="w-[94%] max-w-[550px] bg-white mt-6 p-5 rounded-[2.5rem] shadow-2xl z-50 sticky top-4 border-b-8 border-slate-100">
        <div className="flex justify-between items-center mb-5 px-2">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[#4B0082] hover:bg-slate-200 transition-colors active:scale-90">
              <Lucide.ChevronLeft size={24} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-xl font-[1000] italic text-[#4B0082] uppercase leading-none">Rodrigues Açaí</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Montagem Especial</p>
            </div>
          </div>
          <div className="bg-[#82C91E] px-5 py-2.5 rounded-2xl text-[#4B0082] font-[1000] italic shadow-lg shadow-[#82C91E]/20 text-sm tracking-tighter">
            R$ {pedido.total.toFixed(2).replace('.', ',')}
          </div>
        </div>
        
        {/* BARRA DE PROGRESSO COM ÍCONES */}
        <div className="flex justify-between px-1 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full"></div>
          <motion.div className="absolute top-1/2 left-0 h-1 bg-[#82C91E] -translate-y-1/2 z-0 rounded-full" initial={{ width: 0 }} animate={{ width: `${((etapa - 1) / (iconesEtapa.length - 1)) * 100}%` }} transition={{ duration: 0.5 }} />
          
          {iconesEtapa.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-1.5 relative z-10 bg-white">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${etapa >= item.id ? 'bg-[#4B0082] border-[#4B0082] text-[#82C91E] shadow-md' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                <item.Icon size={16} strokeWidth={etapa >= item.id ? 3 : 2} />
              </div>
              <span className={`text-[7px] font-black uppercase tracking-tighter ${etapa >= item.id ? 'text-[#4B0082]' : 'text-slate-300'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO */}
      <main className="w-full max-w-[550px] px-6 py-10 relative z-10">
        <AnimatePresence mode="wait">
          
          {/* ETAPA 1: ESCOLHA DA BASE */}
          {etapa === 1 && (
            <motion.div key="e1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-2 gap-5">
              {bases.map(b => (
                <button 
                  key={b.id} 
                  onClick={() => {
                    vibrar();
                    setPedido({...pedido, baseId: b.id, baseNome: b.nome, precoChave: b.cat || b.nome, foto: b.imagem_url, logoBase: b.url_logo_item});
                  }}
                  className={`relative h-64 rounded-[3.5rem] overflow-hidden border-4 transition-all bg-white group shadow-2xl ${pedido.baseId === b.id ? 'border-[#82C91E] scale-105 z-10 ring-4 ring-[#82C91E]/30' : 'border-transparent'}`}
                >
                  <img src={b.imagem_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={b.nome} />
                  
                  {b.url_logo_item && (
                    <div className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full p-1.5 shadow-xl border border-slate-50">
                      <img src={b.url_logo_item} className="w-full h-full object-contain" alt="logo base" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#4B0082] via-[#4B0082]/40 to-transparent opacity-90" />
                  
                  {pedido.baseId === b.id && (
                     <div className="absolute top-4 left-4 bg-[#82C91E] text-[#4B0082] p-2 rounded-full shadow-lg z-20">
                         <Lucide.Check size={16} strokeWidth={4} />
                     </div>
                  )}

                  <div className="absolute bottom-6 left-0 right-0 text-center z-10">
                    <span className="text-white font-[1000] uppercase italic text-[12px] px-4 leading-tight block tracking-wide">{b.nome}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* ETAPA 2: TAMANHOS (RECIPIENTES) */}
          {etapa === 2 && (
            <motion.div key="e2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="text-center mb-8">
                <h2 className="text-white font-[1000] uppercase italic text-2xl tracking-tighter">Escolha o Tamanho</h2>
                <p className="text-[#82C91E] text-[11px] font-black uppercase tracking-widest mt-1">Selecione o recipiente ideal</p>
              </div>

              {Object.keys(recipientes)
                .sort((a,b) => (recipientes[a].ordem ?? 999) - (recipientes[b].ordem ?? 999))
                .map(t => (
                  <button key={t} onClick={() => { vibrar(); setPedido({...pedido, tamanho: t}); }}
                    className={`w-full p-6 rounded-[2.5rem] flex justify-between items-center border-4 transition-all duration-300 bg-white shadow-xl relative overflow-hidden group
                    ${pedido.tamanho === t ? 'border-[#82C91E] scale-[1.02] ring-4 ring-[#82C91E]/30' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                    
                    <div className="flex items-center gap-5 relative z-10">
                      <div className={`w-20 h-20 rounded-[1.8rem] p-2 flex items-center justify-center transition-colors ${pedido.tamanho === t ? 'bg-[#82C91E]/20' : 'bg-slate-50'}`}>
                        <img src={recipientes[t].imagem_url || 'https://cdn-icons-png.flaticon.com/512/1046/1046751.png'} className="w-full h-full object-contain group-hover:scale-110 transition-transform" alt={t} />
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-[1000] italic text-[#4B0082] uppercase leading-none">{t}</p>
                        <p className="text-[10px] font-black text-[#82C91E] uppercase mt-1 tracking-widest flex items-center gap-1"><Lucide.Gift size={12}/> Limite: {recipientes[t].limite} Grátis</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <span className="text-xl font-[1000] text-slate-800 italic">R$ {Number(recipientes[t][pedido.precoChave] || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </button>
                ))}
            </motion.div>
          )}

          {/* ETAPA 3: ACOMPANHAMENTOS GRÁTIS */}
          {etapa === 3 && (
            <motion.div key="e3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2.5rem] text-center border border-white/20 shadow-lg">
                <h2 className="text-white font-[1000] uppercase italic text-2xl tracking-tighter mb-1">Itens Grátis</h2>
                <div className="inline-flex items-center gap-2 bg-[#4B0082] px-4 py-2 rounded-xl border border-white/10 mt-2">
                    <Lucide.CheckCircle2 size={16} className={pedido.acompanhamentos.length >= recipientes[pedido.tamanho]?.limite ? "text-[#82C91E]" : "text-white/50"}/>
                    <p className="text-white text-[11px] font-black uppercase tracking-widest">
                        Selecionados: <span className="text-[#82C91E]">{pedido.acompanhamentos.length}</span> de {recipientes[pedido.tamanho]?.limite}
                    </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {gratis.map(item => {
                  const selecionado = pedido.acompanhamentos.includes(item.id);
                  const noLimite = pedido.acompanhamentos.length >= (recipientes[pedido.tamanho]?.limite || 0);
                  
                  return (
                    <button key={item.id} onClick={() => toggleGratis(item)}
                      disabled={!selecionado && noLimite}
                      className={`relative p-4 rounded-[2.5rem] border-4 transition-all bg-white flex flex-col items-center gap-3 shadow-xl
                      ${selecionado ? 'border-[#82C91E] ring-4 ring-[#82C91E]/20 scale-105 z-10' : 'border-transparent opacity-90 disabled:opacity-40 disabled:grayscale-[50%]'}`}>
                      <div className="w-full h-28 bg-slate-50 rounded-[2rem] overflow-hidden border border-slate-100 shadow-inner">
                        <img src={item.imagem_url} className="w-full h-full object-cover" alt={item.nome} />
                      </div>
                      <span className="text-[11px] font-[1000] text-[#4B0082] uppercase text-center leading-tight h-8 flex items-center italic">{item.nome}</span>
                      
                      {selecionado && (
                        <div className="absolute -top-3 -right-3 bg-[#82C91E] text-[#4B0082] p-2.5 rounded-full shadow-lg border-2 border-white">
                          <Lucide.Check size={20} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ETAPA 4: CALDAS / COBERTURAS */}
          {etapa === 4 && (
            <motion.div key="e4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
               <div className="text-center mb-8">
                <h2 className="text-white font-[1000] uppercase italic text-2xl tracking-tighter">Escolha a Calda</h2>
                <p className="text-[#82C91E] text-[11px] font-black uppercase tracking-widest mt-1">O toque final de sabor</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {coberturas.map(c => (
                  <button key={c.id} onClick={() => { vibrar(); setPedido({...pedido, coberturaId: c.id}); }}
                    className={`w-full p-5 rounded-[2.5rem] flex items-center gap-5 border-4 transition-all bg-white shadow-xl relative overflow-hidden
                    ${pedido.coberturaId === c.id ? 'border-[#82C91E] scale-[1.02] ring-4 ring-[#82C91E]/20' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                    
                    <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem] overflow-hidden border-2 border-slate-50 shadow-inner shrink-0 relative z-10">
                      <img src={c.imagem_url} className="w-full h-full object-cover" alt={c.nome} />
                    </div>
                    <span className="text-lg font-[1000] text-[#4B0082] uppercase italic relative z-10 text-left">{c.nome}</span>
                    
                    {pedido.coberturaId === c.id && (
                        <div className="ml-auto bg-[#82C91E] text-[#4B0082] p-3 rounded-2xl shadow-sm relative z-10">
                            <Lucide.Droplets fill="currentColor" size={24} />
                        </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ETAPA 5: ADICIONAIS PAGOS */}
          {etapa === 5 && (
            <motion.div key="e5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center mb-8">
                <h2 className="text-white font-[1000] uppercase italic text-2xl tracking-tighter">Turbine seu Açaí</h2>
                <p className="text-[#82C91E] text-[11px] font-black uppercase tracking-widest mt-1">Adicionais premium</p>
              </div>
              <div className="space-y-4">
                {adicionais.map(item => {
                  const qtd = pedido.adicionais.find(a => a.id === item.id)?.qtd || 0;
                  return (
                    <div key={item.id} className="bg-white p-5 rounded-[2.5rem] flex items-center justify-between shadow-xl border-b-4 border-slate-100 transition-all hover:shadow-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] overflow-hidden border border-slate-100 shadow-inner">
                          <img src={item.imagem_url} className="w-full h-full object-cover" alt={item.nome} />
                        </div>
                        <div className="text-left">
                          <p className="text-[13px] font-[1000] text-[#4B0082] uppercase italic leading-tight">{item.nome}</p>
                          <p className="text-[11px] font-black text-[#82C91E] mt-1 tracking-widest">R$ {Number(item.preco).toFixed(2).replace('.', ',')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 shadow-inner">
                        <button onClick={() => updateAdicional(item, '-')} className={`w-10 h-10 rounded-[1rem] flex items-center justify-center transition-all ${qtd > 0 ? 'bg-white text-[#4B0082] shadow-sm border border-slate-200' : 'bg-transparent text-slate-300'}`}>
                          <Lucide.Minus size={18} strokeWidth={4} />
                        </button>
                        <span className={`text-xl font-[1000] italic w-6 text-center tracking-tighter ${qtd > 0 ? 'text-[#4B0082]' : 'text-slate-300'}`}>{qtd}</span>
                        <button onClick={() => updateAdicional(item, '+')} className="w-10 h-10 bg-[#4B0082] text-[#82C91E] rounded-[1rem] flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                          <Lucide.Plus size={18} strokeWidth={4} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ETAPA 6: UTENSÍLIOS / COLHERES */}
          {etapa === 6 && (
            <motion.div key="e6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
               <div className="text-center mb-8">
                <h2 className="text-white font-[1000] uppercase italic text-2xl tracking-tighter">Precisa de Colher?</h2>
                <p className="text-[#82C91E] text-[11px] font-black uppercase tracking-widest mt-1">Seja sustentável se puder!</p>
              </div>
              <div className="grid grid-cols-1 gap-5">
                {colheres.map(c => (
                  <button key={c.id} onClick={() => { vibrar(); setPedido({...pedido, colher: c.nome}); }}
                    className={`w-full p-8 rounded-[3.5rem] flex flex-col items-center gap-5 border-4 transition-all bg-white shadow-2xl relative overflow-hidden group
                    ${pedido.colher === c.nome ? 'border-[#82C91E] scale-[1.02] ring-4 ring-[#82C91E]/20' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                    
                    <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center p-5 transition-colors ${pedido.colher === c.nome ? 'bg-[#82C91E]/20' : 'bg-slate-50'}`}>
                       {c.imagem_url ? <img src={c.imagem_url} className="w-full h-full object-contain group-hover:scale-110 transition-transform" alt={c.nome} /> : <Lucide.Utensils size={48} className="text-slate-300"/>}
                    </div>
                    <div className="text-center relative z-10">
                        <span className="text-2xl font-[1000] text-[#4B0082] uppercase italic leading-none">{c.nome}</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{c.descricao || 'Adicionar ao pedido'}</p>
                    </div>
                    
                    {pedido.colher === c.nome && (
                        <div className="absolute top-6 right-6 bg-[#82C91E] text-[#4B0082] p-2.5 rounded-full shadow-md z-20">
                            <Lucide.Check size={24} strokeWidth={4}/>
                        </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ETAPA 7: REVISÃO DE ALTO NÍVEL */}
          {etapa === 7 && (
            <motion.div key="e7" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-[3.5rem] p-8 shadow-2xl border-b-[15px] border-[#82C91E] relative overflow-hidden">
                
                {/* MARCA D'ÁGUA */}
                {pedido.logoBase && <img src={pedido.logoBase} className="absolute -top-10 -right-10 w-48 h-48 opacity-5 rotate-12 grayscale pointer-events-none" alt="logo agua" />}
                
                <h2 className="text-2xl font-[1000] italic text-[#4B0082] uppercase mb-8 border-b-2 border-slate-50 pb-5 flex items-center gap-3 relative z-10">
                   <div className="p-3 bg-[#82C91E]/20 rounded-2xl text-[#82C91E]"><Lucide.ClipboardCheck size={28} /></div>
                   Resumo da Carga
                </h2>

                <div className="space-y-6 relative z-10">
                  {/* BASE E TAMANHO */}
                  <div className="flex justify-between items-center bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Item Principal</p>
                      <p className="text-lg font-[1000] text-[#4B0082] uppercase italic leading-tight">{pedido.baseNome}</p>
                      <p className="text-[11px] font-black text-[#82C91E] uppercase mt-0.5">{pedido.tamanho}</p>
                    </div>
                    <p className="text-xl font-[1000] text-slate-800 italic tracking-tighter">R$ {Number(recipientes[pedido.tamanho][pedido.precoChave]).toFixed(2).replace('.', ',')}</p>
                  </div>

                  {/* COMPLEMENTOS GRÁTIS */}
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Lucide.Gift size={14}/> Itens Inclusos</p>
                    <div className="flex flex-wrap gap-2">
                      {pedido.acompanhamentos.map(id => (
                        <span key={id} className="bg-white px-4 py-2.5 rounded-xl text-[10px] font-black text-[#4B0082] uppercase shadow-sm border border-slate-100">
                          {gratis.find(g => g.id === id)?.nome || id}
                        </span>
                      ))}
                      {pedido.coberturaId && (
                          <span className="bg-[#4B0082] text-[#82C91E] px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-md flex items-center gap-1.5">
                            <Lucide.Droplets size={12} fill="currentColor"/> {coberturas.find(c => c.id === pedido.coberturaId)?.nome}
                          </span>
                      )}
                    </div>
                  </div>

                  {/* ADICIONAIS PAGOS */}
                  {pedido.adicionais.length > 0 && (
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Lucide.PlusCircle size={14}/> Adicionais Extras</p>
                      {pedido.adicionais.map(add => (
                        <div key={add.id} className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                          <span className="font-[1000] uppercase text-[#4B0082] italic">{add.qtd}x {add.nome}</span>
                          <span className="font-black text-[#82C91E]">R$ {(add.preco * add.qtd).toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* OBSERVAÇÕES */}
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 ml-1"><Lucide.MessageSquare size={14}/> Alguma restrição ou pedido?</p>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-5 text-xs font-bold text-[#4B0082] uppercase outline-none focus:border-[#4B0082]/30 transition-all placeholder:text-slate-300 resize-none shadow-inner"
                      placeholder="Ex: Sem leite condensado, caprichar na Nutella..."
                      rows="3"
                      value={pedido.observacao}
                      onChange={(e) => setPedido({...pedido, observacao: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO FINAL */}
              <div className="flex flex-col gap-4 mt-6">
                <button 
                  onClick={() => salvarNaSacola(1)} 
                  className="w-full h-24 bg-[#82C91E] text-[#4B0082] rounded-[3rem] shadow-2xl flex items-center justify-center gap-4 text-xl font-[1000] uppercase italic active:scale-95 transition-all border-b-[8px] border-[#6ea81a] hover:bg-[#8ee11c]"
                >
                  Adicionar à Sacola <Lucide.ArrowRight strokeWidth={4} size={28}/>
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => salvarNaSacola(2)} className="h-[4.5rem] bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] text-white font-black uppercase italic text-[11px] tracking-widest flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95 shadow-lg">
                     <Lucide.Copy size={16}/> +1 Igual
                   </button>
                   <button onClick={() => {vibrar(); setEtapa(1);}} className="h-[4.5rem] bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] text-white font-black uppercase italic text-[11px] tracking-widest flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95 shadow-lg">
                     <Lucide.RefreshCcw size={16}/> Começar do Zero
                   </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER NAVEGAÇÃO FIXO */}
      {etapa < 7 && (
        <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-[550px] flex gap-4 z-[100]">
          
          <button 
            onClick={() => { vibrar(); etapa === 1 ? navigate(-1) : setEtapa(etapa - 1); }} 
            className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center justify-center text-[#4B0082] border-b-[6px] border-slate-200 active:scale-90 transition-all hover:bg-slate-50 shrink-0"
          >
            {etapa === 1 ? <Lucide.ArrowLeft size={32} strokeWidth={3} /> : <Lucide.ChevronLeft size={36} strokeWidth={4} />}
          </button>

          <button 
            onClick={handleNext}
            disabled={(etapa === 1 && !pedido.baseId) || (etapa === 2 && !pedido.tamanho) || (etapa === 4 && !pedido.coberturaId && coberturas.length > 0)}
            className="flex-1 h-20 sm:h-24 bg-[#82C91E] text-[#4B0082] rounded-[2.5rem] shadow-[0_10px_30px_rgba(130,201,30,0.4)] font-[1000] uppercase italic text-lg sm:text-xl flex items-center justify-center gap-3 active:scale-95 border-b-[6px] border-[#69a317] disabled:opacity-40 disabled:grayscale-[50%] disabled:active:scale-100 transition-all hover:bg-[#8ee11c]"
          >
            {etapa === 6 ? 'Ir para Resumo' : 'Próxima Etapa'} <Lucide.ArrowRight size={26} strokeWidth={4} />
          </button>
        </footer>
      )}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { background-color: #4B0082; margin: 0; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}