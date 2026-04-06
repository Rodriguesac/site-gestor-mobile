import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, where, addDoc } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone do Mapa
const iconPin = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background: #EA1D2C; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #FFF; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`
});

export default function GestorMobileV21() {
    // --- ESTADOS DE NAVEGAÇÃO E MENU ---
    const [telaAtual, setTelaAtual] = useState('PEDIDOS'); // PEDIDOS | HISTORICO | CARDAPIO
    const [menuAberto, setMenuAberto] = useState(false);
    
    // --- ESTADOS DE PEDIDOS ---
    const [pedidos, setPedidos] = useState([]);
    const [abaAtiva, setAbaAtiva] = useState('NOVOS'); // NOVOS | FILA | PREPARO | PRONTOS
    
    // --- ESTADOS DO PEDIDO EM TELA CHEIA ---
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const [qtdPedidosCliente, setQtdPedidosCliente] = useState(0);
    const [carregandoStats, setCarregandoStats] = useState(false);
    
    // --- ESTADOS DO CHAT ---
    const [chatAberto, setChatAberto] = useState(false);
    const [mensagens, setMensagens] = useState([]);
    const [novaMsg, setNovaMsg] = useState("");
    const chatEndRef = useRef(null);

    // --- ESTADOS DO CARDÁPIO & HISTÓRICO ---
    const [abaCardapio, setAbaCardapio] = useState('cardapio_acai'); 
    const [itensCardapio, setItensCardapio] = useState([]);
    const [filtroHistorico, setFiltroHistorico] = useState('TODOS'); // TODOS | CONCLUIDOS | CANCELADOS

    // --- CONFIGURAÇÕES E ÁUDIO ---
    const [lojaAberta, setLojaAberta] = useState(true);
    const [alertasAtivos, setAlertasAtivos] = useState(false);
    // V2.1: Novo caminho de áudio
    const audioRef = useRef(new Audio('/assets/som/pedidonovo.wav'));

    // 1. SINCRONIZAÇÃO DE PEDIDOS
    useEffect(() => {
        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }, []);

    // 2. ALERTA SONORO CONTÍNUO (A cada 20 segundos)
    useEffect(() => {
        let intervaloSom;
        const pendentes = pedidos.filter(p => p.status === 'PENDENTE');
        
        if (alertasAtivos && pendentes.length > 0) {
            // Toca imediatamente
            audioRef.current.play().catch(() => {});
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            
            // Repete a cada 20 segundos
            intervaloSom = setInterval(() => {
                audioRef.current.play().catch(() => {});
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            }, 20000);
        }
        
        return () => clearInterval(intervaloSom);
    }, [pedidos, alertasAtivos]);

    // 3. AUTO-CANCELAMENTO (5 Minutos)
    useEffect(() => {
        const intervaloCancelamento = setInterval(() => {
            pedidos.filter(p => p.status === 'PENDENTE').forEach(pedido => {
                const minutos = calcularMinutos(pedido.createdAt);
                if (minutos >= 5) {
                    moverStatus(pedido, 'CANCELADO', 'horarioConcluido');
                    // Opcional: Enviar mensagem de cancelamento automático
                    addDoc(collection(db, "pedidos", pedido.id, "chat"), { 
                        texto: "Pedido cancelado automaticamente por falta de resposta da loja no tempo limite (5 min). Pedimos desculpa pelo transtorno.", 
                        remetente: "loja", 
                        timestamp: serverTimestamp() 
                    });
                }
            });
        }, 30000); // Verifica a cada 30 segundos
        return () => clearInterval(intervaloCancelamento);
    }, [pedidos]);

    // 4. SINCRONIZAÇÃO DO CHAT DO PEDIDO ABERTO
    useEffect(() => {
        if (!detalhesPedido) return;
        const qChat = query(collection(db, "pedidos", detalhesPedido.id, "chat"), orderBy("timestamp", "asc"));
        const unsubChat = onSnapshot(qChat, (snap) => {
            setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubChat();
    }, [detalhesPedido]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, chatAberto]);

    // 5. ESTATÍSTICAS DO CLIENTE
    useEffect(() => {
        const buscarHistorico = async () => {
            if (detalhesPedido && detalhesPedido.cliente?.uid) {
                setCarregandoStats(true);
                try {
                    const q = query(collection(db, "pedidos"), where("cliente.uid", "==", detalhesPedido.cliente.uid));
                    const snap = await getDocs(q);
                    setQtdPedidosCliente(snap.size);
                } catch (e) { console.error(e); }
                finally { setCarregandoStats(false); }
            } else { setQtdPedidosCliente(0); }
        };
        buscarHistorico();
    }, [detalhesPedido]);

    // 6. SINCRONIZAÇÃO DO CARDÁPIO (Pausa Rápida)
    useEffect(() => {
        if (telaAtual !== 'CARDAPIO') return;
        const q = query(collection(db, abaCardapio), orderBy("ordem", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            setItensCardapio(snap.docs.map(d => ({ id: d.id, nome: d.data().nome || d.data().n || d.id, disponivel: d.data().disponivel ?? true, ...d.data() })));
        });
        return () => unsub();
    }, [telaAtual, abaCardapio]);

    // --- FUNÇÕES AUXILIARES ---
    const navegarPara = (tela) => {
        setTelaAtual(tela);
        setMenuAberto(false);
    };

    const calcularMinutos = (data) => {
        if (!data) return 0;
        const dateObj = data.toDate ? data.toDate() : new Date(data);
        return Math.floor((new Date() - dateObj) / 60000);
    };

    const getPedidosFiltrados = () => {
        if (abaAtiva === 'NOVOS') return pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status));
        if (abaAtiva === 'FILA') return pedidos.filter(p => p.status === 'FILA');
        if (abaAtiva === 'PREPARO') return pedidos.filter(p => p.status === 'EM_PREPARO');
        if (abaAtiva === 'PRONTOS') return pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status));
        return [];
    };

    const getPedidosHistorico = () => {
        let concluidos = pedidos.filter(p => p.status === 'CONCLUIDO' || p.status === 'CANCELADO').reverse();
        if (filtroHistorico === 'CONCLUIDOS') return concluidos.filter(p => p.status === 'CONCLUIDO');
        if (filtroHistorico === 'CANCELADOS') return concluidos.filter(p => p.status === 'CANCELADO');
        return concluidos;
    };

    const moverStatus = async (pedido, statusForcado = null, logForcado = null) => {
        const fluxo = {
            'PENDENTE': { status: 'FILA', log: 'horarioAceito' },
            'FILA': { status: 'EM_PREPARO', log: 'horarioPreparo' },
            'EM_PREPARO': { status: 'PRONTO', log: 'horarioPronto' },
            'PRONTO': { status: 'SAIU_ENTREGA', log: 'horarioEntrega' },
            'SAIU_ENTREGA': { status: 'CONCLUIDO', log: 'horarioConcluido' }
        };
        const config = statusForcado ? { status: statusForcado, log: logForcado } : fluxo[pedido.status];
        if (config) {
            if (navigator.vibrate) navigator.vibrate(60);
            await updateDoc(doc(db, "pedidos", pedido.id), { status: config.status, [config.log]: serverTimestamp() });
            setDetalhesPedido(null); 
        }
    };

    // CORREÇÃO: Força a atualização do campo 'disponivel' seja qual for o documento
    const alternarDisponibilidade = async (item) => {
        if (navigator.vibrate) navigator.vibrate(40);
        try {
            await updateDoc(doc(db, abaCardapio, item.id), { disponivel: !item.disponivel });
        } catch (error) {
            console.error("Erro ao pausar item:", error);
            alert("Erro ao pausar. Verifique se a categoria está correta no banco.");
        }
    };

    const enviarMensagemChat = async (e) => {
        e.preventDefault();
        if (!novaMsg.trim() || !detalhesPedido) return;
        await addDoc(collection(db, "pedidos", detalhesPedido.id, "chat"), { texto: novaMsg, remetente: "loja", timestamp: serverTimestamp() });
        setNovaMsg("");
    };

    const informarFaltaItem = async (item) => {
        const nomeItem = item.detalhes?.tamanho || item.tamanho || "Item";
        const base = item.detalhes?.baseNome || item.baseNome || "";
        const msg = `⚠️ Olá! Infelizmente o item "${nomeItem} ${base}" está em falta no momento. Gostaria de substituir por outra opção ou prefere cancelar este item?`;
        
        await addDoc(collection(db, "pedidos", detalhesPedido.id, "chat"), { texto: msg, remetente: "loja", timestamp: serverTimestamp() });
        setChatAberto(true); // Abre o chat logo após enviar
    };

    const formatarDataHora = (timestamp) => {
        if (!timestamp) return { data: '--/--', hora: '--:--' };
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return {
            data: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
            hora: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const copiarEndereco = (end) => {
        navigator.clipboard.writeText(`${end.rua}, ${end.numero} - ${end.bairro}. ${end.complemento}`);
        alert("Endereço copiado!");
    };
    
    const abrirMaps = (end) => {
        const query = encodeURIComponent(`${end.rua}, ${end.numero} - ${end.bairro}, Campo Grande`);
        window.open(`http://maps.google.com/?q=${query}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans pb-24 text-slate-900">
            
            {/* MENU LATERAL (DRAWER) */}
            <AnimatePresence>
                {menuAberto && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-black/60 flex">
                        <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: 'spring', damping: 25, stiffness: 250 }} 
                            className="w-4/5 max-w-[300px] bg-white h-full shadow-2xl flex flex-col">
                            {/* Estética iFood Classic (Vermelho e Branco) */}
                            <div className="p-6 bg-[#EA1D2C] text-white">
                                <h2 className="text-xl font-bold uppercase">Gestor de Pedidos</h2>
                                <p className="text-[10px] font-medium tracking-widest uppercase opacity-80 mt-1">Versão 2.1 - Rodrigues</p>
                            </div>
                            <div className="flex-1 p-4 space-y-2">
                                <button onClick={() => navegarPara('PEDIDOS')} className={`w-full flex items-center gap-4 p-4 rounded-lg font-bold uppercase text-sm transition-all ${telaAtual === 'PEDIDOS' ? 'bg-red-50 text-[#EA1D2C]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.ShoppingBag size={20} /> Pedidos Ativos
                                </button>
                                <button onClick={() => navegarPara('HISTORICO')} className={`w-full flex items-center gap-4 p-4 rounded-lg font-bold uppercase text-sm transition-all ${telaAtual === 'HISTORICO' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.History size={20} /> Histórico
                                </button>
                                <button onClick={() => navegarPara('CARDAPIO')} className={`w-full flex items-center gap-4 p-4 rounded-lg font-bold uppercase text-sm transition-all ${telaAtual === 'CARDAPIO' ? 'bg-red-50 text-[#EA1D2C]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.ToggleLeft size={20} /> Disponibilidade
                                </button>
                            </div>
                            <button onClick={() => setMenuAberto(false)} className="m-4 p-4 bg-slate-100 text-slate-600 rounded-lg font-bold uppercase text-sm">Fechar Menu</button>
                        </motion.div>
                        <div className="flex-1" onClick={() => setMenuAberto(false)} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER GESTOR V2.1 (Estilo App Original) */}
            <header className="bg-[#EA1D2C] text-white sticky top-0 z-[100] shadow-md">
                {!alertasAtivos && telaAtual === 'PEDIDOS' && (
                    <button onClick={() => { setAlertasAtivos(true); audioRef.current.play().catch(()=>{}); }} className="w-full bg-white text-[#EA1D2C] p-2 flex items-center justify-center gap-2 font-bold uppercase text-xs animate-pulse">
                        <Lucide.VolumeX size={16} /> Toque para ativar Alertas
                    </button>
                )}
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMenuAberto(true)} className="p-1 active:scale-95 transition-all text-white">
                            <Lucide.Menu size={28} />
                        </button>
                        <h1 className="font-bold text-lg leading-none">
                            {telaAtual === 'PEDIDOS' ? 'Pedidos' : telaAtual === 'HISTORICO' ? 'Histórico' : 'Cardápio'}
                        </h1>
                    </div>
                    {telaAtual === 'PEDIDOS' && (
                        <button onClick={() => setLojaAberta(!lojaAberta)} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase bg-white ${lojaAberta ? 'text-green-600' : 'text-red-600'}`}>
                            {lojaAberta ? 'Loja Aberta' : 'Loja Fechada'}
                        </button>
                    )}
                </div>

                {/* ABAS DINÂMICAS V2.1 */}
                {telaAtual === 'PEDIDOS' && (
                    <div className="flex bg-[#EA1D2C] px-2">
                        {[
                            { id: 'NOVOS', label: 'Novos', count: pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status)).length },
                            { id: 'FILA', label: 'Fila', count: pedidos.filter(p => p.status === 'FILA').length },
                            { id: 'PREPARO', label: 'Preparo', count: pedidos.filter(p => p.status === 'EM_PREPARO').length },
                            { id: 'PRONTOS', label: 'Prontos', count: pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status)).length }
                        ].map(aba => (
                            <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} 
                                className={`flex-1 py-3 text-[11px] font-bold uppercase transition-all border-b-4 flex flex-col items-center gap-1
                                ${abaAtiva === aba.id ? 'border-white text-white' : 'border-transparent text-white/70'}`}>
                                {aba.label}
                                {aba.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${abaAtiva === aba.id ? 'bg-white text-[#EA1D2C]' : 'bg-white/20 text-white'}`}>{aba.count}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {telaAtual === 'CARDAPIO' && (
                    <div className="flex overflow-x-auto no-scrollbar bg-[#EA1D2C] px-2">
                        {[
                            {id:'cardapio_acai', label:'Tamanhos'}, {id:'bases', label:'Bases'}, 
                            {id:'acompanhamentos_gratis', label:'Grátis'}, {id:'adicionais', label:'Add'}, {id:'coberturas', label:'Caldas'}
                        ].map(sub => (
                            <button key={sub.id} onClick={() => setAbaCardapio(sub.id)} 
                                className={`shrink-0 px-4 py-3 text-[11px] font-bold uppercase transition-all border-b-4 ${abaCardapio === sub.id ? 'border-white text-white' : 'border-transparent text-white/70'}`}>
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
                        {getPedidosFiltrados().length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center opacity-40">
                                <Lucide.CheckCircle size={50} className="mx-auto text-slate-400 mb-3" />
                                <p className="font-bold uppercase text-slate-500 text-sm">Nenhum pedido aqui</p>
                            </motion.div>
                        ) : (
                            getPedidosFiltrados().map((pedido) => {
                                const minutos = calcularMinutos(pedido.createdAt);
                                const isAtrasado = minutos > 10;
                                const isAguardandoPagamento = pedido.status === 'AGUARDANDO_PAGAMENTO';

                                return (
                                    <motion.div key={pedido.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                        className={`bg-white rounded-lg shadow-sm border-l-4 overflow-hidden ${abaAtiva === 'NOVOS' ? 'border-[#EA1D2C]' : abaAtiva === 'PRONTOS' ? 'border-green-500' : 'border-amber-500'}`}>
                                        <div className="p-4" onClick={() => setDetalhesPedido(pedido)}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-slate-500 text-xs font-bold">#{pedido.id.slice(-4).toUpperCase()}</span>
                                                <span className={`text-xs font-bold flex items-center gap-1 ${isAtrasado && abaAtiva === 'NOVOS' ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}><Lucide.Clock size={12}/> {minutos} min</span>
                                            </div>
                                            <h2 className="text-lg font-bold text-slate-800 leading-tight truncate">{pedido.cliente?.nome || 'Balcão'}</h2>
                                            {isAguardandoPagamento && <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Aguardando Pagamento</p>}
                                        </div>
                                        {/* Botões de Ação Rápida */}
                                        {abaAtiva !== 'NOVOS' && (
                                            <div className="px-4 pb-4">
                                                <button onClick={() => moverStatus(pedido)} className={`w-full py-3 rounded text-sm font-bold text-white uppercase active:scale-95 transition-all ${abaAtiva === 'FILA' ? 'bg-amber-500' : abaAtiva === 'PREPARO' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                                    {abaAtiva === 'FILA' ? 'Iniciar Preparo' : abaAtiva === 'PREPARO' ? 'Marcar como Pronto' : 'Despachar Pedido'}
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                )}

                {/* --- TELA: HISTÓRICO DE CONCLUÍDOS --- */}
                {telaAtual === 'HISTORICO' && (
                    <div className="space-y-4">
                        {/* Filtros de Histórico */}
                        <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm">
                            {['TODOS', 'CONCLUIDOS', 'CANCELADOS'].map(f => (
                                <button key={f} onClick={() => setFiltroHistorico(f)} className={`flex-1 py-2 rounded text-[10px] font-bold uppercase ${filtroHistorico === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{f}</button>
                            ))}
                        </div>
                        {getPedidosHistorico().map(pedido => (
                            <div key={pedido.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-slate-300 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-slate-500">#{pedido.id.slice(-4).toUpperCase()}</p>
                                    <h4 className="text-sm font-bold text-slate-800">{pedido.cliente?.nome || 'Cliente'}</h4>
                                    <p className={`text-[10px] font-bold uppercase mt-1 ${pedido.status === 'CANCELADO' ? 'text-red-500' : 'text-green-500'}`}>{pedido.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-800">R$ {pedido.valores?.total?.toFixed(2).replace('.', ',')}</p>
                                    <button onClick={() => setDetalhesPedido(pedido)} className="text-[10px] font-bold text-[#EA1D2C] uppercase mt-2">Detalhes</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- TELA: CARDÁPIO (PAUSA RÁPIDA) --- */}
                {telaAtual === 'CARDAPIO' && (
                    <div className="space-y-2">
                        {itensCardapio.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                                <h4 className={`text-sm font-bold flex-1 ${item.disponivel ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.nome}</h4>
                                <button 
                                    onClick={() => alternarDisponibilidade(item)}
                                    className={`px-4 py-2 rounded text-xs font-bold uppercase active:scale-95 transition-all w-24 text-center
                                    ${item.disponivel ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                >
                                    {item.disponivel ? 'Ativo' : 'Pausado'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* TELA CHEIA: DETALHES DO PEDIDO V2.1 */}
            <AnimatePresence>
                {detalhesPedido && (
                    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: 'tween', duration: 0.2 }} 
                        className="fixed inset-0 z-[500] bg-[#f5f5f5] flex flex-col overflow-hidden">
                        
                        {/* HEADER DETALHES */}
                        <header className="bg-white border-b border-slate-200 p-4 flex items-center gap-4 shadow-sm z-10">
                            <button onClick={() => setDetalhesPedido(null)} className="p-2 text-[#EA1D2C]"><Lucide.ArrowLeft size={24} /></button>
                            <div className="flex-1">
                                <h2 className="font-bold text-slate-800 text-lg">Pedido #{detalhesPedido.id.slice(-4).toUpperCase()}</h2>
                                <p className="text-xs font-medium text-slate-500">
                                    {formatarDataHora(detalhesPedido.createdAt).hora} • {detalhesPedido.tipoPedido}
                                </p>
                            </div>
                            <button onClick={() => window.print()} className="p-2 text-slate-500"><Lucide.Printer size={24}/></button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                            
                            {/* DADOS DO CLIENTE & CHAT */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-800 mb-1">{detalhesPedido.cliente?.nome}</h3>
                                <p className="text-xs text-slate-500 mb-3">{qtdPedidosCliente} pedidos realizados</p>
                                
                                <div className="flex gap-2">
                                    <button onClick={() => setChatAberto(true)} className="flex-1 py-2 bg-slate-100 text-slate-800 rounded font-bold text-xs flex items-center justify-center gap-2 border border-slate-300">
                                        <Lucide.MessageSquare size={16}/> Chat com Cliente
                                    </button>
                                    <a href={`tel:${detalhesPedido.cliente?.telefone?.replace(/\D/g, '')}`} className="flex-1 py-2 bg-slate-100 text-slate-800 rounded font-bold text-xs flex items-center justify-center gap-2 border border-slate-300">
                                        <Lucide.PhoneCall size={16}/> Ligar
                                    </a>
                                </div>
                            </div>

                            {/* ITENS DO PEDIDO COM BOTÃO DE FALTA */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 space-y-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Itens</h3>
                                {detalhesPedido.itens?.map((it, idx) => (
                                    <div key={idx} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                        <div className="flex gap-3 items-start">
                                            <div className="bg-slate-100 text-slate-800 font-bold px-2 py-1 rounded text-sm">{it.quantidade || 1}x</div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-slate-800">{it.detalhes?.tamanho || it.tamanho}</h3>
                                                <h4 className="text-xs font-medium text-slate-600 mb-1">{it.detalhes?.baseNome || it.baseNome}</h4>
                                                
                                                <div className="space-y-1 mt-1">
                                                    {it.detalhes?.cobertura_detalhes && <p className="text-[11px] text-slate-500">+ Cobertura: {it.detalhes.cobertura_detalhes.nome || it.detalhes.cobertura_detalhes}</p>}
                                                    {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => <p key={i} className="text-[11px] text-slate-500">+ {ad.qtd}x {ad.nome}</p>)}
                                                </div>
                                                {it.observacao && <div className="mt-2 bg-amber-50 p-2 rounded text-[11px] text-amber-800">Obs: {it.observacao}</div>}
                                                
                                                {/* BOTÃO PREMIUM: AVISAR FALTA */}
                                                {['PENDENTE', 'FILA', 'EM_PREPARO'].includes(detalhesPedido.status) && (
                                                    <button onClick={() => informarFaltaItem(it)} className="mt-2 text-[10px] font-bold text-[#EA1D2C] underline flex items-center gap-1">
                                                        <Lucide.AlertTriangle size={12}/> Informar Falta ou Substituir
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* LOGÍSTICA & MAPA */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Entrega</h3>
                                {detalhesPedido.tipoPedido === 'ENTREGA' ? (
                                    <>
                                        <p className="text-sm font-bold text-slate-800">{detalhesPedido.endereco?.rua}, {detalhesPedido.endereco?.numero}</p>
                                        <p className="text-xs text-slate-500">{detalhesPedido.endereco?.bairro} {detalhesPedido.endereco?.complemento && `• ${detalhesPedido.endereco.complemento}`}</p>
                                        
                                        {detalhesPedido.endereco?.latlng?.lat && (
                                            <div className="h-24 w-full mt-3 rounded border border-slate-200 relative pointer-events-none">
                                                <MapContainer center={[detalhesPedido.endereco.latlng.lat, detalhesPedido.endereco.latlng.lng]} zoom={15} zoomControl={false} dragging={false} touchZoom={false} style={{ height: '100%', width: '100%' }}>
                                                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                                    <Marker position={[detalhesPedido.endereco.latlng.lat, detalhesPedido.endereco.latlng.lng]} icon={iconPin} />
                                                </MapContainer>
                                            </div>
                                        )}

                                        <div className="flex gap-2 mt-3">
                                            <button onClick={() => copiarEndereco(detalhesPedido.endereco)} className="flex-1 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-600 text-center">Copiar</button>
                                            <button onClick={() => abrirMaps(detalhesPedido.endereco)} className="flex-1 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-blue-600 text-center">Ver Mapa</button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm font-bold text-slate-800">Retirada no Balcão</p>
                                )}
                            </div>

                            {/* VALORES */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Total</p>
                                    <p className="text-xs text-slate-500">{detalhesPedido.pagamento?.metodo}</p>
                                </div>
                                <span className="text-lg font-bold text-slate-800">R$ {detalhesPedido.valores?.total?.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>

                        {/* RODAPÉ DE AÇÕES */}
                        <footer className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-slate-200 z-50">
                            {detalhesPedido.status === 'PENDENTE' || detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? (
                                <div className="flex gap-2">
                                    <button disabled={detalhesPedido.status === 'AGUARDANDO_PAGAMENTO'} onClick={() => moverStatus(detalhesPedido, 'FILA', 'horarioAceito')} className={`flex-1 py-3 rounded font-bold text-sm text-white ${detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? 'bg-slate-300' : 'bg-[#EA1D2C]'}`}>
                                        {detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? 'Aguardando Pagamento' : 'Confirmar Pedido'}
                                    </button>
                                    <button onClick={() => { if(window.confirm("Cancelar pedido?")) moverStatus(detalhesPedido, 'CANCELADO', 'horarioConcluido'); }} className="px-4 py-3 bg-white border border-red-200 text-[#EA1D2C] rounded font-bold text-sm">Cancelar</button>
                                </div>
                            ) : (
                                <button onClick={() => moverStatus(detalhesPedido)} className={`w-full py-3 rounded font-bold text-sm text-white ${detalhesPedido.status === 'FILA' ? 'bg-amber-500' : detalhesPedido.status === 'EM_PREPARO' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                    {detalhesPedido.status === 'FILA' ? 'Iniciar Preparo' : detalhesPedido.status === 'EM_PREPARO' ? 'Marcar como Pronto' : 'Despachar / Concluir'}
                                </button>
                            )}
                        </footer>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL DE CHAT (ALTO CONTRASTE V2.1) */}
            <AnimatePresence>
                {chatAberto && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-[1000] bg-[#F5F5F5] flex flex-col">
                        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm">
                            <h3 className="font-bold text-slate-800 text-base">Chat com {detalhesPedido?.cliente?.nome}</h3>
                            <button onClick={() => setChatAberto(false)} className="p-2 text-slate-500"><Lucide.ChevronDown size={24}/></button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F5]">
                            {mensagens.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.remetente === 'loja' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] p-3 text-sm shadow-sm ${msg.remetente === 'loja' ? 'bg-[#EA1D2C] text-white rounded-t-xl rounded-bl-xl' : 'bg-white text-slate-800 border border-slate-200 rounded-t-xl rounded-br-xl'}`}>
                                        {msg.texto}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 mx-1">{formatarDataHora(msg.timestamp).hora}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={enviarMensagemChat} className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center">
                            <input value={novaMsg} onChange={e => setNovaMsg(e.target.value)} placeholder="Escreva uma mensagem..." className="flex-1 bg-slate-100 px-4 py-3 rounded-full text-sm outline-none border border-transparent focus:border-slate-300 text-slate-800"/>
                            <button type="submit" className="bg-[#EA1D2C] text-white p-3 rounded-full flex items-center justify-center"><Lucide.Send size={18}/></button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}