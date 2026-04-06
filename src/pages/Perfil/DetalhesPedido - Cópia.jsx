import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "../../context/CartContext";
import * as Lucide from "lucide-react";
import { motion } from "framer-motion";

export default function DetalhesPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { adicionarItem, limparCarrinho } = useCart();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarPedido = async () => {
      try {
        const docRef = doc(db, "pedidos", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPedido({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) { console.error("Erro na extração:", error); } 
      finally { setLoading(false); }
    };
    buscarPedido();
  }, [id]);

 const repetirPedido = () => {
    if (!pedido?.itens || pedido.itens.length === 0) return;

    // 1. Limpamos o carrinho atual
    limparCarrinho(); 

    // 2. Preparamos os itens "limpos" (sem IDs do banco de dados)
    const itensParaAdicionar = pedido.itens.map(item => {
      // Removemos campos que podem bugar o carrinho
      const { id, createdAt, timestamp, ...itemLimpo } = item;
      return itemLimpo;
    });

    // 3. Adicionamos os itens ao contexto
    itensParaAdicionar.forEach(item => adicionarItem(item));

    // 4. FORÇAMOS a gravação no LocalStorage para o Carrinho.jsx ler na hora
    const novoTotal = itensParaAdicionar.reduce((acc, curr) => acc + (curr.total || curr.preco || 0), 0);
    const payloadCarrinho = {
      itens: itensParaAdicionar.map(it => ({ ...it, quantidade: it.quantidade || 1 })),
      totalGeral: novoTotal
    };

    localStorage.setItem('carrinho_rodrigues', JSON.stringify(payloadCarrinho));

    // 5. Navegamos (com um pequeno delay para garantir o save)
    setTimeout(() => {
      navigate('/carrinho');
    }, 100);
  };

  const formatarLog = (ts) => {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <Lucide.Loader2 size={40} className="animate-spin text-[#82C91E] mb-4" />
      <p className="font-[1000] uppercase italic text-[#4B0082]">Carregando Histórico...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      
      {/* HEADER: Padrão Home */}
      <header className="shrink-0 px-8 pt-12 pb-8 bg-white rounded-b-[3rem] shadow-xl z-10 border-b border-slate-100 mx-2 mt-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] active:scale-90 transition-all shadow-inner"
          >
            <Lucide.ArrowLeft size={22} strokeWidth={3} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1 text-left">Resumo do</p>
            <h1 className="text-xl font-[1000] italic uppercase tracking-tighter text-[#4B0082] text-left leading-none">
              Pedido <span className="text-[#82C91E]">#{id.slice(-4).toUpperCase()}</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">

        {/* STATUS STEPPER (TIMELINE LIMPA) */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-50">
          <h3 className="text-[10px] font-black uppercase text-slate-400 mb-8 flex items-center gap-2 tracking-widest">
            <Lucide.Activity size={14} className="text-[#82C91E]"/> Linha do Tempo
          </h3>
          
          <div className="space-y-8 relative">
            {/* Linha vertical de fundo */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-100" />

            {/* Stage 1 */}
            <div className="relative flex items-center gap-6">
              <div className="z-10 w-6 h-6 rounded-full bg-[#4B0082] border-4 border-white shadow-lg shadow-[#4B0082]/20" />
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Recebido</p>
                  <p className="text-xs font-black text-[#4B0082] uppercase italic">Pedido Realizado</p>
                </div>
                <p className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                  {formatarLog(pedido.createdAt)}
                </p>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="relative flex items-center gap-6">
              <div className={`z-10 w-6 h-6 rounded-full border-4 border-white shadow-lg ${pedido.horarioPronto ? 'bg-[#82C91E] shadow-[#82C91E]/20' : 'bg-slate-200'}`} />
              <div className="flex-1 flex justify-between items-center">
                <div className={!pedido.horarioPronto ? 'opacity-30' : ''}>
                  <p className="text-[9px] font-black uppercase text-slate-400">Produção</p>
                  <p className="text-xs font-black text-[#4B0082] uppercase italic">Açaí Finalizado</p>
                </div>
                {pedido.horarioPronto && <p className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{formatarLog(pedido.horarioPronto)}</p>}
              </div>
            </div>

            {/* Stage 3 */}
            <div className="relative flex items-center gap-6">
              <div className={`z-10 w-6 h-6 rounded-full border-4 border-white shadow-lg ${pedido.horarioConcluido ? 'bg-[#82C91E] shadow-[#82C91E]/20' : 'bg-slate-200'}`} />
              <div className="flex-1 flex justify-between items-center">
                <div className={!pedido.horarioConcluido ? 'opacity-30' : ''}>
                  <p className="text-[9px] font-black uppercase text-slate-400">Entrega</p>
                  <p className="text-xs font-black text-[#4B0082] uppercase italic">Pedido Entregue</p>
                </div>
                {pedido.horarioConcluido && <p className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{formatarLog(pedido.horarioConcluido)}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ENDEREÇO DE ENTREGA */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#4B0082]/5 rounded-2xl flex items-center justify-center text-[#4B0082] shrink-0">
            <Lucide.MapPin size={22} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Entregue em</p>
            <p className="text-[11px] font-[1000] text-[#4B0082] uppercase italic truncate leading-tight">
              {pedido.endereco?.rua}, {pedido.endereco?.numero}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase truncate tracking-widest mt-0.5">
              {pedido.endereco?.bairro}
            </p>
          </div>
        </div>

        {/* RECIBO DE ITENS */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-[11px] font-[1000] text-[#4B0082] uppercase italic tracking-tighter">Itens do Pedido</h3>
            <span className="bg-[#4B0082] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase italic">
              {pedido.metodoPagamento || 'PIX'}
            </span>
          </div>
          
          <div className="p-6 space-y-4">
            {pedido.itens?.map((item, i) => (
              <div key={i} className="flex justify-between items-start pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shrink-0">
                        <img src={item.imagem || "https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png"} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-[#4B0082] uppercase italic leading-none mb-1">
                            {item.quantidade}x {item.nome}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-tight">
                            {item.detalhes?.acompanhamentos_detalhes?.map(a => typeof a === 'object' ? a.nome : a).join(', ')}
                        </p>
                    </div>
                </div>
                <span className="text-xs font-black text-[#4B0082] italic">
                    R$ {(item.precoTotal || item.preco || 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}

            {/* RESUMO DE VALORES */}
            <div className="pt-4 space-y-2 border-t border-slate-100">
               <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                   <span>Taxa de Entrega</span>
                   <span>R$ {pedido.taxaEntrega || "0,00"}</span>
               </div>
               <div className="flex justify-between items-end pt-2">
                  <div>
                    <p className="text-[9px] font-black text-[#82C91E] uppercase italic mb-1 leading-none">Total Pago</p>
                    <p className="text-4xl font-[1000] text-[#4B0082] italic leading-none tracking-tighter">
                        R$ {pedido.total?.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <Lucide.CheckCircle2 size={32} className="text-[#82C91E]" strokeWidth={3} />
               </div>
            </div>
          </div>
        </div>

        {/* BOTÃO REPETIR PEDIDO: Padrão Home */}
        <button 
          onClick={repetirPedido}
          className="w-full py-5 bg-[#82C91E] text-[#4B0082] rounded-[2rem] font-[1000] uppercase italic text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-[#82C91E]/20"
        >
          <Lucide.RefreshCcw size={20} strokeWidth={3} />
          Repetir este Pedido
        </button>

      </main>
    </div>
  );
}