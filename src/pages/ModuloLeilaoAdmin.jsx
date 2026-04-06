import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

export default function ModuloLeilaoAdmin() {
    const [leiloes, setLeiloes] = useState([]);
    const [apelidos, setApelidos] = useState([]);

    useEffect(() => {
        const unsubLeiloes = onSnapshot(query(collection(db, "leiloes"), where("status", "==", "ATIVO")), (snap) => {
            setLeiloes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubApelidos = onSnapshot(query(collection(db, "usuarios"), where("leilao_status", "==", "PENDENTE")), (snap) => {
            setApelidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubLeiloes(); unsubApelidos(); };
    }, []);

    const gerenciarApelido = async (id, acao) => {
        await updateDoc(doc(db, "usuarios", id), { 
            leilao_status: acao === 'OK' ? 'APROVADO' : 'REJEITADO' 
        });
    };

    return (
        <div className="p-8 bg-[#F8FAFC] min-h-screen">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center gap-4 mb-12">
                    <div className="w-16 h-16 bg-pink-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl">
                        <Lucide.Gavel size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-[1000] uppercase italic text-[#4B0082] tracking-tighter">Sala de Arremate</h1>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Controlo de lances e moderação de participantes</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* MODERAÇÃO DE APELIDOS */}
                    <div className="lg:col-span-1 space-y-6">
                        <h2 className="text-xs font-black uppercase text-slate-400 px-2 flex items-center gap-2"><Lucide.UserCheck size={16}/> Validar Pilotos</h2>
                        {apelidos.length === 0 ? (
                            <div className="bg-white p-8 rounded-[2.5rem] border border-dashed border-slate-200 text-center opacity-50">
                                <p className="text-[10px] font-black uppercase">Nenhum pedido pendente</p>
                            </div>
                        ) : (
                            apelidos.map(user => (
                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={user.id} className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-pink-600 uppercase">Sugestão:</p>
                                        <h4 className="font-black text-[#4B0082] uppercase">{user.leilao_nickname}</h4>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => gerenciarApelido(user.id, 'NO')} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl"><Lucide.X size={20}/></button>
                                        <button onClick={() => gerenciarApelido(user.id, 'OK')} className="w-10 h-10 bg-[#82C91E] text-[#4B0082] rounded-xl shadow-md"><Lucide.Check size={20}/></button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {/* LANCES ATIVOS */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xs font-black uppercase text-slate-400 px-2 flex items-center gap-2"><Lucide.Zap size={16}/> Lances em Tempo Real</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {leiloes.map(l => (
                                <div key={l.id} className="bg-[#4B0082] p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-white">
                                    <div className="absolute top-0 right-0 opacity-10 p-4"><Lucide.Gavel size={80}/></div>
                                    <p className="text-[10px] font-black text-[#82C91E] uppercase tracking-widest mb-1">Copo #{l.pedidoOriginalId?.slice(-4)}</p>
                                    <p className="text-4xl font-[1000] italic tracking-tighter mb-6">{formatarMoeda(l.lanceAtual)}</p>
                                    
                                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10 mb-6">
                                        <p className="text-[9px] font-bold text-white/50 uppercase">Arrematante Atual:</p>
                                        <p className="font-black text-[#82C91E] uppercase">{l.ultimoLicitante || 'Sem lances'}</p>
                                    </div>

                                    <button onClick={async () => { if(confirm("Encerrar?")) await deleteDoc(doc(db,"leiloes",l.id)) }} className="w-full py-4 bg-white/10 hover:bg-red-500 transition-colors rounded-2xl font-black text-[10px] uppercase">Finalizar Leilão</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}