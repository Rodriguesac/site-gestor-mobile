import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../services/firebase";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useUser } from '../context/UserContext'; 
import * as Lucide from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ============================================================================
// 1. CONFIGURAÇÕES GLOBAIS E ESTILOS DE MAPA
// ============================================================================
const STORE_COORDS = [-20.431321403072136, -54.554146298681154]; // Loja Rodrigues
const LOGO_LOJA = "https://i.ibb.co/MDJK337g/Chat-GPT-Image-30-de-dez-de-2025-13-05-06.png";

const MAPA_GOOGLE_CLEAN = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"; 

// Ícones Customizados (Mais sutis estilo iFood)
const storeIcon = L.divIcon({ className: 's-icon', html: `<div class="w-10 h-10 bg-[#4B0082] rounded-full border-2 border-white shadow-lg flex items-center justify-center overflow-hidden"><img src="${LOGO_LOJA}" class="w-full h-full object-cover" /></div>`, iconSize: [40, 40], iconAnchor: [20, 20]});
const courierIcon = L.divIcon({ className: 'c-icon', html: `<div class="w-10 h-10 bg-[#82C91E] rounded-full border-2 border-white shadow-lg flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4B0082" stroke-width="2.5"><path d="M12 2a9 9 0 0 0-9 9v3.5a2.5 2.5 0 0 0 2.5 2.5h13a2.5 2.5 0 0 0 2.5-2.5V11a9 9 0 0 0-9-9Z"/><path d="M8.5 17v-4a3.5 3.5 0 0 1 7 0v4"/></svg></div>`, iconSize: [40, 40], iconAnchor: [20, 40]});
const createUserIcon = (fotoUrl) => L.divIcon({ className: 'u-icon', html: `<div class="w-10 h-10 bg-[#EA1D2C] rounded-full border-2 border-white shadow-lg flex items-center justify-center overflow-hidden relative">${fotoUrl ? `<img src="${fotoUrl}" class="w-full h-full object-cover" />` : `<Lucide.User size={16} color="white"/>`}</div>`, iconSize: [40, 40], iconAnchor: [20, 40]});

function MapUpdater({ bounds, padding = [50, 50] }) {
    const map = useMap();
    useEffect(() => { 
        if (bounds && bounds.length > 0) map.fitBounds(bounds, { padding, animate: true, duration: 1.5 });
    }, [bounds, map, padding]);
    return null;
}

const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// ============================================================================
// 2. MOTOR DE RASTREIO ISOLADO
// ============================================================================
const MotorDeRastreio = ({ pedido, fotoPerfil, onUpdateETA }) => {
    const [entregador, setEntregador] = useState(null);
    const [rotaPoligono, setRotaPoligono] = useState([]);
    const [boundsMapa, setBoundsMapa] = useState([]);

    const latDestino = pedido.endereco?.lat;
    const lngDestino = pedido.endereco?.lng;
    const clienteCoords = [latDestino || STORE_COORDS[0], lngDestino || STORE_COORDS[1]];
    const isSaiuEntrega = pedido.status === 'SAIU_ENTREGA';

    const calcularRotaReal = useCallback(async (startLat, startLng, endLat, endLng) => {
        if (!startLat || !startLng || !endLat || !endLng) return;
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.routes?.length > 0) {
                const route = data.routes[0];
                const pontos = route.geometry.coordinates.map(c => [c[1], c[0]]);
                setRotaPoligono(pontos);
                setBoundsMapa([ [startLat, startLng], [endLat, endLng] ]);
                onUpdateETA(Math.ceil(route.duration / 60), (route.distance / 1000).toFixed(1));
            }
        } catch (e) { setRotaPoligono([[startLat, startLng], [endLat, endLng]]); }
    }, [onUpdateETA]);

    useEffect(() => {
        if (!isSaiuEntrega && latDestino && lngDestino) {
            calcularRotaReal(STORE_COORDS[0], STORE_COORDS[1], latDestino, lngDestino);
            return;
        }

        if (isSaiuEntrega && pedido.entregadorId && latDestino && lngDestino) {
            const monitorar = async () => {
                try {
                    const snap = await getDoc(doc(db, "entregadores", pedido.entregadorId));
                    if (snap.exists()) {
                        const piloto = snap.data();
                        setEntregador(piloto);
                        if (piloto.coords?.lat) calcularRotaReal(piloto.coords.lat, piloto.coords.lng, latDestino, lngDestino);
                    }
                } catch (e) { console.error("Erro GPS:", e); }
            };
            monitorar();
            const timer = setInterval(monitorar, 30000); 
            return () => clearInterval(timer);
        }
    }, [isSaiuEntrega, pedido.entregadorId, latDestino, lngDestino, calcularRotaReal]);

    if (!latDestino) return <div className="h-full w-full bg-slate-200 animate-pulse" />;

    return (
        <MapContainer center={STORE_COORDS} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer url={MAPA_GOOGLE_CLEAN} />
            <Marker position={STORE_COORDS} icon={storeIcon} />
            <Marker position={clienteCoords} icon={createUserIcon(fotoPerfil)} />
            
            {isSaiuEntrega && entregador?.coords && (
                <Marker position={[entregador.coords.lat, entregador.coords.lng]} icon={courierIcon} />
            )}
            
            {rotaPoligono.length > 0 && <Polyline positions={rotaPoligono} color="#4B0082" weight={4} opacity={0.8} />}
            <MapUpdater bounds={boundsMapa} padding={[30, 30]} />
        </MapContainer>
    );
};

// ============================================================================
// 3. COMPONENTE PRINCIPAL (UI IFOOD STYLE)
// ============================================================================
export default function AcompanhamentoCompleto() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { fotoPerfil } = useUser(); 
    
    const [pedido, setPedido] = useState(null);
    const [pilotoInfo, setPilotoInfo] = useState(null);
    const [mensagens, setMensagens] = useState([]); 
    const [chatAberto, setChatAberto] = useState(false);
    const [etaInfo, setEtaInfo] = useState({ min: null, km: null });
    const [novaMsg, setNovaMsg] = useState("");
    const chatEndRef = useRef(null);

    const statusSteps = useMemo(() => [
        { id: 'PENDENTE', label: 'Aceito' },
        { id: 'EM_PREPARO', label: 'Preparando' },
        { id: 'SAIU_ENTREGA', label: 'A caminho' },
        { id: 'CONCLUIDO', label: 'Entregue' }
    ], []);

    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, "pedidos", id), async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setPedido({ id: snap.id, ...data });
                // Se já tem motoboy atribuído, busca os dados dele para mostrar no card
                if (data.entregadorId) {
                    const motoristaSnap = await getDoc(doc(db, "entregadores", data.entregadorId));
                    if (motoristaSnap.exists()) setPilotoInfo(motoristaSnap.data());
                }
            } else {
                navigate('/');
            }
        });
        const unsubChat = onSnapshot(query(collection(db, "pedidos", id, "chat"), orderBy("timestamp", "asc")), (snap) => {
            setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsub(); unsubChat(); };
    }, [id, navigate]);

    useEffect(() => { if (chatAberto) chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, chatAberto]);

    const handleEnviarMensagem = async (e) => {
        e.preventDefault();
        if (!novaMsg.trim()) return;
        await addDoc(collection(db, "pedidos", id, "chat"), { texto: novaMsg, remetente: "cliente", timestamp: serverTimestamp() });
        setNovaMsg("");
    };

    if (!pedido) return (
        <div className="h-screen bg-slate-50 flex items-center justify-center">
            <Lucide.Loader2 size={30} className="animate-spin text-[#4B0082]" />
        </div>
    );

    const isSaiuEntrega = pedido.status === 'SAIU_ENTREGA';
    const currentStepIndex = statusSteps.findIndex(s => s.id === pedido.status) !== -1 ? statusSteps.findIndex(s => s.id === pedido.status) : 0;

    return (
        <div className="h-[100dvh] w-full flex flex-col bg-slate-100 overflow-hidden relative font-sans">
            
            {/* BOTÃO VOLTAR FLUTUANTE */}
            <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-[500] w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md text-[#4B0082] active:scale-95">
                <Lucide.ArrowLeft size={20} strokeWidth={3} />
            </button>

            {/* ÁREA DO MAPA (Metade Superior) */}
            <div className="absolute top-0 left-0 w-full h-[50vh] z-0">
                <MotorDeRastreio pedido={pedido} fotoPerfil={fotoPerfil} onUpdateETA={(min, km) => setEtaInfo({ min, km })} />
            </div>

            {/* BOTTOM SHEET (Gaveta Inferior - Estilo iFood) */}
            <div className="absolute bottom-0 left-0 w-full h-[60vh] bg-white rounded-t-[2rem] z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
                
                {/* Handle (Trancinho cinza no topo da gaveta) */}
                <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar space-y-6">
                    
                    {/* CABEÇALHO DO STATUS */}
                    <div className="text-center mb-2">
                        <h2 className="text-2xl font-[1000] text-slate-800 tracking-tight">
                            {pedido.status === 'PENDENTE' ? 'Pedido recebido' :
                             pedido.status === 'EM_PREPARO' ? 'Preparando seu pedido' :
                             pedido.status === 'SAIU_ENTREGA' ? 'O pedido está a caminho' : 'Pedido entregue'}
                        </h2>
                        {etaInfo.min ? (
                            <p className="text-sm font-bold text-slate-500 mt-1">Previsão: <span className="text-[#82C91E] font-black">{etaInfo.min} - {etaInfo.min + 10} min</span></p>
                        ) : (
                            <p className="text-sm font-bold text-slate-500 mt-1">Calculando previsão...</p>
                        )}
                    </div>

                    {/* PROGRESS BAR (Linha do Tempo Simples) */}
                    <div className="relative px-2 py-4">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full" />
                        <div className="absolute top-1/2 left-0 h-1 bg-[#82C91E] -translate-y-1/2 rounded-full transition-all duration-700" style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }} />
                        
                        <div className="relative flex justify-between z-10">
                            {statusSteps.map((step, idx) => (
                                <div key={step.id} className="flex flex-col items-center gap-2">
                                    <div className={`w-3.5 h-3.5 rounded-full ring-4 ring-white transition-all ${idx <= currentStepIndex ? 'bg-[#82C91E]' : 'bg-slate-200'}`} />
                                    <span className={`text-[9px] font-black uppercase ${idx <= currentStepIndex ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PIN DE SEGURANÇA (DISCRETO E ELEGANTE) */}
                    {pedido.codigoEntrega && (
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                            <div className="flex items-center gap-3 text-slate-600">
                                <Lucide.ShieldCheck size={20} className="text-[#4B0082]" />
                                <span className="text-sm font-bold">Código de entrega</span>
                            </div>
                            <span className="text-xl font-black text-[#4B0082] tracking-widest">{pedido.codigoEntrega}</span>
                        </div>
                    )}

                    {/* DADOS DO ENTREGADOR (Aparece só quando sai para entrega) */}
                    <AnimatePresence>
                        {isSaiuEntrega && pilotoInfo && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                                <div className="border-t border-b border-slate-100 py-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                            {pilotoInfo.urlPerfil ? <img src={pilotoInfo.urlPerfil} className="w-full h-full object-cover" alt="Piloto" /> : <Lucide.User size={24} className="m-auto mt-4 text-slate-300" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 leading-tight">{pilotoInfo.nome}</p>
                                            <p className="text-[11px] font-black text-slate-500 uppercase mt-0.5">{pilotoInfo.modalidade} {pilotoInfo.placa ? `• ${pilotoInfo.placa}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setChatAberto(true)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                                            <Lucide.MessageCircle size={18} />
                                        </button>
                                        <a href={`tel:55${pilotoInfo.telefone?.replace(/\D/g, '')}`} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                                            <Lucide.Phone size={18} />
                                        </a>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* DETALHES DO PEDIDO (Lista Clean) */}
                    <div className="pt-2">
                        <h3 className="font-bold text-slate-800 mb-4">Detalhes do pedido</h3>
                        <div className="space-y-4">
                            {pedido.itens?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start text-sm">
                                    <div className="flex gap-3 text-slate-700">
                                        <span className="font-black text-slate-400">{item.quantidade || 1}x</span>
                                        <div>
                                            <p className="font-bold">{item.detalhes?.tamanho || item.tamanho} {item.detalhes?.baseNome || item.baseNome}</p>
                                            <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                                {item.detalhes?.cobertura_detalhes && <p>Calda: {item.detalhes.cobertura_detalhes.nome || item.detalhes.cobertura_detalhes}</p>}
                                                {(item.detalhes?.adicionais_detalhes || []).map((ad, i) => (
                                                    <p key={i}>+ {ad.qtd}x {ad.nome}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-800">{formatarMoeda(item.total * (item.quantidade || 1))}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-sm">
                            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatarMoeda(pedido.valores?.subtotal)}</span></div>
                            <div className="flex justify-between text-slate-500"><span>Taxa de entrega</span><span>{formatarMoeda(pedido.valores?.taxa)}</span></div>
                            <div className="flex justify-between font-black text-slate-800 text-base pt-2"><span>Total</span><span>{formatarMoeda(pedido.valores?.total)}</span></div>
                        </div>
                    </div>

                    {/* AJUDA / SUPORTE */}
                    {!isSaiuEntrega && (
                        <div className="pt-4 border-t border-slate-100 pb-6">
                            <button onClick={() => setChatAberto(true)} className="w-full py-4 text-[#EA1D2C] font-bold text-sm text-left flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition-colors">
                                Falar com a loja
                                <Lucide.ChevronRight size={18} className="text-slate-300" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* CHAT MODAL (Abre por cima de tudo) */}
            <AnimatePresence>
                {chatAberto && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-[3000] flex flex-col bg-white">
                        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 pt-[max(env(safe-area-inset-top),16px)]">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setChatAberto(false)} className="p-2 -ml-2 text-slate-800 active:scale-95"><Lucide.ChevronLeft size={28} /></button>
                                <div>
                                    <h3 className="font-black text-slate-800">{isSaiuEntrega && pilotoInfo ? pilotoInfo.nome : 'Suporte Rodrigues'}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{isSaiuEntrega ? 'Entregador' : 'Loja'}</p>
                                </div>
                            </div>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                            {mensagens.map((msg, i) => (
                                <div key={i} className={`flex ${msg.remetente === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 text-sm font-medium rounded-2xl ${msg.remetente === 'cliente' ? 'bg-[#EA1D2C] text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'}`}>
                                        {msg.texto}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        
                        <form onSubmit={handleEnviarMensagem} className="p-4 bg-white border-t border-slate-100 flex gap-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
                            <input value={novaMsg} onChange={e=>setNovaMsg(e.target.value)} placeholder="Escreva uma mensagem..." className="flex-1 bg-slate-100 px-5 py-3.5 rounded-full font-medium text-sm outline-none text-slate-800" />
                            <button type="submit" disabled={!novaMsg.trim()} className="w-12 h-12 bg-[#EA1D2C] disabled:bg-slate-300 text-white rounded-full flex items-center justify-center shrink-0 transition-colors"><Lucide.Send size={20} className="ml-1" /></button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
            
        </div>
    );
}