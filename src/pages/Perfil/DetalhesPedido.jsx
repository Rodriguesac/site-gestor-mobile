import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase'; // Ajuste conforme seu caminho
import { doc, getDoc } from 'firebase/firestore';
import * as Lucide from 'lucide-react';

export default function DetalhesPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      } catch (error) {
        console.error("Erro:", error);
      } finally {
        setLoading(false);
      }
    };
    buscarPedido();
  }, [id]);

  if (loading) return <div className="p-10 text-center font-black animate-pulse text-zinc-400 uppercase">Carregando Detalhes...</div>;
  if (!pedido) return <div className="p-10 text-center font-black text-red-500 uppercase">Pedido não encontrado</div>;

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* HEADER ESTILO IFOOD */}
      <div className="bg-white p-6 border-b border-zinc-100 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <Lucide.ChevronLeft size={24} className="text-zinc-800" />
        </button>
        <div>
          <h1 className="text-sm font-black uppercase text-zinc-400">Detalhes do Pedido</h1>
          <p className="text-xs font-bold text-zinc-800">#{pedido.id.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        
        {/* STATUS E LINHA DO TEMPO */}
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#82C91E]/10 rounded-full flex items-center justify-center text-[#82C91E]">
              <Lucide.CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="font-black uppercase italic text-zinc-900">{pedido.status}</h2>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Finalizado em {pedido.dataFinalizado || 'Horário indisponível'}</p>
            </div>
          </div>
        </div>

        {/* ITENS - AGORA COM SUB-ITENS (ACOMPANHAMENTOS) */}
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          <h3 className="text-[10px] font-[1000] uppercase text-zinc-400 mb-4 tracking-widest">Seu Pedido</h3>
          <div className="space-y-6">
            {pedido.itens?.map((item, idx) => (
              <div key={idx} className="border-b border-zinc-50 pb-4 last:border-0">
                <div className="flex justify-between items-start">
                  <span className="font-black text-sm text-zinc-800">{item.qtd}x {item.nome}</span>
                  <span className="font-bold text-sm text-zinc-600">R$ {Number(item.preco * item.qtd).toFixed(2)}</span>
                </div>
                {/* Exibe acompanhamentos se houver */}
                {item.acompanhamentos && (
                  <p className="text-[11px] text-zinc-400 mt-1 font-medium italic">
                    + {item.acompanhamentos.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RESUMO DE VALORES - IGUAL IFOOD */}
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 font-bold">Subtotal</span>
            <span className="text-zinc-800 font-bold">R$ {pedido.subtotal?.toFixed(2) || (pedido.total - (pedido.taxaEntrega || 0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 font-bold">Taxa de entrega</span>
            <span className="text-green-600 font-bold">{pedido.taxaEntrega > 0 ? `R$ ${pedido.taxaEntrega.toFixed(2)}` : 'Grátis'}</span>
          </div>
          {pedido.desconto > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-red-500 font-bold">Desconto Cupom</span>
              <span className="text-red-500 font-bold">- R$ {pedido.desconto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between pt-3 border-t border-zinc-50">
            <span className="font-black uppercase italic text-zinc-900">Total</span>
            <span className="font-black text-xl text-zinc-900 tracking-tighter italic">R$ {pedido.total?.toFixed(2)}</span>
          </div>
        </div>

        {/* ENDEREÇO CORRIGIDO E PAGAMENTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <h2 className="font-black uppercase italic text-[10px] text-zinc-400 mb-3 flex items-center gap-2">
              <Lucide.MapPin size={14} className="text-[#ea1d2c]" /> Endereço de Entrega
            </h2>
            {/* Correção da Lógica de Endereço */}
            <div className="space-y-1">
               <p className="text-xs font-black text-zinc-800 uppercase italic">
                 {pedido.endereco?.rua || 'Rua não informada'}, {pedido.endereco?.numero || 'S/N'}
               </p>
               <p className="text-[11px] text-zinc-500 font-bold uppercase">
                 {pedido.endereco?.bairro || 'Bairro'} - {pedido.endereco?.cidade || 'Campo Grande'}
               </p>
               {pedido.endereco?.referencia && (
                 <div className="mt-2 p-2 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">Referência:</p>
                    <p className="text-[10px] text-zinc-600 font-bold italic">{pedido.endereco.referencia}</p>
                 </div>
               )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <h2 className="font-black uppercase italic text-[10px] text-zinc-400 mb-3 flex items-center gap-2">
              <Lucide.CreditCard size={14} className="text-blue-500" /> Pagamento
            </h2>
            <p className="text-xs font-black text-zinc-800 uppercase italic">{pedido.metodoPagamento || 'Não informado'}</p>
            <div className="mt-2 flex items-center gap-1">
               <div className="w-2 h-2 rounded-full bg-green-500"></div>
               <p className="text-[10px] text-green-600 font-[1000] uppercase italic">Pago via App</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}