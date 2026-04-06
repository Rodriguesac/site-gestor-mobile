import React, { useEffect, useState } from "react";
import { db, auth } from "../../services/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import * as Lucide from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('andamento'); 
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
        navigate('/');
        return;
    }

    // Busca os pedidos vinculados ao UID do cliente
    const q = query(
      collection(db, "pedidos"),
      where("cliente.uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [navigate]);

  const aoClicarNoPedido = (pedido) => {
    // Independentemente do status, mandamos para o acompanhamento que tem o resumo completo
    navigate(`/acompanhamento/${pedido.id}`);
  };

  // Filtro Inteligente (Aba + Busca)
  const pedidosFiltrados = pedidos.filter(p => {
    const isFinalizado = ['CONCLUIDO', 'ENTREGUE', 'CANCELADO', 'RETORNO'].includes(p.status?.toUpperCase());
    const passaAba = abaAtiva === 'andamento' ? !isFinalizado : isFinalizado;
    
    const termoBusca = busca.toLowerCase();
    const idAbreviado = p.id.slice(-5).toLowerCase();
    const dataFormatada = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : '';
    const statusStr = p.status?.toLowerCase() || '';

    const passaBusca = !busca || 
        idAbreviado.includes(termoBusca) || 
        dataFormatada.includes(termoBusca) || 
        statusStr.includes(termoBusca);

    return passaAba && passaBusca;
  });

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(50); };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Lucide.Loader2 className="w-10 h-10 text-[#82C91E] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      
      {/* HEADER PREMIUM COM BOTÃO VOLTAR */}
      <header className="bg-white px-6 pt-10 pb-8 rounded-b-[3rem] shadow-xl border-b border-slate-100 mb-6 sticky top-0 z-50">
        <div className="max-w-[500px] mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => { vibrar(); navigate(-1); }} 
                    className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all border border-slate-100"
                >
                    <Lucide.ChevronLeft size={28} strokeWidth={3} />
                </button>
                <div>
                    <h1 className="text-2xl font-[1000] italic uppercase tracking-tighter text-[#4B0082] leading-none">
                    Meus <span className="text-[#82C91E]">Pedidos</span>
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Histórico completo</p>
                </div>
            </div>

            {/* BARRA DE BUSCA INTELIGENTE */}
            <div className="relative">
                <input 
                    type="text" 
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por código, data ou status..." 
                    className="w-full bg-slate-50 border border-slate-200 p-4 pl-12 rounded-2xl text-[#4B0082] font-black text-xs outline-none focus:border-[#82C91E] transition-all"
                />
                <Lucide.Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                {busca && (
                    <button onClick={() => setBusca('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                        <Lucide.XCircle size={16} />
                    </button>
                )}
            </div>
        </div>
      </header>

      <main className="px-6 max-w-[500px] mx-auto space-y-6">
        
        {/* ABAS DE NAVEGAÇÃO */}
        <div className="flex bg-white p-1.5 rounded-[2rem] shadow-sm border border-slate-100">
            <button 
            onClick={() => { vibrar(); setAbaAtiva('andamento'); }}
            className={`flex-1 py-3.5 rounded-[1.5rem] font-black italic uppercase text-[10px] transition-all flex items-center justify-center gap-2 ${abaAtiva === 'andamento' ? 'bg-[#4B0082] text-[#82C91E] shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
            >
            <Lucide.Clock size={16} className={abaAtiva === 'andamento' ? 'animate-pulse' : ''} /> Em Andamento
            </button>
            <button 
            onClick={() => { vibrar(); setAbaAtiva('finalizado'); }}
            className={`flex-1 py-3.5 rounded-[1.5rem] font-black italic uppercase text-[10px] transition-all flex items-center justify-center gap-2 ${abaAtiva === 'finalizado' ? 'bg-[#4B0082] text-[#82C91E] shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
            >
            <Lucide.CheckCircle2 size={16} /> Concluídos
            </button>
        </div>

        {/* LISTA DE PEDIDOS */}
        <div className="space-y-4">
            <AnimatePresence>
                {pedidosFiltrados.map((pedido) => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={pedido.id}
                    onClick={() => aoClicarNoPedido(pedido)}
                    className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-100 cursor-pointer group active:scale-[0.98] transition-all hover:border-[#82C91E]/50 relative overflow-hidden"
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${abaAtiva === 'andamento' ? 'bg-[#82C91E]/10 text-[#82C91E]' : 'bg-slate-100 text-slate-400'}`}>
                                {abaAtiva === 'andamento' ? <Lucide.Timer size={20} /> : <Lucide.PackageCheck size={20} />}
                            </div>
                            <div>
                                <h3 className="font-[1000] italic uppercase text-[#4B0082] text-sm leading-none">
                                    Pedido #{pedido.id.slice(-5).toUpperCase()}
                                </h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    {pedido.createdAt?.toDate ? pedido.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-[1000] italic text-[#4B0082] block leading-none">R$ {pedido.valores?.total?.toFixed(2) || '0.00'}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase">{pedido.itens?.length} Itens</span>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${abaAtiva === 'andamento' ? 'bg-[#82C91E] animate-pulse' : 'bg-slate-400'}`} />
                            <span className="text-[10px] font-black uppercase text-[#4B0082] italic">Status: {pedido.status}</span>
                        </div>
                        <Lucide.ChevronRight size={16} className="text-[#82C91E] group-hover:translate-x-1 transition-transform" />
                    </div>
                </motion.div>
                ))}
            </AnimatePresence>

            {pedidosFiltrados.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 flex flex-col items-center gap-3">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <Lucide.SearchX size={40} className="text-slate-300" />
                    </div>
                    <h3 className="text-[#4B0082] font-[1000] uppercase italic text-lg">Nenhum Pedido</h3>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest max-w-[200px]">
                        Não encontramos nada com esses filtros.
                    </p>
                </motion.div>
            )}
        </div>

      </main>
    </div>
  );
}