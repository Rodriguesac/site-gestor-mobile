import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../services/firebase";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, getDoc, updateDoc, getDocs } from "firebase/firestore";
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
const MAPA_STYLE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"; 

const storeIcon = L.divIcon({ className: 's-icon', html: `<div class="w-10 h-10 bg-[#4B0082] rounded-full border-2 border-white shadow-lg flex items-center justify-center overflow-hidden"><img src="${LOGO_LOJA}" class="w-full h-full object-cover" /></div>`, iconSize: [40, 40], iconAnchor: [20, 20]});
const courierIcon = L.divIcon({ className: 'c-icon', html: `<div class="w-10 h-10 bg-[#82C91E] rounded-full border-2 border-white shadow-lg flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4B0082" stroke-width="2.5"><path d="M12 2a9 9 0 0 0-9 9v3.5a2.5 2.5 0 0 0 2.5 2.5h13a2.5 2.5 0 0 0 2.5-2.5V11a9 9 0 0 0-9-9Z"/><path d="M8.5 17v-4a3.5 3.5 0 0 1 7 0v4"/></svg></div>`, iconSize: [40, 40], iconAnchor: [20, 40]});
const createUserIcon = (fotoUrl) => L.divIcon({ className: 'u-icon', html: `<div class="w-10 h-10 bg-[#EA1D2C] rounded-full border-2 border-white shadow-lg flex items-center justify-center overflow-hidden relative">${fotoUrl ? `<img src="${fotoUrl}" class="w-full h-full object-cover" />` : `<svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`}</div>`, iconSize: [40, 40], iconAnchor: [20, 40]});

function MapUpdater({ bounds }) {
    const map = useMap();
    useEffect(() => { if (bounds?.length > 0) map.fitBounds(bounds, { padding: [30, 30], animate: true }); }, [bounds, map]);
    return null;
}

// ============================================================================
// 2. MOTOR DE RASTREIO (MAPA)
// ============================================================================
const MotorDeRastreio = ({ pedido, fotoPerfil, onUpdateETA }) => {
    const [entregador, setEntregador] = useState(null);
    const [rotaPoligono, setRotaPoligono] = useState([]);
    const [boundsMapa, setBoundsMapa] = useState([]);
    const isSaiuEntrega = pedido.status === 'SAIU_ENTREGA';

    const calcularRota = useCallback(async (sLat, sLng, eLat, eLng) => {
        try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`);
            const data = await res.json();
            if (data.routes?.[0]) {
                setRotaPoligono(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
                setBoundsMapa([[sLat, sLng], [eLat, eLng]]);
                onUpdateETA(Math.ceil(data.routes[0].duration / 60));
            }
        } catch (e) { setRotaPoligono([[sLat, sLng], [eLat, eLng]]); }
    }, [onUpdateETA]);

    useEffect(() => {
        const lat = pedido.endereco?.lat; const lng = pedido.endereco?.lng;
        if (!isSaiuEntrega && lat) calcularRota(STORE_COORDS[0], STORE_COORDS[1], lat, lng);
        if (isSaiuEntrega && pedido.entregadorId && lat) {
            const monitor = async () => {
                const s = await getDoc(doc(db, "entregadores", pedido.entregadorId));
                if (s.exists() && s.data().coords) {
                    setEntregador(s.data());
                    calcularRota(s.data().coords.lat, s.data().coords.lng, lat, lng);
                }
            };
            monitor(); const t = setInterval(monitor, 30000); return () => clearInterval(t);
        }
    }, [isSaiuEntrega, pedido.entregadorId, pedido.endereco, calcularRota]);

    if (!pedido.endereco?.lat) return <div className="h-full w-full bg-slate-200 animate-pulse" />;

    return (
        <MapContainer center={STORE_COORDS} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer url={MAPA_STYLE} />
            <Marker position={STORE_COORDS} icon={storeIcon} />
            <Marker position={[pedido.endereco.lat, pedido.endereco.lng]} icon={createUserIcon(fotoPerfil)} />
            {isSaiuEntrega && entregador?.coords && <Marker position={[entregador.coords.lat, entregador.coords.lng]} icon={courierIcon} />}
            {rotaPoligono.length > 0 && <Polyline positions={rotaPoligono} color="#4B0082" weight={4} opacity={0.6} />}
            <MapUpdater bounds={boundsMapa} />
        </MapContainer>
    );
};

// ============================================================================
// 3. APLICATIVO PRINCIPAL DO CLIENTE (COM ASSISTENTE DE SUPORTE)
// ============================================================================
export default function Acompanhamento() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { fotoPerfil } = useUser();
    
    // Estados do Pedido e Menu
    const [pedido, setPedido] = useState(null);
    const [piloto, setPiloto] = useState(null);
    const [eta, setEta] = useState(null);
    const [adicionaisDinamicos, setAdicionaisDinamicos] = useState([]);
    
    // Estados do Chat e Assistente Virtual
    const [chatAberto, setChatAberto] = useState(false);
    const [mensagens, setMensagens] = useState([]);
    const [novaMsg, setNovaMsg] = useState("");
    const [modoChat, setModoChat] = useState("BOT"); // BOT | HUMANO | LISTA_ITENS
    const chatEndRef = useRef(null);

    // Estados da Solicitação de Alteração
    const [modalTrocaAberto, setModalTrocaAberto] = useState(false);
    const [textoTroca, setTextoTroca] = useState("");
    const [processandoTroca, setProcessandoTroca] = useState(false);

    // ========================================================================
    // INITIAL FETCH (PEDIDO E CARDÁPIO DINÂMICO)
    // ========================================================================
    useEffect(() => {
        // Puxa os adicionais do banco para caso ele queira inserir algo novo no chat
        const fetchAdicionais = async () => {
            const q = query(collection(db, "adicionais"), orderBy("ordem", "asc"));
            const snap = await getDocs(q);
            setAdicionaisDinamicos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.disponivel));
        };
        fetchAdicionais();

        const unsub = onSnapshot(doc(db, "pedidos", id), async (s) => {
            if (s.exists()) {
                const data = s.data(); 
                setPedido({ id: s.id, ...data });
                
                if (data.entregadorId && !piloto) {
                    const ps = await getDoc(doc(db, "entregadores", data.entregadorId));
                    if (ps.exists()) setPiloto(ps.data());
                }

                // REDIRECIONAMENTO AUTOMÁTICO APÓS CONCLUSÃO
                if (data.status === 'CONCLUIDO') {
                    setTimeout(() => navigate(`/detalhes-pedido/${s.id}`, { replace: true }), 3000);
                }
            } else {
                navigate('/');
            }
        });

        const unsubChat = onSnapshot(query(collection(db, "pedidos", id, "chat"), orderBy("timestamp", "asc")), (s) => {
            setMensagens(s.docs.map(d => d.data()));
            // Se a loja mandar mensagem, desativa o bot
            if (s.docs.length > 0 && s.docs[s.docs.length - 1].data().remetente === 'loja') {
                setModoChat('HUMANO');
            }
        });

        return () => { unsub(); unsubChat(); };
    }, [id, navigate, piloto]);

    useEffect(() => {
        if (chatAberto) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensagens, chatAberto, modoChat]);

    // ========================================================================
    // AÇÕES DO CLIENTE
    // ========================================================================
    const confirmarRecebimento = async () => {
        if (window.confirm("Confirma que recebeu o seu pedido em mãos?")) {
            await updateDoc(doc(db, "pedidos", id), { 
                status: 'CONCLUIDO', 
                horarioConcluido: serverTimestamp(), 
                concluidoPeloCliente: true 
            });
        }
    };

    const enviarMsgHumano = async (e) => {
        e.preventDefault(); 
        if (!novaMsg.trim()) return;
        await addDoc(collection(db, "pedidos", id, "chat"), { 
            texto: novaMsg, 
            remetente: "cliente", 
            timestamp: serverTimestamp() 
        });
        setNovaMsg("");
    };

    const enviarSolicitacaoTroca = async (e) => {
        e.preventDefault();
        if (!textoTroca.trim()) return;
        setProcessandoTroca(true);
        try {
            await updateDoc(doc(db, "pedidos", id), {
                solicitacaoAlteracao: {
                    tipo: 'MUDANÇA DE INGREDIENTE',
                    descricao: textoTroca,
                    valorSugerido: 0,
                    status: 'PENDENTE',
                    horario: serverTimestamp()
                }
            });
            setModalTrocaAberto(false);
            setTextoTroca("");
        } catch (error) {
            alert("Erro ao enviar solicitação.");
        } finally {
            setProcessandoTroca(false);
        }
    };

    // ========================================================================
    // ASSISTENTE VIRTUAL DE SOLICITAÇÃO DE ALTERAÇÕES
    // ========================================================================
    const interagirComBot = async (acao, payload = null) => {
        if (acao === 'CHAMAR_HUMANO') {
            setModoChat('HUMANO');
            await addDoc(collection(db, "pedidos", id, "chat"), { 
                texto: "Gostaria de falar com um atendente.", 
                remetente: "cliente", 
                timestamp: serverTimestamp() 
            });
        }
        
        else if (acao === 'ABRIR_MENU_ITENS') {
            setModoChat('LISTA_ITENS');
        }

        else if (acao === 'CANCELAR_PEDIDO') {
            if(window.confirm("Tem certeza que deseja solicitar o CANCELAMENTO?")) {
                await updateDoc(doc(db, "pedidos", id), {
                    solicitacaoAlteracao: {
                        tipo: 'CANCELAMENTO',
                        descricao: "O cliente solicitou o cancelamento do pedido no app.",
                        status: 'PENDENTE',
                        horario: serverTimestamp()
                    }
                });
                alert("Sua solicitação de cancelamento foi enviada. Aguarde a loja processar o estorno.");
                setChatAberto(false);
            }
        }

        else if (acao === 'CONFIRMAR_NOVO_ITEM') {
            const item = payload;
            const precoFormatado = Number(item.preco || 0); // Correção: Garante que é número

            await updateDoc(doc(db, "pedidos", id), {
                solicitacaoAlteracao: {
                    tipo: 'ADICIONAR ITEM',
                    descricao: `Adicionar: ${item.nome} (R$ ${precoFormatado.toFixed(2)})`,
                    valorSugerido: precoFormatado,
                    status: 'PENDENTE',
                    horario: serverTimestamp()
                }
            });
            setModoChat('HUMANO'); // Volta pro modo conversa
            await addDoc(collection(db, "pedidos", id, "chat"), { 
                texto: `Solicitei adicionar ${item.nome} no meu pedido.`, 
                remetente: "cliente", 
                timestamp: serverTimestamp() 
            });
        }
    };

    // ========================================================================
    // RENDERIZAÇÃO
    // ========================================================================
    if (!pedido) return <div className="h-[100dvh] flex items-center justify-center bg-white"><Lucide.Loader2 className="animate-spin text-[#82C91E]" size={40}/></div>;

    return (
        <div className="h-[100dvh] w-full flex flex-col bg-slate-100 overflow-hidden relative font-sans">
            
            {/* TELA DE SUCESSO (3 SEGUNDOS ANTES DO REDIRECIONAMENTO) */}
            <AnimatePresence>
                {pedido.status === 'CONCLUIDO' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[6000] bg-[#82C91E] flex flex-col items-center justify-center text-[#4B0082] p-10 text-center">
                        <Lucide.CheckCircle size={100} className="mb-6 animate-bounce" strokeWidth={3} />
                        <h2 className="text-4xl font-[1000] uppercase italic tracking-tighter">Pedido Entregue!</h2>
                        <p className="font-black uppercase tracking-widest text-sm mt-3 opacity-70">Gerando seu Relatório Fiscal...</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <button onClick={() => navigate(-1)} className="absolute top-6 left-6 z-[500] w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl text-[#4B0082] active:scale-90 transition-transform">
                <Lucide.ArrowLeft size={24} strokeWidth={3}/>
            </button>

            {/* MAPA EM TEMPO REAL */}
            <div className="absolute top-0 left-0 w-full h-[50vh] z-0">
                <MotorDeRastreio pedido={pedido} fotoPerfil={fotoPerfil} onUpdateETA={setEta} />
            </div>

            {/* PAINEL INFERIOR (BOTTOM SHEET) */}
            <div className="absolute bottom-0 left-0 w-full h-[60vh] bg-white rounded-t-[3rem] z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] flex flex-col">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 shrink-0" />
                
                <div className="flex-1 overflow-y-auto p-8 pt-2 custom-scrollbar">
                    
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-[1000] text-[#4B0082] uppercase italic leading-tight">
                            {pedido.status === 'PENDENTE' ? 'Analisando Pedido' :
                             pedido.status === 'FILA' ? 'Fila da Cozinha' :
                             pedido.status === 'EM_PREPARO' ? 'Preparando Tudo' :
                             pedido.status === 'PRONTO' ? 'Pronto para Sair' :
                             pedido.status === 'SAIU_ENTREGA' ? 'Pedido a Caminho' : 'Finalizando'}
                        </h2>
                        {eta && !['CONCLUIDO'].includes(pedido.status) && (
                            <p className="text-[#82C91E] font-black uppercase text-xs mt-2 tracking-widest">Previsão: {eta} - {eta + 10} min</p>
                        )}
                    </div>

                    {/* ALERTA DE TOKEN DE SEGURANÇA */}
                    {pedido.codigoEntrega && pedido.status !== 'CONCLUIDO' && (
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center mb-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Lucide.ShieldCheck size={14}/> Segurança</p>
                                <p className="text-sm font-bold text-slate-600">Mostre ao piloto na entrega</p>
                            </div>
                            <span className="text-3xl font-[1000] text-[#4B0082] tracking-[0.2em] bg-white px-5 py-2 rounded-2xl shadow-sm border border-slate-100">{pedido.codigoEntrega}</span>
                        </div>
                    )}

                    {/* ========================================================
                        SISTEMA DE ALTERAÇÃO DINÂMICA DO PEDIDO
                    ======================================================== */}
                    {pedido.status === 'EM_PREPARO' && (
                        <div className="mb-8">
                            {!pedido.solicitacaoAlteracao ? (
                                <button onClick={() => setModalTrocaAberto(true)} className="w-full py-4 bg-amber-50 border-2 border-amber-200 text-amber-700 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                                    <Lucide.RefreshCcw size={16}/> Solicitar Troca de Ingrediente
                                </button>
                            ) : (
                                <div className={`p-5 rounded-2xl border-2 ${pedido.solicitacaoAlteracao.status === 'PENDENTE' ? 'bg-amber-50 border-amber-200 animate-pulse' : pedido.solicitacaoAlteracao.status === 'ACEITO' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${pedido.solicitacaoAlteracao.status === 'PENDENTE' ? 'text-amber-600' : pedido.solicitacaoAlteracao.status === 'ACEITO' ? 'text-green-600' : 'text-red-600'}`}>
                                        {pedido.solicitacaoAlteracao.status === 'PENDENTE' && <Lucide.Clock size={14}/>}
                                        {pedido.solicitacaoAlteracao.status === 'ACEITO' && <Lucide.CheckCircle2 size={14}/>}
                                        {pedido.solicitacaoAlteracao.status === 'RECUSADO' && <Lucide.XCircle size={14}/>}
                                        Solicitação: {pedido.solicitacaoAlteracao.status}
                                    </p>
                                    <p className="text-xs font-bold text-slate-700 italic leading-relaxed">"{pedido.solicitacaoAlteracao.descricao}"</p>
                                    {pedido.solicitacaoAlteracao.custoAdicional > 0 && pedido.solicitacaoAlteracao.status === 'ACEITO' && (
                                        <div className="mt-3 bg-white p-3 rounded-xl border border-green-200 inline-block">
                                            <p className="text-[10px] font-black text-[#4B0082] uppercase tracking-widest">+ R$ {Number(pedido.solicitacaoAlteracao.custoAdicional || 0).toFixed(2)} adicionados à conta.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* BOTÃO DE CONFIRMAÇÃO DE RECEBIMENTO DO CLIENTE */}
                    {pedido.status === 'SAIU_ENTREGA' && (
                        <button onClick={confirmarRecebimento} className="w-full py-6 bg-[#82C91E] text-[#4B0082] rounded-[2rem] font-[1000] uppercase italic text-sm shadow-xl shadow-[#82C91E]/20 mb-8 active:scale-95 transition-all flex items-center justify-center gap-3">
                            <Lucide.CheckSquare size={24} strokeWidth={3}/> Já recebi meu pedido
                        </button>
                    )}

                    {/* RESUMO DO PEDIDO E ITENS */}
                    <div className="border-t border-slate-100 pt-8">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Resumo da Carga</h3>
                        {pedido.itens?.map((it, i) => (
                            <div key={i} className="flex justify-between items-start mb-4">
                                <div className="flex-1 pr-4">
                                    <span className="text-sm font-black text-[#4B0082] uppercase"><span className="text-[#82C91E]">{it.quantidade}x</span> {it.detalhes?.tamanho || it.tamanho} {it.detalhes?.baseNome || it.baseNome}</span>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{(it.detalhes?.acompanhamentos_detalhes || []).join(', ')}</p>
                                </div>
                                <span className="text-sm font-black text-slate-500">R$ {Number(it.total || 0).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-100 flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total da Conta</span>
                            <span className="text-3xl font-[1000] text-[#4B0082] italic tracking-tighter leading-none">R$ {Number(pedido.valores?.total || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    <button onClick={() => setChatAberto(true)} className="w-full mt-10 py-5 bg-[#4B0082] text-[#82C91E] hover:bg-indigo-950 font-[1000] uppercase text-[11px] tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-xl">
                        <Lucide.Headset size={20}/> Central de Suporte & Alterações
                    </button>
                </div>
            </div>

            {/* ========================================================================
                MODAL DE SUPORTE (CHAT + ASSISTENTE VIRTUAL DINÂMICO)
            ======================================================================== */}
            <AnimatePresence>
                {chatAberto && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="fixed inset-0 z-[4000] bg-[#F8FAFC] flex flex-col pb-[env(safe-area-inset-bottom)]">
                        <header className="p-6 pt-12 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10 shrink-0">
                            <button onClick={() => { setChatAberto(false); setModoChat('BOT'); }} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 active:scale-90 transition-transform"><Lucide.ChevronDown size={24}/></button>
                            <div className="text-center">
                                <h3 className="font-[1000] text-[#4B0082] uppercase italic text-lg leading-none">Assistente Rodrigues</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#82C91E] mt-1">{modoChat === 'HUMANO' ? 'Atendimento Humano' : 'Atendimento Virtual'}</p>
                            </div>
                            <div className="w-12 h-12"/>
                        </header>
                        
                        {modoChat === 'HUMANO' ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC] custom-scrollbar">
                                    <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">Chat Conectado à Loja</p>
                                    {mensagens.map((m, i) => (
                                        <div key={i} className={`flex ${m.remetente === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-4 rounded-[2rem] text-sm font-bold shadow-sm ${m.remetente === 'cliente' ? 'bg-[#82C91E] text-[#4B0082] rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                                                {m.texto}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                <form onSubmit={enviarMsgHumano} className="p-4 bg-white border-t border-slate-200 flex gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20 shrink-0">
                                    <input value={novaMsg} onChange={e => setNovaMsg(e.target.value)} placeholder="Digite sua mensagem..." className="flex-1 bg-slate-100 px-6 py-4 rounded-full outline-none font-bold text-slate-700 placeholder:text-slate-400" />
                                    <button type="submit" disabled={!novaMsg.trim()} className="w-14 h-14 bg-[#4B0082] disabled:bg-slate-200 text-[#82C91E] disabled:text-slate-400 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform shrink-0">
                                        <Lucide.Send size={24} strokeWidth={2.5}/>
                                    </button>
                                </form>
                            </>
                        ) : modoChat === 'LISTA_ITENS' ? (
                            <div className="flex-1 overflow-y-auto bg-white flex flex-col custom-scrollbar">
                                <div className="p-6 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-[1000] text-slate-800 uppercase italic">O que deseja adicionar?</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Selecione um ingrediente abaixo. O valor será cobrado na entrega.</p>
                                </div>
                                <div className="p-6 space-y-3">
                                    {adicionaisDinamicos.map(item => (
                                        <button key={item.id} onClick={() => interagirComBot('CONFIRMAR_NOVO_ITEM', item)} className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl flex justify-between items-center active:scale-95 transition-all hover:border-[#82C91E]">
                                            <span className="font-[1000] text-[#4B0082] uppercase text-sm">{item.nome}</span>
                                            <span className="font-black text-[#82C91E]">+ R$ {Number(item.preco || 0).toFixed(2)}</span>
                                        </button>
                                    ))}
                                    <button onClick={() => setModoChat('BOT')} className="w-full py-4 text-xs font-black text-slate-400 uppercase mt-4">Cancelar e Voltar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC] flex flex-col justify-end custom-scrollbar">
                                <div className="bg-white border border-slate-200 p-6 rounded-[2rem] rounded-tl-sm shadow-sm mb-6 max-w-[85%]">
                                    <Lucide.Bot size={32} className="text-[#4B0082] mb-3"/>
                                    <p className="text-sm font-bold text-slate-800 leading-relaxed">Olá! Eu sou o assistente virtual da Rodrigues. O que você gostaria de fazer com o seu pedido atual?</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {['PENDENTE', 'FILA', 'EM_PREPARO'].includes(pedido.status) && !pedido.solicitacaoAlteracao && (
                                        <>
                                            <button onClick={() => interagirComBot('ABRIR_MENU_ITENS')} className="w-full bg-[#4B0082] text-white p-5 rounded-[2rem] font-[1000] uppercase text-xs tracking-widest text-left flex items-center justify-between shadow-lg active:scale-95 transition-transform">
                                                Adicionar ou Trocar Ingrediente <Lucide.PlusCircle size={20} className="text-[#82C91E]"/>
                                            </button>
                                            <button onClick={() => interagirComBot('CANCELAR_PEDIDO')} className="w-full bg-red-50 border-2 border-red-200 text-red-600 p-5 rounded-[2rem] font-[1000] uppercase text-xs tracking-widest text-left flex items-center justify-between active:scale-95 transition-transform">
                                                Cancelar Pedido <Lucide.XCircle size={20}/>
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => interagirComBot('CHAMAR_HUMANO')} className="w-full bg-slate-200 text-slate-700 p-5 rounded-[2rem] font-[1000] uppercase text-xs tracking-widest text-left flex items-center justify-between active:scale-95 transition-transform">
                                        Falar com um Humano (Chat) <Lucide.MessageSquare size={20}/>
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================================
                MODAL 2: SOLICITAR TROCA DE INGREDIENTE (DINÂMICO)
            ======================================================================== */}
            <AnimatePresence>
                {modalTrocaAberto && (
                    <div className="fixed inset-0 z-[5000] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl relative">
                            <button onClick={() => setModalTrocaAberto(false)} className="absolute top-6 right-6 text-slate-400 p-2 active:scale-90"><Lucide.X size={24}/></button>
                            
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner">
                                <Lucide.RefreshCcw size={32} strokeWidth={2.5}/>
                            </div>
                            
                            <h3 className="text-2xl font-[1000] text-[#4B0082] uppercase italic tracking-tighter mb-2">Trocar Ingrediente</h3>
                            <p className="text-xs font-bold text-slate-500 mb-6 leading-relaxed">A cozinha ainda está preparando seu pedido. O que você gostaria de alterar? (Sujeito à disponibilidade).</p>
                            
                            <form onSubmit={enviarSolicitacaoTroca}>
                                <textarea 
                                    value={textoTroca} 
                                    onChange={(e) => setTextoTroca(e.target.value)} 
                                    placeholder="Ex: Pode trocar o leite condensado por mel?"
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 min-h-[120px] resize-none mb-6 transition-colors"
                                    required
                                />
                                <button type="submit" disabled={processandoTroca || !textoTroca.trim()} className="w-full py-5 bg-amber-400 disabled:bg-slate-200 text-[#4B0082] disabled:text-slate-400 rounded-[2rem] font-[1000] uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2">
                                    {processandoTroca ? <Lucide.Loader2 size={20} className="animate-spin"/> : 'Enviar Solicitação p/ Loja'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}