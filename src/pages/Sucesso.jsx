import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import * as Lucide from 'lucide-react';

export default function Sucesso() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { limparCarrinho } = useCart(); // Puxa a função para limpar a sacola
    const [status, setStatus] = useState('processando');
    const orderId = searchParams.get('order_nsu');

    useEffect(() => {
        const confirmarPagamento = async () => {
            if (!orderId) { setStatus('erro'); return; }

            try {
                // 1. ATUALIZA O FIREBASE: Sai de 'AGUARDANDO_PAGAMENTO' para 'PENDENTE'
                // Isso faz o pedido "brotar" instantaneamente no seu Gestor Inteligente!
                await updateDoc(doc(db, "pedidos", orderId), {
                    status: 'PENDENTE',
                    pagoEm: serverTimestamp(),
                    statusPagamento: 'APROVADO_ONLINE'
                });

                // 2. AGORA SIM: Limpa a sacola e os dados de checkout
                limparCarrinho();
                localStorage.removeItem('checkout_dados');
                
                setStatus('sucesso');

                // Manda para o acompanhamento após 3 segundos
                setTimeout(() => navigate(`/acompanhamento/${orderId}`), 3000);

            } catch (e) {
                console.error("Erro na confirmação:", e);
                setStatus('erro');
            }
        };

        confirmarPagamento();
    }, [orderId, navigate, limparCarrinho]);

    if (status === 'erro') return (
        <div className="h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
            <Lucide.XCircle size={60} className="text-red-500 mb-4" />
            <h1 className="text-2xl font-black text-red-600 uppercase italic">Problema na Confirmação</h1>
            <p className="text-slate-500 mt-2">O pagamento foi processado, mas não conseguimos atualizar o pedido automaticamente.</p>
            <button onClick={() => navigate('/pedidos')} className="mt-8 bg-[#4B0082] text-white px-8 py-4 rounded-2xl font-bold uppercase italic shadow-lg">Ver Meus Pedidos</button>
        </div>
    );

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#4B0082] text-white p-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-[#82C91E] rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(130,201,30,0.4)]">
                <Lucide.Check size={50} strokeWidth={4} className="text-[#4B0082]" />
            </motion.div>
            
            <h1 className="text-3xl font-[1000] italic uppercase tracking-tighter">Pagamento Aprovado!</h1>
            <p className="mt-2 text-[#82C91E] font-black uppercase tracking-widest text-xs animate-pulse">Enviando pedido para a cozinha...</p>
            
            <div className="mt-10 p-4 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-bold text-white/50 uppercase">
                NSU: {orderId}
            </div>
        </div>
    );
}