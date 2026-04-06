import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function HeaderSuperior({ isDark, setIsDark, carrinhoCount = 0 }) {
  const navigate = useNavigate();
  const [temAviso, setTemAviso] = useState(true); // Pode conectar ao Firebase futuramente

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 h-20 flex items-center px-6 justify-between">
      {/* LOCALIZAÇÃO (INTELIGENTE) */}
      <div 
        onClick={() => navigate('/perfil/enderecos')}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center text-[#82C91E] group-active:scale-90 transition-all">
          <Lucide.MapPin size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-zinc-500 leading-none mb-1">Entregar em</span>
          <span className="text-xs font-bold text-white uppercase italic truncate max-w-[120px]">Minha Casa ▼</span>
        </div>
      </div>

      {/* AÇÕES LADO DIREITO (AVISOS, TEMA, SACOLA) */}
      <div className="flex items-center gap-2">
        
        {/* AVISOS (Notificações movidas para cá) */}
        <button 
          onClick={() => navigate('/notificacoes')}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 relative"
        >
          <Lucide.Bell size={22} />
          {temAviso && <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-black"></span>}
        </button>

        {/* TEMA (LUA/SOL) */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className="w-10 h-10 flex items-center justify-center text-zinc-400"
        >
          {isDark ? <Lucide.Sun size={22} /> : <Lucide.Moon size={22} />}
        </button>

        {/* SACOLA/CARRINHO */}
        <button 
          onClick={() => navigate('/carrinho')}
          className="ml-2 bg-[#82C91E] p-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-[#82C91E]/20 active:scale-90 transition-all"
        >
          <Lucide.ShoppingBag size={20} className="text-black" />
          {carrinhoCount > 0 && (
            <span className="bg-black text-[#82C91E] text-[10px] font-[1000] px-1.5 py-0.5 rounded-lg">
              {carrinhoCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}