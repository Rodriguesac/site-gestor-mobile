import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Lucide from "lucide-react";
import { db, auth } from "../../services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function MeusPedidos() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('andamento'); // 'andamento' ou 'concluidos'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return navigate('/login');
      
      const q = query(collection(db, "pedidos"), where("userId", "==", user.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          total: Number(doc.data().total || 0),
          dataExibicao: doc.data().data?.seconds || doc.data().createdAt?.seconds || 0
        })).sort((a, b) => b.dataExibicao - a.dataExibicao);
        
        setPedidos(lista);
        setLoading(false);
      });
      return () => unsub();
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  const pedidosAndamento = pedidos.filter(p => ['RECEBIDO', 'PREPARANDO', 'SAIU_ENTREGA'].includes(p.status));
  const pedidosConcluidos = pedidos.filter(p => ['ENTREGUE', 'CANCELADO'].includes(p.status));

  if (loading) return <div className="p-10 text-center font-black italic">CARREGANDO...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 pb-32">
      <h1 className="text-3xl font-[1000] italic uppercase text-[#2d004d] mb-6">Meus <span className="text-[#82C91E]">Pedidos</span></h1>
      
      {/* SELETOR DE ABAS */}
      <div className="flex gap-2 mb-8 bg-zinc-100 p-1.5 rounded-2xl">
        <button 
          onClick={() => setAbaAtiva('andamento')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all ${abaAtiva === 'andamento' ? 'bg-white text-[#2d004d] shadow-sm' : 'text-zinc-400'}`}
        >
          Em Andamento ({pedidosAndamento.length})
        </button>
        <button 
          onClick={() => setAbaAtiva('concluidos')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all ${abaAtiva === 'concluidos' ? 'bg-white text-[#2d004d] shadow-sm' : 'text-zinc-400'}`}
        >
          Concluídos ({pedidosConcluidos.length})
        </button>
      </div>

      <div className="space-y-4">
        {(abaAtiva === 'andamento' ? pedidosAndamento : pedidosConcluidos).map(pedido => (
          <button 
            key={pedido.id} 
            onClick={() => navigate(abaAtiva === 'andamento' ? `/acompanhamento/${pedido.id}` : `/detalhes-pedido/${pedido.id}`)}
            className="w-full bg-white p-5 rounded-[2rem] border border-zinc-100 flex items-center justify-between shadow-sm active:scale-95 transition-all"
          >
            <div className="text-left">
              <p className="text-[10px] font-black text-zinc-300 uppercase">#...{pedido.id.slice(-6)}</p>
              <p className="font-black text-zinc-800 uppercase italic text-sm">{pedido.itens?.[0]?.nome || 'Açaí Personalizado'}</p>
              <p className="font-black text-[#82C91E] text-lg">R$ {pedido.total.toFixed(2)}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-[8px] font-black uppercase italic ${pedido.status === 'SAIU_ENTREGA' ? 'bg-green-500 text-white animate-pulse' : 'bg-zinc-100 text-zinc-500'}`}>
              {pedido.status}
            </div>
          </button>
        ))}
        {(abaAtiva === 'andamento' ? pedidosAndamento : pedidosConcluidos).length === 0 && (
          <p className="text-center py-10 font-bold text-zinc-300 uppercase italic text-sm">Nenhum pedido aqui</p>
        )}
      </div>
    </div>
  );
}