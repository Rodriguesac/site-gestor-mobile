import React, { useState, useEffect } from "react";
import * as Lucide from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DebugLocalStorageRealTime() {
  const navigate = useNavigate();
  const [data, setData] = useState({ carrinho: null, user: null });
  const [atividades, setAtividades] = useState([]);
  const [isPulsing, setIsPulsing] = useState(false);

  const logAtividade = (msg) => {
    setAtividades(prev => [{ t: new Date().toLocaleTimeString(), m: msg }, ...prev].slice(0, 10));
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 500);
  };

  const sync = () => {
    const c = localStorage.getItem('@RodriguesAcai:carrinho');
    const u = localStorage.getItem('@RodriguesAcai:user');
    
    const parsedC = c ? JSON.parse(c) : null;
    
    // Se o número de itens mudou, logamos a atividade
    if (JSON.stringify(parsedC?.itens) !== JSON.stringify(data.carrinho?.itens)) {
      logAtividade(`Sacola atualizada: ${parsedC?.itens?.length || 0} itens.`);
    }

    setData({ carrinho: parsedC, user: u ? JSON.parse(u) : null });
  };

  useEffect(() => {
    sync();
    const interval = setInterval(sync, 1000); // Monitoramento ativo
    return () => clearInterval(interval);
  }, [data.carrinho]);

  return (
    <div className="min-h-screen bg-[#0b0e13] text-white p-4 font-mono">
      {/* HEADER DINÂMICO */}
      <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 mb-6 ${isPulsing ? 'border-[#82C91E] bg-[#82C91E]/10' : 'border-white/5 bg-white/5'}`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-[1000] uppercase italic italic tracking-tighter">Live <span className="text-[#82C91E]">Auditor</span></h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase">Monitorando Rodrigues Açaí Engine</p>
          </div>
          <Lucide.Activity className={isPulsing ? 'text-[#82C91E]' : 'text-zinc-800'} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* COLUNA 1: FEED DE EVENTOS (O QUE ELE ESTÁ FAZENDO) */}
        <div className="lg:col-span-1 space-y-4">
            <h3 className="text-[10px] font-black uppercase text-zinc-500 ml-4 italic">Linha do Tempo</h3>
            <div className="bg-black/40 rounded-[2rem] border border-white/5 p-4 h-64 overflow-y-auto space-y-2">
                {atividades.map((a, i) => (
                    <div key={i} className="text-[10px] py-2 border-b border-white/5 flex gap-2">
                        <span className="text-[#82C91E] font-bold">{a.t}</span>
                        <span className="text-zinc-400">{a.m}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* COLUNA 2: DADOS DA SACOLA (MONTE SEU AÇAI) */}
        <div className="lg:col-span-2 space-y-4">
            <h3 className="text-[10px] font-black uppercase text-zinc-500 ml-4 italic">Estado Atual do Carrinho</h3>
            <div className="bg-black/40 rounded-[2rem] border border-white/5 p-6 min-h-[400px]">
                {data.carrinho ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase">Total Acumulado</p>
                                <p className="text-4xl font-[1000] italic text-[#82C91E]">R$ {Number(data.carrinho.totalGeral).toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-zinc-500 uppercase">Itens</p>
                                <p className="text-xl font-black italic">{data.carrinho.itens?.length || 0}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {data.carrinho.itens?.map((item, idx) => (
                                <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                    <div>
                                        <p className="font-black uppercase italic text-[11px]">{item.baseNome} ({item.tamanho})</p>
                                        <p className="text-[9px] text-zinc-500 italic">Adicionais: {item.adicionais?.length || 0}</p>
                                    </div>
                                    <span className="font-black text-[#82C91E]">R$ {item.total?.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-20">
                        <Lucide.ShoppingBag size={48} />
                        <p className="font-black uppercase italic text-xs mt-4">Carrinho Vazio</p>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => navigate('/perfil')} className="flex-1 bg-white/5 py-4 rounded-2xl font-black uppercase italic text-[10px]">Voltar ao Perfil</button>
        <button onClick={() => {localStorage.clear(); window.location.reload();}} className="flex-1 bg-red-500/10 text-red-500 py-4 rounded-2xl font-black uppercase italic text-[10px] border border-red-500/20">Resetar Tudo</button>
      </div>
    </div>
  );
}