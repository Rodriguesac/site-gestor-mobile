import React, { useState, useEffect } from 'react';
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
  html: `<div style="background: #82C91E; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(130,201,30,0.6);"></div>`
});

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { 
    if (coords?.lat && coords?.lng) {
      map.setView([coords.lat, coords.lng], 16); 
    }
  }, [coords, map]);
  return null;
}

export default function Carrinho() {
  const navigate = useNavigate();
  const { userData, enderecoAtivo } = useUser(); 
  
  // --- ESTADOS ---
  const [carrinho, setCarrinho] = useState({ itens: [], totalGeral: 0 });
  const [loading, setLoading] = useState(true);
  const [tipoEntrega, setTipoEntrega] = useState('delivery');
  const [isModalEndOpen, setIsModalEndOpen] = useState(false);
  const [cupomDigitado, setCupomDigitado] = useState('');
  const [cupomAtivo, setCupomAtivo] = useState(null);
  const [descontoAplicado, setDescontoAplicado] = useState(0);
  const [cuponsDisponiveis, setCuponsDisponiveis] = useState([]);
  const [itensExpandidos, setItensExpandidos] = useState({});

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(40); };

  // --- MOTOR DE CARREGAMENTO LIMPO E DIRETO ---
  const carregarDados = () => {
    try {
      const salvo = JSON.parse(localStorage.getItem('carrinho_rodrigues'));
      const cupomSalvo = JSON.parse(localStorage.getItem('cupom_rodrigues'));
      
      if (salvo && Array.isArray(salvo.itens)) {
        // Apenas carrega os itens sem disparar alertas
        const itensValidos = salvo.itens;
        
        // Atribui nome do cliente ao primeiro item se estiver vazio
        if (itensValidos.length > 0 && !itensValidos[0].nomeCopo && userData?.nome) {
            itensValidos[0].nomeCopo = userData.nome.split(' ')[0];
        }

        const novoTotal = itensValidos.reduce((acc, curr) => acc + (curr.total * (curr.quantidade || 1)), 0);
        setCarrinho({ itens: itensValidos, totalGeral: novoTotal });
      } else {
        setCarrinho({ itens: [], totalGeral: 0 });
      }

      if (cupomSalvo) {
        setCupomAtivo(cupomSalvo);
        setDescontoAplicado(cupomSalvo.valorDesconto || 0);
      }
    } catch (e) {
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

  // --- FUNÇÕES DE ATUALIZAÇÃO ---
  const atualizarCarrinho = (novosItens) => {
    const novoTotal = novosItens.reduce((acc, curr) => acc + (curr.total * (curr.quantidade || 1)), 0);
    const novoCarrinho = { itens: novosItens, totalGeral: novoTotal };
    setCarrinho(novoCarrinho);
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(novoCarrinho));
    recalcularDesconto(novoTotal, cupomAtivo);
  };

  const removerItem = (index) => {
    vibrar();
    const novos = carrinho.itens.filter((_, i) => i !== index);
    atualizarCarrinho(novos);
  };

  const alterarQuantidade = (index, delta) => {
    vibrar();
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
    vibrar();
    localStorage.setItem('edit_acai', JSON.stringify({ ...item, indexOriginal: index }));
    navigate('/'); 
  };

  const recalcularDesconto = (subtotal, cupom) => {
    if (!cupom) return;
    let valorDesc = cupom.tipo === 'fixo' ? cupom.valor : (subtotal * cupom.valor) / 100;
    if (valorDesc > subtotal) valorDesc = subtotal; 
    setDescontoAplicado(valorDesc);
    localStorage.setItem('cupom_rodrigues', JSON.stringify({...cupom, valorDesconto: valorDesc}));
  };

  const aplicarCupom = () => {
    vibrar();
    const cupomFind = cuponsDisponiveis.find(c => c.codigo === cupomDigitado.toUpperCase());
    if (cupomFind) {
      setCupomAtivo(cupomFind);
      recalcularDesconto(carrinho.totalGeral, cupomFind);
      setCupomDigitado('');
    } else {
      alert("Cupom não encontrado.");
    }
  };

  const removerCupom = () => {
    setCupomAtivo(null); setDescontoAplicado(0); localStorage.removeItem('cupom_rodrigues');
  };

  // --- CÁLCULOS FINAIS ---
  const valorFrete = tipoEntrega === 'retirada' ? 0 : (Number(enderecoAtivo?.taxa?.replace(',', '.')) || 0.00);
  const subtotal = carrinho?.totalGeral || 0;
  const totalFinal = Math.max(0, subtotal + valorFrete - descontoAplicado);

  const handleAutoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-48 relative selection:bg-[#82C91E]/30">
      
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl p-6 flex justify-between items-center rounded-b-[3.5rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] border-b border-slate-100 mx-1 mt-1">
        <button onClick={() => navigate(-1)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all">
          <Lucide.ChevronLeft size={28} strokeWidth={3} />
        </button>
        <div className="text-center">
          <h1 className="text-[#4B0082] font-[1000] italic uppercase text-lg leading-none tracking-tighter">Sua Sacola</h1>
          <p className="text-[10px] font-black text-[#82C91E] uppercase mt-1 tracking-widest">
            {carrinho?.itens?.length || 0} Itens no Pedido
          </p>
        </div>
        <button onClick={() => { if(window.confirm("Limpar sacola?")) { localStorage.removeItem('carrinho_rodrigues'); removerCupom(); carregarDados(); } }} className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-red-500 transition-all bg-white rounded-2xl shadow-sm">
          <Lucide.Trash2 size={20} />
        </button>
      </header>

      <main className="p-6 max-w-[550px] mx-auto space-y-6 relative z-10">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center py-20 gap-4">
               <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-12 h-12 border-[4px] border-[#82C91E] border-t-transparent rounded-full shadow-[0_0_15px_rgba(130,201,30,0.4)]" />
               <p className="text-[#4B0082] text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando...</p>
           </div>
        ) : (carrinho?.itens?.length || 0) === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-20 text-center flex flex-col items-center">
            <div className="w-40 h-40 bg-white rounded-[3.5rem] flex items-center justify-center mb-8 shadow-2xl border border-slate-50">
              <Lucide.ShoppingBag size={60} className="text-slate-100" strokeWidth={1.5} />
            </div>
            <h2 className="text-[#4B0082] font-[1000] uppercase italic text-2xl mb-2 tracking-tighter">Sacola Vazia</h2>
            <button onClick={() => navigate('/')} className="bg-[#82C91E] px-10 py-5 rounded-[2.5rem] text-[#4B0082] font-[1000] uppercase italic text-sm shadow-xl shadow-[#82C91E]/30 active:scale-95 transition-all hover:bg-[#8ee11c]">
              Ver Cardápio
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            
            {/* TIPO DE ENTREGA */}
            <div className="bg-white p-2 rounded-[3rem] flex shadow-xl border border-slate-50 mb-2">
              <button onClick={() => { vibrar(); setTipoEntrega('delivery'); }} className={`flex-1 py-4 rounded-[2.5rem] font-[1000] uppercase italic text-[11px] flex items-center justify-center gap-2 transition-all ${tipoEntrega === 'delivery' ? 'bg-[#4B0082] text-[#82C91E] shadow-md' : 'text-slate-400'}`}>
                <Lucide.Bike size={18} /> Delivery
              </button>
              <button onClick={() => { vibrar(); setTipoEntrega('retirada'); }} className={`flex-1 py-4 rounded-[2.5rem] font-[1000] uppercase italic text-[11px] flex items-center justify-center gap-2 transition-all ${tipoEntrega === 'retirada' ? 'bg-[#4B0082] text-[#82C91E] shadow-md' : 'text-slate-400'}`}>
                <Lucide.Store size={18} /> Retirada
              </button>
            </div>

            {/* ENDEREÇO (CARD MAPA) */}
            {tipoEntrega === 'delivery' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
                className="bg-white rounded-[3rem] p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden cursor-pointer group border-2 border-slate-50 transition-all active:scale-[0.98] hover:border-[#82C91E]/30"
                onClick={() => { vibrar(); setIsModalEndOpen(true); }}
              >
                <div className="flex justify-between items-center mb-4 relative z-10 px-2">
                  <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <Lucide.MapPin size={16} className="text-[#82C91E]" />
                    <div>
                        <h3 className="text-[#4B0082] font-[1000] uppercase text-xs tracking-widest leading-none mb-1">Entregar Em:</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase truncate max-w-[200px]">
                          {enderecoAtivo ? `${enderecoAtivo.rua}, ${enderecoAtivo.numero}` : 'Defina o local de entrega'}
                        </p>
                    </div>
                  </div>
                </div>
                
                {enderecoAtivo?.latlng?.lat && (
                  <div className="w-full h-32 bg-slate-100 rounded-[2.5rem] overflow-hidden border border-slate-200 relative pointer-events-none shadow-inner">
                     <MapContainer center={[enderecoAtivo.latlng.lat, enderecoAtivo.latlng.lng]} zoom={16} zoomControl={false} dragging={false} touchZoom={false} scrollWheelZoom={false} doubleClickZoom={false} style={{ width: '100%', height: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                        <Marker position={[enderecoAtivo.latlng.lat, enderecoAtivo.latlng.lng]} icon={iconVerde} />
                        <RecenterMap coords={enderecoAtivo.latlng} />
                     </MapContainer>
                     <div className="absolute inset-0 z-[400] bg-gradient-to-t from-white/20 to-transparent" />
                  </div>
                )}
              </motion.div>
            )}

            {/* LISTA DE ITENS */}
            <div className="space-y-5 mt-6">
              {carrinho?.itens?.map((item, idx) => {
                const isExpanded = itensExpandidos[idx];
                const tamanho = item.detalhes?.tamanho || item.tamanho;
                const base = item.detalhes?.baseNome || item.baseNome;
                const totalFormatado = (item.total * (item.quantidade || 1)).toFixed(2).replace('.', ',');

                return (
                  <motion.div key={`item-${idx}`} className="bg-white p-6 rounded-[3.5rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] border-2 border-slate-50 relative overflow-hidden transition-all hover:border-[#4B0082]/10">
                    
                    <button onClick={() => editarItem(item, idx)} className="absolute top-6 right-6 w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 hover:text-[#4B0082] transition-colors shadow-sm z-10 border border-slate-100">
                        <Lucide.Pencil size={16} strokeWidth={3} />
                    </button>

                    <div className="mb-5 pr-14 border-b-2 border-slate-50 pb-3">
                        <input 
                            value={item.nomeCopo || ''}
                            onChange={(e) => atualizarCampo(idx, 'nomeCopo', e.target.value)}
                            placeholder="De quem é este pedido?"
                            className="w-full text-[11px] font-[1000] text-[#4B0082] uppercase tracking-[0.1em] outline-none placeholder:text-slate-300 bg-transparent transition-colors focus:text-[#82C91E]"
                        />
                    </div>

                    <div className="flex gap-5">
                      <div className="w-24 h-24 rounded-[2rem] bg-slate-50 overflow-hidden shrink-0 border-2 border-slate-100 shadow-inner p-1 relative">
                        <img src={item.detalhes?.foto || item.foto} className="w-full h-full object-cover rounded-[1.5rem]" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                          <h3 className="text-[#82C91E] font-[1000] uppercase italic text-[11px] leading-tight mb-1">{tamanho}</h3>
                          <h2 className="text-[#4B0082] font-[1000] uppercase italic text-base leading-tight tracking-tighter truncate">{base}</h2>
                          
                          <div className="mt-4 flex justify-between items-center pr-2">
                            <span className="text-xl font-[1000] italic text-[#4B0082] tracking-tighter">R$ {totalFormatado}</span>
                            
                            {/* CONTROLE DE QUANTIDADE - ROXO NO BRANCO (CONTRASTE) */}
                            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-full border border-slate-200 shadow-inner">
                                <button onClick={() => alterarQuantidade(idx, -1)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#4B0082] shadow-sm active:scale-90 transition-all"><Lucide.Minus size={14} strokeWidth={4}/></button>
                                <span className="text-sm font-black w-4 text-center text-[#4B0082]">{item.quantidade || 1}</span>
                                <button onClick={() => alterarQuantidade(idx, 1)} className="w-8 h-8 bg-[#4B0082] rounded-full flex items-center justify-center text-[#82C91E] shadow-md active:scale-90 transition-all"><Lucide.Plus size={14} strokeWidth={4}/></button>
                            </div>
                          </div>
                      </div>
                    </div>

                    <button onClick={() => setItensExpandidos(prev => ({ ...prev, [idx]: !prev[idx] }))} className="w-full mt-5 pt-3 border-t-2 border-slate-50 flex items-center justify-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-[#4B0082] transition-colors">
                        {isExpanded ? 'Ocultar Detalhes' : 'Ver Composição'} 
                        {isExpanded ? <Lucide.ChevronUp size={16} /> : <Lucide.ChevronDown size={16} />}
                    </button>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="pt-5 space-y-5">
                                    <div className="flex flex-wrap gap-2">
                                        {item.detalhes?.cobertura_detalhes && (
                                            <span className="text-[10px] font-black text-white bg-pink-500 px-3 py-2 rounded-xl uppercase shadow-sm italic border-b-2 border-pink-700">Calda: {item.detalhes.cobertura_detalhes}</span>
                                        )}
                                        {(item.detalhes?.acompanhamentos_detalhes || []).map((acc, i) => (
                                            <span key={i} className="text-[10px] font-bold text-slate-500 bg-white border-2 border-slate-100 px-3 py-2 rounded-xl uppercase shadow-sm">{acc}</span>
                                        ))}
                                        {(item.detalhes?.adicionais_detalhes || []).map((add, i) => (
                                            <span key={i} className="text-[10px] font-black text-[#4B0082] bg-[#82C91E]/20 border-2 border-[#82C91E]/30 px-3 py-2 rounded-xl uppercase italic">+ {add.qtd}x {add.nome}</span>
                                        ))}
                                    </div>
                                    <div className="bg-slate-50 border-2 border-slate-100 focus-within:border-[#82C91E] rounded-[2.2rem] p-4 transition-all shadow-inner">
                                        <textarea rows={1} value={item.observacao || ''} onChange={(e) => { atualizarCampo(idx, 'observacao', e.target.value); handleAutoResize(e); }} onFocus={handleAutoResize} placeholder="Alguma nota especial?" className="w-full bg-transparent text-[11px] font-bold text-[#4B0082] uppercase outline-none resize-none overflow-hidden placeholder:text-slate-400" />
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button onClick={() => { if(window.confirm("Remover?")) removerItem(idx); }} className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] flex items-center gap-1 hover:text-red-600 transition-all"><Lucide.Trash2 size={12} /> Excluir Item</button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* CUPOM */}
            <div className="bg-white p-6 rounded-[3rem] shadow-xl mt-8 border-2 border-slate-50">
              <div className="flex justify-between items-center mb-5 px-1">
                <span className="text-[11px] font-[1000] text-[#4B0082] uppercase italic tracking-widest flex items-center gap-2">
                  <div className="p-2 bg-[#82C91E]/20 rounded-xl text-[#82C91E]"><Lucide.Ticket size={16} /></div> Cupom Rodrigues
                </span>
              </div>
              {cupomAtivo ? (
                <div className="flex items-center justify-between bg-[#82C91E]/10 border-2 border-dashed border-[#82C91E] p-5 rounded-[2rem]">
                  <div><span className="text-[10px] font-black text-[#82C91E] uppercase block mb-1">Ativo</span><span className="text-xl font-[1000] italic text-[#4B0082]">{cupomAtivo.codigo}</span></div>
                  <button onClick={removerCupom} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-500 shadow-md active:scale-90 transition-all"><Lucide.X size={20} strokeWidth={4}/></button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <input type="text" placeholder="INSIRA O CÓDIGO" value={cupomDigitado} onChange={e => setCupomDigitado(e.target.value.toUpperCase())} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-6 text-xs font-black uppercase text-[#4B0082] outline-none focus:border-[#82C91E] shadow-inner" />
                  <button onClick={() => { const f = cuponsDisponiveis.find(c => c.codigo === cupomDigitado); if(f) aplicarCupom(f); else alert("Inválido."); }} className="bg-[#4B0082] text-[#82C91E] px-8 rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Ativar</button>
                </div>
              )}
            </div>

            {/* RESUMO FINANCEIRO */}
            <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl mt-10 mb-12 border-[6px] border-slate-50 relative overflow-hidden group">
              <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-[#4B0082]/5 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-1000" />
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 text-center italic">Discriminação do Pedido</h3>
              <div className="space-y-6 text-xs font-black text-slate-500 uppercase tracking-widest relative z-10">
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#4B0082]">R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div className="flex justify-between items-center"><span>Logística</span><span className={tipoEntrega === 'retirada' || valorFrete === 0 ? 'text-[#82C91E] bg-[#82C91E]/10 px-4 py-1.5 rounded-xl border border-[#82C91E]/20' : 'text-[#4B0082]'}>{tipoEntrega === 'retirada' ? 'Grátis' : `R$ ${valorFrete.toFixed(2).replace('.', ',')}`}</span></div>
                {descontoAplicado > 0 && <div className="flex justify-between text-red-500 bg-red-50 p-4 rounded-2xl border-2 border-red-100 items-center animate-in slide-in-from-top-1"><span>Benefício Cupom</span><span className="font-[1000] italic text-sm">- R$ {descontoAplicado.toFixed(2).replace('.', ',')}</span></div>}
              </div>
              <div className="border-t-[3px] border-dashed border-slate-100 mt-10 pt-8 flex justify-between items-end relative z-10">
                <span className="font-black text-slate-300 uppercase text-[11px] tracking-[0.2em] italic mb-1">Total</span>
                <span className="font-[1000] italic text-5xl text-[#4B0082] tracking-tighter leading-none drop-shadow-sm">R$ {totalFinal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

          </AnimatePresence>
        )}
      </main>

      {/* BOTÃO FLUTUANTE DE CHECKOUT PREMIUM */}
      {(carrinho?.itens?.length || 0) > 0 && !loading && (
        <footer className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent z-50">
          <div className="max-w-[550px] mx-auto">
            <button 
              onClick={() => {
                  vibrar();
                  localStorage.setItem('checkout_dados', JSON.stringify({ tipoEntrega, totalFinal, subtotal, valorFrete, descontoAplicado, cupom: cupomAtivo }));
                  navigate('/checkout');
              }}
              disabled={tipoEntrega === 'delivery' && !enderecoAtivo}
              className={`w-full h-24 rounded-[3.5rem] flex items-center justify-between px-10 transition-all active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group
                ${tipoEntrega === 'delivery' && !enderecoAtivo ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-b-[8px] border-slate-300' : 'bg-[#82C91E] text-[#4B0082] border-b-[10px] border-[#6ea81a] hover:bg-[#8ee11c]'}`}
            >
              <div className="absolute inset-0 bg-white/20 w-1/3 -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <div className="text-left relative z-10">
                <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Tudo Pronto?</p>
                <p className="font-[1000] uppercase italic text-2xl leading-none tracking-tighter drop-shadow-sm">Finalizar Pedido</p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg relative z-10 transition-transform group-hover:translate-x-2 ${tipoEntrega === 'delivery' && !enderecoAtivo ? 'bg-slate-300 text-slate-500' : 'bg-[#4B0082] text-[#82C91E]'}`}>
                <Lucide.ArrowRight size={30} strokeWidth={4} />
              </div>
            </button>
            {tipoEntrega === 'delivery' && !enderecoAtivo && (
               <p className="text-center text-[10px] font-black text-red-500 uppercase mt-4 animate-pulse tracking-widest bg-red-50 py-2 rounded-xl border border-red-100">Toque no mapa acima para definir a entrega</p>
            )}
          </div>
        </footer>
      )}

      <ModalEndereco isOpen={isModalEndOpen} onClose={() => { setIsModalEndOpen(false); carregarDados(); }} />
      <style>{`@keyframes shimmer { 100% { transform: translateX(350%); } } ::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}