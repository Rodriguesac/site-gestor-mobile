import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../services/firebase";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import * as Lucide from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- ÍCONES DO MAPA ---
const storeIcon = L.divIcon({ className: 'store-icon', html: `<div class="p-1.5 bg-[#82C91E] rounded-full border-2 border-white shadow-lg flex items-center justify-center"><span style="font-size: 16px;">🏪</span></div>`, iconSize: [32, 32] });
const courierIcon = L.divIcon({ className: 'courier-icon', html: `<div class="p-1.5 bg-[#4B0082] rounded-full border-2 border-white shadow-lg animate-bounce flex items-center justify-center"><span style="font-size: 18px;">🛵</span></div>`, iconSize: [36, 36] });

const IMGBB_API_KEY = 'e3e4b384bff32476d8b8c517a0e31582';

// --- FUNÇÕES DE TEMPO ---
const formatarHora = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getPrevisao = (createdAt) => {
    if (!createdAt) return 'Calculando...';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const inicio = new Date(date.getTime() + 40 * 60000);
    const fim = new Date(date.getTime() + 60 * 60000);
    return `${inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ${fim.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
};

export default function AcompanhamentoCompleto() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [pedido, setPedido] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [itensExpandidos, setItensExpandidos] = useState({});
  const [chatAberto, setChatAberto] = useState(false);
  const [novaMsg, setNovaMsg] = useState("");
  const chatEndRef = useRef(null);

  const statusSteps = [
    { id: 'PENDENTE', label: 'Aceito', logField: 'createdAt', icon: <Lucide.CheckCircle2 /> },
    { id: 'EM_PREPARO', label: 'Cozinha', logField: 'horarioPreparo', icon: <Lucide.Flame /> },
    { id: 'SAIU_ENTREGA', label: 'Em Rota', logField: 'horarioEntrega', icon: <Lucide.Bike /> },
    { id: 'CONCLUIDO', label: 'Entregue', logField: 'horarioConcluido', icon: <Lucide.Home /> }
  ];

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "pedidos", id), (snap) => {
      if (snap.exists()) setPedido({ id: snap.id, ...snap.data() });
    });
    const qChat = query(collection(db, "pedidos", id, "chat"), orderBy("timestamp", "asc"));
    const unsubChat = onSnapshot(qChat, (snap) => setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsub(); unsubChat(); };
  }, [id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, chatAberto]);

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!novaMsg.trim()) return;
    await addDoc(collection(db, "pedidos", id, "chat"), { texto: novaMsg, remetente: "cliente", timestamp: serverTimestamp() });
    setNovaMsg("");
  };

  const notificarAcao = async (tipo) => {
    const msg = tipo === 'calcada' ? "🏃‍♂️ Atenção: O cliente já está na calçada aguardando a entrega!" : "🚨 Solicitação: O cliente deseja alterar o pedido.";
    await addDoc(collection(db, "pedidos", id, "chat"), { texto: msg, remetente: "cliente", timestamp: serverTimestamp() });
    if (tipo === 'alterar') setChatAberto(true);
    else alert("O entregador foi notificado!");
  };

  if (!pedido) return <div className="h-screen bg-slate-50 flex items-center justify-center"><Lucide.Loader2 size={40} className="animate-spin text-[#4B0082]" /></div>;

  const currentStepIndex = statusSteps.findIndex(s => s.id === pedido.status) !== -1 ? statusSteps.findIndex(s => s.id === pedido.status) : 0;
  const isSaiuEntrega = pedido.status === 'SAIU_ENTREGA';
  const isPagamentoNaEntrega = pedido.pagamento?.metodo?.toLowerCase().includes('entrega');

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32 relative overflow-x-hidden selection:bg-[#82C91E]/30">
      
      {/* MARCA D'ÁGUA PREMIUM */}
      <div className="fixed inset-0 z-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
          <h1 className="text-[20vw] font-[1000] uppercase italic text-[#4B0082] rotate-[-25deg] whitespace-nowrap">Rodrigues Açaí</h1>
      </div>

      <div className="relative z-10">
        
        {/* HEADER: PROGRESSO, PREVISÃO E PIN */}
        <header className="bg-white rounded-b-[3.5rem] shadow-2xl border-b border-slate-100 sticky top-0 z-40">
            <div className="px-6 pt-10 pb-6 flex justify-between items-start">
                <button onClick={() => navigate(-1)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all border border-slate-100">
                    <Lucide.ArrowLeft size={24} strokeWidth={3} />
                </button>
                
                <div className="text-center bg-slate-50 px-6 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">PIN de Segurança</p>
                    <p className="text-xl font-[1000] text-[#4B0082] tracking-[0.3em] leading-none">{pedido.id.slice(-4).toUpperCase()}</p>
                </div>

                <a href={`https://wa.me/5567999999999`} target="_blank" rel="noreferrer" className="w-12 h-12 bg-[#25D366]/10 rounded-2xl flex items-center justify-center text-[#25D366] shadow-sm">
                    <Lucide.Phone size={20} strokeWidth={2.5} />
                </a>
            </div>

            {/* PREVISÃO DE ENTREGA */}
            <div className="text-center pb-4">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Chega entre</p>
                <p className="text-sm font-[1000] uppercase italic text-[#82C91E]">{getPrevisao(pedido.createdAt)}</p>
            </div>

            {/* STEPPER COM TIMESTAMPS */}
            <div className="px-8 pb-8">
                <div className="flex justify-between relative px-2">
                    <div className="absolute top-5 left-0 w-full h-1.5 bg-slate-100 z-0 rounded-full" />
                    <motion.div className="absolute top-5 left-0 h-1.5 bg-gradient-to-r from-[#82C91E] to-[#4B0082] z-0 rounded-full" initial={{ width: 0 }} animate={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }} transition={{ duration: 1 }} />
                    
                    {statusSteps.map((step, idx) => (
                        <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
                            <motion.div animate={idx === currentStepIndex ? { scale: [1, 1.1, 1] } : { scale: 1 }} transition={{ repeat: idx === currentStepIndex ? Infinity : 0, duration: 2 }} className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${idx <= currentStepIndex ? 'bg-[#82C91E] border-white text-[#4B0082] shadow-xl' : 'bg-white border-slate-100 text-slate-300'}`}>
                                {React.cloneElement(step.icon, { size: 18, strokeWidth: idx <= currentStepIndex ? 3 : 2 })}
                            </motion.div>
                            <span className={`text-[9px] font-black uppercase italic leading-tight ${idx <= currentStepIndex ? 'text-[#4B0082]' : 'text-slate-300'}`}>{step.label}</span>
                            <span className="text-[8px] font-bold text-slate-400">{formatarHora(pedido[step.logField])}</span>
                        </div>
                    ))}
                </div>
            </div>
        </header>

        <main className="p-6 space-y-6 max-w-[550px] mx-auto">
            
            {/* ========================================================================= */}
            {/* MÓDULO DE MAPA PARA FUTURO RASTREIO GPS (Isolado e pronto para uso)       */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {isSaiuEntrega ? (
                    <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-white p-2 rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden relative">
                        <div className="h-64 w-full rounded-[2.5rem] overflow-hidden relative bg-slate-100">
                            {/* TODO: Substituir posições fixas pela coordenada real do motoboy futuramente */}
                            <MapContainer center={[pedido.endereco?.latlng?.lat || -20.43, pedido.endereco?.latlng?.lng || -54.55]} zoom={15} zoomControl={false} dragging={false} touchZoom={false} scrollWheelZoom={false} className="h-full w-full grayscale-[20%]">
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                <Marker position={[-20.43131, -54.55412]} icon={storeIcon} />
                                <Marker position={[pedido.endereco?.latlng?.lat || -20.43, pedido.endereco?.latlng?.lng || -54.55]} icon={courierIcon} />
                                <Polyline positions={[[-20.43131, -54.55412], [pedido.endereco?.latlng?.lat || -20.43, pedido.endereco?.latlng?.lng || -54.55]]} color="#4B0082" weight={4} opacity={0.7} dashArray="10, 10" />
                            </MapContainer>
                            <div className="absolute top-4 left-4 right-4 z-[400] bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-lg flex items-center gap-3 border border-slate-100">
                                <div className="bg-[#4B0082] p-2.5 rounded-xl text-[#82C91E] animate-pulse"><Lucide.Navigation size={18} /></div>
                                <div><p className="text-[9px] font-black uppercase text-slate-400">O entregador está a caminho</p><p className="text-xs font-[1000] italic text-[#4B0082]">Acompanhe a Rota</p></div>
                            </div>
                        </div>
                        <button onClick={() => notificarAcao('calcada')} className="w-full mt-2 bg-slate-50 hover:bg-[#82C91E]/10 text-[#4B0082] py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                            <Lucide.PersonStanding size={18} /> Estou na Calçada à espera
                        </button>
                    </motion.section>
                ) : (
                    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded-[2.5rem] shadow-lg border border-slate-50 text-center flex flex-col items-center justify-center min-h-[150px]">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                            {pedido.status === 'PENDENTE' ? <Lucide.Clock size={28} className="text-amber-500 animate-pulse" /> : <Lucide.Flame size={28} className="text-orange-500 animate-bounce" />}
                        </div>
                        <h3 className="text-sm font-[1000] uppercase italic text-[#4B0082]">{pedido.status === 'PENDENTE' ? 'Aguardando Início' : 'Sendo Preparado com Carinho'}</h3>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mt-1">O radar será ativado quando o motoboy sair.</p>
                        {pedido.status === 'PENDENTE' && (
                            <button onClick={() => notificarAcao('alterar')} className="mt-4 text-[10px] font-black uppercase text-[#4B0082] bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-100">
                                <Lucide.Edit3 size={14} /> Solicitar alteração
                            </button>
                        )}
                    </motion.section>
                )}
            </AnimatePresence>
            {/* ========================================================================= */}

            {/* RESUMO DO PEDIDO */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
                <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-3">
                    <h3 className="text-xs font-[1000] uppercase italic text-[#4B0082] flex items-center gap-2"><Lucide.ShoppingBag size={16} className="text-[#82C91E]" /> Resumo do Pedido</h3>
                </div>
                
                <div className="space-y-4">
                    {pedido.itens?.map((item, idx) => {
                        const isExpanded = itensExpandidos[idx];
                        return (
                            <div key={idx} className="bg-slate-50/50 p-4 rounded-[2rem] border border-slate-100">
                                {item.nomeCopo && (
                                    <div className="mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                        <Lucide.User size={12} /> Para: <span className="text-[#4B0082]">{item.nomeCopo}</span>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-start gap-3">
                                    <div className="bg-white text-[#4B0082] font-[1000] text-xs w-8 h-8 flex items-center justify-center rounded-xl border border-slate-100 shrink-0 shadow-sm">
                                        {item.quantidade || 1}x
                                    </div>
                                    <div className="flex-1">
                                        {/* HIERARQUIA INVERTIDA SOLICITADA */}
                                        <h2 className="text-[#4B0082] font-[1000] uppercase italic text-[13px] leading-tight mb-0.5">{item.detalhes?.tamanho || item.tamanho}</h2>
                                        <h3 className="text-[#82C91E] font-black uppercase italic text-[11px] leading-tight">{item.detalhes?.baseNome || item.baseNome}</h3>
                                    </div>
                                    <span className="font-[1000] text-[#4B0082] text-xs italic">R$ {(item.total * (item.quantidade || 1)).toFixed(2).replace('.', ',')}</span>
                                </div>

                                <button onClick={() => setItensExpandidos(prev => ({...prev, [idx]: !prev[idx]}))} className="w-full mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1 hover:text-[#4B0082]">
                                    {isExpanded ? 'Ocultar Detalhes' : 'Ver Adicionais'} {isExpanded ? <Lucide.ChevronUp size={12}/> : <Lucide.ChevronDown size={12}/>}
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="pt-3 mt-3 border-t border-slate-200/60 space-y-2">
                                                {/* COBERTURA SEM ABREVIAÇÃO */}
                                                {item.detalhes?.cobertura_detalhes && (
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                        <span>COBERTURA: {item.detalhes.cobertura_detalhes.nome || item.detalhes.cobertura_detalhes}</span><span>R$ 0,00</span>
                                                    </div>
                                                )}
                                                {/* ACOMPANHAMENTOS LIMPOS */}
                                                {(item.detalhes?.acompanhamentos_detalhes || []).map((acc, i) => (
                                                    <div key={`acc-${i}`} className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                        <span>{acc.nome || acc}</span><span>R$ 0,00</span>
                                                    </div>
                                                ))}
                                                {/* ADICIONAIS */}
                                                {(item.detalhes?.adicionais_detalhes || []).map((add, i) => (
                                                    <div key={`add-${i}`} className="flex justify-between text-[10px] font-black text-[#4B0082] uppercase">
                                                        <span>+ {add.qtd}x {add.nome}</span><span>R$ {Number(add.preco * add.qtd).toFixed(2).replace('.', ',')}</span>
                                                    </div>
                                                ))}
                                                {item.observacao && (
                                                    <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2.5 rounded-xl mt-3 border border-amber-100 uppercase italic">Obs: {item.observacao}</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>

                {/* RECIBO INTELIGENTE BLINDADO CONTRA ERROS */}
<div className="mt-6 pt-5 border-t-2 border-dashed border-slate-100 space-y-3">
    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Subtotal</span><span>R$ {pedido.valores?.subtotal?.toFixed(2).replace('.', ',')}</span></div>
    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Logística ({pedido.tipoPedido})</span><span>R$ {pedido.valores?.taxa?.toFixed(2).replace('.', ',')}</span></div>
    
    {/* LOGICA DE STATUS DE PAGAMENTO REAL */}
    {pedido.status === 'AGUARDANDO_PAGAMENTO' ? (
        <div className="p-4 rounded-2xl mt-4 border bg-red-50 border-red-200 flex justify-between items-center animate-pulse">
            <div>
                <span className="text-xs font-[1000] uppercase italic block text-red-600">Pagamento Pendente</span>
                <span className="text-[9px] font-bold text-slate-500 uppercase">O pedido só será preparado após o pagamento</span>
            </div>
            <Lucide.AlertCircle className="text-red-500" size={24} />
        </div>
    ) : (
        <div className={`p-4 rounded-2xl mt-4 border flex justify-between items-center ${isPagamentoNaEntrega ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div>
                <span className={`text-xs font-[1000] uppercase italic block ${isPagamentoNaEntrega ? 'text-amber-600' : 'text-green-600'}`}>
                    {isPagamentoNaEntrega ? 'A Pagar na Entrega' : 'Pagamento Confirmado'}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase">{pedido.pagamento?.metodo}</span>
            </div>
            <span className={`text-2xl font-[1000] italic leading-none ${isPagamentoNaEntrega ? 'text-amber-600' : 'text-green-600'}`}>
                R$ {pedido.valores?.total?.toFixed(2).replace('.', ',')}
            </span>
        </div>
    )}
</div>
            </section>
        </main>

        {/* CHAT FLUTUANTE */}
        <button onClick={() => setChatAberto(true)} className="fixed bottom-8 right-6 w-16 h-16 bg-[#4B0082] rounded-[2rem] shadow-[0_10px_30px_rgba(75,0,130,0.4)] flex items-center justify-center text-[#82C91E] z-[60] border-2 border-white active:scale-90 transition-all hover:scale-105">
            <Lucide.MessageSquare size={26} strokeWidth={2.5} />
            {mensagens.length > 0 && <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#82C91E] text-[#4B0082] rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md animate-bounce">{mensagens.length}</div>}
        </button>

        {/* MODAL DO CHAT */}
        <AnimatePresence>
            {chatAberto && (
                <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-[200] flex flex-col bg-slate-50 sm:p-4 sm:bg-black/50 sm:justify-end">
                    <div className="bg-white flex-1 sm:flex-none sm:h-[85vh] sm:rounded-t-[3.5rem] w-full max-w-md mx-auto flex flex-col shadow-2xl overflow-hidden relative border border-slate-100">
                        <header className="p-6 bg-[#4B0082] text-white flex justify-between items-center shadow-md relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-[#82C91E] border border-white/20"><Lucide.Headset size={22} /></div>
                                <div>
                                    <h3 className="font-[1000] uppercase italic text-lg leading-none tracking-tighter">Central de Apoio</h3>
                                    <span className="text-[9px] font-black text-[#82C91E] uppercase tracking-widest flex items-center gap-1.5 mt-1"><div className="w-1.5 h-1.5 bg-[#82C91E] rounded-full animate-pulse" /> Online</span>
                                </div>
                            </div>
                            <button onClick={() => setChatAberto(false)} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><Lucide.ChevronDown size={22} /></button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 custom-scrollbar">
                            <div className="text-center text-[9px] font-black uppercase text-slate-300 tracking-widest mb-6">Histórico de Comunicação</div>
                            {mensagens.map((msg, i) => (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={i} className={`flex ${msg.remetente === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-[1.5rem] font-bold text-xs shadow-sm ${msg.remetente === 'cliente' ? 'bg-[#4B0082] text-white rounded-br-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'}`}>{msg.texto}</div>
                                </motion.div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 bg-white border-t border-slate-100">
                            <form onSubmit={enviarMensagem} className="flex gap-2 items-end">
                                <input value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} placeholder="Mande uma mensagem à loja..." className="flex-1 bg-slate-50 p-4 rounded-[1.5rem] text-xs font-bold outline-none focus:border-[#4B0082] border border-slate-100 transition-all placeholder:text-slate-300 text-slate-700" />
                                {novaMsg.trim() && <button type="submit" className="bg-[#82C91E] text-[#4B0082] p-4 rounded-[1.5rem] shadow-lg active:scale-90 transition-all shrink-0"><Lucide.Send size={22} strokeWidth={2.5} /></button>}
                            </form>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}