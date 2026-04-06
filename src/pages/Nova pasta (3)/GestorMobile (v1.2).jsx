import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, where } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GestorMobileV13() {
    const [pedidos, setPedidos] = useState([]);
    const [abaAtiva, setAbaAtiva] = useState('NOVOS'); // NOVOS | COZINHA | PRONTOS
    const [lojaAberta, setLojaAberta] = useState(true);
    const [alertasAtivos, setAlertasAtivos] = useState(false);
    
    // Estados para o Modal de Detalhes/Triagem
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const [qtdPedidosCliente, setQtdPedidosCliente] = useState(0);
    const [carregandoStats, setCarregandoStats] = useState(false);
    
    // Alerta sonoro tático
    const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

    // 1. SINCRONIZAÇÃO EM TEMPO REAL E ALERTA
    useEffect(() => {
        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const novosPendentes = docs.filter(p => p.status === 'PENDENTE');
            setPedidos(prev => {
                const pendentesAntigos = prev.filter(p => p.status === 'PENDENTE');
                if (alertasAtivos && novosPendentes.length > pendentesAntigos.length) {
                    audioRef.current.play().catch(() => {});
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                }
                return docs;
            });
        });
        return () => unsubscribe();
    }, [alertasAtivos]);

    // 2. BUSCAR ESTATÍSTICAS DO CLIENTE (Ao abrir modal)
    useEffect(() => {
        const buscarHistorico = async () => {
            if (detalhesPedido && detalhesPedido.cliente?.uid && detalhesPedido.status === 'PENDENTE') {
                setCarregandoStats(true);
                try {
                    const q = query(collection(db, "pedidos"), where("cliente.uid", "==", detalhesPedido.cliente.uid));
                    const snap = await getDocs(q);
                    setQtdPedidosCliente(snap.size); // Conta total de pedidos desse UID
                } catch (e) { console.error("Erro nas stats", e); }
                finally { setCarregandoStats(false); }
            } else { setQtdPedidosCliente(0); }
        };
        buscarHistorico();
    }, [detalhesPedido]);

    // 3. FILTRAGEM OPERACIONAL E MOVIMENTAÇÃO
    const getPedidosFiltrados = () => {
        if (abaAtiva === 'NOVOS') return pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status));
        if (abaAtiva === 'COZINHA') return pedidos.filter(p => ['FILA', 'EM_PREPARO'].includes(p.status));
        if (abaAtiva === 'PRONTOS') return pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status));
        return [];
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
            setDetalhesPedido(null); // Fecha o modal após a ação
        }
    };

    const calcularMinutos = (data) => data ? Math.floor((new Date() - (data.toDate ? data.toDate() : new Date(data))) / 60000) : 0;

    return (
        <div className="min-h-screen bg-[#F2F2F2] font-sans pb-24 selection:bg-[#EA1D2C]/10">
            
            {/* HEADER TÁTICO V1.3 */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
                {!alertasAtivos && (
                    <button onClick={() => { setAlertasAtivos(true); audioRef.current.play(); }} className="w-full bg-[#EA1D2C] text-white p-3 flex items-center justify-center gap-2 font-black uppercase text-[10px] animate-pulse">
                        <Lucide.VolumeX size={14} /> Ativar Alertas Sonoros
                    </button>
                )}
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#EA1D2C] rounded-xl flex items-center justify-center text-white shadow-lg">
                            <Lucide.ShoppingBag size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="font-[1000] text-slate-800 uppercase italic text-sm leading-none">Gestor Rodrigues</h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Mobile V1.3</p>
                        </div>
                    </div>
                    <button onClick={() => setLojaAberta(!lojaAberta)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-inner border ${lojaAberta ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {lojaAberta ? '● Aberta' : '○ Fechada'}
                    </button>
                </div>
                {/* ABAS */}
                <div className="flex px-2 pb-2 gap-2">
                    {[
                        { id: 'NOVOS', label: 'Novos', count: pedidos.filter(p => p.status === 'PENDENTE').length, cor: 'text-[#EA1D2C]' },
                        { id: 'COZINHA', label: 'Cozinha', count: pedidos.filter(p => ['FILA', 'EM_PREPARO'].includes(p.status)).length, cor: 'text-amber-500' },
                        { id: 'PRONTOS', label: 'Prontos', count: pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status)).length, cor: 'text-[#82C91E]' }
                    ].map(aba => (
                        <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all border-b-4 ${abaAtiva === aba.id ? `bg-white border-[#EA1D2C] text-slate-900 shadow-md` : 'bg-slate-50 border-transparent text-slate-400'}`}>
                            {aba.label} {aba.count > 0 && <span className={`px-1.5 py-0.5 rounded-full bg-slate-100 ${aba.cor} text-[10px] ml-1`}>{aba.count}</span>}
                        </button>
                    ))}
                </div>
            </header>

            {/* LISTA DE PEDIDOS OPERACIONAL */}
            <main className="p-3 space-y-4">
                <AnimatePresence mode='popLayout'>
                    {getPedidosFiltrados().map((pedido) => {
                        const minutos = calcularMinutos(pedido.createdAt);
                        const isAtrasado = minutos > 15;
                        const isAguardandoPagamento = pedido.status === 'AGUARDANDO_PAGAMENTO';

                        return (
                            <motion.div key={pedido.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 100 }}
                                className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden ${isAtrasado ? 'border-red-200 bg-red-50/20' : 'border-white'}`}>
                                <div className="p-4" onClick={() => setDetalhesPedido(pedido)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-lg text-[10px] font-black">#{pedido.id.slice(-4).toUpperCase()}</span>
                                        <span className={`text-[11px] font-black uppercase flex items-center gap-1 ${isAtrasado ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}><Lucide.Clock size={12}/> {minutos}m</span>
                                    </div>
                                    <h2 className="text-xl font-[1000] uppercase text-slate-800 leading-none mb-1 truncate">{pedido.cliente?.nome || 'Balcão'}</h2>
                                    {isAguardandoPagamento && <p className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1"><Lucide.Lock size={12}/> Aguardando Pagamento Online</p>}
                                    <div className="space-y-3 mt-4">
                                        {pedido.itens?.map((it, idx) => (
                                            <div key={idx} className="flex items-start gap-3 border-l-4 border-[#82C91E] pl-3">
                                                <div className="font-[1000] text-[#4B0082] text-sm leading-none pt-1">{it.quantidade || 1}x</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-black uppercase text-slate-800 leading-tight">{it.detalhes?.tamanho || it.tamanho}</p>
                                                    <p className="text-[11px] font-bold text-[#82C91E] uppercase leading-tight">{it.detalhes?.baseNome || it.baseNome}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Ações Rápidas Base (Cozinha/Prontos) */}
                                {abaAtiva !== 'NOVOS' && (
                                    <div className="px-3 pb-3">
                                        <button onClick={() => moverStatus(pedido)} className={`w-full py-5 rounded-2xl font-[1000] uppercase italic text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-3 ${abaAtiva === 'COZINHA' ? 'bg-amber-500 text-white' : 'bg-[#82C91E] text-[#4B0082]'}`}>
                                            {abaAtiva === 'COZINHA' ? 'Marcar como Pronto' : 'Despachar / Finalizar'} <Lucide.ChevronRight size={20} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </main>

            {/* MODAL DE TRIAGEM TÁTICA (MOBILE V1.3) */}
            <AnimatePresence>
                {detalhesPedido && (
                    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end selection:bg-[#EA1D2C]/10">
                        <div className="bg-white w-full h-[90vh] rounded-t-[3.5rem] overflow-hidden flex flex-col border border-slate-100 shadow-2xl">
                            
                            {/* Cabeçalho do Modal */}
                            <header className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-[3.5rem]">
                                <h3 className="font-[1000] uppercase text-[#4B0082] text-lg leading-none tracking-tighter">Pedido #{detalhesPedido.id.slice(-4).toUpperCase()}</h3>
                                <button onClick={() => setDetalhesPedido(null)} className="p-3 bg-white rounded-full text-slate-400 shadow-sm"><Lucide.X size={24} /></button>
                            </header>

                            {/* Conteúdo da Triagem Tática */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                
                                {/* SEÇÃO A: TRIAGEM DO CLIENTE (COCKPIT) */}
                                <section className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Lucide.User size={12}/>Dados do Cliente</p>
                                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                        <div>
                                            <h4 className="text-xl font-black text-slate-800 uppercase leading-none tracking-tighter">{detalhesPedido.cliente?.nome || 'Cliente'}</h4>
                                            {carregandoStats ? <Lucide.Loader2 size={12} className="animate-spin text-slate-300 mt-1" /> : (
                                                <span className="bg-[#4B0082]/10 text-[#4B0082] px-2 py-0.5 rounded text-[9px] font-black uppercase mt-1 inline-block">Fez {qtdPedidosCliente} pedidos na loja</span>
                                            )}
                                        </div>
                                        {/* Botões de Ação Imediata */}
                                        <div className="flex gap-2">
                                            <a href={`tel:${detalhesPedido.cliente?.telefone}`} className="w-11 h-11 bg-slate-100 text-[#4B0082] rounded-xl flex items-center justify-center shadow-inner hover:bg-[#82C91E]/10"><Lucide.Phone size={20} /></a>
                                            <a href={`https://wa.me/55${detalhesPedido.cliente?.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-[#25D366]/10 text-[#25D366] rounded-xl flex items-center justify-center shadow-inner hover:bg-[#25D366]/20"><Lucide.MessageCircle size={20} /></a>
                                            <button className="w-11 h-11 bg-red-50 text-[#EA1D2C] rounded-xl flex items-center justify-center shadow-inner hover:bg-red-100"><Lucide.MessagesSquare size={20} /></button>
                                        </div>
                                    </div>
                                </section>

                                {/* SEÇÃO B: CONTEÚDO DO PEDIDO (ALTA LEITURA) */}
                                <section className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Lucide.IceCream size={12}/>Itens do Pedido</p>
                                    {detalhesPedido.itens?.map((it, idx) => (
                                        <div key={idx} className="flex gap-4 items-start border-l-4 border-[#82C91E] pl-4">
                                            <div className="font-[1000] text-[#4B0082] text-xl leading-none pt-1">{it.quantidade || 1}x</div>
                                            <div className="flex-1">
                                                {/* HIERARQUIA V1.2 mantida */}
                                                <h3 className="text-base font-[1000] uppercase italic text-[#4B0082] leading-tight mb-0.5">{it.detalhes?.tamanho || it.tamanho}</h3>
                                                <h4 className="text-xs font-black uppercase text-[#82C91E] leading-tight mb-2">{it.detalhes?.baseNome || it.baseNome}</h4>
                                                {/* Adicionais limpos */}
                                                <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                                                    {it.detalhes?.cobertura_detalhes && <p className="text-[11px] font-bold text-pink-600 uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-pink-500 rounded-full"/>COBERTURA: {it.detalhes.cobertura_detalhes.nome || it.detalhes.cobertura_detalhes}</p>}
                                                    {(it.detalhes?.acompanhamentos_detalhes || []).map((ac, i) => <p key={i} className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-300 rounded-full"/>{ac.nome || ac}</p>)}
                                                    {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => <p key={`add-${i}`} className="text-[11px] font-black text-[#4B0082] uppercase flex items-center gap-1.5"><Lucide.Plus size={10}/>{ad.qtd}x {ad.nome || ad}</p>)}
                                                </div>
                                                {it.observacao && <div className="mt-2 bg-amber-50 border border-amber-200 p-3 rounded-xl"><p className="text-[11px] font-black text-amber-700 uppercase italic">⚠️ OBS: {it.observacao}</p></div>}
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                {/* SEÇÃO C: LOGÍSTICA DE ENTREGA */}
                                <section>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Lucide.MapPin size={12}/>Logística</p>
                                    <div className="bg-slate-100 p-5 rounded-3xl border border-slate-200">
                                        {detalhesPedido.tipoPedido === 'ENTREGA' ? (
                                            <>
                                                <p className="text-[11px] font-[1000] uppercase text-slate-700">{detalhesPedido.endereco?.rua}, {detalhesPedido.endereco?.numero}</p>
                                                <p className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">{detalhesPedido.endereco?.bairro} • {detalhesPedido.endereco?.complemento}</p>
                                            </>
                                        ) : (
                                            <p className="text-xs font-black uppercase text-[#4B0082] flex items-center gap-1.5"><Lucide.Store size={14} /> Retirada no Balcão</p>
                                        )}
                                        {detalhesPedido.observacao && <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded mt-2 uppercase">💬 Obs: {detalhesPedido.observacao}</p>}
                                    </div>
                                </section>

                                {/* SEÇÃO D: FINANCEIRO E CUPOM (NOVO) */}
                                <section className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Lucide.Wallet size={12}/>Pagamento e Valores</p>
                                    <div className="flex justify-between items-center text-sm font-black uppercase text-[#4B0082] italic">
                                        <span>Total</span>
                                        <span>R$ {detalhesPedido.valores?.total?.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">{detalhesPedido.pagamento?.metodo || 'A definir'}</p>
                                    
                                    {/* Destaque de Cupom usado */}
                                    {detalhesPedido.cupom && (
                                        <div className="mt-2 bg-[#82C91E]/10 border border-[#82C91E]/30 p-2 rounded-lg text-[9px] font-black text-[#82C91E] uppercase flex items-center gap-1.5 animate-pulse">
                                            <Lucide.Tag size={12}/> Cupom Usado: "{detalhesPedido.cupom.codigo}"
                                        </div>
                                    )}
                                </section>

                            </div>

                            {/* RODAPÉ: AÇÕES GIGANTES (TÁTICO ONE-TAP) */}
                            <footer className="p-6 bg-white border-t border-slate-100 rounded-t-[2.5rem] shadow-sm z-10 relative">
                                {detalhesPedido.status === 'PENDENTE' || detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? (
                                    <div className="flex gap-3">
                                        {/* Botão Aceitar (Blindado se online pendente) */}
                                        <button 
                                            disabled={detalhesPedido.status === 'AGUARDANDO_PAGAMENTO'}
                                            onClick={() => moverStatus(detalhesPedido, 'FILA', 'horarioAceito')} 
                                            className={`flex-1 py-5 rounded-3xl font-[1000] uppercase italic text-sm shadow-xl active:scale-95 transition-all flex justify-center items-center gap-3 ${detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? 'bg-slate-200 text-slate-400 shadow-none' : 'bg-[#EA1D2C] text-white hover:bg-[#d01927]'}`}
                                        >
                                            {detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? 'Aguardando PIX' : 'Aceitar Pedido'} 
                                            {detalhesPedido.status === 'AGUARDANDO_PAGAMENTO' ? <Lucide.Lock size={18}/> : <Lucide.ThumbsUp size={18}/>}
                                        </button>
                                        {/* Botão de Cancelar no Modal */}
                                        <button onClick={() => { if(window.confirm("Deseja CANCELAR o pedido?")) { moverStatus(detalhesPedido, 'CANCELADO', 'horarioConcluido'); } }} className="w-20 py-5 bg-red-50 text-red-500 rounded-3xl flex justify-center items-center active:scale-95"><Lucide.Trash2 size={18} /></button>
                                    </div>
                                ) : (
                                    // Ação Genérica (Preparo/Despacho) movida para o Rodapé do Modal
                                    <button onClick={() => moverStatus(detalhesPedido)} className={`w-full py-5 rounded-3xl font-[1000] uppercase italic text-sm shadow-xl active:scale-95 transition-all flex justify-center items-center gap-3 ${detalhesPedido.status === 'FILA' || detalhesPedido.status === 'EM_PREPARO' ? 'bg-amber-500 text-white' : 'bg-[#82C91E] text-[#4B0082]'}`}>
                                        {['FILA', 'EM_PREPARO'].includes(detalhesPedido.status) ? 'Marcar como Pronto' : 'Avançar Pedido'} <Lucide.ChevronRight size={20} strokeWidth={3} />
                                    </button>
                                )}
                            </footer>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}