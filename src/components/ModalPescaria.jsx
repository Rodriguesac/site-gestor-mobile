import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function ModalPescaria({ isOpen, onClose, dados }) {
  const navigate = useNavigate();

  if (!isOpen || !dados) return null;

  // Função para lidar com os botões sem dar refresh na página
  const handleAction = (rota) => {
    onClose(); // Fecha o modal primeiro
    navigate(rota); // Navega via React Router
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Overlay Escuro com desfoque */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose} 
      />

      {/* Card do Modal */}
      <div className="relative w-full max-w-sm bg-[#0b0e13] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Imagem configurada no Admin */}
        {dados.imagem && (
          <div className="w-full h-48 relative">
            <img 
              src={dados.imagem} 
              className="w-full h-full object-cover" 
              alt="Promoção" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e13] to-transparent" />
            
            {/* Botão de Fechar no topo da imagem */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white/50 hover:text-white transition-colors"
            >
              <Lucide.X size={20} />
            </button>
          </div>
        )}

        <div className="p-8 text-center">
          {/* Ícone de Incentivo caso não tenha imagem */}
          {!dados.imagem && (
             <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] mx-auto mb-4">
                <Lucide.Gift size={32} />
             </div>
          )}

          {/* Título e Texto do Firebase */}
          <h2 className="text-2xl font-[1000] italic uppercase tracking-tighter text-white leading-tight mb-3">
            {dados.titulo || "Oferta Especial!"}
          </h2>
          
          <p className="text-[11px] font-black uppercase text-zinc-500 tracking-widest leading-relaxed mb-8">
            {dados.texto || "Cadastre-se agora para aproveitar as melhores vantagens."}
          </p>

          {/* Botões de Ação */}
          <div className="space-y-3">
            {/* Botão Principal (Geralmente Login/Cadastro) */}
            <button
              onClick={() => handleAction(dados.rota1 || '/login')}
              className="w-full py-5 bg-[#82C91E] text-black font-[1000] uppercase italic rounded-2xl text-xs shadow-lg shadow-[#82C91E]/20 hover:scale-105 active:scale-95 transition-all"
            >
              {dados.btn1 || "Entrar ou Cadastrar"}
            </button>

            {/* Botão Secundário (Geralmente Checkout Direto) */}
            <button
              onClick={() => handleAction(dados.rota2 || '/checkout')}
              className="w-full py-5 bg-white/5 text-zinc-400 font-black uppercase italic rounded-2xl text-[10px] border border-white/5 hover:bg-white/10 transition-all"
            >
              {dados.btn2 || "Continuar sem desconto"}
            </button>
          </div>

          <p className="mt-6 text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
            *Promoção válida por tempo limitado
          </p>
        </div>
      </div>
    </div>
  );
}