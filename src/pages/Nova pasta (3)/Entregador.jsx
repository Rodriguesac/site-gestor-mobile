import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import * as Lucide from 'lucide-react';

export default function Entregador() {
  const { id } = useParams(); // ID do pedido
  const [rastreando, setRastreando] = useState(false);
  const [watchId, setWatchId] = useState(null);

  const iniciarEntrega = async () => {
    if (!("geolocation" in navigator)) {
      return alert("GPS não disponível no seu aparelho.");
    }

    try {
      // 1. Atualiza o status e cria os campos de GPS no Firebase
      const pedidoRef = doc(db, "pedidos", id);
      await updateDoc(pedidoRef, {
        status: 'SAIU_ENTREGA',
        latEntregador: 0,
        lngEntregador: 0,
        iniciadoEm: serverTimestamp()
      });

      // 2. Começa a monitorar o movimento real
      const idMonitor = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          
          // Envia a localização real para o Firebase
          updateDoc(pedidoRef, {
            latEntregador: latitude,
            lngEntregador: longitude,
            ultimaAtualizacao: serverTimestamp()
          });

          console.log("GPS Enviado:", latitude, longitude);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, distanceFilter: 10 } // Só envia se mover 10 metros
      );

      setWatchId(idMonitor);
      setRastreando(true);
      alert("Rastreio Ativado! Pode seguir para o cliente.");
    } catch (error) {
      alert("Erro ao iniciar: " + error.message);
    }
  };

  const finalizarEntrega = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    const pedidoRef = doc(db, "pedidos", id);
    await updateDoc(pedidoRef, { status: 'ENTREGUE' });
    setRastreando(false);
    alert("Pedido entregue com sucesso!");
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6 flex flex-col items-center justify-center font-sans">
      <div className="text-center mb-10">
        <Lucide.Bike size={60} className="text-[#82C91E] mx-auto mb-4" />
        <h1 className="text-2xl font-black uppercase italic">Painel do <span className="text-[#82C91E]">Entregador</span></h1>
        <p className="text-zinc-400 text-sm mt-2 font-bold uppercase">Pedido: #{id?.slice(-6)}</p>
      </div>

      {!rastreando ? (
        <button 
          onClick={iniciarEntrega}
          className="w-full bg-[#82C91E] text-white py-8 rounded-[2.5rem] font-[1000] uppercase italic text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4"
        >
          <Lucide.Play fill="white" /> Iniciar Rastreio
        </button>
      ) : (
        <div className="w-full space-y-4">
          <div className="bg-white/10 p-6 rounded-3xl text-center border border-white/10 animate-pulse">
            <p className="text-[#82C91E] font-black uppercase italic text-sm">GPS Ativo e Transmitindo...</p>
          </div>
          <button 
            onClick={finalizarEntrega}
            className="w-full bg-white text-zinc-900 py-8 rounded-[2.5rem] font-[1000] uppercase italic text-xl shadow-xl active:scale-95 transition-all"
          >
            Confirmar Entrega
          </button>
        </div>
      )}

      <p className="mt-10 text-[10px] text-zinc-500 uppercase font-black text-center leading-relaxed">
        Atenção: Mantenha a tela do celular ligada <br/> durante o percurso para garantir o rastreio.
      </p>
    </div>
  );
}