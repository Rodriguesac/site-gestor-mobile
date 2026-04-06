import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { motion } from 'framer-motion';

// ATENÇÃO AOS CAMINHOS: Voltando duas pastas (../../) para acessar services e context
import { db } from "../../services/firebase"; 
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '../../context/UserContext'; 

// Sua chave ImgBB
const IMGBB_API_KEY = 'e3e4b384bff32476d8b8c517a0e31582';

export default function Perfil() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // Dados globais blindados pelo UserContext
  const { userData, fotoPerfil, atualizarFotoPerfil, logout, loading: contextLoading } = useUser();
  
  const [loadingEstat, setLoadingEstat] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [estatisticas, setEstatisticas] = useState({ totalPedidos: 0, pontos: 0 });

  // 1. CARREGAR ESTATÍSTICAS DE GAMIFICAÇÃO
  useEffect(() => {
    if (!userData?.uid) return;

    const fetchPedidos = async () => {
      try {
        const q = query(collection(db, "pedidos"), where("cliente.uid", "==", userData.uid));
        const querySnapshot = await getDocs(q);
        const total = querySnapshot.size;
        
        // Cada pedido vale 15 pontos no Rodrigues Fidelidade
        setEstatisticas({ totalPedidos: total, pontos: total * 15 });
      } catch (e) {
        console.error("Erro ao buscar estatísticas", e);
      } finally {
        setLoadingEstat(false);
      }
    };

    fetchPedidos();
  }, [userData]);

  // 2. UPLOAD DE FOTO (IMGBB + CONTEXTO)
  const handleUploadFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const resData = await res.json();

      if (resData.success) {
        const newPhotoURL = resData.data.url;
        // Atualiza globalmente (reflete na Home na hora!)
        await atualizarFotoPerfil(newPhotoURL);
      } else {
        alert("Erro no upload para os servidores da imagem.");
      }
    } catch (error) {
      alert("Falha de conexão ao enviar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
      if(window.confirm("Deseja realmente desconectar sua conta?")) {
          await logout();
          navigate('/');
      }
  };

  if (contextLoading || loadingEstat) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
            <Lucide.Loader2 size={40} className="animate-spin text-[#82C91E]" />
            <p className="font-black italic uppercase text-[10px] tracking-widest text-[#4B0082]">Acessando sua conta...</p>
        </div>
      );
  }

  // 3. LÓGICA DE NÍVEL VIP
  const getNivel = () => {
      if (estatisticas.pontos > 500) return { nome: 'Diamante', cor: 'from-cyan-400 to-blue-500', icon: <Lucide.Gem size={14}/>, shadow: 'shadow-cyan-500/30' };
      if (estatisticas.pontos > 200) return { nome: 'Ouro', cor: 'from-yellow-400 to-amber-500', icon: <Lucide.Crown size={14}/>, shadow: 'shadow-amber-500/30' };
      return { nome: 'Prata', cor: 'from-slate-300 to-slate-400', icon: <Lucide.Star size={14}/>, shadow: 'shadow-slate-400/30' };
  };

  const nivel = getNivel();

  // 4. ITENS DO MENU
  const menuItems = [
    { id: 'dados', label: 'Meus Dados Pessoais', sub: 'Nome, CPF e Contato', icon: <Lucide.User size={22}/>, rota: '/meus-dados' },
    { id: 'enderecos', label: 'Locais de Entrega', sub: 'Gerencie seus endereços', icon: <Lucide.MapPin size={22}/>, rota: '/meus-enderecos' },
    { id: 'pedidos', label: 'Histórico de Pedidos', sub: 'Re-peça seus favoritos', icon: <Lucide.Receipt size={22}/>, rota: '/pedidos' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28 relative overflow-x-hidden selection:bg-[#82C91E]/30">
      
      {/* MARCA D'ÁGUA PREMIUM NO FUNDO */}
      <div className="fixed inset-0 z-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
          <h1 className="text-[20vw] font-[1000] uppercase italic text-[#4B0082] rotate-[-25deg] whitespace-nowrap">Rodrigues Açaí</h1>
      </div>

      <div className="relative z-10">
          
          {/* HEADER: AVATAR E ESTATÍSTICAS */}
          <header className="bg-white px-6 pt-12 pb-10 rounded-b-[3.5rem] shadow-2xl border-b border-slate-100 relative">
            <div className="flex justify-between items-start mb-2">
                <button onClick={() => navigate(-1)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all border border-slate-100 hover:bg-[#82C91E]/10">
                    <Lucide.ChevronLeft size={28} strokeWidth={3} />
                </button>
                <button onClick={handleLogout} className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 shadow-inner active:scale-90 transition-all border border-red-100 hover:bg-red-500 hover:text-white">
                    <Lucide.LogOut size={20} strokeWidth={2.5} />
                </button>
            </div>

            <div className="flex flex-col items-center -mt-6">
                
                {/* AVATAR INTERATIVO */}
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative group mb-5">
                    <div className="w-32 h-32 bg-slate-100 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden relative">
                        {fotoPerfil ? (
                            <img src={fotoPerfil} alt="Perfil" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 bg-[#4B0082]/5">
                                <Lucide.User size={50} strokeWidth={2} />
                            </div>
                        )}
                        {uploading && (
                            <div className="absolute inset-0 bg-[#4B0082]/60 flex flex-col items-center justify-center backdrop-blur-sm">
                                <Lucide.Loader2 size={28} className="animate-spin text-[#82C91E] mb-2" />
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Enviando</span>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => fileInputRef.current.click()}
                        className="absolute -bottom-2 -right-2 w-12 h-12 bg-[#82C91E] text-[#4B0082] rounded-2xl border-[3px] border-white flex items-center justify-center shadow-lg active:scale-90 transition-all hover:scale-110"
                    >
                        <Lucide.Camera size={20} strokeWidth={2.5} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadFoto} accept="image/*" />
                </motion.div>

                {/* BADGE VIP GAMIFICADA */}
                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className={`flex items-center gap-1.5 bg-gradient-to-r ${nivel.cor} text-white px-4 py-1.5 rounded-full mb-3 shadow-lg ${nivel.shadow}`}>
                    {nivel.icon} <span className="text-[10px] font-black uppercase tracking-widest pt-0.5">Cliente {nivel.nome}</span>
                </motion.div>
                
                <motion.h2 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-[1000] uppercase italic text-[#4B0082] leading-none text-center px-4 tracking-tighter">
                    {userData?.nome || 'Membro VIP'}
                </motion.h2>
                <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {userData?.email}
                </motion.p>
            </div>

            {/* ESTATÍSTICAS RÁPIDAS */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 text-center shadow-inner relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -translate-x-full group-hover:translate-x-full" />
                    <Lucide.ShoppingBag size={16} className="absolute top-4 left-4 text-slate-200" />
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedidos Feitos</span>
                    <span className="text-3xl font-[1000] italic text-[#4B0082]">{estatisticas.totalPedidos}</span>
                </div>
                <div className="bg-[#82C91E] p-5 rounded-3xl text-center shadow-[0_10px_20px_rgba(130,201,30,0.2)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -translate-x-full group-hover:translate-x-full" />
                    <Lucide.Trophy size={16} className="absolute top-4 left-4 text-[#4B0082]/20" />
                    <span className="block text-[10px] font-black text-[#4B0082]/70 uppercase tracking-widest mb-1">Rodrigues Pts</span>
                    <span className="text-3xl font-[1000] italic text-[#4B0082]">{estatisticas.pontos}</span>
                </div>
            </motion.div>
          </header>

          {/* DASHBOARD DE OPÇÕES */}
          <main className="px-6 py-8 max-w-md mx-auto space-y-4">
            
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 flex items-center gap-2">
                <Lucide.Settings size={14} /> Configurações da Conta
            </h3>

            {menuItems.map((item, idx) => (
                <motion.button 
                    key={item.id} 
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + (idx * 0.1) }}
                    onClick={() => navigate(item.rota)} 
                    className="w-full bg-white p-5 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between active:scale-[0.98] transition-all group hover:shadow-2xl"
                >
                    <div className="flex items-center gap-4 text-left overflow-hidden">
                        <div className="p-3.5 bg-slate-50 text-[#4B0082] rounded-2xl group-hover:bg-[#4B0082] group-hover:text-[#82C91E] transition-all duration-300 shadow-inner">
                            {item.icon}
                        </div>
                        <div>
                            <p className="text-sm font-[1000] uppercase italic text-[#4B0082] leading-tight">{item.label}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.sub}</p>
                        </div>
                    </div>
                    <Lucide.ChevronRight size={22} strokeWidth={2.5} className="text-slate-300 group-hover:text-[#82C91E] group-hover:translate-x-1 transition-all" />
                </motion.button>
            ))}

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mt-8 mb-2 flex items-center gap-2">
                <Lucide.HeartHandshake size={14} /> Vantagens & Ajuda
            </h3>

            {/* BOTÃO DE CUPONS */}
            <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="w-full bg-white p-5 rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-between active:scale-[0.98] transition-all group">
                <div className="flex items-center gap-4 text-left">
                    <div className="p-3.5 bg-pink-50 text-pink-500 rounded-2xl group-hover:bg-pink-500 group-hover:text-white transition-all shadow-inner relative overflow-hidden">
                        <Lucide.Ticket size={22} />
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    </div>
                    <div>
                        <p className="text-sm font-[1000] uppercase italic text-[#4B0082] leading-tight">Meus Cupons</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Descontos disponíveis</p>
                    </div>
                </div>
                <Lucide.ChevronRight size={22} strokeWidth={2.5} className="text-slate-300 group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
            </motion.button>

            {/* BOTÃO DO WHATSAPP */}
            <motion.a 
                href="https://wa.me/5567999999999" target="_blank" rel="noopener noreferrer" 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                className="w-full bg-[#25D366] p-5 rounded-[2rem] shadow-[0_10px_30px_rgba(37,211,102,0.3)] flex items-center justify-between active:scale-[0.98] transition-all group mt-6 border-2 border-[#25D366] hover:bg-white"
            >
                <div className="flex items-center gap-4 text-left">
                    <div className="p-3.5 bg-white text-[#25D366] rounded-2xl transition-all shadow-sm">
                        <Lucide.MessageCircle size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-[1000] uppercase italic text-white group-hover:text-[#25D366] leading-tight transition-colors">Falar com a Loja</p>
                        <p className="text-[10px] font-black text-white/80 group-hover:text-[#25D366]/80 uppercase tracking-widest mt-0.5 transition-colors">Suporte via WhatsApp</p>
                    </div>
                </div>
                <Lucide.ExternalLink size={20} strokeWidth={3} className="text-white group-hover:text-[#25D366] transition-colors" />
            </motion.a>

          </main>
      </div>
    </div>
  );
}