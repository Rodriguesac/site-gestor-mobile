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

// --- CONFIGURAÇÃO DO MARCADOR DO MAPA ---
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
  
  // --- ESTADOS GERAIS (Garantindo arrays vazios por padrão) ---
  const [carrinho, setCarrinho] = useState({ itens: [], totalGeral: 0 });
  const [loading, setLoading] = useState(true);
  const [tipoEntrega, setTipoEntrega] = useState('delivery');
  
  // --- ESTADOS DE LOGÍSTICA ---
  const [endereco, setEndereco] = useState(null);
  const [isModalEndOpen, setIsModalEndOpen] = useState(false);
  
  // --- ESTADOS DE CUPOM ---
  const [cupomDigitado, setCupomDigitado] = useState('');
  const [cupomAtivo, setCupomAtivo] = useState(null);
  const [descontoAplicado, setDescontoAplicado] = useState(0);
  const [cuponsDisponiveis, setCuponsDisponiveis] = useState([]);
  const [isModalCuponsOpen, setIsModalCuponsOpen] = useState(false);

  // --- ESTADOS DE UX (UI) ---
  const [itensExpandidos, setItensExpandidos] = useState({});

  // --- MOTOR DE CARREGAMENTO DE DADOS ---
  const carregarDados = () => {
    try {
      const salvo = JSON.parse(localStorage.getItem('carrinho_rodrigues'));
      const endSalvo = JSON.parse(localStorage.getItem('endereco_rodrigues'));
      const cupomSalvo = JSON.parse(localStorage.getItem('cupom_rodrigues'));
      
      if (salvo && Array.isArray(salvo.itens)) {
        setCarrinho(salvo);
      } else {
        setCarrinho({ itens: [], totalGeral: 0 });
      }

      if (endSalvo) setEndereco(endSalvo);
      
      if (cupomSalvo) {
        setCupomAtivo(cupomSalvo);
        setDescontoAplicado(cupomSalvo.valorDesconto || 0);
      }
    } catch (e) {
      console.error("Erro no LocalStorage", e);
      setCarrinho({ itens: [], totalGeral: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    window.addEventListener('cartUpdated', carregarDados);
    window.addEventListener('enderecoAtualizado', carregarDados);
    
    const q = query(collection(db, "cupons"), where("ativo", "==", true));
    const unsubCupons = onSnapshot(q, (snap) => {
      setCuponsDisponiveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      window.removeEventListener('cartUpdated', carregarDados);
      window.removeEventListener('enderecoAtualizado', carregarDados);
      unsubCupons();
    };
  }, []);

  // --- FUNÇÕES DE MANIPULAÇÃO DO CARRINHO ---
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

  const atualizarObservacaoItem = (index, texto) => {
    const novos = [...carrinho.itens];
    novos[index].observacao = texto;
    atualizarCarrinho(novos);
  };

  const editarItem = (item, index) => {
    const itemParaEditar = { ...item, indexOriginal: index };
    localStorage.setItem('edit_acai', JSON.stringify(itemParaEditar));
    navigate('/'); 
  };

  // --- LÓGICA DE CUPONS ---
  const recalcularDesconto = (subtotal, cupom) => {
    if (!cupom) return;
    let valorDesc = 0;
    if (cupom.tipo === 'fixo') valorDesc = cupom.valor;
    if (cupom.tipo === 'percentual') valorDesc = (subtotal * cupom.valor) / 100;
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
    setCupomAtivo(null);
    setDescontoAplicado(0);
    localStorage.removeItem('cupom_rodrigues');
  };

  // --- CÁLCULOS FINAIS ---
  const valorFrete = tipoEntrega === 'retirada' ? 0 : (Number(endereco?.taxa?.replace(',', '.')) || 0.00);
  const subtotal = carrinho?.totalGeral || 0;
  const totalFinal = Math.max(0, subtotal + valorFrete - descontoAplicado);

  const toggleExpandir = (idx) => {
    setItensExpandidos(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-48">
      
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-40 bg-white p-6 flex justify-between items-center rounded-b-[3rem] shadow-xl border-b border-slate-100 mx-1 mt-1">
        <button onClick={() => navigate(-1)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all">
          <Lucide.ChevronLeft size={28} strokeWidth={3} />
        </button>
        <div className="text-center">
          <h1 className="text-[#4B0082] font-[1000] italic uppercase text-lg leading-none">Minha Sacola</h1>
          <p className="text-[10px] font-black text-[#82C91E] uppercase mt-1">
            {(carrinho?.itens?.length || 0)} { (carrinho?.itens?.length || 0) === 1 ? 'item' : 'itens' } na carga
          </p>
        </div>
        <button onClick={() => { if(window.confirm("Esvaziar sacola?")) { localStorage.removeItem('carrinho_rodrigues'); removerCupom(); carregarDados(); } }} className="text-slate-300 p-3 hover:text-red-500 transition-colors">
          <Lucide.Trash2 size={20} />
        </button>
      </header>

      <main className="p-6 max-w-[550px] mx-auto space-y-6">
        
        {loading ? (
          <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="bg-white p-5 rounded-[2.5rem] flex gap-4 animate-pulse border border-slate-100">
                  <div className="w-20 h-20 bg-slate-100 rounded-[1.5rem]"></div>
                  <div className="flex-1 space-y-3 py-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
          </div>
        ) : (carrinho?.itens?.length || 0) === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-20 text-center flex flex-col items-center">
            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl border border-slate-50">
              <Lucide.ShoppingBag size={60} className="text-slate-200" strokeWidth={1.5} />
            </div>
            <h2 className="text-[#4B0082] font-[1000] uppercase italic text-2xl mb-2">Sacola Vazia</h2>
            <p className="text-slate-400 text-xs font-bold mb-8 uppercase tracking-widest text-center">O seu açaí está à sua espera!</p>
            <button onClick={() => navigate('/')} className="bg-[#82C91E] px-10 py-5 rounded-[2rem] text-[#4B0082] font-[1000] uppercase italic text-lg shadow-xl shadow-[#82C91E]/20 active:scale-95 transition-all">
              Montar Meu Mix
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            
            {/* LOGÍSTICA DE ENTREGA */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-2 rounded-[2.5rem] flex shadow-lg border border-slate-50 mb-2">
              <button onClick={() => setTipoEntrega('delivery')} className={`flex-1 py-4 rounded-[2.2rem] font-[1000] uppercase italic text-xs flex items-center justify-center gap-2 transition-all ${tipoEntrega === 'delivery' ? 'bg-[#4B0082] text-[#82C91E] shadow-xl' : 'text-slate-400'}`}>
                <Lucide.Bike size={18} /> Delivery
              </button>
              <button onClick={() => setTipoEntrega('retirada')} className={`flex-1 py-4 rounded-[2.2rem] font-[1000] uppercase italic text-xs flex items-center justify-center gap-2 transition-all ${tipoEntrega === 'retirada' ? 'bg-[#4B0082] text-[#82C91E] shadow-xl' : 'text-slate-400'}`}>
                <Lucide.Store size={18} /> Retirada
              </button>
            </motion.div>

            {tipoEntrega === 'delivery' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="bg-white rounded-[2.5rem] p-5 shadow-xl relative overflow-hidden cursor-pointer group border border-slate-50 transition-all active:scale-[0.98]"
                onClick={() => setIsModalEndOpen(true)}
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-[#4B0082] font-[1000] italic uppercase text-sm">Entregar em:</h3>
                    <p className="text-[10px] font-black text-[#82C91E] uppercase mt-1">
                      {endereco ? `${endereco.rua}, ${endereco.numero}` : 'Toque para definir o local'}
                    </p>
                  </div>
                  <div className="bg-[#4B0082]/5 p-2 rounded-xl">
                    <Lucide.Edit3 size={18} className="text-[#4B0082]" />
                  </div>
                </div>
                
                {endereco?.latlng?.lat && (
                  <div className="w-full h-28 bg-slate-50 rounded-[1.8rem] overflow-hidden pointer-events-none border border-slate-100">
                     <MapContainer center={[endereco.latlng.lat, endereco.latlng.lng]} zoom={15} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
                        <Marker position={[endereco.latlng.lat, endereco.latlng.lng]} icon={iconVerde} />
                        <RecenterMap coords={endereco.latlng} />
                     </MapContainer>
                  </div>
                )}
              </motion.div>
            )}

            {/* LISTA DE ITENS - CORREÇÃO DE KEYS E RENDERS */}
            <div className="space-y-4 mt-6">
              <h3 className="text-[11px] font-[1000] text-slate-300 uppercase tracking-[0.2em] pl-2">Carga do Pedido</h3>
              
              {carrinho?.itens?.map((item, idx) => {
                const listaGratis = item.detalhes?.acompanhamentos_detalhes || [];
                const listaAdd = item.detalhes?.adicionais_detalhes || [];
                const qtdTotalItens = listaGratis.length + listaAdd.length;
                const isExpanded = itensExpandidos[idx];

                return (
                  <motion.div 
                    key={`cart-item-${idx}-${item.idLocal || 'new'}`} 
                    className="bg-white p-5 rounded-[2.5rem] shadow-xl border border-slate-50"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-[1.8rem] bg-slate-50 overflow-hidden shrink-0 border border-slate-100 shadow-inner">
                        <img src={item.detalhes?.foto || item.foto || "https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png"} className="w-full h-full object-cover" alt="" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[#4B0082] font-[1000] italic uppercase text-sm leading-none truncate pr-2">
                              {item.detalhes?.baseNome || item.baseNome}
                            </h3>
                            <p className="text-[10px] font-black text-[#82C91E] uppercase italic mt-1">{item.detalhes?.tamanho || item.tamanho}</p>
                          </div>
                          
                          <button onClick={() => editarItem(item, idx)} className="text-slate-300 hover:text-[#4B0082] p-2 bg-slate-50 rounded-xl transition-all">
                            <Lucide.Pencil size={14} strokeWidth={3} />
                          </button>
                        </div>
                        
                        <div className="mt-3 flex justify-between items-center">
                          <span className="text-lg font-[1000] italic text-[#4B0082] tracking-tighter">
                            R$ {(item.total * (item.quantidade || 1)).toFixed(2).replace('.', ',')}
                          </span>
                          
                          <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                            <button onClick={() => alterarQuantidade(idx, -1)} className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#4B0082] shadow-sm"><Lucide.Minus size={12} strokeWidth={4}/></button>
                            <span className="text-xs font-black w-4 text-center">{item.quantidade || 1}</span>
                            <button onClick={() => alterarQuantidade(idx, 1)} className="w-8 h-8 bg-[#4B0082] text-[#82C91E] rounded-xl flex items-center justify-center shadow-sm"><Lucide.Plus size={12} strokeWidth={4}/></button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* EXPANSÃO DE ACOMPANHAMENTOS - CORREÇÃO DE OBJETOS */}
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-100">
                      <div className="flex flex-wrap gap-1.5">
                        {item.detalhes?.cobertura_detalhes && (
                          <span className="text-[9px] font-black text-white bg-[#4B0082] px-3 py-1 rounded-lg uppercase italic">
                            Calda: {item.detalhes.cobertura_detalhes}
                          </span>
                        )}
                        
                        {listaGratis.slice(0, isExpanded ? listaGratis.length : 2).map((acc, i) => (
                          <span key={`acc-${i}`} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg uppercase truncate">
                            {typeof acc === 'object' ? acc.nome : acc}
                          </span>
                        ))}
                        
                        {listaAdd.slice(0, isExpanded ? listaAdd.length : 1).map((add, i) => (
                          <span key={`add-${i}`} className="text-[9px] font-black text-[#4B0082] bg-[#82C91E]/20 border border-[#82C91E]/30 px-2 py-1 rounded-lg uppercase">
                            + {typeof add === 'object' ? add.nome : add}
                          </span>
                        ))}
                      </div>
                      
                      {qtdTotalItens > 3 && (
                        <button onClick={() => toggleExpandir(idx)} className="mt-3 text-[10px] font-black text-[#82C91E] uppercase flex items-center gap-1 italic">
                          {isExpanded ? 'Ver Menos' : `+ Ver mais ${qtdTotalItens - 3}`} <Lucide.ChevronDown size={14} className={isExpanded ? 'rotate-180 transition-all' : 'transition-all'} />
                        </button>
                      )}
                    </div>

                    {/* NOTA PARA COZINHA */}
                    <div className="mt-4 bg-slate-50/50 p-3 rounded-[1.5rem] border border-slate-100">
                      <textarea 
                        value={item.observacao || ''} 
                        onChange={(e) => atualizarObservacaoItem(idx, e.target.value)}
                        placeholder="Alguma observação para este item?"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[11px] font-bold text-[#4B0082] outline-none focus:border-[#82C91E] resize-none h-16 transition-all"
                      />
                    </div>
                    
                    <div className="mt-3 flex justify-end">
                       <button onClick={() => removerItem(idx)} className="text-[10px] font-black text-red-400 uppercase tracking-tighter flex items-center gap-1 hover:bg-red-50 px-4 py-2 rounded-xl transition-all">
                         <Lucide.XCircle size={14} /> Remover
                       </button>
                    </div>
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
                <button onClick={() => setIsModalCuponsOpen(true)} className="text-[10px] font-black text-slate-400 underline uppercase tracking-tighter">Meus Cupons</button>
              </div>

              {cupomAtivo ? (
                <div className="flex items-center justify-between bg-[#82C91E]/10 border-2 border-dashed border-[#82C91E] p-4 rounded-2xl animate-in zoom-in-95">
                  <div>
                    <span className="text-[10px] font-black text-[#82C91E] uppercase block">Benefício Ativo!</span>
                    <span className="text-sm font-[1000] italic text-[#4B0082]">{cupomAtivo.codigo}</span>
                  </div>
                  <button onClick={removerCupom} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-md"><Lucide.X size={18} strokeWidth={3}/></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="CÓDIGO" 
                    value={cupomDigitado}
                    onChange={e => setCupomDigitado(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-xs font-black uppercase text-[#4B0082] outline-none focus:border-[#82C91E] transition-all" 
                  />
                  <button 
                    onClick={() => {
                      const cupomFind = cuponsDisponiveis.find(c => c.codigo === cupomDigitado);
                      if (cupomFind) aplicarCupom(cupomFind);
                      else alert("Cupom inválido.");
                    }}
                    className="bg-[#4B0082] text-[#82C91E] px-6 rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Ativar
                  </button>
                </div>
              )}
            </div>

            {/* RESUMO FINANCEIRO (ESTILO RECIBO) */}
            <div className="bg-white p-8 rounded-[3rem] shadow-2xl mt-8 mb-10 border-2 border-dashed border-slate-100">
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6 text-center italic">Discriminação de Valores</h3>
              <div className="space-y-4 text-xs font-black text-slate-500 uppercase italic">
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#4B0082]">R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div className="flex justify-between">
                  <span>Logística</span>
                  <span className={tipoEntrega === 'retirada' ? 'text-[#82C91E]' : 'text-[#4B0082]'}>
                    {tipoEntrega === 'retirada' ? 'Grátis (Retirada)' : `R$ ${valorFrete.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
                {descontoAplicado > 0 && (
                  <div className="flex justify-between text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                    <span>Desconto</span><span className="font-black">- R$ {descontoAplicado.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-slate-100 mt-6 pt-6 flex justify-between items-end">
                <span className="font-black text-slate-300 uppercase text-[10px] italic">Total Final</span>
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
              disabled={tipoEntrega === 'delivery' && !endereco}
              className={`w-full h-20 rounded-[2.5rem] flex items-center justify-between px-8 transition-all active:scale-95 shadow-2xl relative overflow-hidden group
                ${tipoEntrega === 'delivery' && !endereco 
                  ? 'bg-slate-200 text-slate-400' 
                  : 'bg-[#82C91E] text-[#4B0082] shadow-[#82C91E]/30'}`}
            >
              <div className="absolute inset-0 bg-white/20 w-1/3 -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              
              <div className="text-left relative z-10">
                <p className="text-[10px] font-black uppercase opacity-60 italic">Confirmar e pagar</p>
                <p className="font-[1000] uppercase italic text-xl leading-none">Checkout</p>
              </div>
              <div className="bg-[#4B0082] text-[#82C91E] w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative z-10">
                <Lucide.ChevronRight size={26} strokeWidth={4} />
              </div>
            </button>
            {tipoEntrega === 'delivery' && !endereco && (
               <p className="text-center text-[10px] font-black text-red-500 uppercase mt-3 animate-pulse italic">↑ Defina o local de entrega acima</p>
            )}
          </div>
        </footer>
      )}

      {/* MODAL DE ENDEREÇO */}
      <ModalEndereco 
        isOpen={isModalEndOpen} 
        onClose={() => { setIsModalEndOpen(false); carregarDados(); }} 
        enderecoParaEditar={endereco} 
      />

      {/* MODAL DE CUPONS */}
      <AnimatePresence>
        {isModalCuponsOpen && (
          <div className="fixed inset-0 z-[100] bg-[#4B0082]/40 backdrop-blur-md flex items-end justify-center p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-[500px] rounded-[3rem] p-8 shadow-2xl max-h-[70vh] overflow-y-auto pb-12 relative">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-[1000] italic uppercase text-[#4B0082]">Meus <span className="text-[#82C91E]">Cupons</span></h3>
                <button onClick={() => setIsModalCuponsOpen(false)} className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:text-red-500 transition-all"><Lucide.X size={24} strokeWidth={3}/></button>
              </div>
              <div className="space-y-4">
                {cuponsDisponiveis.map(c => (
                  <div key={c.id} className="bg-slate-50 p-6 rounded-[2rem] flex justify-between items-center border border-slate-100">
                    <div>
                      <span className="bg-[#4B0082] text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase italic tracking-widest">{c.tipo === 'fixo' ? `R$ ${c.valor} OFF` : `${c.valor}% OFF`}</span>
                      <h4 className="text-lg font-[1000] italic uppercase text-slate-800 mt-2">{c.codigo}</h4>
                    </div>
                    <button onClick={() => aplicarCupom(c)} className="bg-[#82C91E] text-[#4B0082] px-6 py-3 rounded-2xl font-[1000] uppercase italic text-xs shadow-lg active:scale-90 transition-all">Usar</button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer { 100% { transform: translateX(350%); } }
      `}</style>
    </div>
  );
}