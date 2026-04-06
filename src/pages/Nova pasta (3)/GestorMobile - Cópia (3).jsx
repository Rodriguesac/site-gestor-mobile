import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, where, addDoc } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone do Mapa estilo Premium Rodrigues
const iconPin = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background: #4B0082; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #82C91E; box-shadow: 0 0 12px rgba(0,0,0,0.4);"></div>`
});

export default function GestorRodriguesV23() {
    // --- ESTADOS DE SISTEMA NATIVO ---
    const [sistemaIniciado, setSistemaIniciado] = useState(false);
    
    // --- ESTADOS COM PERSISTÊNCIA (LocalStorage) ---
    const [telaAtual, setTelaAtual] = useState(() => localStorage.getItem('tela_r') || 'PEDIDOS');
    const [abaAtiva, setAbaAtiva] = useState(() => localStorage.getItem('aba_r') || 'NOVOS');
    
    // --- DADOS DO BANCO ---
    const [pedidos, setPedidos] = useState([]);
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const [qtdPedidosCliente, setQtdPedidosCliente] = useState(0);
    
    // --- CHAT E CARDÁPIO ---
    const [chatAberto, setChatAberto] = useState(false);
    const [mensagens, setMensagens] = useState([]);
    const [novaMsg, setNovaMsg] = useState("");
    const chatEndRef = useRef(null);
    const [abaCardapio, setAbaCardapio] = useState('cardapio_acai'); 
    const [itensCardapio, setItensCardapio] = useState([]);

    // --- ÁUDIO E WAKE LOCK ---
    const audioRef = useRef(new Audio('/assets/som/pedidonovo.wav'));
    const wakeLockRef = useRef(null);

    // SALVAR NAVEGAÇÃO PARA NÃO PERDER AO ATUALIZAR
    useEffect(() => {
        localStorage.setItem('tela_r', telaAtual);
        localStorage.setItem('aba_r', abaAtiva);
    }, [telaAtual, abaAtiva]);

    // 1. INICIAR SISTEMA TÁTICO (Desbloqueia APIS Nativas do Android)
    const iniciarExpediente = async () => {
        try {
            // 1. Pede permissão de Notificação Push
            if ("Notification" in window && Notification.permission !== "granted") {
                await Notification.requestPermission();
            }
            
            // 2. Trava a tela para não apagar (Wake Lock)
            if ("wakeLock" in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request("screen");
            }

            // 3. Desbloqueia o Áudio (Toca mudo rápido e pausa)
            audioRef.current.play().then(() => {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }).catch(e => console.log("Áudio bloqueado:", e));

            // 4. Vibração de confirmação
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

            setSistemaIniciado(true);
        } catch (error) {
            console.error("Erro ao iniciar APIs Nativas:", error);
            setSistemaIniciado(true); // Inicia mesmo se falhar alguma API
        }
    };

    // 2. SINCRONIZAÇÃO DE PEDIDOS
    useEffect(() => {
        if (!sistemaIniciado) return;
        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }, [sistemaIniciado]);

    // 3. MOTOR DE NOTIFICAÇÃO E ÁUDIO (A cada 20s) & AUTO-CANCELAMENTO (5min)
    useEffect(() => {
        if (!sistemaIniciado) return;

        const motorCentral = setInterval(() => {
            const agora = new Date();
            const pendentes = pedidos.filter(p => p.status === 'PENDENTE');

            // --- ALERTA SONORO E PUSH ---
            if (pendentes.length > 0) {
                audioRef.current.play().catch(() => {});
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                
                if (Notification.permission === "granted") {
                    new Notification("Novo Pedido!", { 
                        body: `Você tem ${pendentes.length} pedido(s) aguardando aceite.`,
                        icon: "/pwa-192x192.png" 
                    });
                }
            }

            // --- AUTO CANCELAMENTO ---
            pendentes.forEach(async (p) => {
                const criado = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
                const diffMin = Math.floor((agora - criado) / 60000);
                if (diffMin >= 5) {
                    await updateDoc(doc(db, "pedidos", p.id), { status: 'CANCELADO', logSistema: 'Auto-cancelado após 5 min' });
                    await addDoc(collection(db, "pedidos", p.id, "chat"), { 
                        texto: "Pedido cancelado automaticamente devido ao tempo limite de resposta da loja. Pedimos desculpa pelo inconveniente.", 
                        remetente: "loja", 
                        timestamp: serverTimestamp() 
                    });
                }
            });
        }, 20000); // Executa a cada 20 segundos

        return () => clearInterval(motorCentral);
    }, [pedidos, sistemaIniciado]);

    // 4. SINCRONIZAÇÃO DO CHAT
    useEffect(() => {
        if (!detalhesPedido) return;
        const qChat = query(collection(db, "pedidos", detalhesPedido.id, "chat"), orderBy("timestamp", "asc"));
        const unsubChat = onSnapshot(qChat, (snap) => {
            setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubChat();
    }, [detalhesPedido]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, chatAberto]);

    // 5. SINCRONIZAÇÃO DO CARDÁPIO (Pausa Rápida)
    useEffect(() => {
        if (telaAtual !== 'CARDAPIO' || !sistemaIniciado) return;
        const q = query(collection(db, abaCardapio), orderBy("ordem", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            setItensCardapio(snap.docs.map(d => ({ 
                id: d.id, 
                nome: d.data().nome || d.data().n || d.id, 
                disponivel: d.data().disponivel ?? true, 
                ...d.data() 
            })));
        });
        return () => unsub();
    }, [telaAtual, abaCardapio, sistemaIniciado]);

    // 6. HISTÓRICO DO CLIENTE
    useEffect(() => {
        const buscarFidelidade = async () => {
            if (detalhesPedido && detalhesPedido.cliente?.uid) {
                try {
                    const q = query(collection(db, "pedidos"), where("cliente.uid", "==", detalhesPedido.cliente.uid));
                    const snap = await getDocs(q);
                    setQtdPedidosCliente(snap.size);
                } catch (e) { console.error(e); }
            } else { setQtdPedidosCliente(0); }
        };
        buscarFidelidade();
    }, [detalhesPedido]);

    // --- FUNÇÕES DE AÇÃO ---
    const moverStatus = async (pedido, statusForcado = null, logMsg = null) => {
        const fluxo = { 'PENDENTE': 'FILA', 'FILA': 'EM_PREPARO', 'EM_PREPARO': 'PRONTO', 'PRONTO': 'SAIU_ENTREGA', 'SAIU_ENTREGA': 'CONCLUIDO' };
        const logs = { 'PENDENTE': 'horarioAceito', 'FILA': 'horarioPreparo', 'EM_PREPARO': 'horarioPronto', 'PRONTO': 'horarioEntrega', 'SAIU_ENTREGA': 'horarioConcluido' };
        
        const novoStatus = statusForcado || fluxo[pedido.status];
        const logCampo = logMsg || logs[pedido.status];

        if (novoStatus) {
            if (navigator.vibrate) navigator.vibrate(50);
            await updateDoc(doc(db, "pedidos", pedido.id), { status: novoStatus, [logCampo]: serverTimestamp() });
            setDetalhesPedido(null);
        }
    };

    const alternarDisponibilidade = async (item) => {
        if (navigator.vibrate) navigator.vibrate(40);
        await updateDoc(doc(db, abaCardapio, item.id), { disponivel: !item.disponivel });
    };

    const enviarMensagemChat = async (e) => {
        e.preventDefault();
        if (!novaMsg.trim() || !detalhesPedido) return;
        await addDoc(collection(db, "pedidos", detalhesPedido.id, "chat"), { texto: novaMsg, remetente: "loja", timestamp: serverTimestamp() });
        setNovaMsg("");
    };

    const informarFaltaItem = async (item) => {
        const nomeItem = item.detalhes?.tamanho || item.tamanho || "Item";
        const msg = `⚠️ Olá! Informamos que o item "${nomeItem}" está temporariamente em falta. Gostaria de substituir por outra opção do cardápio?`;
        await addDoc(collection(db, "pedidos", detalhesPedido.id, "chat"), { texto: msg, remetente: "loja", timestamp: serverTimestamp() });
        setChatAberto(true);
    };

    const formatarDataHora = (timestamp) => {
        if (!timestamp) return { data: '--/--', hora: '--:--' };
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return { data: date.toLocaleDateString('pt-BR'), hora: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
    };

    const abrirMapsCampoGrande = (end) => {
        const query = encodeURIComponent(`${end.rua}, ${end.numero} - ${end.bairro}, Campo Grande - MS`);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    };

    // --- TELA DE BLOQUEIO INICIAL (Garante o funcionamento do Áudio) ---
    if (!sistemaIniciado) {
        return (
            <div className="min-h-screen bg-[#4B0082] flex flex-col items-center justify-center p-6">
                <div className="w-24 h-24 bg-[#82C91E] rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(130,201,30,0.4)] animate-pulse">
                    <Lucide.Power size={50} className="text-[#4B0082]" />
                </div>
                <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">Rodrigues <span className="text-[#82C91E]">PRO</span></h1>
                <p className="text-white/70 text-center font-bold text-xs mb-10 max-w-[250px]">Toque abaixo para ativar as permissões nativas de Áudio, Tela e Notificações.</p>
                <button onClick={iniciarExpediente} className="w-full max-w-[300px] py-5 bg-[#82C91E] text-[#4B0082] rounded-2xl font-black text-lg uppercase shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                    INICIAR EXPEDIENTE <Lucide.ArrowRight size={24} />
                </button>
            </div>
        );
    }

    // --- TELA PRINCIPAL V2.3 ---
    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans text-slate-900 pb-24">
            
            {/* HEADER PREMIUM NATIVO */}
            <header className="bg-[#4B0082] text-white sticky top-0 z-[100] shadow-md">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#82C91E] rounded-xl flex items-center justify-center shadow-inner">
                            <Lucide.Store size={22} className="text-[#4B0082]" />
                        </div>
                        <div>
                            <h1 className="font-black text-lg italic uppercase leading-none tracking-tighter">Rodrigues <span className="text-[#82C91E]">PRO</span></h1>
                            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">Gestor V2.3 Nativo</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                        <div className="w-2 h-2 rounded-full bg-[#82C91E] animate-pulse"/>
                        <span className="text-[9px] font-black uppercase text-[#82C91E]">ON</span>
                    </div>
                </div>

                {/* ABAS COM SCROLL HORIZONTAL (SNAP) */}
                {telaAtual === 'PEDIDOS' && (
                    <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory px-2 border-t border-white/10">
                        {[
                            { id: 'NOVOS', label: 'Novos', count: pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status)).length },
                            { id: 'FILA', label: 'Fila', count: pedidos.filter(p => p.status === 'FILA').length },
                            { id: 'PREPARO', label: 'Preparo', count: pedidos.filter(p => p.status === 'EM_PREPARO').length },
                            { id: 'PRONTOS', label: 'Despacho', count: pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status)).length }
                        ].map(aba => (
                            <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} 
                                className={`shrink-0 snap-center px-6 py-4 text-[11px] font-black uppercase tracking-wider transition-all border-b-4 flex items-center gap-2
                                ${abaAtiva === aba.id ? 'border-[#82C91E] text-[#82C91E]' : 'border-transparent text-white/50'}`}>
                                {aba.label} 
                                {aba.count > 0 && <span className={`px-2 py-0.5 rounded-md text-[10px] ${abaAtiva === aba.id ? 'bg-[#82C91E] text-[#4B0082]' : 'bg-white/20 text-white'}`}>{aba.count}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {telaAtual === 'CARDAPIO' && (
                    <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory px-2 border-t border-white/10">
                        {[
                            {id:'cardapio_acai', label:'Tamanhos'}, {id:'bases', label:'Bases'}, 
                            {id:'acompanhamentos_gratis', label:'Grátis'}, {id:'adicionais', label:'Add'}, {id:'coberturas', label:'Caldas'}
                        ].map(sub => (
                            <button key={sub.id} onClick={() => setAbaCardapio(sub.id)} 
                                className={`shrink-0 snap-center px-5 py-4 text-[11px] font-black uppercase tracking-wider transition-all border-b-4 
                                ${abaCardapio === sub.id ? 'border-[#82C91E] text-[#82C91E]' : 'border-transparent text-white/50'}`}>
                                {sub.label}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <main className="p-3 space-y-3">
                {/* --- TELA: PEDIDOS ATIVOS --- */}
                {telaAtual === 'PEDIDOS' && (
                    <AnimatePresence mode='popLayout'>
                        {pedidos.filter(p => {
                            if(abaAtiva === 'NOVOS') return ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status);
                            if(abaAtiva === 'FILA') return p.status === 'FILA';
                            if(abaAtiva === 'PREPARO') return p.status === 'EM_PREPARO';
                            if(abaAtiva === 'PRONTOS') return ['PRONTO', 'SAIU_ENTREGA'].includes(p.status);
                            return false;
                        }).map((pedido) => (
                            <motion.div key={pedido.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => setDetalhesPedido(pedido)}
                                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden active:scale-[0.98] transition-all">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex gap-2 items-center mb-1">
                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">#{pedido.id.slice(-4)}</span>
                                            {pedido.status === 'PENDENTE' && <span className="text-[10px] font-black text-red-500 flex items-center gap-1 animate-pulse"><Lucide.Clock size={10}/> AGUARDANDO</span>}
                                        </div>
                                        <h2 className="text-lg font-black uppercase text-slate-800 leading-none mb-1">{pedido.cliente?.nome || 'Balcão'}</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{pedido.tipoPedido} • {pedido.itens?.length} Item(ns)</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-[#4B0082]">R$ {pedido.valores?.total?.toFixed(2).replace('.', ',')}</p>
                                        <Lucide.ChevronRight size={20} className="text-slate-300 ml-auto mt-2"/>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {/* --- TELA: CARDÁPIO (PAUSA RÁPIDA) --- */}
                {telaAtual === 'CARDAPIO' && (
                    <div className="space-y-3">
                        {itensCardapio.map(item => (
                            <div key={item.id} className={`flex justify-between items-center p-4 rounded-2xl shadow-sm border transition-all ${item.disponivel ? 'bg-white border-slate-200' : 'bg-red-50/50 border-red-100'}`}>
                                <h4 className={`text-sm font-black uppercase ${item.disponivel ? 'text-[#4B0082]' : 'text-slate-400 line-through'}`}>{item.nome}</h4>
                                <button onClick={() => alternarDisponibilidade(item)}
                                    className={`w-24 py-3 rounded-xl font-black uppercase text-[10px] active:scale-95 transition-all
                                    ${item.disponivel ? 'bg-[#82C91E] text-[#4B0082]' : 'bg-red-100 text-red-600 border border-red-200'}`}>
                                    {item.disponivel ? 'Ativo' : 'Pausado'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* BARRA DE NAVEGAÇÃO INFERIOR NATIVA (BOTTOM NAV) */}
            <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center p-2 pb-4 z-[400] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <button onClick={() => setTelaAtual('PEDIDOS')} className={`flex flex-col items-center p-2 w-20 rounded-xl transition-all ${telaAtual === 'PEDIDOS' ? 'text-[#4B0082] bg-purple-50' : 'text-slate-400'}`}>
                    <Lucide.ShoppingBag size={22}/><span className="text-[9px] font-black mt-1">PEDIDOS</span>
                </button>
                <button onClick={() => setTelaAtual('CARDAPIO')} className={`flex flex-col items-center p-2 w-20 rounded-xl transition-all ${telaAtual === 'CARDAPIO' ? 'text-[#4B0082] bg-purple-50' : 'text-slate-400'}`}>
                    <Lucide.ToggleLeft size={22}/><span className="text-[9px] font-black mt-1">CARDÁPIO</span>
                </button>
            </nav>

            {/* TELA CHEIA: DETALHES DO PEDIDO V2.3 */}
            <AnimatePresence>
                {detalhesPedido && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                        className="fixed inset-0 z-[600] bg-[#f5f5f5] flex flex-col overflow-hidden">
                        
                        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
                            <button onClick={() => setDetalhesPedido(null)} className="p-2 text-[#4B0082] bg-purple-50 rounded-full active:scale-95"><Lucide.ChevronDown size={24} /></button>
                            <div className="text-center">
                                <h2 className="font-black text-[#4B0082] text-sm uppercase">Pedido #{detalhesPedido.id.slice(-4)}</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{formatarDataHora(detalhesPedido.createdAt).hora}</p>
                            </div>
                            <button onClick={() => window.print()} className="p-2 text-[#4B0082] bg-purple-50 rounded-full active:scale-95"><Lucide.Printer size={20}/></button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                            {/* INFO CLIENTE & CHAT */}
                            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 mb-1"><Lucide.User size={12}/> Cliente</p>
                                <h3 className="text-xl font-black text-[#4B0082] uppercase">{detalhesPedido.cliente?.nome}</h3>
                                <p className="text-[10px] font-bold text-[#82C91E] uppercase mt-1">⭐ {qtdPedidosCliente} Pedido(s) no histórico</p>
                                
                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => setChatAberto(true)} className="flex-1 py-3 bg-purple-50 text-[#4B0082] rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95">
                                        <Lucide.MessageSquare size={16}/> Chat Interno
                                    </button>
                                    <a href={`tel:${detalhesPedido.cliente?.telefone?.replace(/\D/g, '')}`} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95">
                                        <Lucide.PhoneCall size={16}/> Ligar
                                    </a>
                                </div>
                            </div>

                            {/* LISTA DE ITENS */}
                            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Lucide.IceCream size={12}/> Resumo do Preparo</p>
                                {detalhesPedido.itens?.map((it, idx) => (
                                    <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                        <div className="font-black text-[#4B0082] bg-[#82C91E] w-8 h-8 rounded-xl flex items-center justify-center text-sm">{it.quantidade || 1}x</div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-black uppercase text-[#4B0082] leading-tight">{it.detalhes?.tamanho || it.tamanho}</h3>
                                            <h4 className="text-[11px] font-black uppercase text-slate-500 mb-2">{it.detalhes?.baseNome || it.baseNome}</h4>
                                            <div className="space-y-1">
                                                {it.detalhes?.cobertura_detalhes && <p className="text-[11px] font-bold text-pink-600 uppercase">+ CALDA: {it.detalhes.cobertura_detalhes.nome || it.detalhes.cobertura_detalhes}</p>}
                                                {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => <p key={i} className="text-[11px] font-bold text-slate-600 uppercase">+ {ad.qtd}x {ad.nome}</p>)}
                                            </div>
                                            {it.observacao && <div className="mt-2 bg-amber-50 p-3 rounded-xl text-[10px] font-black text-amber-700 uppercase">OBS: {it.observacao}</div>}
                                            
                                            {/* BOTÃO PREMIUM DE FALTA DE ITEM */}
                                            {['PENDENTE', 'FILA', 'EM_PREPARO'].includes(detalhesPedido.status) && (
                                                <button onClick={() => informarFaltaItem(it)} className="mt-3 py-2 px-3 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 active:scale-95">
                                                    <Lucide.AlertTriangle size={12}/> Avisar falta no Chat
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* MAPA E LOGÍSTICA */}
                            {detalhesPedido.tipoPedido === 'ENTREGA' && (
                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 mb-3"><Lucide.MapPin size={12}/> Logística de Entrega</p>
                                    <p className="text-sm font-black uppercase text-slate-800">{detalhesPedido.endereco?.rua}, {detalhesPedido.endereco?.numero}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{detalhesPedido.endereco?.bairro} {detalhesPedido.endereco?.complemento && `• ${detalhesPedido.endereco.complemento}`}</p>
                                    
                                    {detalhesPedido.endereco?.latlng?.lat && (
                                        <div className="h-32 w-full mt-4 rounded-2xl overflow-hidden border border-slate-200 relative pointer-events-none">
                                            <MapContainer center={[detalhesPedido.endereco.latlng.lat, detalhesPedido.endereco.latlng.lng]} zoom={15} zoomControl={false} dragging={false} touchZoom={false} style={{ height: '100%', width: '100%' }}>
                                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                                <Marker position={[detalhesPedido.endereco.latlng.lat, detalhesPedido.endereco.latlng.lng]} icon={iconPin} />
                                            </MapContainer>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => { navigator.clipboard.writeText(`${detalhesPedido.endereco?.rua}, ${detalhesPedido.endereco?.numero}`); alert("Copiado!"); }} className="flex-1 py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-600 flex items-center justify-center gap-1 active:scale-95"><Lucide.Copy size={16}/> Copiar</button>
                                        <button onClick={() => abrirMapsCampoGrande(detalhesPedido.endereco)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 active:scale-95"><Lucide.Map size={16}/> GPS / Maps</button>
                                    </div>
                                </div>
                            )}

                            {/* PAGAMENTO */}
                            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center mb-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Total a Cobrar</p>
                                    <p className="text-[11px] font-bold text-slate-600 uppercase mt-1">{detalhesPedido.pagamento?.metodo}</p>
                                </div>
                                <span className="text-xl font-black text-[#4B0082]">R$ {detalhesPedido.valores?.total?.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>

                        {/* RODAPÉ DE AÇÃO RÁPIDA (TELA CHEIA) */}
                        <footer className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-slate-200 z-50">
                            {detalhesPedido.status === 'PENDENTE' || detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? (
                                <button disabled={detalhesPedido.status === 'AGUARDANDO_PAGAMENTO'} onClick={() => moverStatus(detalhesPedido, 'FILA', 'horarioAceito')} 
                                    className={`w-full py-4 rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2
                                    ${detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? 'bg-slate-200 text-slate-400' : 'bg-[#4B0082] text-[#82C91E]'}`}>
                                    {detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? 'Aguardando PIX' : 'ACEITAR PEDIDO'} {detalhesPedido.status === 'PENDENTE' && <Lucide.ThumbsUp size={18}/>}
                                </button>
                            ) : (
                                <button onClick={() => moverStatus(detalhesPedido)} 
                                    className="w-full py-4 rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 transition-all bg-[#82C91E] text-[#4B0082] flex items-center justify-center gap-2">
                                    {detalhesPedido.status === 'FILA' ? 'Iniciar Preparo' : detalhesPedido.status === 'EM_PREPARO' ? 'Marcar como Pronto' : 'Avançar Pedido'} <Lucide.ChevronRight size={20} />
                                </button>
                            )}
                        </footer>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL DE CHAT PREMIUM */}
            <AnimatePresence>
                {chatAberto && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[1000] bg-white flex flex-col">
                        <header className="bg-[#4B0082] text-white p-4 flex justify-between items-center shadow-md">
                            <h3 className="font-black uppercase text-sm">Chat: {detalhesPedido?.cliente?.nome}</h3>
                            <button onClick={() => setChatAberto(false)} className="p-2 bg-white/10 rounded-full active:scale-95"><Lucide.ChevronDown size={20}/></button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {mensagens.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.remetente === 'loja' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] p-3 text-[11px] font-bold shadow-sm ${msg.remetente === 'loja' ? 'bg-[#82C91E] text-[#4B0082] rounded-2xl rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm'}`}>
                                        {msg.texto}
                                    </div>
                                    <span className="text-[8px] font-black text-slate-400 mt-1 mx-1 uppercase">{formatarDataHora(msg.timestamp).hora}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={enviarMensagemChat} className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center">
                            <input value={novaMsg} onChange={e => setNovaMsg(e.target.value)} placeholder="Mensagem..." className="flex-1 bg-slate-100 px-4 py-3 rounded-xl text-[11px] font-bold outline-none focus:border-[#4B0082] border border-transparent"/>
                            <button type="submit" className="bg-[#4B0082] text-white p-3 rounded-xl active:scale-95"><Lucide.Send size={20}/></button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}