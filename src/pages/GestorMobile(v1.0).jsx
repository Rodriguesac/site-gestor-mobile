import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GestorMobile() {
    const [pedidos, setPedidos] = useState([]);
    const [abaAtiva, setAbaAtiva] = useState('NOVOS'); // NOVOS | COZINHA | DESPACHO
    const [lojaAberta, setLojaAberta] = useState(true);
    const [alertasAtivos, setAlertasAtivos] = useState(false);
    const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

    // 1. SINCRONIZAÇÃO E ALERTA SONORO
    useEffect(() => {
        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc")); // Mais antigos primeiro (fila de chegada)
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Dispara som se houver um NOVO pedido PENDENTE e os alertas estiverem ativos
            const novosPendentes = docs.filter(p => p.status === 'PENDENTE' || p.status === 'AGUARDANDO_PAGAMENTO');
            
            setPedidos(prev => {
                const pendentesAntigos = prev.filter(p => p.status === 'PENDENTE' || p.status === 'AGUARDANDO_PAGAMENTO');
                if (alertasAtivos && novosPendentes.length > pendentesAntigos.length) {
                    audioRef.current.play().catch(e => console.log("Áudio bloqueado pelo navegador", e));
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // Vibra o telemóvel
                }
                return docs;
            });
        });
        return () => unsubscribe();
    }, [alertasAtivos]);

    // 2. FILTRAGEM DE ABAS (Estilo iFood Gestor)
    const getPedidosFiltrados = () => {
        if (abaAtiva === 'NOVOS') return pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status));
        if (abaAtiva === 'COZINHA') return pedidos.filter(p => ['FILA', 'EM_PREPARO'].includes(p.status));
        if (abaAtiva === 'DESPACHO') return pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status));
        return [];
    };

    // 3. MOTOR DE STATUS (Ações Rápidas)
    const avancarStatus = async (pedido, novoStatus, logField) => {
        try {
            if (navigator.vibrate) navigator.vibrate(50);
            await updateDoc(doc(db, "pedidos", pedido.id), {
                status: novoStatus,
                [logField]: serverTimestamp()
            });
        } catch (e) {
            alert("Erro ao atualizar pedido. Verifique a internet.");
        }
    };

    // 4. TEMPO DE ESPERA
    const calcularTempo = (data) => {
        if (!data) return '0m';
        const inicio = data.toDate ? data.toDate() : new Date(data);
        const diff = Math.floor((new Date() - inicio) / 60000);
        return diff > 60 ? `${Math.floor(diff/60)}h ${diff%60}m` : `${diff}m`;
    };

    // Configuração das Abas
    const abas = [
        { id: 'NOVOS', label: 'Novos', count: pedidos.filter(p => ['PENDENTE', 'AGUARDANDO_PAGAMENTO'].includes(p.status)).length, cor: 'bg-[#EA1D2C]' },
        { id: 'COZINHA', label: 'Cozinha', count: pedidos.filter(p => ['FILA', 'EM_PREPARO'].includes(p.status)).length, cor: 'bg-amber-500' },
        { id: 'DESPACHO', label: 'Despacho', count: pedidos.filter(p => ['PRONTO', 'SAIU_ENTREGA'].includes(p.status)).length, cor: 'bg-[#82C91E]' }
    ];

    return (
        <div className="min-h-screen bg-[#f5f5f5] font-sans pb-24 selection:bg-[#EA1D2C]/30">
            
            {/* HEADER FIXO TÁTICO */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                
                {/* Ativador de Áudio (Exigência dos Navegadores Mobile) */}
                {!alertasAtivos && (
                    <button onClick={() => { setAlertasAtivos(true); audioRef.current.play(); }} className="w-full bg-[#EA1D2C] text-white p-3 flex items-center justify-center gap-2 font-black uppercase text-xs animate-pulse">
                        <Lucide.VolumeX size={16} /> Toque aqui para ativar o "Apito" de Pedidos!
                    </button>
                )}

                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#EA1D2C] rounded-xl flex items-center justify-center text-white shadow-md">
                            <Lucide.Store size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="font-[1000] text-slate-800 uppercase italic text-sm leading-none">Gestor Mobile</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Rodrigues Açaí</p>
                        </div>
                    </div>
                    <button onClick={() => setLojaAberta(!lojaAberta)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-inner border ${lojaAberta ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {lojaAberta ? '🟢 Loja Aberta' : '🔴 Loja Fechada'}
                    </button>
                </div>

                {/* NAVEGAÇÃO POR ABAS (Estilo App) */}
                <div className="flex px-2 pb-2 gap-2">
                    {abas.map(aba => (
                        <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1 border-b-4 
                            ${abaAtiva === aba.id ? `bg-white border-[#EA1D2C] text-slate-800 shadow-md` : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>
                            {aba.label}
                            {aba.count > 0 ? (
                                <span className={`${aba.cor} text-white px-2 py-0.5 rounded text-[10px]`}>{aba.count}</span>
                            ) : (
                                <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded">0</span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            {/* LISTA DE PEDIDOS */}
            <main className="p-3 space-y-4">
                <AnimatePresence>
                    {getPedidosFiltrados().length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 opacity-40">
                            <Lucide.CheckCircle2 size={60} className="text-slate-400 mb-4" />
                            <p className="font-black uppercase italic text-slate-500">Nenhum pedido nesta etapa</p>
                        </motion.div>
                    ) : (
                        getPedidosFiltrados().map((pedido) => {
                            const tempo = calcularTempo(pedido.createdAt);
                            const isAtrasado = parseInt(tempo) > 15 && abaAtiva !== 'DESPACHO';
                            const isAguardandoPagamento = pedido.status === 'AGUARDANDO_PAGAMENTO';

                            return (
                                <motion.div key={pedido.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} 
                                    className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${isAtrasado ? 'border-red-300' : 'border-slate-200'}`}>
                                    
                                    {/* CABEÇALHO DO CARD */}
                                    <div className={`p-4 flex justify-between items-start border-b ${isAguardandoPagamento ? 'bg-amber-50 border-amber-100' : 'border-slate-100'}`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">#{pedido.id.slice(-4)}</span>
                                                <span className={`text-[11px] font-[1000] uppercase italic flex items-center gap-1 ${isAtrasado ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                                    <Lucide.Clock size={12}/> {tempo}
                                                </span>
                                            </div>
                                            <h2 className="text-lg font-[1000] uppercase text-[#4B0082] leading-none tracking-tighter">{pedido.cliente?.nome || 'Cliente Local'}</h2>
                                            {isAguardandoPagamento && (
                                                <p className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1 mt-1.5"><Lucide.AlertTriangle size={12}/> Pagamento Pendente</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-slate-400">Total</p>
                                            <p className="text-sm font-[1000] italic text-[#82C91E]">R$ {pedido.valores?.total?.toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>

                                    {/* ITENS DO PEDIDO (ALTA LEGIBILIDADE) */}
                                    <div className="p-4 space-y-4">
                                        {pedido.itens?.map((it, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-slate-100 border border-slate-200 text-[#4B0082] font-[1000] text-sm w-8 h-8 flex items-center justify-center rounded-lg shrink-0">
                                                        {it.quantidade || 1}x
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-[1000] uppercase italic text-[#4B0082] leading-tight">{it.detalhes?.tamanho || it.tamanho}</h3>
                                                        <h4 className="text-[11px] font-black uppercase text-[#82C91E] leading-tight mb-1">{it.detalhes?.baseNome || it.baseNome}</h4>
                                                        
                                                        {/* ADICIONAIS LIMPOS */}
                                                        <div className="space-y-1 mt-2">
                                                            {it.detalhes?.cobertura_detalhes && (
                                                                <p className="text-[11px] font-bold text-pink-600 uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-pink-500 rounded-full"/>{it.detalhes.cobertura_detalhes.nome || it.detalhes.cobertura_detalhes}</p>
                                                            )}
                                                            {(it.detalhes?.acompanhamentos_detalhes || []).map((ac, i) => (
                                                                <p key={i} className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-300 rounded-full"/>{ac.nome || ac}</p>
                                                            ))}
                                                            {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => (
                                                                <p key={`add-${i}`} className="text-[11px] font-black text-[#4B0082] uppercase flex items-center gap-1.5"><Lucide.Plus size={10}/>{ad.qtd}x {ad.nome || ad}</p>
                                                            ))}
                                                        </div>
                                                        {it.observacao && (
                                                            <div className="mt-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                                                                <p className="text-[11px] font-black text-amber-700 uppercase italic">⚠️ OBS: {it.observacao}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* INFORMAÇÕES DE ENTREGA / RETIRADA */}
                                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 bg-slate-50 p-3 rounded-xl">
                                            {pedido.tipoPedido === 'ENTREGA' ? (
                                                <>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1"><Lucide.Bike size={12} className="text-[#EA1D2C]" /> Delivery ({pedido.endereco?.tipo || 'Local'})</p>
                                                    <p className="text-[11px] font-[1000] uppercase text-slate-700">{pedido.endereco?.rua}, {pedido.endereco?.numero}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-500">{pedido.endereco?.bairro} {pedido.endereco?.complemento && `- ${pedido.endereco.complemento}`}</p>
                                                </>
                                            ) : (
                                                <p className="text-xs font-black uppercase text-[#4B0082] flex items-center gap-1.5"><Lucide.Store size={14} /> Retirada no Balcão</p>
                                            )}
                                            
                                            {pedido.observacao && (
                                                <div className="mt-2 text-[10px] font-black uppercase text-red-500 border border-red-200 bg-red-50 p-2 rounded">
                                                    💬 {pedido.observacao}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* AÇÕES (BOTÕES GIGANTES PARA TOQUE FÁCIL) */}
                                    <div className="p-3 bg-slate-50 border-t border-slate-200">
                                        {abaAtiva === 'NOVOS' && (
                                            <button 
                                                disabled={isAguardandoPagamento}
                                                onClick={() => avancarStatus(pedido, 'EM_PREPARO', 'horarioPreparo')} 
                                                className={`w-full py-4 rounded-2xl font-[1000] uppercase italic text-sm shadow-md transition-all flex justify-center items-center gap-2 ${isAguardandoPagamento ? 'bg-slate-200 text-slate-400' : 'bg-[#EA1D2C] text-white active:scale-95'}`}
                                            >
                                                {isAguardandoPagamento ? 'Aguardando Cliente Pagar' : 'Aceitar Pedido'} {isAguardandoPagamento ? <Lucide.Lock size={18}/> : <Lucide.ThumbsUp size={18}/>}
                                            </button>
                                        )}
                                        
                                        {abaAtiva === 'COZINHA' && (
                                            <button 
                                                onClick={() => avancarStatus(pedido, 'PRONTO', 'horarioPronto')} 
                                                className="w-full py-4 bg-amber-500 text-white rounded-2xl font-[1000] uppercase italic text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-2"
                                            >
                                                Marcar como Pronto <Lucide.CheckCircle2 size={18}/>
                                            </button>
                                        )}

                                        {abaAtiva === 'DESPACHO' && (
                                            <div className="flex gap-2">
                                                {pedido.status === 'PRONTO' && pedido.tipoPedido === 'ENTREGA' && (
                                                    <button onClick={() => avancarStatus(pedido, 'SAIU_ENTREGA', 'horarioEntrega')} className="flex-1 py-4 bg-cyan-500 text-white rounded-2xl font-[1000] uppercase italic text-xs shadow-md active:scale-95 transition-all">
                                                        Saiu p/ Entrega
                                                    </button>
                                                )}
                                                <button onClick={() => avancarStatus(pedido, 'CONCLUIDO', 'horarioConcluido')} className="flex-1 py-4 bg-[#82C91E] text-[#4B0082] rounded-2xl font-[1000] uppercase italic text-xs shadow-md active:scale-95 transition-all flex justify-center items-center gap-2">
                                                    Finalizar <Lucide.Flag size={16}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}