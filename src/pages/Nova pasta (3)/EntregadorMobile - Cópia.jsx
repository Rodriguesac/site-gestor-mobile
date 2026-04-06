import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EntregadorMobile() {
    // --- ESTADOS DE NAVEGAÇÃO ---
    const [abaAtiva, setAbaAtiva] = useState('DISPONIVEIS'); // DISPONIVEIS | EM_ROTA | RESUMO
    const [pedidos, setPedidos] = useState([]);
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const [entregadorOnline, setEntregadorOnline] = useState(true);

    // 1. SINCRONIZAÇÃO DE PEDIDOS DE ENTREGA
    useEffect(() => {
        // Busca todos os pedidos, mas filtraremos localmente para entregas
        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const todosPedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Filtra apenas os que são para ENTREGA
            const apenasEntregas = todosPedidos.filter(p => p.tipoPedido === 'ENTREGA');
            setPedidos(apenasEntregas);
        });
        return () => unsubscribe();
    }, []);

    // --- FILTROS DE ABAS ---
    // Pedidos que a loja marcou como PRONTO (Aguardando motoboy)
    const pedidosDisponiveis = pedidos.filter(p => p.status === 'PRONTO');
    // Pedidos que o motoboy pegou (SAIU_ENTREGA)
    const pedidosEmRota = pedidos.filter(p => p.status === 'SAIU_ENTREGA');
    // Entregas concluídas hoje (para o resumo do motoboy)
    const entregasHoje = pedidos.filter(p => p.status === 'CONCLUIDO' && new Date(p.createdAt?.toDate?.() || p.createdAt).toDateString() === new Date().toDateString());

    // --- FUNÇÕES DE AÇÃO DO ENTREGADOR ---
    const assumirEntrega = async (pedido) => {
        if (navigator.vibrate) navigator.vibrate(50);
        try {
            await updateDoc(doc(db, "pedidos", pedido.id), { 
                status: 'SAIU_ENTREGA', 
                horarioEntrega: serverTimestamp() 
            });
            setAbaAtiva('EM_ROTA');
            setDetalhesPedido(null);
        } catch (error) {
            alert("Erro ao assumir entrega: " + error.message);
        }
    };

    const finalizarEntrega = async (pedido) => {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        if (window.confirm("Confirmar entrega ao cliente?")) {
            try {
                await updateDoc(doc(db, "pedidos", pedido.id), { 
                    status: 'CONCLUIDO', 
                    horarioConcluido: serverTimestamp() 
                });
                setDetalhesPedido(null);
                if (pedidosEmRota.length <= 1) setAbaAtiva('RESUMO');
            } catch (error) {
                alert("Erro ao finalizar entrega: " + error.message);
            }
        }
    };

    // --- FUNÇÕES DE NAVEGAÇÃO GPS ---
    const abrirGPS = (endereco) => {
        if (endereco.latlng?.lat && endereco.latlng?.lng) {
            // Se tiver latitude e longitude exatas, abre a rota direta
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${endereco.latlng.lat},${endereco.latlng.lng}`, '_blank');
        } else {
            // Busca por texto (Rua, Número, Bairro, Cidade)
            const queryMap = encodeURIComponent(`${endereco.rua}, ${endereco.numero} - ${endereco.bairro}, Campo Grande - MS`);
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${queryMap}`, '_blank');
        }
    };

    const abrirWhatsApp = (telefone, nome) => {
        const numeroLimpo = telefone.replace(/\D/g, '');
        const mensagem = `Olá ${nome}, sou o entregador do Rodrigues Açaí. Estou a caminho com o seu pedido! 🛵`;
        window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans pb-24 text-slate-900">
            
            {/* HEADER DO ENTREGADOR */}
            <header className="bg-[#EA1D2C] text-white sticky top-0 z-[100] shadow-md">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-full text-[#EA1D2C]">
                            <Lucide.Bike size={24} />
                        </div>
                        <div>
                            <h1 className="font-black text-lg leading-none uppercase tracking-wide">Entregador Pro</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">Rodrigues Açaí</p>
                        </div>
                    </div>
                    <button onClick={() => setEntregadorOnline(!entregadorOnline)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all shadow-md ${entregadorOnline ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                        {entregadorOnline ? 'Online' : 'Pausado'}
                    </button>
                </div>

                {/* ABAS DINÂMICAS */}
                <div className="flex bg-[#EA1D2C] px-2 pt-2">
                    {[
                        { id: 'DISPONIVEIS', label: 'Na Loja', count: pedidosDisponiveis.length, icon: Lucide.Store },
                        { id: 'EM_ROTA', label: 'Em Rota', count: pedidosEmRota.length, icon: Lucide.Map },
                        { id: 'RESUMO', label: 'Resumo', count: entregasHoje.length, icon: Lucide.CheckSquare }
                    ].map(aba => (
                        <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} 
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-4 flex flex-col items-center gap-1
                            ${abaAtiva === aba.id ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white/80'}`}>
                            <aba.icon size={18} className="mb-1" />
                            <div className="flex items-center gap-1">
                                {aba.label}
                                {aba.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${abaAtiva === aba.id ? 'bg-white text-[#EA1D2C]' : 'bg-white/20 text-white'}`}>{aba.count}</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </header>

            {!entregadorOnline ? (
                <div className="flex flex-col items-center justify-center pt-32 px-6 text-center opacity-50">
                    <Lucide.Coffee size={60} className="text-slate-400 mb-4" />
                    <h2 className="text-xl font-black uppercase text-slate-600">Você está offline</h2>
                    <p className="text-sm font-bold text-slate-500 mt-2">Ative o status para receber novas entregas e acessar rotas.</p>
                </div>
            ) : (
                <main className="p-3 space-y-3">
                    
                    {/* TELA: RESUMO (Ganhos e Entregas do Dia) */}
                    {abaAtiva === 'RESUMO' && (
                        <div className="space-y-4">
                            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                                <h3 className="text-slate-800 text-xs font-black uppercase tracking-widest mb-4">Seu Desempenho Hoje</h3>
                                <div className="flex justify-around items-center text-center">
                                    <div>
                                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Lucide.CheckCircle2 size={24} />
                                        </div>
                                        <p className="text-2xl font-black text-slate-800">{entregasHoje.length}</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Entregas Feitas</p>
                                    </div>
                                    <div className="w-px h-16 bg-slate-200" />
                                    <div>
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Lucide.Banknote size={24} />
                                        </div>
                                        {/* Assumindo uma taxa fixa simulada de R$ 5,00 por entrega - pode ajustar depois */}
                                        <p className="text-2xl font-black text-slate-800">R$ {(entregasHoje.length * 5).toFixed(2)}</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Ganhos (Taxas)</p>
                                    </div>
                                </div>
                            </div>
                            
                            <h3 className="font-black text-slate-600 uppercase text-xs px-2 mt-6">Últimas Entregas</h3>
                            {entregasHoje.length === 0 && <p className="text-slate-400 text-sm font-bold px-2">Nenhuma entrega finalizada hoje.</p>}
                            {entregasHoje.map(pedido => (
                                <div key={pedido.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center opacity-70">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500">#{pedido.id.slice(-4).toUpperCase()}</p>
                                        <h4 className="text-sm font-black text-slate-800">{pedido.endereco?.rua}, {pedido.endereco?.numero}</h4>
                                    </div>
                                    <div className="text-right">
                                        <Lucide.CheckCircle2 className="text-green-500 inline-block mb-1" size={18} />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Concluído</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TELA: DISPONÍVEIS OU EM ROTA */}
                    {['DISPONIVEIS', 'EM_ROTA'].includes(abaAtiva) && (
                        <AnimatePresence mode='popLayout'>
                            {(abaAtiva === 'DISPONIVEIS' ? pedidosDisponiveis : pedidosEmRota).length === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center opacity-40">
                                    <Lucide.MapPinOff size={50} className="mx-auto text-slate-400 mb-3" />
                                    <p className="font-black uppercase text-slate-500 text-sm">
                                        {abaAtiva === 'DISPONIVEIS' ? 'Nenhum pedido pronto na loja' : 'Nenhuma rota ativa'}
                                    </p>
                                </motion.div>
                            ) : (
                                (abaAtiva === 'DISPONIVEIS' ? pedidosDisponiveis : pedidosEmRota).map((pedido) => (
                                    <motion.div key={pedido.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                                        onClick={() => setDetalhesPedido(pedido)}
                                    >
                                        <div className="p-4 flex gap-4 items-center">
                                            <div className="w-12 h-12 bg-red-50 text-[#EA1D2C] rounded-full flex items-center justify-center shrink-0">
                                                <Lucide.MapPin size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-slate-400 text-xs font-bold uppercase">#{pedido.id.slice(-4).toUpperCase()}</span>
                                                    <span className="text-[#EA1D2C] font-black text-sm">R$ {pedido.valores?.total?.toFixed(2)}</span>
                                                </div>
                                                <h2 className="text-base font-black text-slate-800 leading-tight line-clamp-1">{pedido.endereco?.rua}, {pedido.endereco?.numero}</h2>
                                                <p className="text-xs font-bold text-slate-500 mt-1">{pedido.endereco?.bairro}</p>
                                            </div>
                                        </div>

                                        <div className="px-4 pb-4">
                                            {abaAtiva === 'DISPONIVEIS' ? (
                                                <button onClick={(e) => { e.stopPropagation(); assumirEntrega(pedido); }} className="w-full py-3 rounded-lg text-sm font-black text-white uppercase bg-blue-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                                                    <Lucide.Bike size={18} /> Pegar para Entrega
                                                </button>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); abrirGPS(pedido.endereco); }} className="w-full py-3 rounded-lg text-sm font-black text-white uppercase bg-[#EA1D2C] shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                                                    <Lucide.Navigation size={18} /> Iniciar Rota no GPS
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    )}
                </main>
            )}

            {/* MODAL: DETALHES COMPLETOS DA ENTREGA */}
            <AnimatePresence>
                {detalhesPedido && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'tween', duration: 0.2 }} 
                        className="fixed inset-0 z-[500] bg-[#f5f5f5] flex flex-col overflow-hidden">
                        
                        <header className="bg-white border-b border-slate-200 p-4 flex items-center gap-4 shadow-sm z-10">
                            <button onClick={() => setDetalhesPedido(null)} className="p-2 text-[#EA1D2C] active:scale-90"><Lucide.ArrowDown size={28} /></button>
                            <div>
                                <h2 className="font-black text-slate-800 text-lg uppercase tracking-wide">Detalhes da Rota</h2>
                                <p className="text-xs font-bold text-slate-500">Pedido #{detalhesPedido.id.slice(-4).toUpperCase()}</p>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                            
                            {/* BLOCO FINANCEIRO (O mais importante para o motoboy) */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-[#EA1D2C]">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Cobrança no Local</h3>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-3xl font-black text-slate-800">R$ {detalhesPedido.valores?.total?.toFixed(2)}</p>
                                        <p className="text-sm font-bold text-amber-600 mt-1 bg-amber-50 inline-block px-2 py-1 rounded">
                                            {detalhesPedido.pagamento?.metodo || 'Verificar na Nota'}
                                        </p>
                                    </div>
                                    <Lucide.Wallet className="text-slate-300" size={40} />
                                </div>
                                {detalhesPedido.pagamento?.trocoPara && (
                                    <p className="mt-3 text-sm font-black text-red-600 border border-red-200 bg-red-50 p-2 rounded">
                                        Levar troco para: R$ {detalhesPedido.pagamento.trocoPara}
                                    </p>
                                )}
                            </div>

                            {/* DADOS DO CLIENTE E CONTATO */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Cliente</h3>
                                        <p className="font-black text-slate-800 text-lg">{detalhesPedido.cliente?.nome}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => abrirWhatsApp(detalhesPedido.cliente?.telefone, detalhesPedido.cliente?.nome)} className="py-3 bg-green-50 text-green-700 rounded-lg font-black text-[11px] uppercase flex items-center justify-center gap-2 border border-green-200 active:scale-95">
                                        <Lucide.MessageCircle size={18}/> WhatsApp
                                    </button>
                                    <a href={`tel:${detalhesPedido.cliente?.telefone?.replace(/\D/g, '')}`} className="py-3 bg-blue-50 text-blue-700 rounded-lg font-black text-[11px] uppercase flex items-center justify-center gap-2 border border-blue-200 active:scale-95">
                                        <Lucide.PhoneCall size={18}/> Ligar
                                    </a>
                                </div>
                            </div>

                            {/* ENDEREÇO E NAVEGAÇÃO */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Endereço</h3>
                                <p className="text-xl font-black text-slate-800 leading-tight">{detalhesPedido.endereco?.rua}, {detalhesPedido.endereco?.numero}</p>
                                <p className="text-sm font-bold text-slate-500 mt-1">{detalhesPedido.endereco?.bairro}</p>
                                {detalhesPedido.endereco?.complemento && (
                                    <p className="mt-3 bg-slate-100 p-3 rounded-lg text-sm font-bold text-slate-700 border border-slate-200">
                                        {detalhesPedido.endereco.complemento}
                                    </p>
                                )}
                                
                                <button onClick={() => abrirGPS(detalhesPedido.endereco)} className="w-full mt-4 py-4 bg-slate-800 text-white rounded-lg font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                                    <Lucide.Navigation size={20} /> Abrir no Google Maps
                                </button>
                            </div>
                        </div>

                        {/* AÇÕES DE RODAPÉ */}
                        <footer className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-slate-200 z-50">
                            {detalhesPedido.status === 'PRONTO' ? (
                                <button onClick={() => assumirEntrega(detalhesPedido)} className="w-full py-4 rounded-xl font-black text-sm text-white uppercase bg-blue-500 shadow-lg active:scale-95 transition-all">
                                    Confirmar Retirada na Loja
                                </button>
                            ) : (
                                <button onClick={() => finalizarEntrega(detalhesPedido)} className="w-full py-4 rounded-xl font-black text-sm text-white uppercase bg-green-500 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Lucide.CheckCircle2 size={24} /> Entrega Concluída
                                </button>
                            )}
                        </footer>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}