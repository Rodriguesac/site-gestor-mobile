import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { useUser } from '../context/UserContext'; 
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalEndereco from '../components/ModalEndereco';

export default function HomeDashboard() {
  const navigate = useNavigate();
  const { userData, enderecoAtivo, fotoPerfil } = useUser();
  
  const [layout, setLayout] = useState(null);
  const [pedidoAtivo, setPedidoAtivo] = useState(null);
  
  // A LINHA ABAIXO FOI ADICIONADA PARA CORRIGIR O ERRO
  const [isModalEndOpen, setIsModalEndOpen] = useState(false);

  // 1. Saudação por horário
  const saudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  // 2. Escuta o Layout do Admin
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuracoes", "home"), (snap) => {
      if (snap.exists()) setLayout(snap.data());
    });
    return () => unsub();
  }, []);

  // 3. Busca Pedidos Ativos
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(collection(db, "pedidos"), where("cliente.uid", "==", userData.uid), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const ativo = snap.docs[0].data();
        if (!['ENTREGUE', 'CANCELADO', 'CONCLUIDO'].includes(ativo.status?.toUpperCase())) {
          setPedidoAtivo({ id: snap.docs[0].id, ...ativo });
        } else { setPedidoAtivo(null); }
      }
    });
    return () => unsub();
  }, [userData]);

  if (!layout) return <div className="h-screen bg-[#1F0137] flex items-center justify-center text-[#82C91E] font-black italic animate-pulse text-xs uppercase tracking-widest">Sincronizando Rodrigues...</div>;

  return (
    <div className="flex flex-col min-h-screen pb-28 font-sans relative overflow-x-hidden bg-transparent">
      
      {/* MARCA D'ÁGUA NO FUNDO */}
      <div className="fixed inset-0 z-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
          <h1 className="text-[20vw] font-[1000] uppercase italic text-[#4B0082] rotate-[-25deg] whitespace-nowrap">Rodrigues Açaí</h1>
      </div>

      {/* HEADER PREMIUM REATIVO */}
      <header className="px-6 pt-12 pb-8 bg-white rounded-b-[3.5rem] shadow-2xl z-20 mx-1 mt-1 border-b border-slate-100 relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 text-left">
            <button onClick={() => navigate('/perfil')} className="w-14 h-14 bg-[#4B0082] rounded-2xl flex items-center justify-center shadow-lg border-2 border-transparent hover:border-[#82C91E] overflow-hidden transition-all">
                {fotoPerfil ? (
                    <img src={fotoPerfil} className="w-full h-full object-cover" alt="Perfil" />
                ) : (
                    <Lucide.User size={28} className="text-white" />
                )}
            </button>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1 tracking-widest">
                {saudacao()}, {userData?.nome?.split(' ')[0] || 'Cliente'}!
              </p>
              <h1 className="text-xl font-[1000] italic uppercase text-[#4B0082] leading-none tracking-tighter">
                Rodrigues <span className="text-[#82C91E]">Açaí</span>
              </h1>
            </div>
          </div>
          <button onClick={() => navigate('/avisos')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] border border-slate-100 shadow-inner">
            <Lucide.Bell size={22} />
          </button>
        </div>

        {/* BARRA DE LOCALIZAÇÃO DO CONTEXTO */}
        {layout.mostrarLocalizacao && (
          <button onClick={() => setIsModalEndOpen(true)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-3xl flex items-center justify-between shadow-inner active:scale-95 transition-all">
            <div className="flex items-center gap-3 overflow-hidden text-left">
              <Lucide.MapPin size={18} className="text-[#82C91E]" strokeWidth={3} />
              <div className="overflow-hidden">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entregar em:</p>
                <p className="text-[11px] font-bold text-[#4B0082] truncate uppercase italic">
                  {enderecoAtivo ? `${enderecoAtivo.rua}, ${enderecoAtivo.numero}` : 'Toque para selecionar'}
                </p>
              </div>
            </div>
          </button>
        )}
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-6 space-y-6 relative z-10">
        
        {/* RADAR DE PEDIDO ATIVO */}
        <AnimatePresence>
          {pedidoAtivo && (
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={() => navigate(`/acompanhamento/${pedidoAtivo.id}`)} className="bg-[#82C91E] p-5 rounded-[2.5rem] flex items-center gap-4 cursor-pointer shadow-xl shadow-[#82C91E]/20 text-left">
              <Lucide.Truck size={20} className="text-[#4B0082] animate-bounce" />
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase text-[#4B0082]/60">Seu açaí está a caminho!</p>
                <h2 className="text-sm font-[1000] uppercase italic text-[#4B0082] leading-tight">{pedidoAtivo.status}</h2>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTÃO PRINCIPAL DINÂMICO */}
        {layout.btnPrincipal?.visivel && (
          <button onClick={() => navigate('/monte-seu-acai')} style={{ backgroundColor: layout.btnPrincipal.cor }} className="group relative w-full p-8 rounded-[3rem] shadow-2xl active:scale-[0.98] transition-all text-left overflow-hidden">
            <div className="relative z-10">
                <Lucide.Zap size={28} className="text-[#82C91E] mb-5 w-fit" />
                <h2 className="text-3xl font-[1000] text-white italic uppercase tracking-tighter leading-none mb-2">{layout.btnPrincipal.titulo}</h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Toque para começar</p>
            </div>
            <Lucide.IceCream className="absolute -right-8 -bottom-8 text-white/5 rotate-12" size={220} />
          </button>
        )}
<button 
  onClick={() => navigate('/leilao')} 
  className="w-full p-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-[2.5rem] flex items-center justify-between shadow-lg"
>
  <div className="text-left text-white">
    <h3 className="font-[1000] italic uppercase leading-none">Leilão de Copos</h3>
    <p className="text-[9px] font-bold uppercase opacity-60">Copos com descontos de até 60%</p>
  </div>
  <Lucide.Gavel className="text-[#82C91E]" size={28} />
</button>
      </main>

      {/* NAVBAR FIXA */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-10 py-6 flex justify-between items-center shadow-[0_-15px_40px_rgba(0,0,0,0.08)] rounded-t-[3rem] z-40">
        <button className="text-[#4B0082] flex flex-col items-center gap-1 scale-110"><Lucide.Home size={24} strokeWidth={3} /></button>
        <button onClick={() => navigate('/cardapio')} className="text-slate-300 flex flex-col items-center gap-1"><Lucide.Search size={24}/></button>
        <button onClick={() => navigate('/carrinho')} className="text-slate-300 flex flex-col items-center gap-1"><Lucide.ShoppingBag size={24}/></button>
        <button onClick={() => navigate('/perfil')} className="text-slate-300 flex flex-col items-center gap-1"><Lucide.User size={24}/></button>
      </footer>

      {/* MODAL DE ENDEREÇO */}
      <ModalEndereco isOpen={isModalEndOpen} onClose={() => setIsModalEndOpen(false)} />
    </div>
  );
}