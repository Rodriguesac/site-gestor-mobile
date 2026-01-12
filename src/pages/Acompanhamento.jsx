import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebase'; // Certifique-se que o caminho está correto
import { doc, onSnapshot } from 'firebase/firestore';
import * as Lucide from 'lucide-react';

// Importações do Leaflet (Certifique-se de ter instalado: npm install react-leaflet leaflet)
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 1. Configuração de Ícones Personalizados
const motoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
});

const lojaIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/606/606161.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
});

const destinoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1277/1277332.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
});

// Coordenadas da Loja (conforme o seu Logistica.jsx)
const STORE_COORDS = [-20.43131, -54.55412];

// Componente para ajustar o zoom automaticamente para mostrar todos os pontos
function AutoFit({ pontos }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length > 1) {
      const bounds = L.latLngBounds(pontos);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [pontos, map]);
  return null;
}

export default function Acompanhamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);

  useEffect(() => {
    if (!id) return;
    // Escuta as atualizações do Firebase em tempo real
    return onSnapshot(doc(db, "pedidos", id), (docSnap) => {
      if (docSnap.exists()) setPedido({ id: docSnap.id, ...docSnap.data() });
    });
  }, [id]);

  if (!pedido) return null;

  // Array de pontos válidos para o mapa focar
  const pontosParaFocar = [
    STORE_COORDS,
    pedido.latEntregador && pedido.lngEntregador ? [pedido.latEntregador, pedido.lngEntregador] : null,
    pedido.enderecoCliente?.latlng ? [pedido.enderecoCliente.latlng.lat, pedido.enderecoCliente.latlng.lng] : null
  ].filter(p => p !== null);

  const steps = [
    { label: 'Recebido', icon: <Lucide.CheckCircle />, status: 'RECEBIDO' },
    { label: 'Preparando', icon: <Lucide.ChefHat />, status: 'PREPARANDO' },
    { label: 'A caminho', icon: <Lucide.Bike />, status: 'SAIU_ENTREGA' },
    { label: 'Entregue', icon: <Lucide.Flag />, status: 'ENTREGUE' }
  ];

  const currentIdx = steps.findIndex(s => s.status === pedido.status);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 font-sans text-left">
      {/* HEADER */}
      <div className="bg-[#2d004d] p-10 text-white rounded-b-[4rem] text-center shadow-2xl relative overflow-hidden">
        <button onClick={() => navigate('/')} className="absolute left-6 top-10 text-white/50 hover:text-white">
          <Lucide.ArrowLeft />
        </button>
        <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-2">Pedido em tempo real</p>
        <h1 className="text-4xl font-[1000] italic uppercase tracking-tighter">Rodrigues <span className="text-[#82C91E]">Açaí</span></h1>
      </div>

      <div className="max-w-xl mx-auto px-6 -mt-10">
        <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-zinc-100">
          
          {/* MAPA PROFISSIONAL (LEAFLET) */}
          {pedido.status === 'SAIU_ENTREGA' && (
            <div className="w-full h-80 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl mb-8 relative z-10">
              <MapContainer 
                center={STORE_COORDS} 
                zoom={15} 
                zoomControl={false}
                attributionControl={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                
                {/* Marcador da Loja */}
                <Marker position={STORE_COORDS} icon={lojaIcon}>
                    <Popup>Loja Rodrigues</Popup>
                </Marker>

                {/* Marcador do Cliente (Destino) */}
                {pedido.enderecoCliente?.latlng && (
                    <Marker position={[pedido.enderecoCliente.latlng.lat, pedido.enderecoCliente.latlng.lng]} icon={destinoIcon}>
                        <Popup>Sua Casa</Popup>
                    </Marker>
                )}

                {/* Marcador do Entregador (Moto) */}
                {pedido.latEntregador && pedido.lngEntregador && (
                    <Marker position={[pedido.latEntregador, pedido.lngEntregador]} icon={motoIcon} />
                )}

                {/* Ajusta o mapa para mostrar todos os pontos ao mesmo tempo */}
                <AutoFit pontos={pontosParaFocar} />
              </MapContainer>
            </div>
          )}

          {/* TIMELINE DE STATUS */}
          <div className="relative flex justify-between mb-12 px-2">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-100 -translate-y-1/2 z-0"></div>
            {steps.map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${idx <= currentIdx ? 'bg-[#82C91E] text-white shadow-lg shadow-[#82C91E]/30' : 'bg-white text-zinc-200 border-2 border-zinc-100'}`}>
                  {React.cloneElement(step.icon, { size: 20 })}
                </div>
                <span className={`text-[8px] font-black uppercase italic ${idx <= currentIdx ? 'text-[#2d004d]' : 'text-zinc-300'}`}>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="text-center bg-zinc-50 rounded-[2rem] p-6 border border-dashed border-zinc-200">
             <h2 className="text-2xl font-[1000] italic uppercase text-[#2d004d]">{pedido.status}</h2>
             <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1">Estamos a cuidar de tudo!</p>
          </div>

          <div className="mt-8 space-y-4">
             <div className="flex justify-between items-end border-b pb-4 border-zinc-50">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Resumo</span>
                <span className="text-lg font-black italic text-[#2d004d]">R$ {Number(pedido.total || pedido.totalGeral || 0).toFixed(2)}</span>
             </div>
             {pedido.itens?.map((item, i) => (
               <div key={i} className="flex justify-between text-xs font-bold uppercase italic text-zinc-500">
                  <span>{item.quantidade || 1}x {item.nome}</span>
                  <span>R$ {Number(item.preco || 0).toFixed(2)}</span>
               </div>
             ))}
          </div>
        </div>

        <button 
          onClick={() => window.open(`https://wa.me/5567999999999?text=Oi, sobre o pedido ${id.slice(-6)}`, '_blank')}
          className="w-full mt-6 bg-white border-2 border-zinc-100 py-5 rounded-3xl font-black uppercase italic text-[#2d004d] flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all"
        >
          <Lucide.MessageCircle size={20} className="text-[#25D366]" /> Suporte WhatsApp
        </button>
      </div>
    </div>
  );
}