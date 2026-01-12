import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth, db } from '../../services/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

export default function Perfil() {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('Meninos');

  // Banco de dados de avatares estilo Netflix
  const categoriasAvatares = {
    'Meninos': [
      { id: 1, url: 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png' },
      { id: 2, url: 'https://cdn-icons-png.flaticon.com/512/8024/8024474.png' },
      { id: 3, url: 'https://cdn-icons-png.flaticon.com/512/236/236832.png' },
      { id: 4, url: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png' },
    ],
    'Meninas': [
      { id: 5, url: 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png' },
      { id: 6, url: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png' },
      { id: 7, url: 'https://cdn-icons-png.flaticon.com/512/1154/1154448.png' },
      { id: 8, url: 'https://cdn-icons-png.flaticon.com/512/6997/6997674.png' },
    ],
    'Diversos': [
      { id: 9, url: 'https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png' }, // Sua Logo
      { id: 10, url: 'https://cdn-icons-png.flaticon.com/512/6897/6897018.png' },
      { id: 11, url: 'https://cdn-icons-png.flaticon.com/512/2102/2102647.png' },
      { id: 12, url: 'https://cdn-icons-png.flaticon.com/512/714/714420.png' },
    ]
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('@RodriguesAcai:user');
    navigate('/');
  };

  const mudarAvatar = async (url) => {
    try {
      await updateProfile(auth.currentUser, { photoURL: url });
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      await updateDoc(userRef, { photoURL: url });
      setUser({ ...auth.currentUser, photoURL: url });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  const menuItems = [
    { id: 1, title: 'Meus Dados', sub: 'Informações da sua conta', icon: <Lucide.UserCircle size={22} />, path: '/perfil/meus-dados' },
    { id: 2, title: 'Meus Pedidos', sub: 'Histórico e status atual', icon: <Lucide.ClipboardList size={22} />, path: '/pedidos' },
    { id: 3, title: 'Endereços', sub: 'Locais de entrega salvos', icon: <Lucide.MapPin size={22} />, path: '/meus-enderecos' }
  ];

  return (
    <div className="min-h-screen bg-[#0b0e13] text-zinc-400">
      <div className="h-4" />

      <div className="w-full max-w-4xl mx-auto px-4 py-6 pb-24">
        
        {/* BOTÃO VOLTAR */}
        <div className="flex items-center mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-3 text-white/70 hover:text-[#82C91E] transition-all group">
            <div className="bg-[#161922] p-2.5 rounded-xl border border-white/5 shadow-xl group-active:scale-90 transition-transform">
              <Lucide.ArrowLeft size={18} />
            </div>
            <span className="font-black uppercase italic text-[10px] tracking-widest">Voltar para o App</span>
          </button>
        </div>

        {/* HEADER PERFIL */}
        <div className="flex flex-col items-center text-center mb-10 bg-[#161922] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#82C91E]/5 blur-[50px] pointer-events-none" />
          
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-[#0b0e13] rounded-[2rem] flex items-center justify-center border-2 border-[#82C91E] shadow-[0_0_20px_rgba(130,201,30,0.2)] overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} className="w-full h-full object-cover p-2" alt="Avatar" />
              ) : (
                <Lucide.User size={40} className="text-[#82C91E]" />
              )}
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="absolute -bottom-1 -right-1 bg-[#161922] p-2 rounded-xl border border-white/10 shadow-lg text-[#82C91E] hover:bg-[#82C91E] hover:text-black transition-all active:scale-90"
            >
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

        {/* MENU */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-5 p-5 bg-[#161922] border border-white/5 rounded-[1.8rem] hover:border-[#82C91E]/30 transition-all group text-left shadow-lg"
            >
              <div className="bg-[#0b0e13] p-3 rounded-2xl text-zinc-500 group-hover:text-[#82C91E] transition-all">
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-[13px] text-white uppercase italic leading-none group-hover:text-[#82C91E]">
                  {item.title}
                </h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1.5 tracking-wider">
                  {item.sub}
                </p>
              </div>
              <Lucide.ChevronRight size={20} strokeWidth={3} className="text-zinc-700 group-hover:text-[#82C91E]" />
            </button>
          ))}
        </div>

        {/* SAIR */}
        <button
          onClick={handleLogout}
          className="w-full mt-12 flex items-center justify-center gap-3 p-5 bg-[#1a1d29] text-zinc-500 border border-white/5 rounded-[1.8rem] font-[1000] uppercase italic text-[11px] hover:text-red-500 transition-all shadow-xl"
        >
          <Lucide.LogOut size={18} strokeWidth={3} />
          Encerrar Sessão
        </button>
      </div>

      {/* MODAL ESTILO NETFLIX COM ABAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-[#161922] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-white font-[1000] uppercase italic text-xl tracking-tighter">
                  Quem é <span className="text-[#82C91E]">Você?</span>
                </h3>
                <p className="text-[8px] font-black text-zinc-500 uppercase italic tracking-widest mt-1">Escolha um avatar personalizado</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-600 hover:text-white p-2">
                <Lucide.X size={24} />
              </button>
            </div>

            {/* BARRA DE ABAS */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
              {Object.keys(categoriasAvatares).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAbaAtiva(cat)}
                  className={`px-6 py-2 rounded-full font-black text-[10px] uppercase italic transition-all whitespace-nowrap border ${
                    abaAtiva === cat 
                    ? 'bg-[#82C91E] text-black border-[#82C91E]' 
                    : 'bg-[#0b0e13] text-zinc-500 border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* GRID DE AVATARES */}
            <div className="grid grid-cols-4 gap-3 mb-8">
              {categoriasAvatares[abaAtiva].map((av) => (
                <button
                  key={av.id}
                  onClick={() => mudarAvatar(av.url)}
                  className="relative aspect-square bg-[#0b0e13] rounded-2xl border-2 border-white/5 hover:border-[#82C91E] transition-all group overflow-hidden active:scale-90"
                >
                  <img src={av.url} className="w-full h-full object-cover p-1" alt="Avatar" />
                  <div className="absolute inset-0 bg-[#82C91E]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <Lucide.Check className="text-white" size={20} strokeWidth={4} />
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-[8px] font-bold text-zinc-600 uppercase italic">
              Clique no avatar para salvar instantaneamente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}