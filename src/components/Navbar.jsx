import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // Itens da navegação para manter o código limpo
  const navItems = [
    { path: '/', icon: Lucide.Home, label: 'Início' },
    { path: '/cardapio', icon: Lucide.UtensilsCrossed, label: 'Menu' },
    { path: '/monte-seu-acai', icon: Lucide.PlusCircle, label: 'Montar' },
    { path: '/pedidos', icon: Lucide.ClipboardList, label: 'Pedidos' },
    { path: '/perfil', icon: Lucide.UserCircle, label: 'Perfil' }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 z-[1000] px-4 pb-2 flex justify-around items-center overflow-hidden">
      
      {/* BACKGROUND DINÂMICO COM ONDAS */}
      <div className="absolute inset-0 -z-10">
        {/* Usando a variável de fundo que definimos no index.css */}
        <div className="absolute inset-0 bg-[var(--nav-bg)] backdrop-blur-3xl border-t border-white/5" />
        
        {/* EFEITO DE ONDAS MAIS SUAVE */}
        <div className="absolute inset-0 opacity-10 overflow-hidden">
          <div className="wave-line" />
          <div className="wave-line-delayed" />
        </div>
      </div>

      {/* RENDERIZAÇÃO DOS 5 ÍCONES */}
      {navItems.map((item) => (
        <Link 
          key={item.path}
          to={item.path} 
          className={`relative flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all duration-300 active:scale-90`}
        >
          {/* Indicador de item ativo (pontinho ou brilho) */}
          {isActive(item.path) && (
            <div className="absolute top-2 w-1 h-1 bg-[#82C91E] rounded-full shadow-[0_0_10px_#82C91E]" />
          )}

          <item.icon 
            size={22} 
            strokeWidth={isActive(item.path) ? 2.5 : 2} 
            className={`transition-colors duration-300 ${isActive(item.path) ? 'text-[#82C91E]' : 'text-zinc-500'}`}
          />
          
          <span className={`text-[9px] font-black uppercase italic tracking-tighter transition-colors duration-300 ${
            isActive(item.path) ? 'text-[#82C91E]' : 'text-zinc-500'
          }`}>
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}