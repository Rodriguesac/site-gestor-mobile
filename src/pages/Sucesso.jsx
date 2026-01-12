import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function Sucesso() {
  const navigate = useNavigate();
  const lastOrderId = localStorage.getItem('@RodriguesAcai:lastOrderId');

  useEffect(() => {
    // Se não houver ID de pedido, volta para o início
    if (!lastOrderId) {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastOrderId, navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
        <Lucide.Check size={48} strokeWidth={3} />
      </div>
      
      <h1 className="text-3xl font-[1000] uppercase italic text-zinc-900 mb-2">Pagamento Aprovado!</h1>
      <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mb-8">
        Seu pedido já foi enviado para a nossa cozinha.
      </p>

      <button 
        onClick={() => navigate(`/acompanhamento/${lastOrderId}`)}
        className="bg-[#EA1D2C] text-white px-10 py-5 rounded-[2rem] font-black uppercase italic shadow-xl hover:scale-105 transition-all flex items-center gap-3"
      >
        Acompanhar Pedido <Lucide.ArrowRight size={20} />
      </button>
    </div>
  );
}