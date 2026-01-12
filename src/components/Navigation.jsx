import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import ModalEndereco from './ModalEndereco';

export default function Navigation() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [dadosEntrega, setDadosEntrega] = useState(null);
  const [sacolaAnimando, setSacolaAnimando] = useState(false);
  const [carrinhoQtd, setCarrinhoQtd] = useState(0);

  const atualizarDados = () => {
    const endSalvo = localStorage.getItem('endereco_rodrigues');
    if (endSalvo) {
      const parsed = JSON.parse(endSalvo);
      setDadosEntrega({
        endereco: parsed.endereco,
        valor: parsed.taxa || '0,00',
        km: parsed.km || '0'
      });
    }
    
    const carrinho = JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [] };
    if (carrinho.itens.length !== carrinhoQtd) {
      setCarrinhoQtd(carrinho.itens.length);
      setSacolaAnimando(true);
      setTimeout(() => setSacolaAnimando(false), 600);
    }
  };

  useEffect(() => {
    atualizarDados();
    window.addEventListener('storage', atualizarDados);
    return () => window.removeEventListener('storage', atualizarDados);
  }, [carrinhoQtd]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-[#161922] border-b border-white/5">
        <div className="max-w-[1440px] mx-auto flex flex-col px-4 pt-2 pb-3">
          {/* LINHA 1: BRANDING + ÍCONES AMPLIADOS */}
          <div className="flex justify-between items-center h-12">
            <div className="flex flex-col leading-[0.7] cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-[#82C91E] font-[1000] italic uppercase text-xl tracking-tighter">Rodrigues</span>
              <span className="text-white font-bold uppercase text-[8px] tracking-[0.2em] self-end">Açaí</span>
            </div>

            <div className="flex items-center gap-6 mr-1">
              <button onClick={() => setIsNotifOpen(true)} className="relative text-white/80 active:scale-90">
                <Lucide.Bell size={24} />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-[#82C91E] rounded-full animate-pulse shadow-[0_0_8px_#82C91E]" />
              </button>

              <button onClick={() => navigate('/perfil')} className="text-white/80 active:scale-90">
                <Lucide.User size={24} />
              </button>

              <button 
                onClick={() => navigate('/carrinho')} 
                className={`relative text-white/80 transition-all duration-500 ${sacolaAnimando ? 'scale-125 text-[#82C91E]' : ''}`}
              >
                <Lucide.ShoppingBag size={24} />
                {carrinhoQtd > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#82C91E] text-[#0b0e13] text-[9px] font-[1000] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#161922]">
                    {carrinhoQtd}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* LINHA 2: ENDEREÇO SELETOR */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-[#0b0e13]/80 border border-white/10 rounded-2xl h-14 px-4 flex items-center justify-between mt-2 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 truncate">
              <Lucide.MapPin size={18} className="text-[#82C91E]" />
              <div className="flex flex-col text-left truncate">
                <span className="text-zinc-500 font-black text-[7px] uppercase">Entregar em</span>
                <span className="text-white font-black text-[11px] uppercase truncate">{dadosEntrega?.endereco || "Definir Local"}</span>
              </div>
            </div>
            <Lucide.ChevronDown size={14} className="text-zinc-600" />
          </button>
        </div>

        {/* MARQUEE INFERIOR */}
        <div className="bg-[#82C91E] py-1 overflow-hidden border-t border-black/10">
          <div className="flex whitespace-nowrap animate-marquee">
            <span className="text-[9px] font-[1000] uppercase text-[#0b0e13] mx-10 italic">⚡ QUALIDADE PREMIUM • ENTREGA RÁPIDA • O MELHOR AÇAÍ ⚡</span>
            <span className="text-[9px] font-[1000] uppercase text-[#0b0e13] mx-10 italic">⚡ QUALIDADE PREMIUM • ENTREGA RÁPIDA • O MELHOR AÇAÍ ⚡</span>
          </div>
        </div>
      </header>

      {/* ESTE DIV É O SEGREDO: Ele empurra o conteúdo para baixo do header fixo */}
      <div className="h-[155px]" /> 

      <ModalEndereco isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={atualizarDados} />
    </>
  );
}