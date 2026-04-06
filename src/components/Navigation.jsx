import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { db, auth } from "../services/firebase"; 
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import ModalEndereco from './ModalEndereco'; 

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const controls = useAnimation();
  const constraintsRef = useRef(null);
  const popoverRef = useRef(null);
  
  // INICIA COM O TEMA SALVO OU DARK POR PADRÃO
  const [isDark, setIsDark] = useState(() => {
    const salvo = localStorage.getItem('tema_rodrigues');
    return salvo !== null ? salvo === 'dark' : true;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  
  const [notificacoes, setNotificacoes] = useState([]);
  const [temNotificacaoNova, setTemNotificacaoNova] = useState(false);
  const [lidas, setLidas] = useState(() => JSON.parse(localStorage.getItem('notif_lidas') || '[]'));

  const [enderecoInfo, setEnderecoInfo] = useState({ 
    bairro: 'Definir endereço', rua: 'Toque para localizar', km: '0.0', taxa: '0,00'
  });

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setShowNotifPopover(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. ESCUTAR NOTIFICAÇÕES (DO PAINEL)
  useEffect(() => {
    const user = auth.currentUser;
    const q = query(collection(db, "campanhas_notificacoes"), orderBy("createdAt", "desc"), limit(5));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(n => !n.destinatarios || n.destinatarios.length === 0 || n.destinatarios.includes(user?.uid));
      
      setNotificacoes(lista);
      
      const novas = lista.some(n => !lidas.includes(n.id));
      setTemNotificacaoNova(novas);
    });
    return () => unsubscribe();
  }, [lidas]);

  const marcarComoLida = (id) => {
    if (!lidas.includes(id)) {
      const novaLista = [...lidas, id];
      setLidas(novaLista);
      localStorage.setItem('notif_lidas', JSON.stringify(novaLista));
    }
  };

  // 2. SINCRONIZAÇÃO DE ENDEREÇO E TEMA
  const carregarEnderecoDoStorage = () => {
    const salvo = localStorage.getItem('endereco_rodrigues');
    if (salvo) {
      const data = JSON.parse(salvo);
      setEnderecoInfo({
        bairro: data.bairro || 'Bairro não definido',
        rua: data.rua || 'Rua não definida',
        km: data.km || '0.0',
        taxa: data.taxa || '0,00'
      });
    }
  };

  useEffect(() => {
    // PERSISTÊNCIA DO TEMA
    const temaSalvo = localStorage.getItem('tema_rodrigues') || 'dark';
    document.documentElement.classList.toggle('dark', temaSalvo === 'dark');
    setIsDark(temaSalvo === 'dark');
    
    carregarEnderecoDoStorage();
    window.addEventListener('enderecoAtualizado', carregarEnderecoDoStorage);
    window.addEventListener('storage', carregarEnderecoDoStorage);
    return () => {
      window.removeEventListener('enderecoAtualizado', carregarEnderecoDoStorage);
      window.removeEventListener('storage', carregarEnderecoDoStorage);
    };
  }, []);

  // 3. ANIMAÇÃO DA LOGO
  useEffect(() => {
    const interval = setInterval(() => {
      const sorteio = Math.floor(Math.random() * 12) + 1;
      if (sorteio === 1) {
        controls.start({ scale: [1, 1.4, 1], transition: { duration: 0.5 } });
      } else if (sorteio === 2) {
        controls.start({ x: [0, -5, 5, -5, 5, 0], transition: { duration: 0.3 } });
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [controls]);

  const resetLogoPosition = () => {
    setTimeout(() => {
      controls.start({ x: 0, y: 0, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 40, damping: 15 } });
    }, 4000); 
  };

  const navItems = [
    { icon: <Lucide.Home size={20} />, label: 'Início', path: '/' },
    { icon: <Lucide.Search size={20} />, label: 'Busca', path: '/busca' },
    { icon: <Lucide.ClipboardList size={20} />, label: 'Pedidos', path: '/pedidos' },
  ];

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[110]" />

      <header className="fixed top-0 left-0 right-0 z-[100] bg-[var(--bg-home)] border-b border-[var(--border-home)] shadow-md transition-all">
        <div className="max-w-[1600px] mx-auto px-5">
          
          <div className="h-20 md:h-28 flex items-center gap-4 lg:gap-8">
            
            <div className="w-20 h-20 md:w-32 md:h-32 flex items-center justify-center shrink-0">
              <motion.div
                drag
                dragConstraints={constraintsRef}
                dragElastic={0.8}
                animate={controls}
                onDragEnd={resetLogoPosition}
                whileDrag={{ scale: 1.1, rotate: 10 }}
                className="pointer-events-auto cursor-grab z-[120]"
              >
                <img 
                  src="https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png" 
                  className="h-14 w-14 md:h-24 md:w-24 object-contain select-none" 
                  draggable="false"
                />
              </motion.div>
            </div>

            <nav className="hidden xl:flex items-center gap-2">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-[1000] uppercase text-[11px] transition-all ${
                    location.pathname === item.path ? 'bg-[#82C91E] text-black' : 'text-zinc-500 hover:bg-white/5'
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex flex-1 justify-center">
              <div onClick={() => setModalOpen(true)} className="w-full max-w-md h-14 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl flex items-center px-5 gap-3 cursor-pointer">
                <Lucide.MapPin size={18} className="text-[#82C91E]" />
                <div className="flex flex-col text-left truncate">
                  <span className="text-[11px] font-black uppercase text-[var(--text-home)] truncate">
                    {enderecoInfo.rua}, {enderecoInfo.bairro}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase italic leading-none">
                    {enderecoInfo.km} KM • TAXA: R$ {enderecoInfo.taxa}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3 ml-auto relative" ref={popoverRef}>
              
              <button 
                onClick={() => setShowNotifPopover(!showNotifPopover)}
                className="hidden md:flex p-3 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-[#82C91E] transition-all relative"
              >
                <Lucide.Bell size={20} />
                {temNotificacaoNova && (
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-[var(--bg-home)] animate-pulse"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifPopover && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-80 bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[150]"
                  >
                    <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase italic text-[#82C91E]">Avisos Recentes</h4>
                      <Lucide.Zap size={14} className="text-[#82C91E]" />
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto custom-scrollbar bg-black/20">
                      {notificacoes.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 text-[10px] font-black uppercase">Sem avisos</div>
                      ) : (
                        notificacoes.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { marcarComoLida(n.id); navigate('/todas-notificacoes'); }}
                            className={`p-4 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer ${lidas.includes(n.id) ? 'opacity-40 border-l-4 border-transparent' : 'opacity-100 border-l-4 border-[#82C91E]'}`}
                          >
                            <p className="text-[11px] font-[1000] uppercase text-white leading-tight">{n.titulo}</p>
                            <span className="text-[8px] font-black text-[#82C91E] uppercase mt-1 block">
                              {n.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <button 
                      onClick={() => { navigate('/todas-notificacoes'); setShowNotifPopover(false); }}
                      className="w-full py-4 bg-[#82C91E] text-black text-[10px] font-[1000] uppercase italic transition-all"
                    >
                      Ver Tudo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => navigate('/perfil')} className="hidden md:flex items-center gap-3 px-4 py-3 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl">
                <Lucide.User size={18} />
                <span className="text-[10px] font-[1000] uppercase">Minha Conta</span>
              </button>

              <button 
                onClick={() => { 
                  const novoTema = !isDark ? 'dark' : 'light';
                  setIsDark(!isDark); 
                  document.documentElement.classList.toggle('dark');
                  localStorage.setItem('tema_rodrigues', novoTema);
                }} 
                className="p-3 md:p-4 rounded-xl bg-zinc-100 dark:bg-white/5 text-[#82C91E]"
              >
                {isDark ? <Lucide.Sun size={20} /> : <Lucide.Moon size={20} />}
              </button>

              <button onClick={() => navigate('/carrinho')} className="p-3 md:px-5 md:py-4 bg-[#82C91E] text-black rounded-xl shadow-lg flex items-center gap-3 active:scale-95 transition-all">
                <Lucide.ShoppingBag size={20} strokeWidth={3} />
                <span className="hidden sm:block font-[1000] uppercase text-[11px]">Sacola</span>
              </button>
            </div>
          </div>

          <div className="md:hidden pb-4">
            <div onClick={() => setModalOpen(true)} className="w-full h-14 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl flex items-center px-4 gap-3">
              <Lucide.MapPin size={18} className="text-[#82C91E] shrink-0" />
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-[11px] font-black uppercase text-[var(--text-home)] truncate">{enderecoInfo.rua}, {enderecoInfo.bairro}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase italic truncate">{enderecoInfo.km} KM • TAXA: R$ {enderecoInfo.taxa}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[var(--bg-home)] border-t border-[var(--border-home)] px-6 py-3 flex justify-between items-center shadow-2xl">
        {[...navItems, { icon: <Lucide.Bell size={24} />, label: 'Avisos', path: '/todas-notificacoes' }].map((item) => (
          <button key={item.label} onClick={() => navigate(item.path)} className={`flex flex-col items-center gap-1 ${location.pathname === item.path ? 'text-[#82C91E]' : 'text-zinc-500'}`}>
            <div className="relative">
              {item.icon}
              {item.label === 'Avisos' && temNotificacaoNova && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full"></span>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="h-36 md:h-28"></div> 
      <ModalEndereco isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}