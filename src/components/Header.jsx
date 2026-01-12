import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase'; // Ajuste o caminho se necessário
import { onAuthStateChanged } from 'firebase/auth';

export default function Header() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Monitora o usuário logado de forma segura
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  return (
    <header className="flex justify-between items-center py-6 px-1 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-black rounded-2xl p-1 shadow-lg shadow-black/20 flex items-center justify-center overflow-hidden">
          <img 
            src="https://i.ibb.co/MDJK337g/Chat-GPT-Image-30-de-dez-de-2025-13-05-06.png" 
            alt="Logo" 
            className="w-full h-full object-contain transform scale-110"
          />
        </div>

        <div className="flex flex-col">
          <h1 className="text-xl font-[1000] italic leading-none tracking-tighter uppercase text-slate-900">
            Rodrigues<br />
            <span className="text-[#32CD32]">Açaí</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-[#32CD32] rounded-full animate-pulse"></span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Aberto agora
            </span>
          </div>
        </div>
      </div>

      <button 
        onClick={() => navigate('/perfil')} 
        className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden active:scale-90 transition-all"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-400 font-bold text-xs">
            {user?.displayName ? user.displayName.charAt(0) : 'R'}
          </div>
        )}
      </button>
    </header>
  );
}