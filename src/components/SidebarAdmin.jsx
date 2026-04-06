import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function SidebarAdmin() {
  const navigate = useNavigate();
  const location = useLocation();

  const menus = [
    { id: 'PDV', icon: Lucide.ChefHat, path: '/gestor-mobile', label: 'Cozinha' },
    { id: 'Torre', icon: Lucide.CloudLightning, path: '/torre-logistica', label: 'Logística' },
    { id: 'Frota', icon: Lucide.Users, path: '/painel-entregadores', label: 'Motoboys' },
    // 👇 NOVO MENU DE ENGENHARIA LOGÍSTICA (TAXAS E TEMPO) 👇
    { id: 'Engenharia', icon: Lucide.Settings2, path: '/painel-logistica', label: 'Engenharia' },
    { id: 'Cardapio', icon: Lucide.LayoutGrid, path: '/cardapio', label: 'Cardápio' },
  ];

  return (
    <div className="w-[100px] h-screen bg-[#4B0082] flex flex-col items-center py-10 gap-8 shadow-2xl z-[100]">
      <div className="w-12 h-12 bg-[#82C91E] rounded-2xl flex items-center justify-center text-[#4B0082] shadow-lg mb-4">
        <Lucide.Zap size={24} strokeWidth={3} />
      </div>
      
      {menus.map((m) => (
        <button 
          key={m.id} 
          onClick={() => navigate(m.path)} 
          className={`group relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all 
          ${location.pathname === m.path 
            ? 'bg-[#82C91E] text-[#4B0082] scale-110 shadow-lg shadow-[#82C91E]/20' 
            : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
        >
           <m.icon size={22} strokeWidth={location.pathname === m.path ? 3 : 2} />
           
           {/* Tooltip Lateral */}
           <span className="absolute left-20 bg-black text-white text-[10px] px-3 py-1.5 rounded-lg font-black uppercase opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap shadow-xl z-[200]">
               {m.label}
           </span>
        </button>
      ))}

      <button 
        onClick={() => navigate('/')} 
        className="mt-auto w-14 h-14 rounded-2xl flex items-center justify-center text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all"
      >
          <Lucide.LogOut size={22} />
      </button>
    </div>
  );
}