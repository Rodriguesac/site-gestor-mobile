import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db } from '../services/firebase'; 
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function MonteSeuAcai() {
  const navigate = useNavigate();
  
  // --- DADOS DO FIREBASE ---
  const [loading, setLoading] = useState(true);
  const [bases, setBases] = useState([]);
  const [recipientes, setRecipientes] = useState({});
  const [gratis, setGratis] = useState([]);
  const [adicionais, setAdicionais] = useState([]);
  const [coberturas, setCoberturas] = useState([]);
  const [colheres, setColheres] = useState([]);
  const [categoriasExtra, setCategoriasExtra] = useState([]);
  const [dadosDinamicos, setDadosDinamicos] = useState({}); 

  // --- ESTADO COM PERSISTÊNCIA (TRAVA DE RASCUNHO) ---
  const [etapa, setEtapa] = useState(() => {
    const salva = localStorage.getItem('rodrigues_etapa_ativa');
    return salva ? Number(salva) : 1;
  });

  const [pedido, setPedido] = useState(() => {
    const salvo = localStorage.getItem('rodrigues_rascunho_pedido');
    return salvo ? JSON.parse(salvo) : {
      idLocal: null, baseId: '', baseNome: '', precoChave: '', tamanho: '',
      acompanhamentos: [], coberturaId: '', colher: '', adicionais: [],
      total: 0, foto: '', logoBase: '', observacao: '', tipo: 'Personalizado', selecoesDinamicas: {} 
    };
  });

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(40); };

  useEffect(() => {
    localStorage.setItem('rodrigues_etapa_ativa', etapa.toString());
    localStorage.setItem('rodrigues_rascunho_pedido', JSON.stringify(pedido));
  }, [etapa, pedido]);

  // --- SINCRONIZAÇÃO EM TEMPO REAL ---
  useEffect(() => {
    const fetchRealtime = (path, setter) => {
      return onSnapshot(collection(db, path), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(i => i.disponivel !== false && i.disponivel !== "false")
          .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
        setter(data);
      });
    };

    fetchRealtime("bases", setBases);
    fetchRealtime("acompanhamentos_gratis", setGratis);
    fetchRealtime("adicionais", setAdicionais);
    fetchRealtime("coberturas", setCoberturas);
    fetchRealtime("colheres", setColheres);
    
    onSnapshot(collection(db, "cardapio_acai"), (s) => {
      const d = {}; 
      s.docs.forEach(doc => { if (doc.data().disponivel !== false) d[doc.id] = { id: doc.id, ...doc.data() }; });
      setRecipientes(d);
    });

    const unsubCatsExtra = onSnapshot(collection(db, "categorias_extra"), (snap) => {
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.isMonteAcai);
      setCategoriasExtra(cats);
      cats.forEach(cat => {
        onSnapshot(collection(db, cat.colecao), (s) => {
           const itens = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(i => i.disponivel !== false);
           setDadosDinamicos(prev => ({ ...prev, [cat.colecao]: itens }));
        });
      });
      setLoading(false);
    });

    return () => unsubCatsExtra();
  }, []);

  // --- MOTOR DE CÁLCULO ---
  useEffect(() => {
    if (!pedido.tamanho || !recipientes[pedido.tamanho]) return;
    const precoBase = Number(recipientes[pedido.tamanho][pedido.precoChave]) || 0;
    const somaFixos = pedido.adicionais.reduce((acc, it) => acc + (Number(it.preco) * it.qtd), 0);
    
    let somaDinamicos = 0;
    Object.keys(pedido.selecoesDinamicas).forEach(col => {
        const itens = dadosDinamicos[col] || [];
        pedido.selecoesDinamicas[col].forEach(id => {
            const item = itens.find(i => i.id === id);
            if (item?.preco) somaDinamicos += Number(item.preco);
        });
    });

    setPedido(prev => ({ ...prev, total: precoBase + somaFixos + somaDinamicos }));
  }, [pedido.tamanho, pedido.adicionais, pedido.precoChave, pedido.selecoesDinamicas, recipientes, dadosDinamicos]);

  // --- FUNÇÕES DE NAVEGAÇÃO E LIMPEZA ---
  const totalEtapasPadrao = 6;
  const etapaRevisao = totalEtapasPadrao + categoriasExtra.length + 1;

  const handleNext = () => {
    vibrar();
    if ((etapa === 1 && !pedido.baseId) || (etapa === 2 && !pedido.tamanho)) return;
    setEtapa(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparRascunho = () => {
    localStorage.removeItem('rodrigues_etapa_ativa');
    localStorage.removeItem('rodrigues_rascunho_pedido');
    setEtapa(1);
    setPedido({ baseId: '', baseNome: '', precoChave: '', tamanho: '', acompanhamentos: [], coberturaId: '', colher: '', adicionais: [], total: 0, foto: '', logoBase: '', observacao: '', tipo: 'Personalizado', selecoesDinamicas: {} });
  };

  const limparEtapaAtual = (campo) => {
      vibrar();
      if (campo === 'acompanhamentos') setPedido(p => ({...p, acompanhamentos: []}));
      else if (campo === 'adicionais') setPedido(p => ({...p, adicionais: []}));
      else setPedido(p => ({...p, selecoesDinamicas: {...p.selecoesDinamicas, [campo]: []}}));
  };

  // --- FUNÇÕES DE SELEÇÃO ---
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

  const toggleItemDinamico = (col, item) => {
    vibrar();
    setPedido(prev => {
        const atuais = prev.selecoesDinamicas[col] || [];
        const novaLista = atuais.includes(item.id) ? atuais.filter(id => id !== item.id) : [...atuais, item.id];
        return { ...prev, selecoesDinamicas: { ...prev.selecoesDinamicas, [col]: novaLista } };
    });
  };

  const updateAdicional = (item, operacao) => {
    vibrar();
    setPedido(prev => {
      const exist = prev.adicionais.find(a => a.id === item.id);
      let novaLista;
      if (operacao === '+') novaLista = exist ? prev.adicionais.map(a => a.id === item.id ? { ...a, qtd: a.qtd + 1 } : a) : [...prev.adicionais, { id: item.id, nome: item.nome, preco: item.preco, imagem_url: item.imagem_url, qtd: 1 }];
      else novaLista = exist?.qtd > 1 ? prev.adicionais.map(a => a.id === item.id ? { ...a, qtd: a.qtd - 1 } : a) : prev.adicionais.filter(a => a.id !== item.id);
      return { ...prev, adicionais: novaLista };
    });
  };

  // ===================================================================
  // CORREÇÃO CRÍTICA AQUI: ENVIAR BASE E TAMANHO NA RAIZ DO OBJETO
  // ===================================================================
  const salvarNaSacola = () => {
    vibrar();
    const sacola = JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 };
    
    const detalhes = {
        baseNome: pedido.baseNome, 
        tamanho: pedido.tamanho, 
        foto: pedido.foto,
        cobertura_detalhes: coberturas.find(c => c.id === pedido.coberturaId)?.nome || '',
        acompanhamentos_detalhes: gratis.filter(g => pedido.acompanhamentos.includes(g.id)).map(g => g.nome),
        adicionais_detalhes: pedido.adicionais, 
        colher: pedido.colher || 'Não solicitada'
    };

    categoriasExtra.forEach(cat => {
        detalhes[`${cat.colecao}_detalhes`] = (dadosDinamicos[cat.colecao] || []).filter(i => (pedido.selecoesDinamicas[cat.colecao] || []).includes(i.id)).map(i => i.nome);
    });

    const itemFinalizado = { 
        idLocal: Date.now(), 
        id: Date.now(),
        nome: `Açaí ${pedido.tamanho}`,
        // ATENÇÃO: ESTES SÃO OS CAMPOS QUE FALTAVAM E QUE DAVAM ERRO NO CARRINHO
        baseNome: pedido.baseNome,
        tamanho: pedido.tamanho,
        foto: pedido.foto,
        tipo: 'Personalizado',
        total: pedido.total, 
        quantidade: 1, 
        observacao: pedido.observacao, 
        detalhes: detalhes 
    };

    sacola.itens.push(itemFinalizado);
    sacola.totalGeral = sacola.itens.reduce((acc, curr) => acc + (curr.total * curr.quantidade), 0);
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(sacola));
    window.dispatchEvent(new Event('cartUpdated'));
    
    limparRascunho();
    navigate('/carrinho');
  };

  const iconesEtapa = [
    { id: 1, Icon: Lucide.IceCream, label: 'Base' },
    { id: 2, Icon: Lucide.Maximize, label: 'Tamanho' },
    { id: 3, Icon: Lucide.Apple, label: 'Grátis' },
    { id: 4, Icon: Lucide.Droplets, label: 'Calda' },
    { id: 5, Icon: Lucide.PlusCircle, label: 'Extras' },
    { id: 6, Icon: Lucide.Utensils, label: 'Utensílio' },
    ...categoriasExtra.map((c, i) => ({ id: 7 + i, Icon: Lucide.PlusSquare, label: c.nome })),
    { id: etapaRevisao, Icon: Lucide.ClipboardCheck, label: 'Revisão' }
  ];

  if (loading) return (
    <div className="h-screen bg-[#4B0082] flex flex-col items-center justify-center gap-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-16 h-16 border-[6px] border-[#82C91E] border-t-transparent rounded-full shadow-[0_0_30px_rgba(130,201,30,0.5)]" />
      <span className="text-white font-[1000] italic uppercase tracking-widest text-sm animate-pulse">Preparando Cardápio...</span>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#4B0082] font-['Montserrat'] flex flex-col items-center pb-48 relative overflow-x-hidden">
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none z-0"></div>
      
      {/* HEADER GLASSMORPHISM PREMIUM */}
      <header className="w-[94%] max-w-[550px] bg-white/95 backdrop-blur-xl mt-6 p-5 rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] z-50 sticky top-4 border border-white/40">
        <div className="flex justify-between items-center mb-5 px-2">
          <div className="flex items-center gap-3">
            <button onClick={() => { if(window.confirm("Sair e perder a montagem?")) { limparRascunho(); navigate(-1); } }} className="w-10 h-10 bg-slate-100 rounded-[1.2rem] flex items-center justify-center text-[#4B0082] hover:bg-slate-200 transition-colors active:scale-90">
              <Lucide.ChevronLeft size={24} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-xl font-[1000] italic text-[#4B0082] uppercase leading-none">Rodrigues Açaí</h1>
              <p className="text-[9px] font-black text-[#82C91E] uppercase tracking-widest mt-1">Montagem Premium</p>
            </div>
          </div>
          <motion.div layout className="bg-[#82C91E] px-4 py-2.5 rounded-2xl text-[#4B0082] font-[1000] italic shadow-lg shadow-[#82C91E]/30 text-sm tracking-tighter">
            R$ {pedido.total.toFixed(2).replace('.', ',')}
          </motion.div>
        </div>
        
        {/* PROGRESS BAR */}
        <div className="flex justify-between px-1 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full"></div>
          <motion.div className="absolute top-1/2 left-0 h-1 bg-[#82C91E] -translate-y-1/2 z-0 rounded-full shadow-[0_0_10px_#82C91E]" animate={{ width: `${((etapa - 1) / (iconesEtapa.length - 1)) * 100}%` }} transition={{ duration: 0.4 }} />
          {iconesEtapa.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-1.5 relative z-10 bg-white/95 rounded-full">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${etapa >= item.id ? 'bg-[#4B0082] border-[#4B0082] text-[#82C91E] shadow-md scale-110' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                <item.Icon size={14} strokeWidth={etapa >= item.id ? 3 : 2} />
              </div>
              <span className={`text-[6px] font-black uppercase tracking-tighter ${etapa >= item.id ? 'text-[#4B0082]' : 'text-slate-300 opacity-0'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ÁREA DE SELEÇÃO */}
      <main className="w-full max-w-[550px] px-6 py-10 relative z-10">
        <AnimatePresence mode="wait">
          
          {etapa === 1 && (
            <motion.div key="e1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-2 gap-5">
              {bases.map((b, idx) => (
                <button key={b.id} onClick={() => { vibrar(); setPedido({...pedido, baseId: b.id, baseNome: b.nome, precoChave: b.cat || b.nome, foto: b.imagem_url, logoBase: b.url_logo_item}); }}
                  className={`relative h-64 rounded-[3.5rem] overflow-hidden border-[5px] transition-all bg-white group shadow-2xl ${pedido.baseId === b.id ? 'border-[#82C91E] scale-105 z-10 ring-4 ring-[#82C91E]/20' : 'border-transparent'}`}>
                  {idx === 0 && <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#82C91E] text-[#4B0082] text-[9px] font-black uppercase px-3 py-1 rounded-b-xl z-30 shadow-md flex items-center gap-1"><Lucide.Flame size={10}/> Mais Pedido</div>}
                  <img src={b.imagem_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#4B0082] via-[#4B0082]/40 to-transparent opacity-90" />
                  <div className="absolute bottom-6 left-0 right-0 text-center z-10 px-2"><span className="text-white font-[1000] uppercase italic text-[13px] block tracking-wide drop-shadow-md">{b.nome}</span></div>
                  {pedido.baseId === b.id && <div className="absolute top-4 right-4 bg-[#82C91E] text-[#4B0082] p-2.5 rounded-[1rem] shadow-xl z-20"><Lucide.Check size={20} strokeWidth={4} /></div>}
                </button>
              ))}
            </motion.div>
          )}

          {etapa === 2 && (
            <motion.div key="e2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="text-center mb-8"><h2 className="text-white font-[1000] uppercase italic text-3xl tracking-tighter drop-shadow-lg">Escolha o Tamanho</h2></div>
              {Object.keys(recipientes).sort((a,b) => (recipientes[a].ordem ?? 999) - (recipientes[b].ordem ?? 999)).map((t, idx) => (
                  <button key={t} onClick={() => { vibrar(); setPedido({...pedido, tamanho: t}); }}
                    className={`w-full p-6 rounded-[2.5rem] flex justify-between items-center border-[5px] transition-all bg-white shadow-xl relative overflow-hidden ${pedido.tamanho === t ? 'border-[#82C91E] scale-[1.02] ring-4 ring-[#82C91E]/20' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                    {idx === 0 && <div className="absolute top-0 right-8 bg-pink-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-b-xl z-30 shadow-md">Custo Benefício</div>}
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-20 h-20 rounded-[1.8rem] p-2 bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner"><img src={recipientes[t].imagem_url || 'https://cdn-icons-png.flaticon.com/512/1046/1046751.png'} className="w-full h-full object-contain" alt="" /></div>
                      <div className="text-left"><p className="text-2xl font-[1000] italic text-[#4B0082] uppercase leading-none">{t}</p><p className="text-[10px] font-black text-[#82C91E] uppercase mt-2 tracking-widest flex items-center gap-1"><Lucide.Gift size={12}/> {recipientes[t].limite} Grátis</p></div>
                    </div>
                    <div className="text-right relative z-10 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100"><span className="text-lg font-[1000] italic text-slate-800">R$ {Number(recipientes[t][pedido.precoChave] || 0).toFixed(2).replace('.', ',')}</span></div>
                  </button>
                ))}
            </motion.div>
          )}

          {etapa === 3 && (
            <motion.div key="e3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] text-center border border-white/20 shadow-2xl relative">
                {pedido.acompanhamentos.length > 0 && (
                   <button onClick={() => limparEtapaAtual('acompanhamentos')} className="absolute top-4 right-4 text-[9px] font-black uppercase text-white/50 hover:text-white flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-lg transition-colors"><Lucide.Trash2 size={10}/> Limpar</button>
                )}
                <h2 className="text-white font-[1000] uppercase italic text-2xl tracking-tighter mb-3">Mix de Acompanhamentos</h2>
                <div className="inline-flex items-center gap-2 bg-[#4B0082] px-5 py-2.5 rounded-2xl border border-white/10">
                    <p className="text-white text-[11px] font-black uppercase tracking-widest">
                        Selecionados: <span className="text-[#82C91E] text-sm">{pedido.acompanhamentos.length}</span> <span className="opacity-50">/ {recipientes[pedido.tamanho]?.limite}</span>
                    </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {gratis.map(item => {
                  const isSel = pedido.acompanhamentos.includes(item.id);
                  const isFull = pedido.acompanhamentos.length >= (recipientes[pedido.tamanho]?.limite || 0);
                  return (
                    <button key={item.id} onClick={() => toggleGratis(item)} disabled={!isSel && isFull}
                      className={`relative p-4 rounded-[2.5rem] border-4 transition-all bg-white flex flex-col items-center gap-3 shadow-xl ${isSel ? 'border-[#82C91E] scale-105 z-10' : 'border-transparent opacity-95 disabled:opacity-40 disabled:grayscale-[50%]'}`}>
                      <div className="w-full h-28 bg-slate-50 rounded-[2rem] overflow-hidden shadow-inner border border-slate-100"><img src={item.imagem_url} className="w-full h-full object-cover" alt="" /></div>
                      <span className="text-[11px] font-[1000] text-[#4B0082] uppercase text-center leading-tight italic h-8 flex items-center px-1">{item.nome}</span>
                      {isSel && <div className="absolute -top-3 -right-3 bg-[#82C91E] text-[#4B0082] p-2.5 rounded-full shadow-2xl border-[4px] border-white"><Lucide.Check size={20} strokeWidth={4} /></div>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {etapa === 4 && (
            <motion.div key="e4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="text-center mb-8"><h2 className="text-white font-[1000] uppercase italic text-3xl tracking-tighter drop-shadow-lg">Toque Final</h2></div>
              <div className="grid grid-cols-1 gap-4">
                {coberturas.map((c, idx) => (
                  <button key={c.id} onClick={() => { vibrar(); setPedido({...pedido, coberturaId: c.id}); }}
                    className={`w-full p-5 rounded-[2.5rem] flex items-center gap-5 border-[4px] transition-all bg-white shadow-xl relative overflow-hidden ${pedido.coberturaId === c.id ? 'border-[#82C91E] scale-[1.02]' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                    {idx === 0 && <div className="absolute top-0 right-6 bg-[#82C91E] text-[#4B0082] text-[9px] font-black uppercase px-3 py-1 rounded-b-xl z-30 shadow-sm flex items-center gap-1">Favorito</div>}
                    <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem] overflow-hidden shrink-0 shadow-inner border border-slate-50 relative z-10"><img src={c.imagem_url} className="w-full h-full object-cover" alt="" /></div>
                    <span className="text-xl font-[1000] text-[#4B0082] uppercase italic flex-1 text-left relative z-10 tracking-tighter">{c.nome}</span>
                    {pedido.coberturaId === c.id && <div className="bg-[#82C91E] text-[#4B0082] p-3 rounded-2xl shadow-md relative z-10 animate-bounce"><Lucide.Droplets fill="currentColor" size={24} /></div>}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {etapa === 5 && (
            <motion.div key="e5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="text-center mb-6 relative">
                 <h2 className="text-white font-[1000] uppercase italic text-3xl tracking-tighter drop-shadow-lg">Turbine seu Açaí</h2>
                 {pedido.adicionais.length > 0 && <button onClick={() => limparEtapaAtual('adicionais')} className="mt-3 text-[10px] font-black uppercase text-white/50 hover:text-white flex items-center justify-center gap-1 mx-auto bg-white/10 px-4 py-1.5 rounded-xl transition-colors"><Lucide.Trash2 size={12}/> Limpar Seleções</button>}
              </div>
              <div className="space-y-4">
                {adicionais.map((item, idx) => {
                  const qtd = pedido.adicionais.find(a => a.id === item.id)?.qtd || 0;
                  return (
                    <div key={item.id} className="bg-white p-5 rounded-[2.5rem] flex items-center justify-between shadow-xl border-b-[6px] border-slate-100 hover:scale-[1.01] transition-transform relative overflow-hidden">
                      {idx === 0 && <div className="absolute top-0 right-6 bg-pink-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-b-xl z-30 shadow-sm">Premium</div>}
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] overflow-hidden shadow-inner border border-slate-100"><img src={item.imagem_url} className="w-full h-full object-cover" alt="" /></div>
                        <div className="text-left"><p className="text-[14px] font-[1000] text-[#4B0082] uppercase italic leading-tight">{item.nome}</p><p className="text-[11px] font-black text-[#82C91E] mt-1 tracking-widest">+ R$ {Number(item.preco).toFixed(2).replace('.', ',')}</p></div>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 shadow-inner relative z-10">
                        <button onClick={() => updateAdicional(item, '-')} className={`w-10 h-10 rounded-[1.2rem] flex items-center justify-center transition-all ${qtd > 0 ? 'bg-white text-[#4B0082] shadow-sm border border-slate-200 active:scale-90' : 'text-slate-300 opacity-30 cursor-default'}`}><Lucide.Minus size={18} strokeWidth={4} /></button>
                        <span className="text-xl font-[1000] italic w-6 text-center text-[#4B0082]">{qtd}</span>
                        <button onClick={() => updateAdicional(item, '+')} className="w-10 h-10 bg-[#4B0082] text-[#82C91E] rounded-[1.2rem] flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Lucide.Plus size={18} strokeWidth={4} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {etapa === 6 && (
            <motion.div key="e6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="text-center mb-8"><h2 className="text-white font-[1000] uppercase italic text-3xl tracking-tighter drop-shadow-lg">Precisa de Colher?</h2></div>
              <div className="grid grid-cols-1 gap-5">
                {colheres.map(c => (
                  <button key={c.id} onClick={() => { vibrar(); setPedido({...pedido, colher: c.nome}); }}
                    className={`w-full p-8 rounded-[3.5rem] flex flex-col items-center gap-5 border-[5px] transition-all bg-white shadow-2xl relative overflow-hidden ${pedido.colher === c.nome ? 'border-[#82C91E] scale-[1.02]' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                    <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center p-5 transition-colors duration-500 shadow-inner ${pedido.colher === c.nome ? 'bg-[#82C91E]/20 scale-110' : 'bg-slate-50 border border-slate-100'}`}>{c.imagem_url ? <img src={c.imagem_url} className="w-full h-full object-contain" alt="" /> : <Lucide.Utensils size={50} className="text-slate-300"/>}</div>
                    <div className="text-center z-10"><span className="text-2xl font-[1000] text-[#4B0082] uppercase italic leading-none">{c.nome}</span><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{c.descricao || 'Sustentável'}</p></div>
                    {pedido.colher === c.nome && <div className="absolute top-6 right-6 bg-[#82C91E] text-[#4B0082] p-3 rounded-2xl shadow-xl z-20 animate-in zoom-in"><Lucide.Check size={28} strokeWidth={5}/></div>}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ETAPAS DINÂMICAS DO ADMIN */}
          {etapa > totalEtapasPadrao && etapa < etapaRevisao && (
            <motion.div key={`din-${etapa}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
               {categoriasExtra.map((cat, index) => {
                  if (etapa !== (totalEtapasPadrao + index + 1)) return null;
                  const itens = dadosDinamicos[cat.colecao] || [];
                  const temSelecao = (pedido.selecoesDinamicas[cat.colecao] || []).length > 0;
                  return (
                    <div key={cat.id} className="space-y-6">
                        <div className="text-center mb-6 relative">
                            <h2 className="text-white font-[1000] uppercase italic text-3xl tracking-tighter drop-shadow-lg">{cat.nome}</h2>
                            {temSelecao && <button onClick={() => limparEtapaAtual(cat.colecao)} className="mt-3 text-[10px] font-black uppercase text-white/50 hover:text-white flex items-center justify-center gap-1 mx-auto bg-white/10 px-4 py-1.5 rounded-xl transition-colors"><Lucide.Trash2 size={12}/> Limpar Seleções</button>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {itens.map(item => {
                                const isSel = (pedido.selecoesDinamicas[cat.colecao] || []).includes(item.id);
                                return (
                                    <button key={item.id} onClick={() => toggleItemDinamico(cat.colecao, item)}
                                        className={`relative p-4 rounded-[2.5rem] border-4 transition-all bg-white flex flex-col items-center gap-3 shadow-xl ${isSel ? 'border-[#82C91E] scale-105 z-10' : 'border-transparent opacity-95 hover:opacity-100'}`}>
                                        <div className="w-full h-28 bg-slate-50 rounded-[2rem] overflow-hidden shadow-inner border border-slate-100"><img src={item.imagem_url} className="w-full h-full object-cover" alt="" /></div>
                                        <span className="text-[11px] font-[1000] text-[#4B0082] uppercase italic text-center leading-tight h-8 flex items-center px-1">{item.nome}</span>
                                        {isSel && <div className="absolute -top-3 -right-3 bg-[#82C91E] text-[#4B0082] p-2.5 rounded-full shadow-2xl border-[4px] border-white"><Lucide.Check size={20} strokeWidth={4} /></div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                  );
               })}
            </motion.div>
          )}

          {/* REVISÃO FINAL */}
          {etapa === etapaRevisao && (
            <motion.div key="final" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-[3.5rem] p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-b-[15px] border-[#82C91E] relative overflow-hidden">
                {pedido.logoBase && <img src={pedido.logoBase} className="absolute -top-10 -right-10 w-48 h-48 opacity-[0.03] rotate-12 pointer-events-none" alt="" />}
                <h2 className="text-2xl font-[1000] italic text-[#4B0082] uppercase mb-8 border-b-2 border-slate-50 pb-5 flex items-center gap-3 relative z-10"><div className="p-3 bg-[#82C91E]/20 rounded-2xl text-[#82C91E]"><Lucide.ClipboardCheck size={28} /></div>Resumo do Pedido</h2>
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden shrink-0 p-1"><img src={recipientes[pedido.tamanho]?.imagem_url} className="w-full h-full object-contain" alt=""/></div>
                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Copo Escolhido</p><p className="text-xl font-[1000] text-[#4B0082] uppercase italic leading-none">{pedido.baseNome} • {pedido.tamanho}</p></div>
                    </div>
                    <p className="text-2xl font-[1000] text-slate-800 italic">R$ {pedido.total.toFixed(2).replace('.', ',')}</p>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Lucide.Gift size={14}/> Composição</p>
                    <div className="flex flex-wrap gap-3">
                      {pedido.acompanhamentos.map(id => {
                          const item = gratis.find(g => g.id === id);
                          return item && (
                              <span key={id} className="bg-white pr-4 pl-2 py-2 rounded-xl text-[11px] font-[1000] text-[#4B0082] uppercase shadow-sm border border-slate-100 flex items-center gap-2">
                                  <img src={item.imagem_url} className="w-6 h-6 rounded-md object-cover border border-slate-50" alt=""/> {item.nome}
                              </span>
                          );
                      })}
                      {pedido.coberturaId && (() => {
                          const c = coberturas.find(cb => cb.id === pedido.coberturaId);
                          return c && (
                              <span className="bg-[#4B0082] text-[#82C91E] pr-4 pl-2 py-2 rounded-xl text-[11px] font-[1000] uppercase shadow-md flex items-center gap-2">
                                  <img src={c.imagem_url} className="w-6 h-6 rounded-md object-cover bg-white" alt=""/> {c.nome}
                              </span>
                          );
                      })()}
                      {pedido.adicionais.map(add => (
                          <span key={add.id} className="bg-pink-50 text-pink-600 border border-pink-100 pr-4 pl-2 py-2 rounded-xl text-[11px] font-[1000] uppercase shadow-sm flex items-center gap-2">
                              <img src={add.imagem_url} className="w-6 h-6 rounded-md object-cover border border-pink-50" alt=""/> {add.qtd}x {add.nome}
                          </span>
                      ))}
                      {categoriasExtra.map(cat => (pedido.selecoesDinamicas[cat.colecao] || []).map(id => {
                            const item = (dadosDinamicos[cat.colecao] || []).find(i => i.id === id);
                            return item && (
                                <span key={id} className="bg-purple-50 text-[#4B0082] border border-purple-100 pr-4 pl-2 py-2 rounded-xl text-[11px] font-[1000] uppercase shadow-sm flex items-center gap-2">
                                    <img src={item.imagem_url} className="w-6 h-6 rounded-md object-cover border border-purple-50" alt=""/> {item.nome}
                                </span>
                            );
                      }))}
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-2 tracking-widest"><Lucide.MessageSquare size={14} className="inline mr-1"/> Observações Especiais</p>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-5 text-xs font-bold text-[#4B0082] uppercase outline-none focus:border-[#4B0082]/30 transition-all placeholder:text-slate-300 shadow-inner" placeholder="Ex: Sem morango..." rows="3" value={pedido.observacao} onChange={(e) => setPedido({...pedido, observacao: e.target.value})} />
                  </div>
                </div>
              </div>
              <button onClick={() => salvarNaSacola()} className="w-full h-24 bg-[#82C91E] text-[#4B0082] rounded-[3rem] shadow-[0_20px_40px_rgba(130,201,30,0.3)] flex items-center justify-center gap-4 text-2xl font-[1000] uppercase italic active:scale-95 transition-all border-b-[8px] border-[#6ea81a] hover:bg-[#8ee11c] group">
                  Finalizar Açaí <Lucide.ArrowRight strokeWidth={5} size={30} className="group-hover:translate-x-2 transition-transform"/>
              </button>
              <button onClick={() => { if(window.confirm("Apagar montagem e reiniciar?")) limparRascunho(); }} className="w-full text-white/50 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancelar Montagem e Reiniciar</button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* NAVIGATION FOOTER FIXO (COM TRAVA DE TAMANHO/BASE) */}
      {etapa < etapaRevisao && (
        <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-[550px] flex gap-4 z-[100]">
          <button onClick={() => { vibrar(); etapa === 1 ? navigate(-1) : setEtapa(etapa - 1); }} 
            className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-[#4B0082] border-b-[8px] border-slate-200 active:scale-90 transition-all hover:bg-slate-50 shrink-0">
            {etapa === 1 ? <Lucide.ArrowLeft size={36} strokeWidth={4} /> : <Lucide.ChevronLeft size={40} strokeWidth={5} />}
          </button>
          
          {/* TRAVA: O botão fica cinza se a base ou o tamanho não estiverem escolhidos na sua respectiva etapa */}
          <button onClick={handleNext} disabled={(etapa === 1 && !pedido.baseId) || (etapa === 2 && !pedido.tamanho)}
            className="flex-1 h-20 sm:h-24 bg-[#82C91E] text-[#4B0082] rounded-[2.5rem] shadow-[0_20px_40px_rgba(130,201,30,0.3)] font-[1000] uppercase italic text-xl flex items-center justify-center gap-3 active:scale-95 border-b-[8px] border-[#69a317] disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none transition-all hover:bg-[#8ee11c]">
            {etapa === (etapaRevisao - 1) ? 'Ver Resumo' : 'Avançar'} <Lucide.ArrowRight size={28} strokeWidth={5} />
          </button>
        </footer>
      )}
      <style>{` ::-webkit-scrollbar { display: none; } body { background-color: #4B0082; } * { -webkit-tap-highlight-color: transparent; } `}</style>
    </div>
  );
}