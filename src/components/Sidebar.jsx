import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { auth } from "../services/firebase"; 

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;

  const menuItems = [
    { icon: <Lucide.Home size={22} />, label: 'Início', path: '/' },
    { icon: <Lucide.Zap size={22} />, label: 'Cardápio', path: '/cardapio' },
    { icon: <Lucide.PlusCircle size={22} />, label: 'Montar Açaí', path: '/monte-seu-acai' },
    { icon: <Lucide.History size={22} />, label: 'Meus Pedidos', path: '/pedidos' },
    { icon: <Lucide.User size={22} />, label: 'Perfil', path: '/perfil' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-0 h-screen bg-[#0f0417] border-r border-white/5 z-[100] p-6 shadow-2xl">
      
      {/* LOGO REAL RODRIGUES */}
      <div 
        onClick={() => navigate('/')} 
        className="flex items-center gap-3 mb-12 px-2 cursor-pointer group"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-[#82C91E]/20 blur-xl rounded-full group-hover:bg-[#82C91E]/40 transition-all"></div>
          <img 
            src="https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png" 
            alt="Rodrigues Açaí"
            className="w-12 h-12 object-contain relative z-10 group-hover:scale-110 transition-transform duration-500"
          />
        </div>
        <h2 className="font-[1000] italic uppercase tracking-tighter text-xl text-white">
          Rodrigues
        </h2>
      </div>

      {/* NAVEGAÇÃO ESTILO COINS.GAME */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-[11px] font-[1000] uppercase italic transition-all group ${
                active 
                  ? 'bg-[#82C91E] text-black shadow-[0_10px_20px_rgba(130,201,30,0.2)]' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`${active ? 'text-black' : 'group-hover:text-[#82C91E]'} transition-colors`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* FOOTER DA SIDEBAR (CONTA) */}
      <div className="mt-auto pt-6 border-t border-white/5">
        <button 
          onClick={() => navigate('/carrinho')}
          className="w-full bg-[#1d0b35] border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:bg-[#250e45] transition-all group mb-4"
        >
          <div className="flex items-center gap-3">
            <Lucide.ShoppingBag size={20} className="text-[#82C91E]" />
            <span className="text-[10px] font-black uppercase italic text-white">Sacola</span>
          </div>
          <Lucide.ChevronRight size={14} className="text-zinc-600 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black uppercase">
            {user?.displayName?.charAt(0) || <Lucide.User size={14}/>}
          </div>
          <div className="flex flex-col text-left truncate">
            <span className="text-[10px] font-black uppercase text-white truncate">{user?.displayName || 'Convidado'}</span>
            <span className="text-[8px] font-bold text-zinc-500 uppercase">Status: VIP Player</span>
          </div>
        </div>
      </div>
    </aside>
  );
}