import React, { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, where, addDoc, deleteDoc } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ============================================================================
// CONFIGURAÇÕES GLOBAIS E GEOFENCING
// ============================================================================
const LOJA_COORDS = { lat: -20.43131, lng: -54.55412 };

const calcularDistanciaKM = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999; 
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
};

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

const formatarDataHora = (data) => {
    if (!data) return '--/--/---- --:--';
    const d = data.toDate ? data.toDate() : new Date(data);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// ============================================================================
// CONFIGURAÇÕES DO MAPA GESTOR
// ============================================================================
const MAPA_STYLE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"; 

// Ícones do Mapa
const storeIcon = L.divIcon({ className: 's-icon', html: `<div class="w-8 h-8 bg-[#4B0082] rounded-full border-2 border-white shadow-lg flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></div>`, iconSize: [32, 32], iconAnchor: [16, 16]});
const userIcon = L.divIcon({ className: 'u-icon', html: `<div class="w-8 h-8 bg-[#EA1D2C] rounded-full border-2 border-white shadow-lg flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`, iconSize: [32, 32], iconAnchor: [16, 32]});

function MapUpdater({ bounds }) {
    const map = useMap();
    useEffect(() => { if (bounds?.length > 0) map.fitBounds(bounds, { padding: [40, 40] }); }, [bounds, map]);
    return null;
}

// Componente que renderiza o mapa (Pode ser estático ou dinâmico)
const MotorDeRastreioGestor = ({ pedido, interativo }) => {
    const lat = pedido.endereco?.lat;
    const lng = pedido.endereco?.lng;
    const bounds = lat ? [[LOJA_COORDS.lat, LOJA_COORDS.lng], [lat, lng]] : [];

    if (!lat) return <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase">Localização não fornecida</div>;

    return (
        <MapContainer center={[LOJA_COORDS.lat, LOJA_COORDS.lng]} zoom={13} zoomControl={interativo} dragging={interativo} scrollWheelZoom={interativo} doubleClickZoom={interativo} touchZoom={interativo} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer url={MAPA_STYLE} />
            <Marker position={[LOJA_COORDS.lat, LOJA_COORDS.lng]} icon={storeIcon} />
            <Marker position={[lat, lng]} icon={userIcon} />
            <MapUpdater bounds={bounds} />
        </MapContainer>
    );
};

// ============================================================================
// SISTEMA DE NOTIFICAÇÕES (TOAST)
// ============================================================================
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-[90%] max-w-sm pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0, x: 50, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 50, scale: 0.9 }}
                            className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-black uppercase tracking-wide text-white border-b-4 
                            ${t.type === 'error' ? 'bg-[#EA1D2C] border-red-900' : t.type === 'success' ? 'bg-[#82C91E] text-[#4B0082] border-green-700' : 'bg-slate-800 border-slate-900'}`}>
                            {t.type === 'error' && <Lucide.AlertOctagon size={28} className="shrink-0" />}
                            {t.type === 'success' && <Lucide.CheckSquare size={28} className="shrink-0" />}
                            {t.type === 'info' && <Lucide.Info size={28} className="shrink-0" />}
                            <div className="flex-1 leading-tight">{t.msg}</div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

// ============================================================================
// NÚCLEO DO SISTEMA GESTOR
// ============================================================================
const GestorLojaContent = () => {
    const toast = useToast();
    
    // Estados
    const [sistemaIniciado, setSistemaIniciado] = useState(false);
    const [telaAtual, setTelaAtual] = useState('COZINHA'); 
    const [abaKanban, setAbaKanban] = useState('NOVOS'); 
    const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
    const [mapaExpandido, setMapaExpandido] = useState(false);

    // Dados do Banco
    const [pedidos, setPedidos] = useState([]);
    const [entregadores, setEntregadores] = useState([]);
    const [leiloes, setLeiloes] = useState([]);
    const [apelidosPendentes, setApelidosPendentes] = useState([]);
    const [itensCardapio, setItensCardapio] = useState([]);
    
    // Controles de Detalhes
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const [abaModal, setAbaModal] = useState('INFO'); 
    const [modalDespacho, setModalDespacho] = useState(null); 
    const [entregadorSelecionado, setEntregadorSelecionado] = useState(""); 
    
    // Controles do Chat e Alterações
    const [mensagens, setMensagens] = useState([]);
    const [novaMsg, setNovaMsg] = useState("");
    const [custoExtraAlteracao, setCustoExtraAlteracao] = useState("");
    const [textoAlerta, setTextoAlerta] = useState("");
    const [abaCardapio, setAbaCardapio] = useState('cardapio_acai'); 

    // Refs
    const chatEndRef = useRef(null);
    const audioRef = useRef(null);
    const audioTrocaRef = useRef(null);
    const wakeLockRef = useRef(null);

    useEffect(() => { 
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
        audioTrocaRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    }, []);

    const iniciarExpediente = async () => {
        try {
            if ("Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
            if ("wakeLock" in navigator) wakeLockRef.current = await navigator.wakeLock.request("screen");
            audioRef.current.play().then(() => { audioRef.current.pause(); audioRef.current.currentTime = 0; }).catch(() => {});
            toast("Sistema Rodrigues Online. Bom trabalho!", "success");
            setSistemaIniciado(true);
        } catch (error) { 
            console.error("Erro ao solicitar permissões", error);
            setSistemaIniciado(true); 
        }
    };

    useEffect(() => {
        if (!sistemaIniciado) return;
        
        const qPedidos = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
        const unsubPedidos = onSnapshot(qPedidos, (snap) => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (lista.some(p => p.solicitacaoAlteracao?.status === 'PENDENTE')) {
                audioTrocaRef.current.play().catch(() => {});
            }
            setPedidos(lista);
        });

        const qEntregadores = query(collection(db, "entregadores"), where("status", "==", "Livre"), where("statusAprovacao", "==", "APROVADO"));
        const unsubEntregadores = onSnapshot(qEntregadores, (snap) => setEntregadores(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qLeiloes = query(collection(db, "leiloes"), where("status", "==", "ATIVO"));
        const unsubLeiloes = onSnapshot(qLeiloes, (snap) => setLeiloes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qApelidos = query(collection(db, "usuarios"), where("leilao_status", "==", "PENDENTE"));
        const unsubApelidos = onSnapshot(qApelidos, (snap) => setApelidosPendentes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubPedidos(); unsubEntregadores(); unsubLeiloes(); unsubApelidos(); };
    }, [sistemaIniciado]);

    useEffect(() => {
        if (telaAtual !== 'CARDAPIO' || !sistemaIniciado) return;
        const q = query(collection(db, abaCardapio), orderBy("ordem", "asc"));
        const unsub = onSnapshot(q, (snap) => setItensCardapio(snap.docs.map(d => ({ 
            id: d.id, 
            nome: d.data().nome || d.data().n || d.id, 
            disponivel: d.data().disponivel ?? true, 
            ...d.data() 
        }))));
        return () => unsub();
    }, [telaAtual, abaCardapio, sistemaIniciado]);

    // Buscar mensagens do chat quando abre um pedido
    useEffect(() => {
        if (!detalhesPedido) return;
        const qChat = query(collection(db, "pedidos", detalhesPedido.id, "chat"), orderBy("timestamp", "asc"));
        const unsubChat = onSnapshot(qChat, (snap) => setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsubChat();
    }, [detalhesPedido]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, abaModal]);

    // Motor de cancelamento automático
    useEffect(() => {
        if (!sistemaIniciado) return;
        const motorCentral = setInterval(() => {
            const agora = new Date();
            const pendentes = pedidos.filter(p => p.status === 'PENDENTE');

            if (pendentes.length > 0) {
                audioRef.current.play().catch(() => {});
                if (Notification.permission === "granted") new Notification("Pedido Novo!", { body: `Existem pedidos aguardando aceite na cozinha.`, icon: "/pwa-192x192.png" });
            }

            pendentes.forEach(async (p) => {
                const criado = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
                if (Math.floor((agora - criado) / 60000) >= 10) { 
                    await updateDoc(doc(db, "pedidos", p.id), { status: 'CANCELADO', logSistema: 'Auto-cancelado após 10 min de ociosidade' });
                    toast(`Pedido #${p.id.slice(-4)} cancelado por estourar o tempo limite de aceite!`, "error");
                }
            });
        }, 20000);
        return () => clearInterval(motorCentral);
    }, [pedidos, sistemaIniciado, toast]);

    const moverStatus = async (pedido, novoStatus) => {
        try {
            let updateData = { status: novoStatus, statusAtualizadoEm: serverTimestamp() };
            if (pedido.status === 'PENDENTE' && (novoStatus === 'FILA' || novoStatus === 'EM_PREPARO')) {
                updateData.codigoEntrega = Math.floor(1000 + Math.random() * 9000).toString();
                toast(`Pedido Aceito! Token: ${updateData.codigoEntrega}`, "success");
            } else {
                toast(`Status atualizado para ${novoStatus.replace('_', ' ')}!`, "success");
            }
            await updateDoc(doc(db, "pedidos", pedido.id), updateData);
            setDetalhesPedido(null);
        } catch (e) { toast("Erro ao mudar status.", "error"); }
    };

    // ========================================================================
    // PROCESSAR ALTERAÇÕES E DESPACHO
    // ========================================================================
    const processarAlteracao = async (pedido, acao) => {
        const { tipo, descricao } = pedido.solicitacaoAlteracao;
        
        try {
            if (acao === 'ACEITAR') {
                if (tipo === 'CANCELAMENTO') {
                    await updateDoc(doc(db, "pedidos", pedido.id), {
                        "solicitacaoAlteracao.status": 'ACEITO',
                        status: 'CANCELADO',
                        motivoCancelamento: descricao
                    });
                    toast("PEDIDO CANCELADO A PEDIDO DO CLIENTE", "success");
                    return;
                }

                const valorAcrescimo = Number(custoExtraAlteracao.replace(',', '.') || 0);
                const novoTotal = (pedido.valores?.total || 0) + valorAcrescimo;

                await updateDoc(doc(db, "pedidos", pedido.id), {
                    "solicitacaoAlteracao.status": 'ACEITO',
                    "solicitacaoAlteracao.custoAdicional": valorAcrescimo,
                    "valores.total": novoTotal,
                    observacao: `⚠️ ALTERADO: ${descricao} (+R$ ${valorAcrescimo.toFixed(2)}) | ` + (pedido.observacao || "")
                });
                
                setCustoExtraAlteracao("");
                toast(`ALTERAÇÃO APLICADA! R$ ${valorAcrescimo} somado ao pedido.`, "success");

            } else {
                await updateDoc(doc(db, "pedidos", pedido.id), {
                    "solicitacaoAlteracao.status": 'RECUSADO'
                });
                toast("SOLICITAÇÃO RECUSADA", "info");
            }
        } catch(error) {
            toast("Erro ao processar solicitação.", "error");
        }
    };

    const despacharPedido = async (pedido, tipoEnvio) => {
        try {
            if (tipoEnvio === 'TORRE') {
                if (entregadores.length === 0) {
                    return toast("Nenhum piloto livre no momento! Tente novamente em alguns segundos.", "error");
                }

                const entregadoresComDistancia = entregadores.map(e => ({
                    ...e,
                    distancia: e.coords ? calcularDistanciaKM(LOJA_COORDS.lat, LOJA_COORDS.lng, e.coords.lat, e.coords.lng) : 999
                })).sort((a, b) => a.distancia - b.distancia);

                const melhorPiloto = entregadoresComDistancia[0]; 

                await updateDoc(doc(db, "pedidos", pedido.id), { 
                    status: 'PRONTO', 
                    statusDespacho: 'OFERTA_INDIVIDUAL', 
                    entregadorAtualOferta: melhorPiloto.id, 
                    tentativasOferta: 1,
                    statusAtualizadoEm: serverTimestamp() 
                });
                
                toast(`Despachado! Tocando no radar do piloto ${melhorPiloto.nome.split(' ')[0]} (A ${melhorPiloto.distancia.toFixed(1)}km)`, "success");

            } else if (tipoEnvio === 'DIRETO') {
                if (!entregadorSelecionado) return toast("Você deve selecionar um piloto da lista para o despacho manual!", "error");
                
                await updateDoc(doc(db, "pedidos", pedido.id), { 
                    status: 'SAIU_ENTREGA', 
                    statusDespacho: 'Atribuído Manualmente', 
                    entregadorId: entregadorSelecionado, 
                    statusAtualizadoEm: serverTimestamp() 
                });
                
                await updateDoc(doc(db, "entregadores", entregadorSelecionado), { status: 'Em Rota' });
                toast("Piloto vinculado e pacote despachado!", "success");
                setEntregadorSelecionado("");
                
            } else if (tipoEnvio === 'BALCAO') {
                await updateDoc(doc(db, "pedidos", pedido.id), { 
                    status: 'PRONTO', 
                    statusDespacho: 'Aguardando Cliente Balcão', 
                    statusAtualizadoEm: serverTimestamp() 
                });
                toast("Disponível no Balcão para Retirada!", "success");
            }
            
            setModalDespacho(null); 
            setDetalhesPedido(null); 
            setAbaKanban('EXPEDICAO');
            
        } catch (e) { 
            console.error("Erro no despacho", e);
            toast("Erro de comunicação com os pilotos.", "error"); 
        }
    };

    const enviarParaLeilao = async (pedido) => {
        if (!window.confirm("CONFIRMAÇÃO: O copo já está fisicamente na loja? Se sim, ele será ofertado para o público geral no Leilão.")) return;
        
        try {
            await addDoc(collection(db, "leiloes"), {
                pedidoOriginalId: pedido.id,
                itens: pedido.itens,
                lanceAtual: (pedido.valores.total * 0.4),
                lanceFinal: null,
                ultimoLicitante: null,
                expiraEm: new Date(Date.now() + 5 * 60000), 
                status: 'ATIVO',
                criadoEm: serverTimestamp()
            });
            
            await updateDoc(doc(db, "pedidos", pedido.id), { status: 'LEILOADO', logSistema: 'Transformado em Leilão por Retorno' });
            toast("Copo enviado para o Leilão Público com sucesso!", "success");
            setTelaAtual('LEILAO');
        } catch (e) { 
            console.error(e);
            toast("Erro crítico ao criar leilão no banco de dados.", "error"); 
        }
    };

    const gerenciarApelido = async (userId, acao) => {
        try {
            await updateDoc(doc(db, "usuarios", userId), { 
                leilao_status: acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO' 
            });
            toast(`Apelido do cliente ${acao === 'APROVAR' ? 'Validado' : 'Recusado'} no sistema!`, "info");
        } catch (e) { 
            toast("Erro de rede na aprovação", "error"); 
        }
    };

    const alternarDisponibilidade = async (item) => {
        try {
            await updateDoc(doc(db, abaCardapio, item.id), { disponivel: !item.disponivel });
            toast(`Ingrediente ${item.nome} ${!item.disponivel ? 'REATIVADO' : 'PAUSADO'} no App do Cliente!`, "info");
        } catch (e) { toast("Erro ao atualizar estoque.", "error"); }
    };

    // ========================================================================
    // ALERTAS E CHAT
    // ========================================================================
    const dispararAlerta = async (pedido) => {
        if(!textoAlerta.trim()) return toast("Digite uma mensagem primeiro!", "error");
        try {
            await updateDoc(doc(db, "pedidos", pedido.id), { alertaLoja: textoAlerta });
            toast("Alerta enviado ao aplicativo do cliente!", "success");
            setTextoAlerta("");
        } catch (error) {
            toast("Erro ao enviar alerta.", "error");
        }
    };

    const removerAlerta = async (pedido) => {
        try {
            await updateDoc(doc(db, "pedidos", pedido.id), { alertaLoja: null });
            toast("Alerta retirado.", "info");
        } catch (error) {
            toast("Erro ao remover.", "error");
        }
    };

    const enviarMensagemChat = async (e) => {
        e.preventDefault();
        if (!novaMsg.trim() || !detalhesPedido) return;
        await addDoc(collection(db, "pedidos", detalhesPedido.id, "chat"), { 
            texto: novaMsg, 
            remetente: "loja", 
            timestamp: serverTimestamp() 
        });
        setNovaMsg("");
    };

    const calcularMinutos = (data) => {
        if (!data) return 0;
        const inicio = data.toDate ? data.toDate() : new Date(data);
        return Math.floor((new Date() - inicio) / 60000);
    };

    const pedidosDoDiaSelecionado = pedidos.filter(p => {
        if (!p.createdAt) return false;
        const dFogo = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        const dFiltro = new Date(dataFiltro + 'T12:00:00'); 
        return dFogo.getDate() === dFiltro.getDate() && 
               dFogo.getMonth() === dFiltro.getMonth() && 
               dFogo.getFullYear() === dFiltro.getFullYear();
    });

    const vendasConcluidas = pedidosDoDiaSelecionado.filter(p => p.status === 'CONCLUIDO');
    
    const metricas = {
        totalFaturamento: vendasConcluidas.reduce((acc, p) => acc + (p.valores?.total || 0), 0),
        qtdVendas: vendasConcluidas.length,
        ticketMedio: vendasConcluidas.length > 0 ? (vendasConcluidas.reduce((acc, p) => acc + (p.valores?.total || 0), 0) / vendasConcluidas.length) : 0,
        dinheiro: vendasConcluidas.filter(p => p.pagamento?.metodo?.toUpperCase().includes('DINHEIRO')).length,
        pix: vendasConcluidas.filter(p => p.pagamento?.metodo?.toUpperCase().includes('PIX')).length,
        cartao: vendasConcluidas.filter(p => p.pagamento?.metodo?.toUpperCase().includes('CARTÃO') || p.pagamento?.metodo?.toUpperCase().includes('MAQUININHA')).length,
    };

    // Card Resumido do Kanban
    const CardPedido = ({ pedido }) => (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => setDetalhesPedido(pedido)} 
            className={`bg-white p-6 rounded-[2.5rem] shadow-lg border-2 active:scale-[0.98] transition-transform relative overflow-hidden
            ${pedido.observacaoSOS ? 'border-red-500 shadow-red-500/20 animate-pulse' : 'border-slate-100 hover:border-[#82C91E]'}`}>
            
            {pedido.observacaoSOS && <div className="absolute top-0 left-0 w-full h-2 bg-red-600"/>}
            {pedido.alertaLoja && <div className="absolute top-0 left-0 w-full h-2 bg-blue-500 animate-pulse"/>}
            {pedido.solicitacaoAlteracao?.status === 'PENDENTE' && <div className="absolute top-0 left-0 w-full h-2 bg-amber-400 animate-pulse"/>}

            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
                        <Lucide.Hash size={12}/> Pedido {pedido.id.slice(-4)}
                    </p>
                    <h4 className="font-[1000] text-xl text-[#4B0082] uppercase truncate max-w-[200px] italic leading-none mt-1">
                        {pedido.cliente?.nome || 'Balcão Físico'}
                    </h4>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-[1000] uppercase tracking-widest px-3 py-1 rounded-lg ${pedido.observacaoSOS ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {calcularMinutos(pedido.createdAt)} min
                    </span>
                    {pedido.codigoEntrega && (
                        <span className="text-[8px] font-black text-white bg-[#82C91E] px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <Lucide.Lock size={8}/> Token Gerado
                        </span>
                    )}
                </div>
            </div>

            {pedido.observacaoSOS && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl mb-4">
                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <Lucide.Siren size={14}/> Emergência na Rota
                    </h4>
                    <p className="text-xs font-bold text-red-800">{pedido.observacaoSOS}</p>
                </div>
            )}

            {pedido.solicitacaoAlteracao?.status === 'PENDENTE' && (
                <div className="bg-amber-50 border border-amber-300 p-2 rounded-xl flex items-center gap-1 mb-2">
                    <Lucide.AlertCircle size={14} className="text-amber-600" />
                    <p className="text-[10px] font-black text-amber-600 uppercase">Solicitação Pendente!</p>
                </div>
            )}
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-5">
                <p className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <span className="text-[#4B0082] font-[1000]">{pedido.itens?.length} Itens</span> na lista
                </p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{pedido.tipoPedido}</span>
                    <span className="text-sm font-[1000] italic text-[#82C91E]">R$ {pedido.valores?.total?.toFixed(2)}</span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 relative z-10">
                {pedido.status === 'PENDENTE' && <button onClick={(e) => { e.stopPropagation(); moverStatus(pedido, 'FILA'); }} className="w-full py-5 bg-[#4B0082] text-white font-[1000] text-xs tracking-widest uppercase rounded-2xl shadow-xl hover:bg-indigo-900 transition-colors flex items-center justify-center gap-2">Gerar Token e Aceitar <Lucide.ArrowRight size={16}/></button>}
                {pedido.status === 'FILA' && <button onClick={(e) => { e.stopPropagation(); moverStatus(pedido, 'EM_PREPARO'); }} className="w-full py-5 bg-amber-400 hover:bg-amber-500 text-white font-[1000] text-xs tracking-widest uppercase rounded-2xl shadow-xl transition-colors flex items-center justify-center gap-2">Colocar na Bancada <Lucide.Flame size={16}/></button>}
                {pedido.status === 'EM_PREPARO' && <button onClick={(e) => { e.stopPropagation(); setModalDespacho(pedido); }} className="w-full py-5 bg-[#82C91E] hover:bg-lime-500 text-[#4B0082] font-[1000] text-xs tracking-widest uppercase rounded-2xl shadow-xl transition-colors flex items-center justify-center gap-2">Embalar e Despachar <Lucide.PackageCheck size={16}/></button>}
                
                {pedido.status === 'PRONTO' && (
                    <div className="bg-blue-50 p-4 rounded-2xl text-center border border-blue-100">
                        <p className="text-[10px] font-black uppercase text-blue-600 flex items-center justify-center gap-2">
                            <Lucide.Radar size={14}/> Radar Tocando na Nuvem
                        </p>
                    </div>
                )}

                {pedido.status === 'SAIU_ENTREGA' && (
                    <div className="bg-purple-50 p-4 rounded-2xl text-center border border-purple-100">
                        <p className="text-[10px] font-black uppercase text-purple-600 flex items-center justify-center gap-2">
                            <Lucide.Bike size={14}/> Piloto em Rota de Entrega
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );

    if (!sistemaIniciado) {
        return (
            <div className="h-[100dvh] w-full bg-gradient-to-br from-[#1F0137] to-[#4B0082] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://res.cloudinary.com/dbd9x1o02/image/upload/v1774934438/rodrigues_geral/vvrauvi5vxs3ukdqd1qn.png')] bg-repeat bg-[length:120px_120px]" />
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-36 h-36 bg-[#82C91E] rounded-[3rem] flex items-center justify-center mb-10 shadow-[0_0_60px_rgba(130,201,30,0.5)] border-4 border-white/20 relative z-10">
                    <Lucide.ChefHat size={70} className="text-[#4B0082]" />
                </motion.div>
                <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-5xl font-[1000] text-white italic uppercase tracking-tighter mb-4 relative z-10">PDV <span className="text-[#82C91E]">PRO</span></motion.h1>
                <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-white/70 font-bold text-sm mb-12 max-w-sm relative z-10 leading-relaxed">
                    Torre de Comando Central. Controle pedidos, logística de rua, crises de rota e leilões públicos em tempo real.
                </motion.p>
                <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} onClick={iniciarExpediente} className="w-full max-w-sm py-6 bg-[#82C91E] hover:bg-lime-400 text-[#4B0082] rounded-[2rem] font-[1000] text-base uppercase shadow-2xl active:scale-95 transition-all relative z-10 tracking-widest">
                    INICIAR TURNO DE VENDAS
                </motion.button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden relative">
            
            {/* CABEÇALHO */}
            <header className="bg-gradient-to-r from-[#1F0137] to-[#4B0082] pt-10 pb-5 px-6 text-white flex justify-between items-center shadow-lg shrink-0 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#82C91E] rounded-xl flex items-center justify-center border-2 border-white/20 shadow-inner">
                        <Lucide.ChefHat size={24} className="text-[#4B0082]"/>
                    </div>
                    <div className="leading-tight">
                        <h1 className="text-xl font-[1000] italic uppercase tracking-tighter">Torre <span className="text-[#82C91E]">Rodrigues</span></h1>
                        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1 text-[#82C91E]">
                            <div className="w-2 h-2 bg-[#82C91E] rounded-full animate-ping" /> Estação Operacional
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col relative z-0">
                
                {/* --- TELA: COZINHA / KANBAN --- */}
                {telaAtual === 'COZINHA' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/50">
                        <div className="flex overflow-x-auto gap-3 p-5 bg-white shadow-sm no-scrollbar border-b border-slate-200 shrink-0">
                            {[
                                { id: 'NOVOS', label: 'Cozinha', icon: Lucide.BellRing, cor: 'text-red-500' },
                                { id: 'PREPARO', label: 'Bancada', icon: Lucide.Flame, cor: 'text-amber-500' },
                                { id: 'EXPEDICAO', label: 'Expedição', icon: Lucide.PackageCheck, cor: 'text-[#82C91E]' }
                            ].map(aba => {
                                const count = pedidos.filter(p => 
                                    aba.id === 'NOVOS' ? ['PENDENTE','AGUARDANDO_PAGAMENTO'].includes(p.status) : 
                                    aba.id === 'PREPARO' ? ['FILA','EM_PREPARO'].includes(p.status) : 
                                    ['PRONTO','SAIU_ENTREGA'].includes(p.status)
                                ).length;
                                
                                return (
                                    <button key={aba.id} onClick={() => setAbaKanban(aba.id)} 
                                        className={`flex-1 min-w-[110px] py-4 rounded-3xl flex flex-col items-center border-2 transition-all shadow-sm
                                        ${abaKanban === aba.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                                        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1.5 ${abaKanban === aba.id ? aba.cor : ''}`}>
                                            <aba.icon size={14}/> {aba.label}
                                        </div>
                                        <span className="text-3xl font-[1000] italic leading-none">{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-28 custom-scrollbar">
                            <AnimatePresence>
                                {pedidos.filter(p => abaKanban === 'NOVOS' ? ['PENDENTE','AGUARDANDO_PAGAMENTO'].includes(p.status) : abaKanban === 'PREPARO' ? ['FILA','EM_PREPARO'].includes(p.status) : ['PRONTO','SAIU_ENTREGA'].includes(p.status)).map(pedido => (
                                    <CardPedido key={pedido.id} pedido={pedido} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* --- TELA: LEILÃO (MANTIDA INTACTA) --- */}
                {telaAtual === 'LEILAO' && (
                    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
                        <div className="p-6 bg-white border-b border-slate-200 shrink-0 shadow-sm">
                            <h2 className="text-3xl font-[1000] text-pink-600 uppercase italic flex items-center gap-3 tracking-tighter">
                                <Lucide.Gavel size={32}/> Central de Leilões
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest leading-relaxed max-w-sm">
                                Modere os apelidos dos clientes para evitar fraudes e acompanhe as disputas ativas pelos copos que voltaram da rua.
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32 custom-scrollbar">
                            {apelidosPendentes.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-[1000] uppercase text-amber-600 flex items-center gap-2 bg-amber-100 inline-flex px-4 py-2 rounded-xl">
                                        <Lucide.UserPlus size={16}/> Pendentes de Aprovação
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {apelidosPendentes.map(user => (
                                            <div key={user.id} className="bg-white border-2 border-amber-200 p-5 rounded-[2rem] flex items-center justify-between shadow-lg">
                                                <div>
                                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Apelido Solicitado:</p>
                                                    <h4 className="font-[1000] text-[#4B0082] uppercase text-xl italic">{user.leilao_nickname}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1">{user.nome} • {user.telefone}</p>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => gerenciarApelido(user.id, 'APROVAR')} className="w-12 h-12 bg-[#82C91E] text-[#4B0082] hover:bg-lime-400 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center"><Lucide.Check size={24}/></button>
                                                    <button onClick={() => gerenciarApelido(user.id, 'REJEITAR')} className="w-12 h-12 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center"><Lucide.X size={24}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-xs font-[1000] uppercase text-pink-600 flex items-center gap-2 bg-pink-100 inline-flex px-4 py-2 rounded-xl">
                                    <Lucide.Zap size={16}/> Copos em Disputa
                                </h3>
                                
                                {leiloes.length === 0 ? (
                                    <div className="text-center pt-10 opacity-40">
                                        <Lucide.Gavel size={60} className="mx-auto mb-4 text-slate-400" />
                                        <p className="font-[1000] uppercase text-[12px] tracking-widest text-slate-500">O pregão está fechado no momento.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {leiloes.map(l => (
                                            <div key={l.id} className="bg-gradient-to-br from-pink-600 to-purple-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-white border-4 border-pink-400/30">
                                                <div className="absolute top-0 right-0 p-4 opacity-10"><Lucide.Gavel size={100}/></div>
                                                
                                                <div className="relative z-10 flex justify-between items-start mb-6">
                                                    <span className="text-[10px] font-[1000] bg-white text-pink-600 px-4 py-2 rounded-full uppercase italic animate-pulse shadow-lg flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-pink-600 animate-ping" /> Aceitando Lances
                                                    </span>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black uppercase text-white/60 tracking-widest mb-1">Maior Lance</p>
                                                        <span className="text-4xl font-[1000] text-[#82C91E] italic tracking-tighter drop-shadow-md">{formatarMoeda(l.lanceAtual)}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-black/30 p-5 rounded-3xl border border-white/20 backdrop-blur-sm relative z-10 mb-6">
                                                    <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Liderando no momento:</p>
                                                    <p className="font-[1000] text-white uppercase text-xl truncate">{l.ultimoLicitante || 'Aguardando 1º lance...'}</p>
                                                </div>

                                                <button onClick={async () => { 
                                                    if(window.confirm("Bater o martelo e vender para " + (l.ultimoLicitante || 'ninguém') + "?")) {
                                                        if (!l.ultimoLicitanteUid) return alert("Nenhum lance foi dado ainda!");
                                                        await updateDoc(doc(db, "leiloes", l.id), { status: 'FINALIZADO', ganhadorUid: l.ultimoLicitanteUid });
                                                    }
                                                }} className="w-full py-5 bg-white/10 hover:bg-red-500 text-white rounded-2xl font-[1000] text-xs uppercase tracking-widest italic border border-white/20 transition-all active:scale-95 relative z-10">
                                                    Bater o Martelo (Encerrar e Cobrar)
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TELA: CARDÁPIO / BOTÕES DE PÂNICO (MANTIDA INTACTA) --- */}
                {telaAtual === 'CARDAPIO' && (
                    <div className="flex-1 flex flex-col bg-slate-50">
                        <div className="p-6 bg-white border-b border-slate-200 shrink-0 shadow-sm">
                            <h2 className="text-2xl font-[1000] text-[#4B0082] uppercase italic tracking-tighter flex items-center gap-3">
                                <Lucide.ToggleLeft size={28}/> Botões de Pânico
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest max-w-md leading-relaxed">
                                Acabou o morango? Pause aqui e ele desaparece na mesma hora do aplicativo do cliente. Sem stress.
                            </p>
                        </div>
                        
                        <div className="flex overflow-x-auto gap-3 p-5 bg-white shadow-sm shrink-0 border-b border-slate-100 no-scrollbar">
                            {[
                                {id:'bases', label:'Bases Açaí'}, 
                                {id:'acompanhamentos_gratis', label:'Acomp. Grátis'}, 
                                {id:'adicionais', label:'Adicionais Extras'}, 
                                {id:'coberturas', label:'Caldas e Caldas'}
                            ].map(sub => (
                                <button key={sub.id} onClick={() => setAbaCardapio(sub.id)} 
                                    className={`px-6 py-4 rounded-2xl font-[1000] uppercase text-[10px] shrink-0 border-2 transition-all shadow-sm tracking-widest
                                    ${abaCardapio === sub.id ? 'bg-[#4B0082] text-[#82C91E] border-[#4B0082]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                    {sub.label}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-32 custom-scrollbar">
                            {itensCardapio.map(item => (
                                <div key={item.id} onClick={() => alternarDisponibilidade(item)} 
                                    className={`p-6 rounded-[2.5rem] border-2 flex flex-col justify-between items-center text-center cursor-pointer transition-all active:scale-95 shadow-sm h-36
                                    ${item.disponivel ? 'bg-white border-slate-100 hover:border-[#82C91E]' : 'bg-red-50 border-red-200'}`}>
                                    
                                    <h4 className={`text-xs font-[1000] uppercase tracking-wide line-clamp-3 
                                        ${item.disponivel ? 'text-[#4B0082]' : 'text-red-500 line-through opacity-70'}`}>
                                        {item.nome}
                                    </h4>
                                    
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md mt-4
                                        ${item.disponivel ? 'bg-[#82C91E] text-[#4B0082]' : 'bg-red-500 text-white'}`}>
                                        {item.disponivel ? <Lucide.Check size={20} strokeWidth={3}/> : <Lucide.Pause size={20} strokeWidth={3}/>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- TELA: DASHBOARD / MÉTRICAS (MANTIDA INTACTA) --- */}
                {telaAtual === 'DASHBOARD' && (
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar pb-32 bg-slate-50 space-y-6">
                        <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                            <div>
                                <h2 className="text-3xl font-[1000] text-[#4B0082] uppercase italic tracking-tighter flex items-center gap-3">
                                    <Lucide.BarChart3 size={32}/> Visão Geral
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-11">Seus resultados do dia</p>
                            </div>
                            <input 
                                type="date" 
                                value={dataFiltro} 
                                onChange={(e) => setDataFiltro(e.target.value)} 
                                className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-[1000] text-[#4B0082] outline-none focus:border-[#82C91E] shadow-inner transition-colors"
                            />
                        </div>

                        <div className="bg-gradient-to-br from-[#4B0082] to-indigo-950 rounded-[3rem] p-10 shadow-2xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-[0.05] p-5"><Lucide.TrendingUp size={200} strokeWidth={1} /></div>
                            <div className="relative z-10">
                                <p className="text-xs font-[1000] uppercase tracking-widest text-[#82C91E] mb-2 flex items-center gap-2">
                                    <Lucide.DollarSign size={16}/> Faturamento Bruto (Dia Selecionado)
                                </p>
                                <p className="text-6xl font-[1000] italic tracking-tighter drop-shadow-lg">{formatarMoeda(metricas.totalFaturamento)}</p>
                                
                                <div className="mt-8 pt-6 border-t border-white/10 flex gap-8">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase text-white/50 tracking-widest mb-1">Copos Vendidos</p>
                                        <p className="text-2xl font-black">{metricas.qtdVendas}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold uppercase text-white/50 tracking-widest mb-1">Ticket Médio (Por Pedido)</p>
                                        <p className="text-2xl font-black">{formatarMoeda(metricas.ticketMedio)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-shadow">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4"><Lucide.Banknote size={24}/></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vendas em Dinheiro</p>
                                <p className="text-3xl font-[1000] text-slate-800">{metricas.dinheiro} <span className="text-sm text-slate-400 font-bold">pedidos</span></p>
                            </div>
                            
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-shadow">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4"><Lucide.SmartphoneNfc size={24}/></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vendas em PIX App</p>
                                <p className="text-3xl font-[1000] text-slate-800">{metricas.pix} <span className="text-sm text-slate-400 font-bold">pedidos</span></p>
                            </div>
                            
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-shadow">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4"><Lucide.CreditCard size={24}/></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cartão / Maquininha</p>
                                <p className="text-3xl font-[1000] text-slate-800">{metricas.cartao} <span className="text-sm text-slate-400 font-bold">pedidos</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TELA: HISTÓRICO / AUDITORIA (MANTIDA INTACTA) --- */}
                {telaAtual === 'HISTORICO' && (
                    <div className="flex-1 flex flex-col bg-slate-50 h-full">
                        <div className="bg-white p-6 border-b border-slate-200 shrink-0 flex justify-between items-center shadow-sm z-10">
                            <div>
                                <h2 className="text-3xl font-[1000] text-[#4B0082] uppercase tracking-tighter italic flex items-center gap-3">
                                    <Lucide.History size={32}/> Auditoria
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest ml-11">Registro de Cancelados, Entregues e Devolvidos.</p>
                            </div>
                            <input 
                                type="date" 
                                value={dataFiltro} 
                                onChange={(e) => setDataFiltro(e.target.value)} 
                                className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-[1000] text-[#4B0082] outline-none focus:border-[#82C91E] transition-colors shadow-inner"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar pb-32">
                            {pedidosDoDiaSelecionado.length === 0 ? (
                                <div className="text-center pt-32 opacity-40">
                                    <Lucide.SearchX size={80} strokeWidth={1} className="mx-auto mb-4 text-[#4B0082]" />
                                    <p className="font-black uppercase text-xs tracking-widest text-slate-500">O Histórico está limpo neste dia</p>
                                </div>
                            ) : (
                                pedidosDoDiaSelecionado.filter(p => ['CONCLUIDO', 'CANCELADO', 'RETORNADO', 'LEILOADO'].includes(p.status)).map(pedido => (
                                    <div key={pedido.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
                                        
                                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setDetalhesPedido(pedido)}>
                                            <div className="flex gap-4 items-center">
                                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-200">
                                                    <Lucide.FileText size={20}/>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Lucide.Clock size={12}/> {formatarDataHora(pedido.createdAt)}</p>
                                                    <h4 className="text-lg font-[1000] text-[#4B0082] uppercase truncate max-w-[200px] italic leading-none mb-2">{pedido.cliente?.nome || 'Cliente Local'}</h4>
                                                    
                                                    <span className={`text-[9px] font-[1000] uppercase tracking-widest px-3 py-1 rounded-md inline-flex items-center gap-1
                                                        ${pedido.status === 'CANCELADO' ? 'bg-red-50 text-red-600 border border-red-100' : 
                                                          pedido.status === 'LEILOADO' ? 'bg-pink-50 text-pink-600 border border-pink-100' : 
                                                          pedido.status === 'RETORNADO' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                          'bg-[#82C91E]/10 text-[#4B0082] border border-[#82C91E]/30'}`}>
                                                        {pedido.status === 'CONCLUIDO' && <Lucide.CheckCircle2 size={10}/>}
                                                        {pedido.status === 'RETORNADO' && <Lucide.AlertCircle size={10}/>}
                                                        {pedido.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                                                <p className="font-[1000] text-2xl text-slate-800 italic tracking-tighter leading-none mb-2">{formatarMoeda(pedido.valores?.total)}</p>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase">{pedido.pagamento?.metodo}</p>
                                            </div>
                                        </div>
                                        
                                        {pedido.status === 'RETORNADO' && (
                                            <div className="mt-2 pt-4 border-t border-dashed border-slate-200">
                                                <div className="bg-amber-50 p-4 rounded-2xl mb-4 border border-amber-100">
                                                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">⚠️ Motivo: {pedido.motivoRetorno || 'Cliente não atendeu o piloto'}</p>
                                                </div>
                                                <button onClick={() => enviarParaLeilao(pedido)} className="w-full py-5 bg-pink-50 text-pink-600 border-2 border-pink-200 rounded-[2rem] font-[1000] text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-pink-600 hover:text-white hover:border-pink-600 transition-all active:scale-95 shadow-sm">
                                                    <Lucide.Gavel size={18}/> Iniciar Leilão de Oportunidade
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* NAVEGAÇÃO INFERIOR */}
            <nav className="h-20 bg-white border-t border-slate-200 flex justify-around items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] fixed bottom-0 left-0 right-0 z-40">
                {[
                    { id: 'COZINHA', icon: Lucide.ListOrdered, label: 'Operação', cor: 'text-[#4B0082]' },
                    { id: 'LEILAO', icon: Lucide.Gavel, label: 'Leilão', cor: 'text-pink-500' },
                    { id: 'CARDAPIO', icon: Lucide.ToggleLeft, label: 'Estoque', cor: 'text-blue-500' },
                    { id: 'HISTORICO', icon: Lucide.History, label: 'Auditoria', cor: 'text-amber-500' },
                    { id: 'DASHBOARD', icon: Lucide.BarChart3, label: 'Métricas', cor: 'text-[#82C91E]' }
                ].map(item => (
                    <button key={item.id} onClick={() => setTelaAtual(item.id)} className={`flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-2xl transition-all ${telaAtual === item.id ? `${item.cor} bg-slate-50` : 'text-slate-400 hover:bg-slate-50'}`}>
                        <item.icon size={24} strokeWidth={telaAtual === item.id ? 2.5 : 2} className={telaAtual === item.id && item.id === 'COZINHA' ? 'animate-bounce-slow' : telaAtual === item.id && item.id === 'LEILAO' ? 'animate-pulse' : ''} />
                        <span className={`text-[8px] font-black uppercase tracking-widest ${telaAtual === item.id ? item.cor : 'text-slate-400'}`}>{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* MODAL DE DESPACHO (MANTIDO INTACTO) */}
            <AnimatePresence>
                {modalDespacho && (
                    <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-md flex items-end justify-center p-4">
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="w-full bg-white rounded-[3rem] p-8 shadow-2xl pb-[calc(20px+env(safe-area-inset-bottom))]">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
                            
                            <h2 className="text-3xl font-[1000] text-[#4B0082] uppercase tracking-tighter text-center mb-2 italic">Despachar Rota</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase text-center mb-8 tracking-widest">Pedido {modalDespacho.id.slice(-4)} montado, lacrado e pronto para a rua.</p>
                            
                            {modalDespacho.tipoPedido === 'ENTREGA' ? (
                                <div className="space-y-4">
                                    <button onClick={() => despacharPedido(modalDespacho, 'TORRE')} className="w-full p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-[2.5rem] flex items-center gap-5 hover:border-blue-400 active:scale-95 transition-all text-left shadow-sm group">
                                        <div className="w-14 h-14 bg-blue-500 rounded-[1.5rem] flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-110 transition-transform"><Lucide.Radar size={28}/></div>
                                        <div>
                                            <p className="text-lg font-[1000] text-blue-900 uppercase italic leading-none mb-1">Radar da Torre (Auto)</p>
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-relaxed">Calcula o piloto livre mais próximo pelo GPS e envia oferta 60s.</p>
                                        </div>
                                    </button>
                                    
                                    <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-[2.5rem]">
                                        <div className="flex items-center gap-5 mb-5">
                                            <div className="w-14 h-14 bg-slate-200 rounded-[1.5rem] flex items-center justify-center text-slate-500 shrink-0"><Lucide.Bike size={28}/></div>
                                            <div>
                                                <p className="text-lg font-[1000] text-slate-800 uppercase italic leading-none mb-1">Forçar Piloto Físico</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Atribui a um motoboy que já está na loja.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <select value={entregadorSelecionado} onChange={(e) => setEntregadorSelecionado(e.target.value)} className="w-full h-14 bg-white border-2 border-slate-300 rounded-2xl px-4 text-xs font-black uppercase text-[#4B0082] outline-none focus:border-[#82C91E] transition-colors appearance-none">
                                                <option value="">Selecione o Piloto Presente...</option>
                                                {entregadores.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                            </select>
                                            <button onClick={() => despacharPedido(modalDespacho, 'DIRETO')} className="w-full h-14 bg-[#4B0082] text-[#82C91E] rounded-2xl font-[1000] text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vincular Piloto e Sair</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => despacharPedido(modalDespacho, 'BALCAO')} className="w-full p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-[2.5rem] flex items-center gap-5 hover:border-purple-400 active:scale-95 transition-all text-left shadow-sm">
                                    <div className="w-14 h-14 bg-[#4B0082] rounded-[1.5rem] flex items-center justify-center text-white shrink-0 shadow-lg"><Lucide.Store size={28}/></div>
                                    <div>
                                        <p className="text-lg font-[1000] text-purple-900 uppercase italic leading-none mb-1">Pronto no Balcão</p>
                                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest leading-relaxed">Notifica o aplicativo do cliente que ele já pode vir retirar.</p>
                                    </div>
                                </button>
                            )}
                            
                            <button onClick={() => setModalDespacho(null)} className="w-full mt-6 py-5 text-[11px] font-black text-slate-400 hover:bg-slate-100 rounded-2xl uppercase tracking-widest transition-colors">Voltar</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

          {/* ========================================================= */}
            {/* PÁGINA DE DETALHES DO PEDIDO (Agora se porta como página) */}
            {/* ========================================================= */}
            <AnimatePresence>
                {detalhesPedido && (
                    <motion.div 
                        initial={{ x: "100%" }} 
                        animate={{ x: 0 }} 
                        exit={{ x: "100%" }} 
                        transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                        className="fixed inset-0 z-[5000] w-full h-[100dvh] bg-slate-50 flex flex-col shadow-2xl"
                    >
                        {/* HEADER DA PÁGINA COM BOTÃO DE VOLTAR */}
                        <header className="bg-gradient-to-r from-[#1F0137] to-[#4B0082] p-5 pt-8 text-white flex items-center gap-4 shrink-0 shadow-md">
                            <button onClick={() => setDetalhesPedido(null)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-90 transition-all hover:bg-white/20">
                                <Lucide.ArrowLeft size={24} strokeWidth={2.5}/>
                            </button>
                            <div>
                                <h2 className="text-2xl font-[1000] uppercase italic leading-none mb-1 tracking-tighter">Pedido #{detalhesPedido.id.slice(-4)}</h2>
                                <p className="text-[10px] font-black text-[#82C91E] uppercase tracking-widest">{detalhesPedido.tipoPedido}</p>
                            </div>
                        </header>

                        {/* ABAS DO MODAL */}
                        <div className="flex bg-white shadow-sm relative z-10 shrink-0">
                            <button onClick={() => setAbaModal('INFO')} className={`flex-1 py-5 text-[11px] font-[1000] uppercase tracking-widest border-b-4 transition-colors ${abaModal === 'INFO' ? 'border-[#4B0082] text-[#4B0082]' : 'border-transparent text-slate-400 hover:bg-slate-50'}`}>Ficha Técnica</button>
                            <button onClick={() => setAbaModal('CHAT')} className={`flex-1 py-5 text-[11px] font-[1000] uppercase tracking-widest border-b-4 transition-colors flex items-center justify-center gap-2 ${abaModal === 'CHAT' ? 'border-[#4B0082] text-[#4B0082]' : 'border-transparent text-slate-400 hover:bg-slate-50'}`}>
                                Chat Cliente
                                {mensagens.length > 0 && <span className="bg-[#EA1D2C] text-white px-2 py-0.5 rounded-full text-[9px] animate-pulse">{mensagens.length}</span>}
                            </button>
                        </div>

                        {/* CONTEÚDO DAS ABAS */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {abaModal === 'INFO' ? (
                                <div className="p-6 space-y-6 pb-24">
                                    
                                    {/* AVISAR CLIENTE */}
                                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm">
                                        <h3 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-3 flex items-center gap-2"><Lucide.BellRing size={14}/> Avisar o Cliente (App)</h3>
                                        {detalhesPedido.alertaLoja ? (
                                            <div className="bg-white p-3 rounded-xl border border-blue-200 flex justify-between items-center shadow-sm">
                                                <p className="text-xs font-bold text-blue-900 italic">"{detalhesPedido.alertaLoja}"</p>
                                                <button onClick={() => removerAlerta(detalhesPedido)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Lucide.Trash2 size={16}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <input value={textoAlerta} onChange={e => setTextoAlerta(e.target.value)} placeholder="Ex: Houve um problema, vai atrasar 10 min..." className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500 font-bold text-blue-900 placeholder:text-blue-300" />
                                                <button onClick={() => dispararAlerta(detalhesPedido)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                                                    <Lucide.Send size={14}/> Disparar Aviso
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* PROCESSAR ALTERAÇÃO */}
                                    {detalhesPedido.solicitacaoAlteracao?.status === 'PENDENTE' && (
                                        <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-3xl animate-pulse">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Lucide.AlertCircle size={16} className="text-amber-600" />
                                                <p className="text-[10px] font-black text-amber-600 uppercase">SOLICITAÇÃO: {detalhesPedido.solicitacaoAlteracao.tipo}</p>
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 my-2 italic">"{detalhesPedido.solicitacaoAlteracao.descricao}"</p>
                                            
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Custo Extra (R$):</span>
                                                <input 
                                                    type="number" 
                                                    value={custoExtraAlteracao}
                                                    onChange={(e) => setCustoExtraAlteracao(e.target.value)}
                                                    placeholder="Ex: 5,00"
                                                    className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
                                                />
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={() => processarAlteracao(detalhesPedido, 'RECUSAR')} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-red-200">Negar</button>
                                                <button onClick={() => processarAlteracao(detalhesPedido, 'ACEITAR')} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-green-200">Aceitar & Somar</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* DADOS DO CLIENTE & MAPA ESTÁTICO */}
                                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Lucide.User size={12}/> Dados do Cliente</p>
                                        <h3 className="text-xl font-[1000] text-[#4B0082] uppercase italic mb-1">{detalhesPedido.cliente?.nome}</h3>
                                        <p className="text-xs font-bold text-slate-500 mb-4">{detalhesPedido.cliente?.telefone}</p>
                                        
                                        {detalhesPedido.tipoPedido === 'ENTREGA' && (
                                            <div className="pt-4 border-t border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Lucide.MapPin size={12}/> Local de Entrega</p>
                                                
                                                {/* NOVO: MAPA ESTÁTICO (MINIATURA) */}
                                                {detalhesPedido.endereco?.lat && (
                                                    <div className="w-full h-36 bg-slate-100 rounded-2xl overflow-hidden relative cursor-pointer mb-4 border border-slate-200 shadow-inner group" onClick={() => setMapaExpandido(true)}>
                                                        <div className="absolute inset-0 z-10 bg-[#4B0082]/10 flex items-center justify-center group-hover:bg-[#4B0082]/30 transition-colors">
                                                            <span className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full text-[9px] font-black text-[#4B0082] uppercase flex items-center gap-2 shadow-lg">
                                                                <Lucide.Maximize2 size={12} className="text-[#82C91E]"/> Tocar para Expandir o Mapa
                                                            </span>
                                                        </div>
                                                        {/* Atenção: Certifique-se de que o MotorDeRastreioGestor está declarado no topo como instruído */}
                                                        <MotorDeRastreioGestor pedido={detalhesPedido} interativo={false} />
                                                    </div>
                                                )}

                                                <p className="text-xs font-[1000] text-slate-700 uppercase">{detalhesPedido.endereco?.rua}, {detalhesPedido.endereco?.numero}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{detalhesPedido.endereco?.bairro}</p>
                                                {detalhesPedido.endereco?.complemento && <p className="text-[10px] font-black text-amber-700 uppercase mt-2 bg-amber-50 px-3 py-2 rounded-xl inline-block border border-amber-200">Ref: {detalhesPedido.endereco.complemento}</p>}
                                            </div>
                                        )}
                                    </div>

                                    {/* ITENS DO PEDIDO */}
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                                            <Lucide.List size={14}/> Ficha de Produção
                                        </h3>
                                        {detalhesPedido.itens?.map((it, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                                                <div className="w-10 h-10 bg-[#4B0082] rounded-lg flex items-center justify-center text-lg font-[1000] text-[#82C91E] shrink-0">{it.quantidade}x</div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-[1000] text-slate-800 uppercase italic">{it.detalhes?.tamanho || it.tamanho}</h4>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{it.detalhes?.baseNome || it.baseNome}</p>
                                                    <div className="space-y-1">
                                                        {(it.detalhes?.acompanhamentos_detalhes || []).map((ac, i) => <p key={i} className="text-[10px] font-bold text-slate-600 uppercase">• {ac.nome || ac}</p>)}
                                                        {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => <p key={i} className="text-[10px] font-[1000] text-[#4B0082] uppercase">+ {ad.qtd}x {ad.nome || ad}</p>)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* EXTRATO FINANCEIRO DETALHADO */}
                                    <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1 rounded-bl-2xl font-black text-[9px] uppercase text-slate-500">
                                            PGTO: {detalhesPedido.pagamento?.metodo}
                                        </div>

                                        <h3 className="text-[10px] font-black text-[#4B0082] uppercase tracking-widest mb-4 flex items-center gap-2"><Lucide.Receipt size={14}/> Extrato Detalhado</h3>
                                        
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                                <span>Subtotal</span>
                                                <span>R$ {Number(detalhesPedido.valores?.subtotal || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                                <span>Entrega</span>
                                                <span>{detalhesPedido.valores?.taxa > 0 ? `R$ ${Number(detalhesPedido.valores.taxa).toFixed(2)}` : 'Grátis'}</span>
                                            </div>
                                            {detalhesPedido.gorjeta > 0 && (
                                                <div className="flex justify-between items-center text-[11px] font-black uppercase text-pink-500 bg-pink-50 p-2 rounded-lg">
                                                    <span>Caixinha</span>
                                                    <span>+ R$ {Number(detalhesPedido.gorjeta).toFixed(2)}</span>
                                                </div>
                                            )}
                                            {detalhesPedido.valores?.desconto > 0 && (
                                                <div className="flex justify-between items-center text-[11px] font-black uppercase text-[#82C91E] bg-[#82C91E]/10 p-2 rounded-lg">
                                                    <span>Desconto</span>
                                                    <span>- R$ {Number(detalhesPedido.valores.desconto).toFixed(2)}</span>
                                                </div>
                                            )}
                                            
                                            <div className="pt-4 border-t border-slate-200 flex justify-between items-end mt-2">
                                                <span className="text-xs font-[1000] text-[#4B0082] uppercase tracking-widest">Total</span>
                                                <span className="text-3xl font-[1000] text-[#4B0082] italic leading-none">R$ {Number(detalhesPedido.valores?.total || 0).toFixed(2)}</span>
                                            </div>
                                            
                                            {detalhesPedido.pagamento?.valorTrocoPara && (
                                                <div className="mt-3 bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 flex justify-between items-center font-black text-xs uppercase">
                                                    <span>Troco Para:</span>
                                                    <span>R$ {detalhesPedido.pagamento.valorTrocoPara}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ABA CHAT CLIENTE */
                                <div className="h-full flex flex-col bg-slate-100 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                        {mensagens.length === 0 ? (
                                            <div className="text-center pt-32 opacity-40">
                                                <Lucide.MessageCircle size={80} strokeWidth={1} className="mx-auto mb-4 text-slate-500" />
                                                <h3 className="font-[1000] text-xl uppercase italic text-slate-600">Chat Vazio</h3>
                                                <p className="font-black uppercase text-[10px] tracking-widest text-slate-400 mt-2">Nenhuma mensagem trocada.</p>
                                            </div>
                                        ) : (
                                            mensagens.map((msg, i) => (
                                                <div key={i} className={`flex flex-col ${msg.remetente === 'loja' ? 'items-end' : 'items-start'}`}>
                                                    <div className={`max-w-[85%] p-4 text-[13px] font-bold shadow-md 
                                                        ${msg.remetente === 'loja' 
                                                            ? 'bg-gradient-to-r from-[#4B0082] to-[#1F0137] text-white rounded-[2rem] rounded-tr-sm' 
                                                            : 'bg-white text-slate-800 border border-slate-200 rounded-[2rem] rounded-tl-sm'}`}>
                                                        {msg.texto}
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase text-slate-400 mt-1 px-2">{msg.remetente === 'loja' ? 'Nós (Loja)' : 'Cliente'}</span>
                                                </div>
                                            ))
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                    
                                    <form onSubmit={enviarMensagemChat} className="p-4 bg-white flex gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] shrink-0 z-20 pb-[calc(20px+env(safe-area-inset-bottom))]">
                                        <div className="flex-1 bg-slate-100 rounded-full flex items-center px-6 border border-slate-200">
                                            <input 
                                                value={novaMsg} 
                                                onChange={e => setNovaMsg(e.target.value)} 
                                                placeholder="Escreva para o cliente..." 
                                                className="w-full bg-transparent py-4 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
                                            />
                                        </div>
                                        <button type="submit" disabled={!novaMsg.trim()} className="w-14 h-14 rounded-full flex items-center justify-center bg-[#82C91E] disabled:bg-slate-300 text-[#4B0082] disabled:text-slate-500 shadow-lg active:scale-90 transition-transform shrink-0">
                                            <Lucide.Send size={24} strokeWidth={2.5}/>
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================= */}
            {/* MAPA EXPANDIDO (TELA CHEIA) */}
            {/* ========================================================= */}
            <AnimatePresence>
                {mapaExpandido && detalhesPedido && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[6000] bg-white flex flex-col">
                        <header className="bg-[#1F0137] p-5 pt-8 text-white flex justify-between items-center shadow-lg z-10 shrink-0">
                            <div>
                                <h2 className="font-[1000] uppercase italic text-xl tracking-tighter">Rota do Pedido</h2>
                                <p className="text-[10px] font-black text-[#82C91E] tracking-widest uppercase">Visualização Dinâmica</p>
                            </div>
                            <button onClick={() => setMapaExpandido(false)} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl active:scale-90 transition-transform">
                                <Lucide.X size={20}/>
                            </button>
                        </header>
                        <div className="flex-1 relative bg-slate-100">
                            {/* Atenção: Certifique-se de que o MotorDeRastreioGestor está declarado no topo como instruído */}
                            <MotorDeRastreioGestor pedido={detalhesPedido} interativo={true} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default function GestorMobileWrapper() {
    return <ToastProvider><GestorLojaContent /></ToastProvider>;
}