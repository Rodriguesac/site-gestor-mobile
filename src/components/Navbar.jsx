import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label }) => (
    <Link to={to} className={`flex flex-col items-center gap-1 transition-all ${isActive(to) ? 'text-[#82C91E]' : 'text-zinc-500 hover:text-zinc-300'}`}>
      <Icon size={20} strokeWidth={isActive(to) ? 3 : 2} />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </Link>
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full glass-nav h-[75px] px-6 flex justify-around items-center z-[1000] border-t border-white/5">
      <NavItem to="/" icon={Lucide.Home} label="Home" />
      <NavItem to="/cardapio" icon={Lucide.Search} label="Menu" />
      
      {/* Botão Central de Destaque */}
      <Link to="/monte-seu-acai" className="relative -translate-y-5">
        <div className="w-14 h-14 bg-[#82C91E] rounded-2xl flex items-center justify-center shadow-[0_10px_20px_rgba(130,201,30,0.3)] rotate-45 active:scale-90 transition-transform">
          <Lucide.Plus className="-rotate-45 text-[#0b0e13]" size={28} strokeWidth={4} />
        </div>
      </Link>

      <NavItem to="/bebidas" icon={Lucide.CupSoda} label="Bebidas" />
      <NavItem to="/perfil" icon={Lucide.User} label="Perfil" />
    </nav>
  );
}