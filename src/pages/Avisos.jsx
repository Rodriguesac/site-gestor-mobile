import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db, auth } from "../services/firebase";
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function Avisos() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "campanhas_notificacoes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(n => !n.destinatarios || n.destinatarios.length === 0 || n.destinatarios.includes(auth.currentUser?.uid));
      setNotificacoes(lista);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-home)] pb-32">
      {/* HEADER ESTILO PREMIUM */}
      <div className="p-6 md:p-12 flex items-center gap-4 border-b border-[var(--border-home)] bg-[var(--bg-home)] sticky top-0 z-50 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:text-[#82C91E]">
          <Lucide.ChevronLeft size={24} strokeWidth={3} />
        </button>
        <div>
          <h1 className="text-xl md:text-3xl font-[1000] uppercase italic text-[var(--text-home)] tracking-tighter">
            Central de <span className="text-[#a855f7]">Avisos</span>
          </h1>
          <p className="text-[10px] font-black text-zinc-500 uppercase italic">Fique por dentro das novidades</p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto p-6 space-y-4">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-zinc-600 font-black uppercase italic">Carregando mensagens...</div>
        ) : notificacoes.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <Lucide.BellOff size={48} className="mx-auto text-zinc-800" />
            <p className="text-zinc-500 font-black uppercase italic text-xs">Nenhuma notificação encontrada</p>
          </div>
        ) : (
          notificacoes.map((n) => (
            <div 
              key={n.id} 
              className={`relative overflow-hidden p-6 rounded-[2.5rem] border transition-all duration-500 ${
                n.isUrgente 
                ? 'bg-red-500/5 border-red-500/20 shadow-lg shadow-red-900/10' 
                : 'bg-white/5 border-[var(--border-home)]'
              }`}
            >
              {/* TAG URGENTE */}
              {n.isUrgente && (
                <div className="absolute top-6 right-6 flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded-full animate-bounce">
                  <Lucide.Zap size={10} fill="white" />
                  <span className="text-[8px] font-black uppercase italic">Urgente</span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className={`p-4 rounded-2xl ${n.isUrgente ? 'bg-red-600/20 text-red-500' : 'bg-purple-600/20 text-purple-500'}`}>
                   {n.isUrgente ? <Lucide.AlertTriangle size={24} /> : <Lucide.MessageSquare size={24} />}
                </div>
                
                <div className="flex-1">
                  <span className="text-[9px] font-black text-zinc-500 uppercase italic">
                    {n.createdAt?.toDate().toLocaleDateString()} às {n.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <h3 className="text-sm md:text-lg font-[1000] uppercase italic text-white mt-1 leading-tight">
                    {n.titulo}
                  </h3>
                  <p className="text-[11px] md:text-sm text-zinc-400 font-bold uppercase italic mt-3 leading-relaxed">
                    {n.texto}
                  </p>

                  {/* IMAGEM DA NOTIFICAÇÃO (SE HOUVER) */}
                  {n.imagem && (
                    <img src={n.imagem} className="mt-4 w-full h-48 object-cover rounded-[2rem] border border-white/10" alt="Notificação" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}