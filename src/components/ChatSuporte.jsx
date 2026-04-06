import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import * as Lucide from 'lucide-react';

export default function ChatSuporte({ pedidoId }) {
    const [chatData, setChatData] = useState(null);
    const [mensagem, setMensagem] = useState('');
    const [mostrarFAQ, setMostrarFAQ] = useState(true);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!pedidoId) return;

        const docRef = doc(db, "chats", pedidoId);
        
        // Criar o documento do chat se não existir
        getDoc(docRef).then(snap => {
            if (!snap.exists()) {
                setDoc(docRef, { mensagens: [], gestorOnline: false, digitandoGestor: false });
            }
        });

        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) setChatData(snap.data());
        });
        return () => unsub();
    }, [pedidoId]);

    // Auto-scroll para a última mensagem
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatData?.mensagens]);

    const selecionarAssunto = async (assunto) => {
        setMostrarFAQ(false);
        await updateDoc(doc(db, "chats", pedidoId), {
            assunto: assunto,
            mensagens: arrayUnion({
                texto: `🤖 Olá! Assunto: ${assunto}. Já avisei o gestor. Como posso ajudar mais?`,
                remetente: 'robo',
                horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            })
        });
    };

    const enviarMsg = async () => {
        if (!mensagem.trim()) return;
        const textoTemp = mensagem;
        setMensagem('');
        
        await updateDoc(doc(db, "chats", pedidoId), {
            mensagens: arrayUnion({
                texto: textoTemp,
                remetente: 'cliente',
                horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }),
            digitandoCliente: false
        });
    };

    if (!pedidoId) return null;

    return (
        <div className="fixed bottom-24 right-6 w-[320px] bg-[#0b0e13] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl z-[999] flex flex-col transition-all animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="bg-[#82C91E] p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full border-2 border-[#82C91E] ${chatData?.gestorOnline ? 'bg-blue-600 animate-pulse' : 'bg-zinc-500'}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black font-[1000] uppercase italic text-[11px] leading-none">Suporte Rodrigues</span>
                        <span className="text-[9px] text-black/60 font-bold uppercase">{chatData?.gestorOnline ? 'Online agora' : 'Offline'}</span>
                    </div>
                </div>
                {chatData?.digitandoGestor && <Lucide.MessageSquareMore size={18} className="text-black animate-bounce" />}
            </div>

            {/* Mensagens */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {mostrarFAQ ? (
                    <div className="space-y-2 py-2">
                        <p className="text-[#82C91E] text-[10px] font-black uppercase italic mb-4">Escolha um assunto:</p>
                        {['Alterar Endereço', 'Cancelar Pedido', 'Falar sobre Atraso', 'Outros'].map(item => (
                            <button key={item} onClick={() => selecionarAssunto(item)} className="w-full text-left p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-white font-black uppercase italic hover:bg-[#82C91E] hover:text-black transition-all">
                                {item}
                            </button>
                        ))}
                    </div>
                ) : (
                    chatData?.mensagens?.map((m, idx) => (
                        <div key={idx} className={`flex flex-col ${m.remetente === 'cliente' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-bold leading-relaxed ${
                                m.remetente === 'cliente' ? 'bg-[#82C91E] text-black rounded-tr-none' : 
                                m.remetente === 'robo' ? 'bg-zinc-800 text-[#82C91E] border border-[#82C91E]/20' : 'bg-zinc-800 text-white rounded-tl-none'
                            }`}>
                                {m.texto}
                            </div>
                            <span className="text-[8px] opacity-30 mt-1 font-black uppercase">{m.horario}</span>
                        </div>
                    ))
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input */}
            {!mostrarFAQ && (
                <div className="p-4 bg-white/5 border-t border-white/5 flex gap-2">
                    <input 
                        value={mensagem}
                        onChange={(e) => {
                            setMensagem(e.target.value);
                            updateDoc(doc(db, "chats", pedidoId), { digitandoCliente: true });
                        }}
                        onBlur={() => updateDoc(doc(db, "chats", pedidoId), { digitandoCliente: false })}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 bg-[#0b0e13] rounded-full px-5 py-3 text-[11px] text-white outline-none border border-white/10 focus:border-[#82C91E]"
                    />
                    <button onClick={enviarMsg} className="bg-[#82C91E] p-3 rounded-full text-black hover:scale-110 active:scale-95 transition-transform">
                        <Lucide.Send size={18} strokeWidth={3} />
                    </button>
                </div>
            )}
        </div>
    );
}