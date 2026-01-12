import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';

export default function Perfil() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('@RodriguesAcai:user');
    navigate('/');
  };

  const menuItems = [
    { 
      id: 1, 
      title: 'Meus Dados', 
      sub: 'Informações da sua conta', 
      icon: <Lucide.UserCircle size={22} />, 
      path: '/perfil/meus-dados' 
    },
    { 
      id: 2, 
      title: 'Meus Pedidos', 
      sub: 'Histórico e status atual', 
      icon: <Lucide.ClipboardList size={22} />, 
      path: '/pedidos' 
    },
    { 
      id: 3, 
      title: 'Endereços', 
      sub: 'Locais de entrega salvos', 
      icon: <Lucide.MapPin size={22} />, 
      path: '/meus-enderecos' 
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b0e13] text-zinc-400">
      {/* ESPAÇADOR PARA O HEADER FIXO */}
      <div className="h-4" />

      <div className="w-full max-w-4xl mx-auto px-4 py-6 pb-24">
        
        {/* BOTÃO VOLTAR - Estilo Glassmorphism */}
        <div className="flex items-center mb-8">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-3 text-white/70 hover:text-[#82C91E] transition-all group"
          >
            <div className="bg-[#161922] p-2.5 rounded-xl border border-white/5 shadow-xl group-active:scale-90 transition-transform">
              <Lucide.ArrowLeft size={18} />
            </div>
            <span className="font-black uppercase italic text-[10px] tracking-widest">Voltar para o App</span>
          </button>
        </div>

        {/* HEADER DO PERFIL - Estilo Player Card */}
        <div className="flex flex-col items-center text-center mb-10 bg-[#161922] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Brilho de fundo sutil */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#82C91E]/5 blur-[50px] pointer-events-none" />
          
          <div className="relative mb-6">
            {/* Avatar com borda neon Coins.game */}
            <div className="w-24 h-24 bg-[#0b0e13] rounded-[2rem] flex items-center justify-center border-2 border-[#82C91E] shadow-[0_0_20px_rgba(130,201,30,0.2)]">
              <Lucide.User size={40} className="text-[#82C91E]" />
            </div>
            <button className="absolute -bottom-1 -right-1 bg-[#161922] p-2 rounded-xl border border-white/10 shadow-lg text-zinc-400 hover:text-white transition-colors">
              <Lucide.Camera size={16} />
            </button>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-2xl font-[1000] italic uppercase text-white leading-none tracking-tighter">
              {user?.displayName || 'Jogador Rodrigues'}
            </h2>
            <div className="inline-block mt-2 bg-[#82C91E]/10 px-3 py-1 rounded-full border border-[#82C91E]/20">
              <p className="text-[9px] text-[#82C91E] font-black uppercase italic tracking-[0.1em]">
                VIP Nível 1 • Rodrigues Açaí
              </p>
            </div>
          </div>
        </div>

        {/* LISTA DE OPÇÕES (MENU) - Estilo Game Lobby */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-5 p-5 bg-[#161922] border border-white/5 rounded-[1.8rem] hover:border-[#82C91E]/30 transition-all group text-left active:scale-[0.98] shadow-lg"
            >
              <div className="bg-[#0b0e13] p-3 rounded-2xl text-zinc-500 group-hover:text-[#82C91E] group-hover:shadow-[0_0_15px_rgba(130,201,30,0.2)] transition-all">
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-[13px] text-white uppercase italic leading-none group-hover:text-[#82C91E] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1.5 tracking-wider">
                  {item.sub}
                </p>
              </div>
              <div className="text-zinc-700 group-hover:text-[#82C91E] transition-colors">
                <Lucide.ChevronRight size={20} strokeWidth={3} />
              </div>
            </button>
          ))}
        </div>

        {/* BOTÃO SAIR - Estilo Danger Button Cassino */}
        <button
          onClick={handleLogout}
          className="w-full mt-12 flex items-center justify-center gap-3 p-5 bg-[#1a1d29] text-zinc-500 border border-white/5 rounded-[1.8rem] font-[1000] uppercase italic text-[11px] hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 shadow-xl"
        >
          <Lucide.LogOut size={18} strokeWidth={3} />
          Encerrar Sessão
        </button>
      </div>
    </div>
  );
}