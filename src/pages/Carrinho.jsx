import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ModalEndereco from '../components/ModalEndereco'; 
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

// --- MARCADOR DO MAPA ---
const iconVerde = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: #82C91E; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(130,201,30,0.8);"></div>`
});

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { 
    if (coords?.lat && coords?.lng) {
      map.setView([coords.lat, coords.lng], 16); // Zoom 16 mostra bem as quadras ao redor
    }
  }, [coords, map]);
  return null;
}

export default function Carrinho() {
  const navigate = useNavigate();
  const { userData, enderecoAtivo } = useUser(); // Puxa endereço e dados globais
  
  // --- ESTADOS ---
  const [carrinho, setCarrinho] = useState({ itens: [], totalGeral: 0 });
  const [loading, setLoading] = useState(true);
  const [tipoEntrega, setTipoEntrega] = useState('delivery');
  
  const [isModalEndOpen, setIsModalEndOpen] = useState(false);
  
  const [cupomDigitado, setCupomDigitado] = useState('');
  const [cupomAtivo, setCupomAtivo] = useState(null);
  const [descontoAplicado, setDescontoAplicado] = useState(0);
  const [cuponsDisponiveis, setCuponsDisponiveis] = useState([]);
  const [isModalCuponsOpen, setIsModalCuponsOpen] = useState(false);

  const [itensExpandidos, setItensExpandidos] = useState({});

  // --- MOTOR DE CARREGAMENTO & VALIDAÇÃO ---
  const carregarDados = () => {
    try {
      const salvo = JSON.parse(localStorage.getItem('carrinho_rodrigues'));
      const cupomSalvo = JSON.parse(localStorage.getItem('cupom_rodrigues'));
      
      if (salvo && Array.isArray(salvo.itens)) {
        // Validação Inteligente (Falta de Base/Recipiente em Re-pedidos)
        let itensValidos = [];
        let teveErroGrave = false;

        salvo.itens.forEach((item, index) => {
           // Verifica se a base ou recipiente sumiram (simulando falta de estoque)
           if (!item.baseNome || (!item.tamanho && !item.detalhes?.tamanho)) {
               teveErroGrave = true;
           } else {
               // Nome inteligente automático no primeiro item
               if (index === 0 && !item.nomeCopo && userData?.nome) {
                   item.nomeCopo = userData.nome.split(' ')[0];
               }
               itensValidos.push(item);
           }
        });

        if (teveErroGrave) {
            alert("Atenção: Alguns itens do seu re-pedido foram removidos pois a Base ou Recipiente estão indisponíveis no momento.");
        }

        const novoTotal = itensValidos.reduce((acc, curr) => acc + (curr.total * (curr.quantidade || 1)), 0);
        setCarrinho({ itens: itensValidos, totalGeral: novoTotal });
        localStorage.setItem('carrinho_rodrigues', JSON.stringify({ itens: itensValidos, totalGeral: novoTotal }));

      } else {
        setCarrinho({ itens: [], totalGeral: 0 });
      }

      if (cupomSalvo) {
        setCupomAtivo(cupomSalvo);
        setDescontoAplicado(cupomSalvo.valorDesconto || 0);
      }
    } catch (e) {
        console.error(e);
        setCarrinho({ itens: [], totalGeral: 0 });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    window.addEventListener('cartUpdated', carregarDados);
    
    const q = query(collection(db, "cupons"), where("ativo", "==", true));
    const unsubCupons = onSnapshot(q, (snap) => {
      setCuponsDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      window.removeEventListener('cartUpdated', carregarDados);
      unsubCupons();
    };
  }, [userData]); 

  // --- FUNÇÕES DO CARRINHO ---
  const atualizarCarrinho = (novosItens) => {
    const novoTotal = novosItens.reduce((acc, curr) => acc + (curr.total * (curr.quantidade || 1)), 0);
    const novoCarrinho = { itens: novosItens, totalGeral: novoTotal };
    setCarrinho(novoCarrinho);
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(novoCarrinho));
    recalcularDesconto(novoTotal, cupomAtivo);
  };

  const removerItem = (index) => {
    const novos = carrinho.itens.filter((_, i) => i !== index);
    atualizarCarrinho(novos);
  };

  const alterarQuantidade = (index, delta) => {
    const novos = [...carrinho.itens];
    const novaQtd = (novos[index].quantidade || 1) + delta;
    if (novaQtd < 1) return;
    novos[index].quantidade = novaQtd;
    atualizarCarrinho(novos);
  };

  const atualizarCampo = (index, campo, valor) => {
    const novos = [...carrinho.itens];
    novos[index][campo] = valor;
    atualizarCarrinho(novos);
  };

  const editarItem = (item, index) => {
    localStorage.setItem('edit_acai', JSON.stringify({ ...item, indexOriginal: index }));
    navigate('/'); 
  };

  // --- LÓGICA DE CUPONS ---
  const recalcularDesconto = (subtotal, cupom) => {
    if (!cupom) return;
    let valorDesc = cupom.tipo === 'fixo' ? cupom.valor : (subtotal * cupom.valor) / 100;
    if (valorDesc > subtotal) valorDesc = subtotal; 
    setDescontoAplicado(valorDesc);
    localStorage.setItem('cupom_rodrigues', JSON.stringify({...cupom, valorDesconto: valorDesc}));
  };

  const aplicarCupom = (cupomObj) => {
    setCupomAtivo(cupomObj);
    recalcularDesconto(carrinho.totalGeral, cupomObj);
    setIsModalCuponsOpen(false);
    setCupomDigitado('');
  };

  const removerCupom = () => {
    setCupomAtivo(null); setDescontoAplicado(0); localStorage.removeItem('cupom_rodrigues');
  };

  // =========================================================================
  // BLINDAGEM DE LOGÍSTICA: PUXA DIRETO DO CACHE DO NAVEGADOR
  // =========================================================================
  const getEnderecoSeguro = () => {
      const cache = JSON.parse(localStorage.getItem('endereco_rodrigues'));
      if (cache && cache.taxa && cache.taxa !== '...') return cache;
      if (enderecoAtivo && enderecoAtivo.taxa && enderecoAtivo.taxa !== '...') return enderecoAtivo;
      return null;
  };
  
  const endSeguro = getEnderecoSeguro();
  
  const taxaString = endSeguro?.taxa ? String(endSeguro.taxa).replace(',', '.') : "0";
  const valorFrete = tipoEntrega === 'retirada' ? 0 : (Number(taxaString) || 0.00);
  
  const subtotal = carrinho?.totalGeral || 0;
  const totalFinal = Math.max(0, subtotal + valorFrete - descontoAplicado);

  const toggleExpandir = (idx) => {
    setItensExpandidos(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleAutoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-48 selection:bg-[#82C91E]/30">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white p-6 flex justify-between items-center rounded-b-[3.5rem] shadow-xl border-b border-slate-100 mx-1 mt-1">
        <button onClick={() => navigate(-1)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all">
          <Lucide.ChevronLeft size={28} strokeWidth={3} />
        </button>
        <div className="text-center">
          <h1 className="text-[#4B0082] font-[1000] italic uppercase text-lg leading-none">Sua Sacola</h1>
          <p className="text-[10px] font-black text-[#82C91E] uppercase mt-1 tracking-widest">
            {(carrinho?.itens?.length || 0)} Itens
          </p>
        </div>
        <button onClick={() => { if(window.confirm("Esvaziar sacola?")) { localStorage.removeItem('carrinho_rodrigues'); removerCupom(); carregarDados(); } }} className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors bg-white rounded-2xl">
          <Lucide.Trash2 size={20} />
        </button>
      </header>

      <main className="p-6 max-w-[550px] mx-auto space-y-6">
        
        {loading ? (
           <div className="flex justify-center py-10"><Lucide.Loader2 size={30} className="animate-spin text-[#82C91E]" /></div>
        ) : (carrinho?.itens?.length || 0) === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-20 text-center flex flex-col items-center">
            <div className="w-40 h-40 bg-white rounded-[3rem] flex items-center justify-center mb-6 shadow-xl border border-slate-50">
              <Lucide.ShoppingBag size={60} className="text-slate-200" strokeWidth={1.5} />
            </div>
            <h2 className="text-[#4B0082] font-[1000] uppercase italic text-2xl mb-2">Sacola Vazia</h2>
            <button onClick={() => navigate('/')} className="mt-6 bg-[#82C91E] px-10 py-5 rounded-[2rem] text-[#4B0082] font-[1000] uppercase italic text-sm shadow-xl shadow-[#82C91E]/20 active:scale-95 transition-all">
              Ir para o Cardápio
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            
            {/* LOGÍSTICA DE ENTREGA */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-2 rounded-[2.5rem] flex shadow-lg border border-slate-50 mb-2">
              <button onClick={() => setTipoEntrega('delivery')} className={`flex-1 py-4 rounded-[2.2rem] font-[1000] uppercase italic text-[11px] flex items-center justify-center gap-2 transition-all ${tipoEntrega === 'delivery' ? 'bg-[#4B0082] text-[#82C91E] shadow-xl' : 'text-slate-400'}`}>
                <Lucide.Bike size={18} /> Delivery
              </button>
              <button onClick={() => setTipoEntrega('retirada')} className={`flex-1 py-4 rounded-[2.2rem] font-[1000] uppercase italic text-[11px] flex items-center justify-center gap-2 transition-all ${tipoEntrega === 'retirada' ? 'bg-[#4B0082] text-[#82C91E] shadow-xl' : 'text-slate-400'}`}>
                <Lucide.Store size={18} /> Retirada
              </button>
            </motion.div>

            {/* ENDEREÇO ATIVO GLOBAL */}
            {tipoEntrega === 'delivery' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
                className="bg-white rounded-[2.5rem] p-5 shadow-xl relative overflow-hidden cursor-pointer group border border-slate-50 transition-all active:scale-[0.98]"
                onClick={() => setIsModalEndOpen(true)}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl">
                    <h3 className="text-[#4B0082] font-[1000] italic uppercase text-sm leading-none flex items-center gap-2">
                        ENTREGAR EM: <Lucide.Edit3 size={14} className="text-slate-400" />
                    </h3>
                    <p className="text-[10px] font-black text-[#82C91E] uppercase mt-1 tracking-widest">
                      {endSeguro ? `${endSeguro.rua}, ${endSeguro.numero}` : 'Toque para definir o local'}
                    </p>
                  </div>
                </div>
                
                {/* 🗺️ MAPA RETRO VINTAGE 🗺️ */}
                {endSeguro?.latlng?.lat && (
                  <div className="w-full h-32 bg-amber-50/50 rounded-[1.8rem] overflow-hidden border border-slate-100 relative pointer-events-none mt-4 shadow-inner">
                     <MapContainer 
                        center={[endSeguro.latlng.lat, endSeguro.latlng.lng]} 
                        zoom={16} 
                        zoomControl={false} 
                        dragging={false}
                        touchZoom={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        style={{ width: '100%', height: '100%' }}
                        className="retro-map-tiles"
                     >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                        <Marker position={[endSeguro.latlng.lat, endSeguro.latlng.lng]} icon={iconVerde} />
                        <RecenterMap coords={endSeguro.latlng} />
                     </MapContainer>
                     {/* Borda interna e Overlay para bloquear cliques e dar mais estilo vintage */}
                     <div className="absolute inset-0 z-[400] shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] pointer-events-none" />
                  </div>
                )}
              </motion.div>
            )}

            {/* LISTA DE ITENS (ACORDEÃO / SANFONA) */}
            <div className="space-y-4 mt-6">
              
              {carrinho?.itens?.map((item, idx) => {
                const isExpanded = itensExpandidos[idx];
                const tamanhoRecipiente = item.detalhes?.tamanho || item.tamanho;
                const baseNome = item.detalhes?.baseNome || item.baseNome;
                const totalItem = (item.total * (item.quantidade || 1)).toFixed(2).replace('.', ',');

                return (
                  <motion.div key={`item-${idx}`} className="bg-white p-5 rounded-[2.5rem] shadow-xl border border-slate-50 relative overflow-hidden">
                    
                    {/* Botão de Editar Isolado */}
                    <button onClick={() => editarItem(item, idx)} className="absolute top-5 right-5 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-[#4B0082] transition-colors shadow-inner z-10">
                        <Lucide.Pencil size={14} strokeWidth={3} />
                    </button>

                    {/* Identificação Inteligente (Nome no Copo) */}
                    <div className="mb-4 pr-10 border-b border-slate-50 pb-2">
                        <input 
                            value={item.nomeCopo || ''}
                            onChange={(e) => atualizarCampo(idx, 'nomeCopo', e.target.value)}
                            placeholder="Para quem é este pedido?"
                            className="w-full text-[11px] font-[1000] text-[#4B0082] uppercase tracking-widest outline-none placeholder:text-slate-300 bg-transparent"
                        />
                    </div>

                    {/* INFORMAÇÕES PRINCIPAIS (Sempre Visíveis) */}
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-[1.8rem] bg-slate-50 overflow-hidden shrink-0 border border-slate-100 shadow-inner">
                        <img src={item.detalhes?.foto || item.foto || "https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png"} className="w-full h-full object-cover" alt="" />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                          <h3 className="text-[#82C91E] font-[1000] uppercase italic text-[11px] leading-tight mb-0.5">{tamanhoRecipiente}</h3>
                          <h2 className="text-[#4B0082] font-black uppercase italic text-[14px] leading-tight truncate">{baseNome}</h2>
                          
                          <div className="mt-3 flex justify-between items-center pr-2">
                            <span className="text-lg font-[1000] italic text-[#4B0082] tracking-tighter">R$ {totalItem}</span>
                            
                            {/* Botões de Qtd Alto Contraste */}
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-full border border-slate-100">
                                <button onClick={() => alterarQuantidade(idx, -1)} className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[#4B0082] shadow-sm"><Lucide.Minus size={14} strokeWidth={3}/></button>
                                <span className="text-xs font-black w-4 text-center">{item.quantidade || 1}</span>
                                <button onClick={() => alterarQuantidade(idx, 1)} className="w-8 h-8 bg-[#4B0082] rounded-full flex items-center justify-center text-[#82C91E] shadow-sm"><Lucide.Plus size={14} strokeWidth={3}/></button>
                            </div>
                          </div>
                      </div>
                    </div>

                    {/* Botão de Sanfona */}
                    <button onClick={() => toggleExpandir(idx)} className="w-full mt-4 flex items-center justify-center gap-1 text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-[#4B0082] transition-colors">
                        {isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'} 
                        {isExpanded ? <Lucide.ChevronUp size={14} /> : <Lucide.ChevronDown size={14} />}
                    </button>

                    {/* ÁREA EXPANSÍVEL (SANFONA) */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }} 
                                animate={{ height: 'auto', opacity: 1 }} 
                                exit={{ height: 0, opacity: 0 }} 
                                className="overflow-hidden"
                            >
                                <div className="pt-4 border-t border-slate-50 mt-3 space-y-4">
                                    
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.detalhes?.cobertura_detalhes && (
                                            <span className="text-[9px] font-black text-white bg-[#F1157E] px-3 py-1.5 rounded-lg uppercase italic shadow-sm">
                                                Calda: {item.detalhes.cobertura_detalhes.nome || item.detalhes.cobertura_detalhes}
                                            </span>
                                        )}
                                        {(item.detalhes?.acompanhamentos_detalhes || []).map((acc, i) => (
                                            <span key={`acc-${i}`} className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg uppercase">
                                                {acc.nome || acc}
                                            </span>
                                        ))}
                                        {(item.detalhes?.adicionais_detalhes || []).map((add, i) => (
                                            <span key={`add-${i}`} className="text-[9px] font-black text-[#4B0082] bg-[#82C91E]/20 border border-[#82C91E]/50 px-3 py-1.5 rounded-lg uppercase">
                                                + {add.qtd}x {add.nome}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="bg-white border-2 border-slate-100 focus-within:border-[#4B0082]/30 rounded-[1.5rem] p-3 transition-colors">
                                        <textarea 
                                            rows={1}
                                            value={item.observacao || ''} 
                                            onChange={(e) => {
                                                atualizarCampo(idx, 'observacao', e.target.value);
                                                handleAutoResize(e);
                                            }}
                                            onFocus={handleAutoResize}
                                            placeholder="Alguma observação para este item?"
                                            className="w-full bg-transparent text-[11px] font-bold text-[#4B0082] outline-none resize-none overflow-hidden placeholder:text-slate-300"
                                        />
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => removerItem(idx)} className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5 hover:bg-red-50 px-4 py-2 rounded-xl transition-all">
                                            <Lucide.XCircle size={14} /> Remover Item
                                        </button>
                                    </div>

                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                  </motion.div>
                );
              })}
            </div>

            {/* CUPOM DE DESCONTO */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl mt-6 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[11px] font-[1000] text-[#4B0082] uppercase italic flex items-center gap-2">
                  <Lucide.Ticket size={18} className="text-[#82C91E]" /> Cupom Rodrigues
                </span>
              </div>

              {cupomAtivo ? (
                <div className="flex items-center justify-between bg-[#82C91E]/10 border-2 border-dashed border-[#82C91E] p-4 rounded-2xl">
                  <div>
                    <span className="text-[10px] font-black text-[#82C91E] uppercase block">Benefício Ativo!</span>
                    <span className="text-sm font-[1000] italic text-[#4B0082]">{cupomAtivo.codigo}</span>
                  </div>
                  <button onClick={removerCupom} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-md"><Lucide.X size={18} strokeWidth={3}/></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="CÓDIGO" value={cupomDigitado} onChange={e => setCupomDigitado(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-xs font-black uppercase text-[#4B0082] outline-none focus:border-[#82C91E] transition-all" 
                  />
                  <button 
                    onClick={() => {
                      const cupomFind = cuponsDisponiveis.find(c => c.codigo === cupomDigitado);
                      if (cupomFind) aplicarCupom(cupomFind); else alert("Cupom inválido.");
                    }}
                    className="bg-[#4B0082] text-[#82C91E] px-6 rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all"
                  >Ativar</button>
                </div>
              )}
            </div>

            {/* RESUMO FINANCEIRO */}
            <div className="bg-white p-8 rounded-[3rem] shadow-2xl mt-8 mb-10 border-2 border-dashed border-slate-100">
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6 text-center italic">Discriminação de Valores</h3>
              <div className="space-y-4 text-xs font-black text-slate-500 uppercase italic">
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#4B0082]">R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div className="flex justify-between">
                  <span>Logística</span>
                  <span className={tipoEntrega === 'retirada' || valorFrete === 0 ? 'text-[#82C91E]' : 'text-[#4B0082]'}>
                    {tipoEntrega === 'retirada' ? 'Grátis (Retirada)' : `R$ ${valorFrete.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
                {descontoAplicado > 0 && (
                  <div className="flex justify-between text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                    <span>Desconto Cupom</span><span className="font-black">- R$ {descontoAplicado.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-slate-100 mt-6 pt-6 flex justify-between items-end">
                <span className="font-black text-slate-300 uppercase text-[10px] italic">Total a Pagar</span>
                <span className="font-[1000] italic text-4xl text-[#4B0082] tracking-tighter leading-none">R$ {totalFinal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

          </AnimatePresence>
        )}
      </main>

      {/* BOTÃO FLUTUANTE DE CHECKOUT */}
      {(carrinho?.itens?.length || 0) > 0 && !loading && (
        <footer className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent z-40">
          <div className="max-w-[550px] mx-auto">
            <button 
              onClick={() => {
                  localStorage.setItem('checkout_dados', JSON.stringify({ tipoEntrega, totalFinal, subtotal, valorFrete, descontoAplicado, cupom: cupomAtivo }));
                  navigate('/checkout');
              }}
              disabled={tipoEntrega === 'delivery' && !endSeguro}
              className={`w-full h-20 rounded-[2.5rem] flex items-center justify-between px-8 transition-all active:scale-95 shadow-2xl relative overflow-hidden group
                ${tipoEntrega === 'delivery' && !endSeguro ? 'bg-slate-200 text-slate-400' : 'bg-[#82C91E] text-[#4B0082] shadow-[#82C91E]/30'}`}
            >
              <div className="absolute inset-0 bg-white/20 w-1/3 -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <div className="text-left relative z-10">
                <p className="text-[10px] font-black uppercase opacity-60 italic">Confirmar Carga</p>
                <p className="font-[1000] uppercase italic text-xl leading-none">Ir para Pagamento</p>
              </div>
              <div className="bg-[#4B0082] text-[#82C91E] w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative z-10">
                <Lucide.ChevronRight size={26} strokeWidth={4} />
              </div>
            </button>
            {tipoEntrega === 'delivery' && !endSeguro && (
               <p className="text-center text-[10px] font-black text-red-500 uppercase mt-3 animate-pulse italic">↑ Defina o local de entrega acima</p>
            )}
          </div>
        </footer>
      )}

      {/* MODAL DE ENDEREÇO */}
      <ModalEndereco isOpen={isModalEndOpen} onClose={() => { setIsModalEndOpen(false); carregarDados(); }} />

      <style>{`
        @keyframes shimmer { 100% { transform: translateX(350%); } }
        /* CSS PARA O MAPA RETRO */
        .retro-map-tiles .leaflet-tile-pane {
            filter: sepia(0.8) contrast(1.2) brightness(0.9) saturate(0.6) hue-rotate(-10deg);
        }
      `}</style>
    </div>
  );
}