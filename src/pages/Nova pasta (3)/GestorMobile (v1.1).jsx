import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GestorMobileV12() {
    const [pedidos, setPedidos] = useState([]);
    const [abaAtiva, setAbaAtiva] = useState('NOVOS'); // NOVOS | COZINHA | PRONTOS
    const [lojaAberta, setLojaAberta] = useState(true);
    const [alertasAtivos, setAlertasAtivos] = useState(false);
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    
    // Alerta sonoro tático
    const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

    // 1. SINCRONIZAÇÃO EM TEMPO REAL
    useEffect(() => {
        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Lógica de Alerta para novos pedidos PENDENTES
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

    // 2. FILTRAGEM POR ETAPAS OPERACIONAIS
    const getPedidosFiltrados = () => {
        if (abaAtiva === 'NOVOS') return pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status));
        if (abaAtiva === 'COZINHA') return pedidos.filter(p => ['FILA', 'EM_PREPARO'].includes(p.status));
        if (abaAtiva === 'PRONTOS') return pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status));
        return [];
    };

    // 3. AVANÇO DE STATUS (One-Tap)
    const moverStatus = async (pedido) => {
        const fluxo = {
            'PENDENTE': { status: 'FILA', log: 'horarioAceito' },
            'FILA': { status: 'EM_PREPARO', log: 'horarioPreparo' },
            'EM_PREPARO': { status: 'PRONTO', log: 'horarioPronto' },
            'PRONTO': { status: 'SAIU_ENTREGA', log: 'horarioEntrega' },
            'SAIU_ENTREGA': { status: 'CONCLUIDO', log: 'horarioConcluido' }
        };

        const config = fluxo[pedido.status];
        if (config) {
            if (navigator.vibrate) navigator.vibrate(60);
            await updateDoc(doc(db, "pedidos", pedido.id), {
                status: config.status,
                [config.log]: serverTimestamp()
            });
        }
    };

    const calcularMinutos = (data) => {
        if (!data) return 0;
        const inicio = data.toDate ? data.toDate() : new Date(data);
        return Math.floor((new Date() - inicio) / 60000);
    };

    return (
        <div className="min-h-screen bg-[#F2F2F2] font-sans pb-24 selection:bg-[#EA1D2C]/20">
            
            {/* HEADER TÁTICO IFOOD 2023 */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
                {!alertasAtivos && (
                    <button onClick={() => { setAlertasAtivos(true); audioRef.current.play(); }} className="w-full bg-[#EA1D2C] text-white p-3 flex items-center justify-center gap-2 font-black uppercase text-[10px] animate-pulse">
                        <Lucide.VolumeX size={14} /> Ativar Alerta de Pedidos
                    </button>
                )}

                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#EA1D2C] rounded-xl flex items-center justify-center text-white shadow-lg">
                            <Lucide.ShoppingBag size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="font-[1000] text-slate-800 uppercase italic text-sm leading-none">Gestor Rodrigues</h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mobile V1.2</p>
                        </div>
                    </div>
                    <button onClick={() => setLojaAberta(!lojaAberta)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-inner border ${lojaAberta ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {lojaAberta ? '● Aberta' : '○ Fechada'}
                    </button>
                </div>

                {/* ABAS DE NAVEGAÇÃO */}
                <div className="flex px-2 pb-2 gap-2">
                    {[
                        { id: 'NOVOS', label: 'Novos', count: pedidos.filter(p => p.status === 'PENDENTE').length, cor: 'text-[#EA1D2C]' },
                        { id: 'COZINHA', label: 'Cozinha', count: pedidos.filter(p => ['FILA', 'EM_PREPARO'].includes(p.status)).length, cor: 'text-amber-500' },
                        { id: 'PRONTOS', label: 'Prontos', count: pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status)).length, cor: 'text-[#82C91E]' }
                    ].map(aba => (
                        <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex flex-col items-center border-b-4 
                            ${abaAtiva === aba.id ? `bg-white border-[#EA1D2C] text-slate-900 shadow-md` : 'bg-slate-50 border-transparent text-slate-400'}`}>
                            <span className="flex items-center gap-1.5">
                                {aba.label}
                                {aba.count > 0 && <span className={`px-1.5 py-0.5 rounded-full bg-slate-100 ${aba.cor} text-[10px]`}>{aba.count}</span>}
                            </span>
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

                        return (
                            <motion.div key={pedido.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 100 }}
                                className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden ${isAtrasado ? 'border-red-200 bg-red-50/20' : 'border-white'}`}>
                                
                                <div className="p-4" onClick={() => setDetalhesPedido(pedido)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-black">#{pedido.id.slice(-4).toUpperCase()}</span>
                                            <span className={`text-[11px] font-black uppercase flex items-center gap-1 ${isAtrasado ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                                <Lucide.Clock size={12}/> {minutos}m
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-[1000] italic text-[#4B0082]">R$ {pedido.valores?.total?.toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>

                                    <h2 className="text-lg font-[1000] uppercase text-slate-800 leading-none mb-4 truncate">{pedido.cliente?.nome || 'Balcão'}</h2>

                                    {/* LISTAGEM DE ITENS COMPACTA */}
                                    <div className="space-y-3">
                                        {pedido.itens?.map((it, idx) => (
                                            <div key={idx} className="flex items-start gap-3 border-l-4 border-[#82C91E] pl-3">
                                                <div className="font-[1000] text-[#4B0082] text-sm leading-none pt-1">{it.quantidade || 1}x</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-black uppercase text-slate-800 leading-tight">{it.detalhes?.tamanho || it.tamanho}</p>
                                                    <p className="text-[11px] font-bold text-[#82C91E] uppercase leading-tight">{it.detalhes?.baseNome || it.baseNome}</p>
                                                    
                                                    {/* ADICIONAIS EM DESTAQUE */}
                                                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                                        {it.detalhes?.cobertura_detalhes && <span className="text-[9px] font-black text-pink-500 uppercase">COBERTURA: {it.detalhes.cobertura_detalhes}</span>}
                                                        {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => (
                                                            <span key={i} className="text-[9px] font-black text-[#4B0082] uppercase">+ {ad.qtd}x {ad.nome}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* BOTÃO DE AÇÃO GIGANTE (Full-Width) */}
                                <div className="px-3 pb-3">
                                    <button onClick={() => moverStatus(pedido)} 
                                        className={`w-full py-5 rounded-2xl font-[1000] uppercase italic text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-3
                                        ${abaAtiva === 'NOVOS' ? 'bg-[#EA1D2C] text-white' : abaAtiva === 'COZINHA' ? 'bg-amber-500 text-white' : 'bg-[#82C91E] text-[#4B0082]'}`}>
                                        {abaAtiva === 'NOVOS' ? 'Aceitar Pedido' : abaAtiva === 'COZINHA' ? 'Marcar como Pronto' : 'Despachar / Finalizar'}
                                        <Lucide.ChevronRight size={20} strokeWidth={3} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </main>

            {/* MODAL DE DETALHES COMPLETO (Inspirado no App) */}
            <AnimatePresence>
                {detalhesPedido && (
                    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} 
                        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end">
                        <div className="bg-white w-full h-[85vh] rounded-t-[3.5rem] overflow-hidden flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h3 className="font-[1000] uppercase text-[#4B0082]">Pedido #{detalhesPedido.id.slice(-4).toUpperCase()}</h3>
                                <button onClick={() => setDetalhesPedido(null)} className="p-2 bg-slate-100 rounded-full text-slate-400"><Lucide.X size={24} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <section>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                    <h4 className="text-xl font-black text-slate-800 uppercase">{detalhesPedido.cliente?.nome}</h4>
                                    <p className="text-sm font-bold text-[#4B0082]">{detalhesPedido.cliente?.telefone}</p>
                                </section>
                                <section className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Entrega</p>
                                    <p className="text-sm font-black text-slate-700 uppercase leading-tight">{detalhesPedido.endereco?.rua}, {detalhesPedido.endereco?.numero}</p>
                                    <p className="text-xs font-bold text-slate-500 uppercase mt-1">{detalhesPedido.endereco?.bairro} • {detalhesPedido.endereco?.complemento}</p>
                                </section>
                                {detalhesPedido.observacao && (
                                    <section className="bg-amber-50 border border-amber-100 p-5 rounded-3xl">
                                        <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Observação do Pedido</p>
                                        <p className="text-sm font-bold text-amber-800 uppercase italic">"{detalhesPedido.observacao}"</p>
                                    </section>
                                )}
                            </div>
                            <div className="p-6 bg-slate-50">
                                <button onClick={() => { moverStatus(detalhesPedido); setDetalhesPedido(null); }} 
                                    className="w-full py-5 bg-[#EA1D2C] text-white rounded-3xl font-[1000] uppercase italic shadow-xl">
                                    Avançar Status Agora
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}