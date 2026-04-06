import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db } from '../services/firebase'; 
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIGURAÇÕES VISUAIS DE MARCA ---
const CORES = {
  roxo: "#4B0082",
  verde: "#82C91E",
  fundo: "#F8FAFC",
  texto: "#1E293B"
};

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

  // --- ESTADO DO PEDIDO (SCHEMA COMPATÍVEL COM GESTOR/CHECKOUT) ---
  const [etapa, setEtapa] = useState(1);
  const [pedido, setPedido] = useState({
    idLocal: null,
    baseId: '',
    baseNome: '',
    precoChave: '', // Ex: 'Acai' ou 'Cupuacu'
    tamanho: '',
    acompanhamentos: [], // IDs dos itens grátis
    coberturaId: '',
    colher: '',
    adicionais: [], // [{id, nome, preco, qtd}]
    total: 0,
    foto: '',
    logoBase: '',
    observacao: '',
    tipo: 'Personalizado'
  });

  // --- 1. SINCRONIZAÇÃO EM TEMPO REAL (REAL-TIME ENGINE) ---
  useEffect(() => {
    const fetchRealtime = (path, setter) => {
      return onSnapshot(collection(db, path), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(i => i.disponivel !== false)
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
      s.docs.forEach(doc => { d[doc.id] = { id: doc.id, ...doc.data() }; });
      setRecipientes(d);
      setLoading(false);
    });

    return () => {
      unsubBases(); unsubGratis(); unsubAdds(); 
      unsubCobre(); unsubColher(); unsubCopo();
    };
  }, []);

  // --- 2. MOTOR DE CÁLCULO DE PREÇO ---
  useEffect(() => {
    if (!pedido.tamanho || !recipientes[pedido.tamanho]) return;
    
    const precoBaseCopo = Number(recipientes[pedido.tamanho][pedido.precoChave]) || 0;
    const somaAdicionais = pedido.adicionais.reduce((acc, item) => acc + (Number(item.preco) * item.qtd), 0);
    
    setPedido(prev => ({ ...prev, total: precoBaseCopo + somaAdicionais }));
  }, [pedido.tamanho, pedido.adicionais, pedido.precoChave, recipientes]);

  // --- 3. LOGICA DE NAVEGAÇÃO E VALIDAÇÃO ---
  const handleNext = () => {
    if (etapa === 1 && !pedido.baseId) return;
    if (etapa === 2 && !pedido.tamanho) return;
    setEtapa(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleGratis = (item) => {
    const limite = recipientes[pedido.tamanho]?.limite || 0;
    setPedido(prev => {
      const isSelected = prev.acompanhamentos.includes(item.id);
      if (isSelected) return { ...prev, acompanhamentos: prev.acompanhamentos.filter(id => id !== item.id) };
      if (prev.acompanhamentos.length < limite) return { ...prev, acompanhamentos: [...prev.acompanhamentos, item.id] };
      return prev;
    });
  };

  const updateAdicional = (item, operacao) => {
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

  // --- 4. INTEGRAÇÃO FINAL: SALVAR NA SACOLA (LOCALSTORAGE) ---
  const salvarNaSacola = (repetir = 1) => {
    const carrinhoAtual = JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 };
    
    // Mapeamento rico para o Gestor e Checkout
    const itemFormatado = {
      ...pedido,
      idLocal: Date.now(),
      nome: `Açaí Customizado (${pedido.tamanho})`,
      quantidade: 1,
      // Nomes resolvidos para exibição no gestor sem precisar de nova consulta
      detalhes: {
        base: pedido.baseNome,
        gratis: pedido.acompanhamentos.map(id => gratis.find(g => g.id === id)?.nome),
        cobertura: coberturas.find(c => c.id === pedido.coberturaId)?.nome || 'Nenhuma',
        colher: pedido.colher || 'Não solicitada'
      }
    };

    for (let i = 0; i < repetir; i++) {
      carrinhoAtual.itens.push({ ...itemFormatado, idLocal: Date.now() + i });
    }

    carrinhoAtual.totalGeral = carrinhoAtual.itens.reduce((acc, curr) => acc + curr.total, 0);
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(carrinhoAtual));
    navigate('/carrinho');
  };

  if (loading) return (
    <div className="h-screen bg-[#4B0082] flex flex-col items-center justify-center gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-[#82C91E] border-t-transparent rounded-full" />
      <span className="text-white font-black italic uppercase tracking-widest text-xs">Preparando Experiência...</span>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#4B0082] font-['Montserrat'] flex flex-col items-center pb-40">
      
      {/* HEADER DINÂMICO ESTILO iFOOD */}
      <header className="w-[94%] max-w-[550px] bg-white mt-6 p-5 rounded-[2.5rem] shadow-2xl z-50 sticky top-4 border-b-8 border-slate-100">
        <div className="flex justify-between items-center mb-5 px-2">
          <div>
            <h1 className="text-xl font-[1000] italic text-[#4B0082] uppercase leading-none">Rodrigues Açaí</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Personalização Profissional</p>
          </div>
          <div className="bg-[#82C91E] px-5 py-2.5 rounded-2xl text-black font-[1000] italic shadow-lg shadow-[#82C91E]/20">
            R$ {pedido.total.toFixed(2)}
          </div>
        </div>
        
        {/* BARRA DE ETAPAS COM ÍCONES */}
        <div className="flex justify-between px-1">
          {iconesEtapa.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-1">
              <div className={`p-2.5 rounded-full transition-all duration-500 ${etapa >= item.id ? 'bg-[#4B0082] text-[#82C91E] scale-110' : 'bg-slate-100 text-slate-300'}`}>
                <item.Icon size={16} strokeWidth={3} />
              </div>
              <span className={`text-[6px] font-black uppercase tracking-tighter ${etapa >= item.id ? 'text-[#4B0082]' : 'text-slate-300'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO */}
      <main className="w-full max-w-[550px] px-6 py-10">
        <AnimatePresence mode="wait">
          
          {/* ETAPA 1: ESCOLHA DA BASE (COM LOGOS) */}
          {etapa === 1 && (
            <motion.div key="e1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-2 gap-5">
              {bases.map(b => (
                <button 
                  key={b.id} 
                  onClick={() => {
                    setPedido({...pedido, baseId: b.id, baseNome: b.nome, precoChave: b.cat || b.nome, foto: b.imagem_url, logoBase: b.url_logo_item});
                    handleNext();
                  }}
                  className={`relative h-64 rounded-[3.5rem] overflow-hidden border-4 transition-all bg-white group ${pedido.baseId === b.id ? 'border-[#82C91E] scale-105 z-10' : 'border-transparent shadow-xl'}`}
                >
                  <img src={b.imagem_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={b.nome} />
                  
                  {/* LOGO DA BASE (Destaque que você pediu) */}
                  {b.url_logo_item && (
                    <div className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full p-1.5 shadow-2xl border border-slate-50">
                      <img src={b.url_logo_item} className="w-full h-full object-contain" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#4B0082] via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-6 left-0 right-0 text-center">
                    <span className="text-white font-[1000] uppercase italic text-[11px] px-4 leading-tight block">{b.nome}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* ETAPA 7: RESUMO COMPLETO DE EXCELÊNCIA */}
          {etapa === 7 && (
            <motion.div key="e7" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-[4rem] p-8 shadow-2xl border-b-[15px] border-slate-100 relative overflow-hidden">
                {/* MARCA D'ÁGUA DA LOGO DA BASE */}
                {pedido.logoBase && <img src={pedido.logoBase} className="absolute -top-6 -right-6 w-32 h-32 opacity-10 rotate-12 grayscale" />}
                
                <h2 className="text-2xl font-[1000] italic text-[#4B0082] uppercase mb-8 border-b-2 border-slate-50 pb-4 flex items-center gap-3">
                   <Lucide.ShoppingBag className="text-[#82C91E]" /> Resumo do Pedido
                </h2>

                <div className="space-y-6">
                  {/* BASE E TAMANHO */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Item Principal</p>
                      <p className="text-lg font-black text-[#4B0082] uppercase italic">{pedido.baseNome} • {pedido.tamanho}</p>
                    </div>
                    <p className="text-sm font-black text-slate-800">R$ {Number(recipientes[pedido.tamanho][pedido.precoChave]).toFixed(2)}</p>
                  </div>

                  {/* COMPLEMENTOS GRÁTIS */}
                  <div className="bg-slate-50 p-5 rounded-[2.5rem]">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-3 ml-2">Acompanhamentos (Inclusos)</p>
                    <div className="flex flex-wrap gap-2">
                      {pedido.acompanhamentos.map(id => (
                        <span key={id} className="bg-white px-4 py-2 rounded-full text-[10px] font-black text-[#4B0082] shadow-sm border border-slate-100">
                          {gratis.find(g => g.id === id)?.nome}
                        </span>
                      ))}
                      <span className="bg-[#4B0082] text-[#82C91E] px-4 py-2 rounded-full text-[10px] font-black shadow-lg">
                        Calda: {coberturas.find(c => c.id === pedido.coberturaId)?.nome || 'Sem Calda'}
                      </span>
                    </div>
                  </div>

                  {/* ADICIONAIS PAGOS */}
                  {pedido.adicionais.length > 0 && (
                    <div className="space-y-3 px-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Adicionais Extras</p>
                      {pedido.adicionais.map(add => (
                        <div key={add.id} className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#4B0082]">{add.qtd}x {add.nome}</span>
                          <span className="font-black text-[#82C91E]">R$ {(add.preco * add.qtd).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* OBSERVAÇÕES */}
                  <div className="pt-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">Observações para a Cozinha:</p>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-5 text-xs font-bold text-[#4B0082] outline-none focus:border-[#82C91E] transition-all"
                      placeholder="Ex: Mandar colher separada, caprichar no leite em pó..."
                      rows="3"
                      value={pedido.observacao}
                      onChange={(e) => setPedido({...pedido, observacao: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO FINAL */}
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => salvarNaSacola(1)} 
                  className="w-full h-24 bg-[#82C91E] text-black rounded-[2.8rem] shadow-2xl flex items-center justify-center gap-4 text-xl font-[1000] uppercase italic active:scale-95 transition-all border-b-[10px] border-[#6ea81a]"
                >
                  Confirmar e Ir para Sacola <Lucide.ArrowRight strokeWidth={4} />
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => salvarNaSacola(2)} className="h-16 bg-white/10 border-2 border-white/20 rounded-[2rem] text-white font-black uppercase italic text-[10px] flex items-center justify-center gap-2">
                     <Lucide.Copy size={14}/> +1 Igual a este
                   </button>
                   <button onClick={() => setEtapa(1)} className="h-16 bg-white/10 border-2 border-white/20 rounded-[2rem] text-white font-black uppercase italic text-[10px] flex items-center justify-center gap-2">
                     <Lucide.RefreshCcw size={14}/> Refazer
                   </button>
                </div>
              </div>
            </motion.div>
          )}

        {/* ETAPA 2: TAMANHOS (RECIPIENTES) */}
          {etapa === 2 && (
            <motion.div key="e2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-white font-[1000] uppercase italic text-xl">Escolha o Tamanho</h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Selecione o recipiente ideal</p>
              </div>
              {Object.keys(recipientes).map(t => (
                <button key={t} onClick={() => { setPedido({...pedido, tamanho: t}); handleNext(); }}
                  className={`w-full p-6 rounded-[2.5rem] flex justify-between items-center border-4 transition-all duration-300 bg-white shadow-xl ${pedido.tamanho === t ? 'border-[#82C91E] scale-[1.02]' : 'border-transparent opacity-90'}`}>
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 bg-slate-50 rounded-[1.8rem] p-2 flex items-center justify-center">
                      <img src={recipientes[t].imagem_url} className="w-full h-full object-contain" alt={t} />
                    </div>
                    <div className="text-left">
                      <p className="text-2xl font-[1000] italic text-[#4B0082] uppercase leading-none">{t}</p>
                      <p className="text-[9px] font-black text-[#82C91E] uppercase mt-1">Limite: {recipientes[t].limite} Itens Grátis</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-[1000] text-black italic">R$ {Number(recipientes[t][pedido.precoChave]).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* ETAPA 3: ACOMPANHAMENTOS GRÁTIS (COM TRAVA DE LIMITE) */}
          {etapa === 3 && (
            <motion.div key="e3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2.5rem] text-center border border-white/10">
                <h2 className="text-white font-[1000] uppercase italic text-lg">Itens Grátis</h2>
                <p className="text-[#82C91E] text-[10px] font-black uppercase">
                  Selecionados: {pedido.acompanhamentos.length} de {recipientes[pedido.tamanho]?.limite}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {gratis.map(item => {
                  const selecionado = pedido.acompanhamentos.includes(item.id);
                  const noLimite = pedido.acompanhamentos.length >= (recipientes[pedido.tamanho]?.limite || 0);
                  
                  return (
                    <button key={item.id} onClick={() => toggleGratis(item)}
                      disabled={!selecionado && noLimite}
                      className={`relative p-4 rounded-[2.5rem] border-4 transition-all bg-white flex flex-col items-center gap-3 ${selecionado ? 'border-[#82C91E] shadow-2xl' : 'border-transparent opacity-80 disabled:opacity-40'}`}>
                      <div className="w-full h-28 bg-slate-50 rounded-[2rem] overflow-hidden">
                        <img src={item.imagem_url} className="w-full h-full object-cover" alt={item.nome} />
                      </div>
                      <span className="text-[10px] font-black text-[#4B0082] uppercase text-center leading-tight h-8 flex items-center">{item.nome}</span>
                      {selecionado && (
                        <div className="absolute -top-2 -right-2 bg-[#82C91E] text-black p-2 rounded-full shadow-lg">
                          <Lucide.Check size={16} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ETAPA 4: CALDAS / COBERTURAS (SINGLE CHOICE) */}
          {etapa === 4 && (
            <motion.div key="e4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
               <div className="text-center mb-6">
                <h2 className="text-white font-[1000] uppercase italic text-xl">Escolha a Calda</h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">O toque final do seu mix</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {coberturas.map(c => (
                  <button key={c.id} onClick={() => { setPedido({...pedido, coberturaId: c.id}); handleNext(); }}
                    className={`w-full p-5 rounded-[2rem] flex items-center gap-4 border-4 transition-all bg-white ${pedido.coberturaId === c.id ? 'border-[#82C91E] scale-[1.02]' : 'border-transparent shadow-lg'}`}>
                    <div className="w-14 h-14 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-50">
                      <img src={c.imagem_url} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-sm font-[1000] text-[#4B0082] uppercase italic">{c.nome}</span>
                    {pedido.coberturaId === c.id && <Lucide.Droplets className="ml-auto text-[#82C91E]" fill="currentColor" size={20} />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ETAPA 5: ADICIONAIS PAGOS (INCREMENTO/DECREMENTO) */}
          {etapa === 5 && (
            <motion.div key="e5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-white font-[1000] uppercase italic text-xl">Turbine seu Açaí</h2>
                <p className="text-[#82C91E] text-[10px] font-black uppercase">Adicionais premium pagos</p>
              </div>
              <div className="space-y-3">
                {adicionais.map(item => {
                  const qtd = pedido.adicionais.find(a => a.id === item.id)?.qtd || 0;
                  return (
                    <div key={item.id} className="bg-white p-4 rounded-[2.5rem] flex items-center justify-between shadow-xl border-b-4 border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl overflow-hidden">
                          <img src={item.imagem_url} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-[#4B0082] uppercase italic">{item.nome}</p>
                          <p className="text-[10px] font-bold text-[#82C91E]">R$ {Number(item.preco).toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-full">
                        <button onClick={() => updateAdicional(item, '-')} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${qtd > 0 ? 'bg-white text-[#4B0082] shadow-md' : 'text-slate-300'}`}>
                          <Lucide.Minus size={18} strokeWidth={4} />
                        </button>
                        <span className={`text-lg font-[1000] italic w-6 text-center ${qtd > 0 ? 'text-[#4B0082]' : 'text-slate-300'}`}>{qtd}</span>
                        <button onClick={() => updateAdicional(item, '+')} className="w-10 h-10 bg-[#4B0082] text-[#82C91E] rounded-full flex items-center justify-center shadow-lg active:scale-90">
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
               <div className="text-center mb-6">
                <h2 className="text-white font-[1000] uppercase italic text-xl">Precisa de Colher?</h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Seja sustentável se puder!</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {colheres.map(c => (
                  <button key={c.id} onClick={() => { setPedido({...pedido, colher: c.nome}); handleNext(); }}
                    className={`w-full p-8 rounded-[3rem] flex flex-col items-center gap-4 border-4 transition-all bg-white ${pedido.colher === c.nome ? 'border-[#82C91E] scale-[1.02]' : 'border-transparent shadow-xl opacity-90'}`}>
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center p-4">
                       {c.imagem_url ? <img src={c.imagem_url} className="w-full h-full object-contain" /> : <Lucide.Utensils size={40} className="text-slate-200"/>}
                    </div>
                    <span className="text-lg font-[1000] text-[#4B0082] uppercase italic">{c.nome}</span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{c.descricao || 'Disponível para este pedido'}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER NAVEGAÇÃO (BOTÃO PRÓXIMO FIXO) */}
      {etapa < 7 && (
        <footer className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[92%] max-w-[500px] flex gap-4 z-[100]">
          {etapa > 1 && (
            <button onClick={() => setEtapa(etapa - 1)} className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-[#4B0082] border-b-8 border-slate-200 active:scale-90">
              <Lucide.ChevronLeft size={35} strokeWidth={4} />
            </button>
          )}
          <button 
            onClick={handleNext}
            disabled={(etapa === 1 && !pedido.baseId) || (etapa === 2 && !pedido.tamanho)}
            className="flex-1 h-24 bg-[#82C91E] text-black rounded-[2.5rem] shadow-2xl font-[1000] uppercase italic text-xl flex items-center justify-center gap-3 active:scale-95 border-b-8 border-[#69a317] disabled:opacity-50"
          >
            {etapa === 6 ? 'Ver Resumo' : 'Próxima Etapa'} <Lucide.Zap size={22} fill="black" />
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