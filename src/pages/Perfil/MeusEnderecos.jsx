import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from "../../services/firebase";
import { collection, query, doc, deleteDoc, onSnapshot, orderBy } from 'firebase/firestore';
import ModalEndereco from '../../components/ModalEndereco';

export default function MeusEnderecos() {
  const navigate = useNavigate();
  const [enderecos, setEnderecos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enderecoParaEditar, setEnderecoParaEditar] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const q = query(collection(db, "usuarios", user.uid, "meus_enderecos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEnderecos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAbrirEdicao = (e, end) => {
    e.stopPropagation();
    setEnderecoParaEditar(end);
    setIsModalOpen(true);
  };

  const deletar = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Pretende remover este local de entrega?")) {
      await deleteDoc(doc(db, "usuarios", auth.currentUser.uid, "meus_enderecos", id));
    }
  };

  // Renderiza o ícone correto baseado na escolha do cliente no modal
  const renderizarIcone = (tipo, iconeId) => {
      if (tipo === 'Casa') return <Lucide.Home size={22} strokeWidth={2.5} />;
      if (tipo === 'Trabalho') return <Lucide.Briefcase size={22} strokeWidth={2.5} />;
      
      switch(iconeId) {
          case 'Namorada': return <Lucide.Heart size={22} strokeWidth={2.5} className="text-red-500 fill-red-500" />;
          case 'Namorado': return <Lucide.Heart size={22} strokeWidth={2.5} className="text-blue-500 fill-blue-500" />;
          case 'Amigo': return <Lucide.User size={22} strokeWidth={2.5} />;
          case 'Hotel': return <Lucide.Hotel size={22} strokeWidth={2.5} />;
          case 'Igreja': return <Lucide.Church size={22} strokeWidth={2.5} />;
          default: return <Lucide.MapPin size={22} strokeWidth={2.5} />;
      }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-[#82C91E]/30 pb-10">
      
      {/* HEADER: Flutuante e Branco (Padrão Home) */}
      <header className="shrink-0 px-8 pt-12 pb-8 bg-white rounded-b-[3rem] shadow-xl z-10 border-b border-slate-100 mx-2 mt-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] active:scale-90 transition-all shadow-inner"
          >
            <Lucide.ArrowLeft size={22} strokeWidth={3} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1 text-left">Gerenciar</p>
            <h1 className="text-xl font-[1000] italic uppercase tracking-tighter text-[#4B0082] text-left leading-none">
              Meus <span className="text-[#82C91E]">Locais</span>
            </h1>
          </div>
        </div>
      </header>

      {/* CONTEÚDO ROLÁVEL COM CARDS BRANCOS */}
      <main className="flex-1 px-6 py-8 space-y-6">
        
        {/* CARD DESTAQUE: ADICIONAR NOVO */}
        <button 
          onClick={() => { setEnderecoParaEditar(null); setIsModalOpen(true); }}
          className="group relative w-full bg-[#4B0082] p-8 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#4B0082]/30 active:scale-[0.98] transition-all text-left flex items-center justify-between"
        >
          <div className="relative z-10">
            <div className="bg-[#82C91E] text-[#4B0082] p-3 rounded-2xl mb-4 w-fit shadow-lg">
                <Lucide.MapPin size={24} strokeWidth={3} />
            </div>
            <h2 className="text-xl font-[1000] text-white italic uppercase tracking-tighter leading-none mb-2">
                Adicionar Novo <br/> <span className="text-[#82C91E]">Endereço</span>
            </h2>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Toque para buscar no mapa</p>
          </div>
          <Lucide.PlusCircle className="absolute -right-6 -bottom-6 text-white/5 rotate-12" size={160} />
        </button>

        {/* LISTA DE ENDEREÇOS (CARDS BRANCOS) */}
        <div className="space-y-4">
          {loading ? (
             <>
                 <div className="h-28 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-pulse" />
                 <div className="h-28 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-pulse opacity-70" />
             </>
          ) : enderecos.length === 0 ? (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 text-center shadow-lg mt-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Lucide.Map size={28} className="text-slate-300" />
              </div>
              <p className="font-[1000] uppercase italic text-slate-800 text-sm">Nenhum local salvo</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Sua lista está vazia</p>
            </div>
          ) : (
            enderecos.map((end) => (
              <div 
                key={end.id} 
                className="bg-white p-5 rounded-[2.5rem] border border-slate-50 shadow-xl flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group"
                onClick={() => { 
                    localStorage.setItem('endereco_rodrigues', JSON.stringify(end)); 
                    window.dispatchEvent(new Event('enderecoAtualizado')); 
                    navigate(-1);
                }}
              >
                {/* ÁREA DE DADOS DO ENDEREÇO */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 bg-[#4B0082]/5 text-[#4B0082] rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-[#4B0082] group-hover:text-white transition-colors">
                    {renderizarIcone(end.tipo, end.iconeId)}
                  </div>
                  
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[12px] font-[1000] uppercase italic text-slate-900 tracking-tighter truncate">
                          {end.tipo}
                      </h3>
                      {end.principal && <span className="bg-[#82C91E] text-[#4B0082] text-[8px] font-black px-2 py-0.5 rounded-full uppercase italic">Atual</span>}
                    </div>
                    
                    <p className="text-[10px] font-black text-slate-500 uppercase leading-tight truncate">
                      {end.rua}, {end.numero || 'S/N'}
                    </p>
                    
                    {end.complemento && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">
                            Comp: {end.complemento}
                        </p>
                    )}
                    
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {end.bairro} {end.cep && `• ${end.cep}`}
                    </p>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO (Lado Direito) */}
                <div className="flex flex-col items-center gap-2 ml-3 pl-4 border-l border-slate-100">
                  <button 
                    onClick={(e) => handleAbrirEdicao(e, end)} 
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-[#4B0082] hover:text-[#82C91E] transition-all"
                  >
                    <Lucide.Pencil size={18} strokeWidth={2.5} />
                  </button>
                  <button 
                    onClick={(e) => deletar(e, end.id)} 
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Lucide.Trash2 size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* O MODAL DE ENDEREÇO (Abre por cima de tudo) */}
      <ModalEndereco 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEnderecoParaEditar(null); }} 
        dadosEdicao={enderecoParaEditar} 
      />
    </div>
  );
}