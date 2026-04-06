import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase'; 
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUser } from '../context/UserContext'; 
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LeilaoCliente() {
    const navigate = useNavigate();
    const { userData } = useUser();
    
    const [leiloesAtivos, setLeiloesAtivos] = useState([]);
    const [meusArremates, setMeusArremates] = useState([]); 
    const [apelidoInput, setApelidoInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Monitora Leilões Ativos E os Finalizados que o usuário ganhou
    useEffect(() => {
        if (!userData?.uid) return;

        const qAtivos = query(collection(db, "leiloes"), where("status", "==", "ATIVO"));
        const unsubAtivos = onSnapshot(qAtivos, (snap) => {
            setLeiloesAtivos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const qGanhos = query(
            collection(db, "leiloes"), 
            where("status", "==", "FINALIZADO"),
            where("ganhadorUid", "==", userData.uid)
        );
        const unsubGanhos = onSnapshot(qGanhos, (snap) => {
            const ganhos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.pedidoGeradoId);
            setMeusArremates(ganhos);
        });

        return () => { unsubAtivos(); unsubGanhos(); };
    }, [userData]);

    const solicitarApelidoLeilao = async () => {
        if (!apelidoInput.trim() || apelidoInput.length < 3) return alert("Digite um apelido válido (mínimo 3 letras).");
        setLoading(true);
        try {
            await updateDoc(doc(db, "usuarios", userData.uid), {
                leilao_nickname: apelidoInput.toUpperCase(),
                leilao_status: 'PENDENTE'
            });
            setApelidoInput('');
        } catch (error) { alert("Erro ao enviar."); } 
        finally { setLoading(false); }
    };

    const darLance = async (leilaoId, lanceAtual) => {
        if (userData?.leilao_status !== 'APROVADO') return;
        const novoLance = Number(lanceAtual) + 1.00;
        try {
            await updateDoc(doc(db, "leiloes", leilaoId), {
                lanceAtual: novoLance,
                ultimoLicitante: userData.leilao_nickname,
                ultimoLicitanteUid: userData.uid, 
                historicoLances: arrayUnion({
                    usuario: userData.nome,
                    uid: userData.uid,
                    valor: novoLance,
                    hora: new Date()
                })
            });
        } catch (error) { console.error("Erro no lance:", error); }
    };

    const resgatarArremate = async (leilao) => {
        if(!window.confirm("Confirmar o arremate por R$ " + leilao.lanceAtual.toFixed(2) + "? (Lembrando que a taxa de entrega será combinada a parte).")) return;
        setLoading(true);
        try {
            const novoPedido = await addDoc(collection(db, "pedidos"), {
                cliente: { uid: userData.uid, nome: userData.nome, telefone: userData.telefone },
                itens: leilao.itens,
                valores: { total: leilao.lanceAtual, subtotal: leilao.lanceAtual, taxaEntrega: 0 }, 
                tipoPedido: 'ENTREGA', 
                status: 'AGUARDANDO_PAGAMENTO', 
                pagamento: { metodo: 'A Combinar na Entrega/Balcão (Leilão)' },
                origem: 'LEILAO_ARREMATE',
                observacao: '⚠️ ATENÇÃO MOTOBOY: Cobrar taxa de entrega de acordo com o endereço. Valor do app é só do copo leiloado.',
                createdAt: serverTimestamp(),
                endereco: userData.enderecos?.[0] || { rua: 'Definir no chat', numero: 'S/N' }
            });

            await updateDoc(doc(db, "leiloes", leilao.id), { pedidoGeradoId: novoPedido.id });
            navigate(`/acompanhamento/${novoPedido.id}`);
            
        } catch (error) {
            alert("Erro ao resgatar pedido.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 pb-32 bg-slate-50 min-h-screen">
            <header className="mb-8">
                <h2 className="text-3xl font-[1000] text-pink-600 italic uppercase tracking-tighter flex items-center gap-3">
                    <Lucide.Gavel size={32}/> Leilão ao Vivo
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    Disputa de copos retornados com lances a partir de R$ 1,00!
                </p>
            </header>

            {/* --- CONTROLE DE ACESSO --- */}
            {(!userData?.leilao_status || userData?.leilao_status === 'REJEITADO') ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[3rem] shadow-xl border-2 border-pink-100 text-center">
                    <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lucide.UserPlus size={40} className="text-pink-600" />
                    </div>
                    <h3 className="text-xl font-[1000] text-[#4B0082] uppercase italic mb-2">Crie seu Apelido</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Escolha um codinome para participar.</p>
                    <input 
                        type="text" maxLength={15} value={apelidoInput} onChange={(e) => setApelidoInput(e.target.value)} placeholder="Ex: REI DO AÇAÍ"
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-center text-lg font-[1000] text-[#4B0082] uppercase outline-none focus:border-pink-500 mb-4"
                    />
                    <button onClick={solicitarApelidoLeilao} disabled={loading} className="w-full py-5 bg-pink-600 text-white rounded-2xl font-[1000] text-xs uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50">
                        {loading ? 'Enviando...' : 'Entrar no Leilão'}
                    </button>
                </motion.div>

            ) : userData?.leilao_status === 'PENDENTE' ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-amber-100 p-8 rounded-[3rem] border border-amber-200 text-center shadow-lg">
                    <Lucide.Clock size={60} className="mx-auto text-amber-500 mb-6 animate-pulse" />
                    <h3 className="text-2xl font-[1000] text-amber-700 uppercase italic mb-2">Na Fila...</h3>
                    <p className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest">A loja está avaliando seu apelido "{userData.leilao_nickname}".</p>
                </motion.div>

            ) : (
                <div className="space-y-6">
                    
                    {/* ALERTA DE VITÓRIA (ARREMATES) */}
                    <AnimatePresence>
                        {meusArremates.length > 0 && meusArremates.map(arremate => (
                            <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} key={`arremate-${arremate.id}`} 
                                className="bg-gradient-to-r from-yellow-400 to-amber-500 p-8 rounded-[3rem] shadow-2xl border-4 border-yellow-200 text-center relative overflow-hidden">
                                <Lucide.PartyPopper size={120} className="absolute -top-4 -left-4 text-yellow-600/20" />
                                <div className="relative z-10">
                                    <h3 className="text-3xl font-[1000] text-[#4B0082] uppercase italic mb-2 tracking-tighter">Você Ganhou!</h3>
                                    <p className="text-[11px] font-black text-amber-900 uppercase tracking-widest mb-4">O martelo foi batido. O copo é seu por R$ {arremate.lanceAtual?.toFixed(2)}!</p>
                                    
                                    {/* 👇 NOVO AVISO DE TAXA DE ENTREGA 👇 */}
                                    <div className="bg-amber-600/10 border border-amber-600/30 p-4 rounded-2xl mb-6">
                                        <p className="text-[10px] font-[1000] text-amber-900 uppercase tracking-widest flex items-center justify-center gap-2 mb-1">
                                            <Lucide.AlertTriangle size={16} /> Taxa não inclusa
                                        </p>
                                        <p className="text-[9px] font-bold text-amber-800 uppercase leading-relaxed">
                                            O valor acima é apenas do copo leiloado. A taxa de entrega será calculada e cobrada à parte na hora da entrega.
                                        </p>
                                    </div>
                                    {/* 👆 FIM DO AVISO 👆 */}

                                    <button onClick={() => resgatarArremate(arremate)} disabled={loading} className="w-full py-5 bg-[#4B0082] text-yellow-400 rounded-2xl font-[1000] text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <Lucide.ShoppingBag size={20} /> Transformar em Pedido
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* LISTA DE LEILÕES ATIVOS */}
                    {leiloesAtivos.length === 0 ? (
                        <div className="text-center py-16 opacity-40">
                            <Lucide.Gavel size={60} className="mx-auto mb-4 text-slate-400" />
                            <p className="font-[1000] uppercase text-xs tracking-widest text-slate-500">Pregão Fechado</p>
                            <p className="font-bold uppercase text-[10px] text-slate-400 mt-2">Nenhum copo em disputa agora.</p>
                        </div>
                    ) : (
                        leiloesAtivos.map(l => (
                            <motion.div key={l.id} className="bg-gradient-to-br from-pink-600 to-purple-800 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden border-2 border-pink-400/30">
                                <div className="absolute top-0 right-0 p-4 opacity-[0.05]"><Lucide.Zap size={100} /></div>
                                
                                <div className="relative z-10 flex justify-between items-start mb-6">
                                    <span className="text-[10px] font-[1000] bg-white text-pink-600 px-4 py-2 rounded-full uppercase italic animate-pulse shadow-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-pink-600 animate-ping" /> Disputa Ativa
                                    </span>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black uppercase text-white/60 tracking-widest mb-1">Lance Atual</p>
                                        <span className="text-4xl font-[1000] text-[#82C91E] italic tracking-tighter drop-shadow-md">
                                            R$ {l.lanceAtual?.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Ficha Técnica do Copo */}
                                <div className="bg-white/10 p-5 rounded-[2rem] border border-white/20 relative z-10 mb-6">
                                    <p className="text-[10px] font-[1000] text-pink-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Lucide.IceCream size={16}/> O que vem no copo:
                                    </p>
                                    {l.itens?.map((it, idx) => (
                                        <div key={idx} className="mb-4 last:mb-0 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                                            <p className="font-[1000] text-xl uppercase italic leading-tight text-white mb-1">
                                                {it.quantidade || 1}x {it.detalhes?.tamanho || it.tamanho}
                                            </p>
                                            <p className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-2">{it.detalhes?.baseNome || it.baseNome}</p>
                                            
                                            <div className="space-y-1.5 pl-3 border-l-2 border-pink-400/50">
                                                {it.detalhes?.cobertura_detalhes && (
                                                    <p className="text-[10px] font-bold text-white/90 uppercase flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"/> 
                                                        Calda: {it.detalhes.cobertura_detalhes.nome || it.detalhes.cobertura_detalhes}
                                                    </p>
                                                )}
                                                {(it.detalhes?.acompanhamentos_detalhes || []).map((ac, i) => (
                                                    <p key={i} className="text-[10px] font-bold text-white/90 uppercase flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 bg-white/50 rounded-full"/> 
                                                        {ac.nome || ac}
                                                    </p>
                                                ))}
                                                {(it.detalhes?.adicionais_detalhes || []).map((ad, i) => (
                                                    <p key={`add-${i}`} className="text-[10px] font-black text-[#82C91E] uppercase flex items-center gap-1.5">
                                                        <Lucide.Plus size={10} strokeWidth={4}/> 
                                                        {ad.qtd}x {ad.nome || ad}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="bg-black/30 p-5 rounded-3xl border border-white/20 backdrop-blur-sm relative z-10 mb-6 flex justify-between items-center">
                                    <div>
                                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Liderando o pregão:</p>
                                        <p className="font-[1000] text-white uppercase text-xl truncate max-w-[150px]">
                                            {l.ultimoLicitante || 'Seja o 1º!'}
                                        </p>
                                    </div>
                                    <Lucide.Crown size={28} className={l.ultimoLicitante === userData.leilao_nickname ? "text-yellow-400" : "text-white/20"} />
                                </div>

                                <button onClick={() => darLance(l.id, l.lanceAtual)} className="w-full py-5 bg-[#82C91E] hover:bg-lime-400 text-[#4B0082] rounded-2xl font-[1000] text-[13px] uppercase tracking-widest shadow-xl active:scale-95 transition-all relative z-10 flex items-center justify-center gap-2">
                                    DAR LANCE DE R$ {(l.lanceAtual + 1).toFixed(2)} <Lucide.ArrowUpCircle size={18} />
                                </button>
                            </motion.div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}