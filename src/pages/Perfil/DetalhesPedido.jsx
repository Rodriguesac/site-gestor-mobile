import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../services/firebase";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useCart } from "../../context/CartContext";
import * as Lucide from "lucide-react";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function DetalhesPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { adicionarItem, limparCarrinho } = useCart();
  
  const [pedido, setPedido] = useState(null);
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarPedido = async () => {
      try {
        const docSnap = await getDoc(doc(db, "pedidos", id));
        if (docSnap.exists()) {
          setPedido({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) { console.error("Erro:", error); } 
      finally { setLoading(false); }
    };
    
    // Busca Histórico de Chat também para o Relatório
    const unsubChat = onSnapshot(query(collection(db, "pedidos", id, "chat"), orderBy("timestamp", "asc")), (snap) => {
        setChat(snap.docs.map(d => d.data()));
    });

    buscarPedido();
    return () => unsubChat();
  }, [id]);

  // LÓGICA DE EXPORTAÇÃO PARA PDF
  const baixarPDF = () => {
      const elemento = document.getElementById('relatorio-fiscal');
      html2canvas(elemento, { scale: 2, backgroundColor: '#ffffff' }).then((canvas) => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Relatorio_Rodrigues_${id.slice(-4)}.pdf`);
      });
  };

  // REPETIR PEDIDO (Adiciona os itens de volta na sacola, carrinho validerá no init)
  const repetirPedido = () => {
    if (!pedido?.itens || pedido.itens.length === 0) return;
    limparCarrinho(); 
    const itensParaAdicionar = pedido.itens.map(item => {
      const { id, createdAt, timestamp, ...itemLimpo } = item;
      return itemLimpo;
    });
    itensParaAdicionar.forEach(item => adicionarItem(item));
    
    const novoTotal = itensParaAdicionar.reduce((acc, curr) => acc + (curr.total || curr.preco || 0), 0);
    const payloadCarrinho = { itens: itensParaAdicionar.map(it => ({ ...it, quantidade: it.quantidade || 1 })), totalGeral: novoTotal };
    localStorage.setItem('carrinho_rodrigues', JSON.stringify(payloadCarrinho));

    setTimeout(() => { navigate('/carrinho'); }, 100);
  };

  const formatarHora = (ts) => {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatarDataCompleta = (ts) => {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <Lucide.Loader2 size={40} className="animate-spin text-[#82C91E] mb-4" />
      <p className="font-[1000] uppercase italic text-[#4B0082]">Emitindo Relatório...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-32">
      
      <header className="px-6 pt-10 pb-6 bg-white shadow-sm flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => navigate('/pedidos')} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90"><Lucide.ArrowLeft size={20} strokeWidth={3} /></button>
        <h1 className="text-sm font-[1000] uppercase italic tracking-widest text-[#4B0082]">Relatório Fiscal</h1>
        <button onClick={baixarPDF} className="w-10 h-10 bg-[#4B0082] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90"><Lucide.Download size={18} /></button>
      </header>

      <main className="max-w-[600px] mx-auto p-4 space-y-4">

        {/* CONTAINER DO RELATÓRIO (AQUI O HTML2CANVAS VAI TIRAR A FOTO) */}
        <div id="relatorio-fiscal" className="bg-white p-8 rounded-none border border-slate-200 shadow-sm relative" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
            
            {/* Header do Recibo */}
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-6 mb-6">
                <Lucide.Store size={40} className="mx-auto mb-2 text-[#4B0082]"/>
                <h2 className="text-2xl font-[1000] uppercase text-[#4B0082] italic tracking-tighter">Rodrigues Açaí</h2>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-1">CNPJ: 00.000.000/0001-00</p>
                <p className="text-xs font-bold text-slate-500 mt-2">{formatarDataCompleta(pedido.createdAt)}</p>
                <div className="bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest py-1.5 px-4 rounded-lg inline-block mt-4">
                    Comprovante de Pedido #{id.slice(-6).toUpperCase()}
                </div>
            </div>

            {/* Dados do Cliente */}
            <div className="mb-6">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Cliente</p>
                <p className="text-sm font-[1000] text-slate-800 uppercase">{pedido.cliente?.nome}</p>
                <p className="text-xs font-bold text-slate-500">{pedido.cliente?.telefone}</p>
            </div>

            {/* Endereço */}
            {pedido.tipoPedido === 'ENTREGA' && (
                <div className="mb-6 border-l-4 border-[#82C91E] pl-3 bg-slate-50 p-3 rounded-r-xl">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Destino de Entrega</p>
                    <p className="text-xs font-black text-slate-700 uppercase">{pedido.endereco?.rua}, {pedido.endereco?.numero}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{pedido.endereco?.bairro} {pedido.endereco?.complemento && `• ${pedido.endereco.complemento}`}</p>
                </div>
            )}

            {/* Itens do Recibo */}
            <div className="border-t border-b border-slate-200 py-4 mb-6 space-y-4">
                {pedido.itens?.map((item, i) => (
                    <div key={i} className="flex justify-between items-start text-xs font-bold">
                        <div className="pr-4">
                            <p className="text-slate-800 font-[1000] uppercase"><span className="text-[#4B0082]">{item.quantidade}x</span> {item.detalhes?.tamanho || item.tamanho} {item.detalhes?.baseNome || item.baseNome}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                {(item.detalhes?.acompanhamentos_detalhes || []).map(a => typeof a === 'object' ? a.nome : a).join(', ')}
                            </p>
                        </div>
                        <span className="text-slate-800">R$ {(item.precoTotal || item.total || 0).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            {/* Resumo Financeiro */}
            <div className="space-y-2 text-xs font-black text-slate-500 uppercase mb-6">
                <div className="flex justify-between"><span>Subtotal</span><span>R$ {pedido.valores?.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Taxa Logística</span><span>R$ {pedido.valores?.taxa?.toFixed(2)}</span></div>
                {pedido.valores?.desconto > 0 && <div className="flex justify-between text-red-500"><span>Cupom Aplicado</span><span>- R$ {pedido.valores.desconto.toFixed(2)}</span></div>}
                
                <div className="flex justify-between text-lg font-[1000] text-[#4B0082] italic pt-2 border-t border-slate-200 mt-2">
                    <span>Total Pago</span>
                    <span>R$ {pedido.valores?.total?.toFixed(2)}</span>
                </div>
                <div className="text-right">
                    <span className="text-[9px] bg-[#82C91E]/20 text-[#4B0082] px-2 py-0.5 rounded tracking-widest">{pedido.pagamento?.metodo}</span>
                </div>
            </div>

            {/* HISTÓRICO DE AUDITORIA (LINHA DO TEMPO) */}
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2"><Lucide.Activity size={14}/> Auditoria de Timeline</p>
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {[
                        { label: 'Pedido Realizado', time: pedido.createdAt },
                        { label: 'Aceito pela Loja', time: pedido.horarioAceitoLoja },
                        { label: 'Pronto p/ Despacho', time: pedido.horarioPronto },
                        { label: 'Saiu para Entrega', time: pedido.despachadoEm },
                        { label: 'Entregue / Concluído', time: pedido.horarioConcluido }
                    ].filter(i => i.time).map((step, idx) => (
                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-[#82C91E] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                <Lucide.Check size={12}/>
                            </div>
                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border border-slate-200 bg-white shadow-sm flex justify-between items-center">
                                <span className="text-[9px] font-bold text-slate-500 uppercase">{step.label}</span>
                                <span className="text-[10px] font-black text-[#4B0082]">{formatarHora(step.time)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* HISTÓRICO DE CHAT (SE HOUVER) */}
            {chat.length > 0 && (
                <div className="border-t-2 border-dashed border-slate-300 pt-6">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2"><Lucide.MessageSquare size={14}/> Histórico de Comunicação</p>
                    <div className="space-y-2">
                        {chat.map((msg, i) => (
                            <div key={i} className={`p-3 rounded-lg text-xs font-bold ${msg.remetente === 'cliente' ? 'bg-slate-100 text-slate-700 ml-8' : 'bg-[#4B0082]/10 text-[#4B0082] mr-8'}`}>
                                <span className="block text-[8px] uppercase tracking-widest opacity-50 mb-1">{msg.remetente === 'cliente' ? 'Cliente' : 'Loja/Entregador'}</span>
                                {msg.texto}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="mt-8 text-center opacity-40">
                <p className="text-[8px] font-black uppercase tracking-widest">Documento Auxiliar de Venda</p>
                <p className="text-[8px] font-black uppercase tracking-widest">ID: {id}</p>
            </div>
        </div>

        {/* BOTÃO REPETIR PEDIDO */}
        <button 
          onClick={repetirPedido}
          className="w-full py-5 mt-6 bg-[#82C91E] text-[#4B0082] rounded-[2rem] font-[1000] uppercase italic text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-[#82C91E]/20"
        >
          <Lucide.RefreshCcw size={20} strokeWidth={3} /> Pedir Exatamente Isso Novamente
        </button>

      </main>
    </div>
  );
}