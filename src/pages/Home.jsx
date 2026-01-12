import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const promocoes = [
    {
      id: 1,
      titulo: "Combo Verão",
      preco: "19,90",
      img: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=1200"
    },
    {
      id: 2,
      titulo: "Barca Premium",
      preco: "45,00",
      img: "https://images.unsplash.com/photo-1516685018646-527ad952f519?auto=format&fit=crop&q=80&w=1200"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === promocoes.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [promocoes.length]);

  return (
    <div className="flex flex-col w-full bg-[#0b0e13] min-h-screen">
      
      {/* 1. HERO BANNER - ESTILO DASHBOARD COINS */}
      <section className="w-full pt-4 px-4 md:px-10">
        <div className="max-w-[1920px] mx-auto">
          <div 
            onClick={() => navigate('/monte-seu-acai')}
            className="relative h-40 md:h-64 overflow-hidden cursor-pointer group rounded-[2rem] border border-white/5 bg-[#161922] shadow-2xl shadow-black"
          >
            {/* Background com Grid de Pontos (Efeito Gaming) */}
            <div className="absolute inset-0 opacity-20" 
                 style={{ backgroundImage: 'radial-gradient(#82C91E 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}></div>
            
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0e13] via-transparent to-[#82C91E]/10 transition-opacity group-hover:opacity-100"></div>
            
            <div className="relative h-full flex items-center justify-between px-8 md:px-20">
              <div className="flex flex-col z-10">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 bg-[#82C91E] rounded-full animate-pulse shadow-[0_0_8px_#82C91E]" />
                   <span className="text-[#82C91E] font-black text-[10px] uppercase tracking-[0.3em]">Exclusivo</span>
                </div>
                <h3 className="text-3xl md:text-6xl font-[1000] italic uppercase leading-tight tracking-tighter text-white">
                  Monte do <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#82C91E] to-[#94d82d]">
                    Seu Jeito
                  </span>
                </h3>
                <button className="mt-4 bg-[#82C91E] text-[#0b0e13] font-black text-[10px] px-6 py-2 rounded-xl w-fit uppercase tracking-widest hover:scale-105 transition-transform">
                  Começar Agora
                </button>
              </div>
              
              <img 
                src="https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png" 
                className="h-28 md:h-52 w-auto object-contain drop-shadow-[0_20px_50px_rgba(130,201,30,0.3)] group-hover:rotate-6 transition-transform duration-500"
                alt="Açaí" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. CARROSSEL DE PROMOÇÕES - ESTILO SLIDER PREMIUM */}
      <section className="px-4 md:px-10 py-8">
        <div className="max-w-[1920px] mx-auto relative h-72 md:h-[450px] overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#161922]">
          {promocoes.map((promo, index) => (
            <div 
              key={promo.id}
              className={`absolute inset-0 transition-all duration-700 flex items-center ${
                index === currentSlide ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
              }`}
            >
              {/* Overlay Escuro para Legibilidade */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e13] via-[#0b0e13]/40 to-transparent z-10"></div>
              
              <img src={promo.img} className="absolute inset-0 w-full h-full object-cover scale-110" alt={promo.titulo} />
              
              <div className="relative z-20 px-10 md:px-24 text-white">
                <span className="bg-[#82C91E] text-[#0b0e13] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter mb-4 inline-block">
                  Oferta do Dia
                </span>
                <h2 className="text-4xl md:text-8xl font-[1000] italic uppercase leading-none mb-4 tracking-tighter shadow-black drop-shadow-2xl">
                  {promo.titulo}
                </h2>
                <div className="flex items-center gap-4">
                  <div className="text-4xl md:text-6xl font-[1000] italic text-[#82C91E] drop-shadow-[0_0_15px_rgba(130,201,30,0.4)]">
                    R$ {promo.preco}
                  </div>
                  <button className="bg-white/10 backdrop-blur-md border border-white/10 text-white p-4 rounded-2xl hover:bg-white/20 transition-all">
                    <Lucide.ChevronRight size={24} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Indicadores de Slide */}
          <div className="absolute bottom-6 right-10 z-30 flex gap-2">
            {promocoes.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-8 bg-[#82C91E]' : 'w-2 bg-white/20'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3. CATEGORIAS QUICK LINK (Opcional, estilo Coins) */}
      <section className="px-4 md:px-10 pb-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[1920px] mx-auto w-full">
         {['Açaí', 'Bebidas', 'Combos', 'Extras'].map((cat) => (
           <div key={cat} className="bg-[#161922] border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center gap-3 group cursor-pointer hover:border-[#82C91E]/30 transition-all">
              <div className="w-12 h-12 bg-[#82C91E]/10 rounded-2xl flex items-center justify-center text-[#82C91E] group-hover:scale-110 transition-transform">
                <Lucide.Zap size={24} fill="currentColor" />
              </div>
              <span className="text-white font-black uppercase text-[10px] tracking-widest">{cat}</span>
           </div>
         ))}
      </section>
    </div>
  );
}