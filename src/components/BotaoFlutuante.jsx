import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';

export default function BotaoFlutuante() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('tema_rodrigues') !== 'light');

  const toggleTema = () => {
    const novoTema = isDark ? 'light' : 'dark';
    localStorage.setItem('tema_rodrigues', novoTema);
    setIsDark(!isDark);
    
    // Dispara evento para sincronizar com a Navigation e outros componentes
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    const syncTema = () => {
      setIsDark(localStorage.getItem('tema_rodrigues') !== 'light');
    };
    window.addEventListener('storage', syncTema);
    return () => window.removeEventListener('storage', syncTema);
  }, []);

  return (
    <button
      onClick={toggleTema}
      className={`fixed bottom-24 right-6 z-[999] w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl transition-all active:scale-90 border
        ${isDark 
          ? 'bg-zinc-800 text-yellow-400 border-white/10 shadow-black/50' 
          : 'bg-white text-zinc-900 border-zinc-200 shadow-xl'
        }`}
      title="Alternar Tema"
    >
      {isDark ? (
        <Lucide.Sun size={20} strokeWidth={3} className="animate-in spin-in-180 duration-500" />
      ) : (
        <Lucide.Moon size={20} strokeWidth={3} className="animate-in spin-in-180 duration-500" />
      )}
    </button>
  );
}