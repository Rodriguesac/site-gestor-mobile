import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Users, Package, Search, Bell, Bike, Battery, Wifi, Clock, 
  X, TrendingUp, AlertTriangle, Phone, DollarSign, CloudLightning, 
  Crosshair, Filter, CheckCircle
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÕES E ÍCONES DO MAPA
// ==========================================
const LOJA_COORD = [-20.4697, -54.6201]; // Campo Grande, MS

const createDriverIcon = (status) => {
  const color = status === 'Livre' ? '#10B981' : status === 'Em Rota' ? '#8B5CF6' : '#9CA3AF';
  const glow = status === 'Livre' ? 'shadow-[0_0_15px_#10B981]' : status === 'Em Rota' ? 'shadow-[0_0_15px_#8B5CF6]' : '';
  
  return L.divIcon({
    className: 'custom-driver-icon',
    html: `
      <div class="relative flex items-center justify-center w-12 h-12 bg-white rounded-full border-4 ${glow}" style="border-color: ${color};">
        <span class="text-2xl">🛵</span>
        <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white" style="background-color: ${color};"></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
};

const storeIcon = L.divIcon({
  className: 'store-icon',
  html: `
    <div class="flex items-center justify-center w-16 h-16 bg-purple-900 rounded-2xl border-4 border-lime-400 shadow-[0_0_30px_rgba(163,230,53,0.5)] z-50">
      <span class="text-3xl">💜</span>
    </div>
  `,
  iconSize: [64, 64],
  iconAnchor: [32, 32],
});

const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
};

// ==========================================
// DADOS MOCKADOS (Simulando o Backend)
// ==========================================
const INITIAL_DRIVERS = [
  { id: 'ENT-001', nome: 'Carlos Mendes', status: 'Livre', coords: [-20.4715, -54.6180], bateria: 85, sinal: 'Forte', veiculo: 'CG 160', ganhosHoje: 145.50, carteiraApp: 50.00, ultimaAtualizacao: 'Agora', distanciaLoja: 0.8 },
  { id: 'ENT-002', nome: 'Ana Souza', status: 'Em Rota', coords: [-20.4650, -54.6250], bateria: 42, sinal: 'Médio', veiculo: 'Fazer', ganhosHoje: 210.00, carteiraApp: -15.00, ultimaAtualizacao: '1m', distanciaLoja: 2.1, pedidoAtual: { id: '#1041', endereco: 'Rua das Flores, 123' } },
  { id: 'ENT-003', nome: 'Marcos Silva', status: 'Livre', coords: [-20.4800, -54.6100], bateria: 90, sinal: 'Forte', veiculo: 'Bike', ganhosHoje: 55.00, carteiraApp: 120.00, ultimaAtualizacao: 'Agora', distanciaLoja: 3.5 },
];

const INITIAL_ORDERS = [
  { id: '#1042', cliente: 'Roberto Alves', endereco: 'Av. Afonso Pena, 3000', valor: 89.90, taxa: 8.00, tempoEspera: 4, statusDespacho: 'Buscando Entregador', tempoNuvem: 28 }, // Nuvem ativa (30s)
  { id: '#1043', cliente: 'Juliana Costa', endereco: 'Rua Rui Barbosa, 500', valor: 35.00, taxa: 5.00, tempoEspera: 1, statusDespacho: 'Aguardando Despacho', tempoNuvem: 0 },
];

// ==========================================
// COMPONENTE PRINCIPAL: CENTRO DE COMANDO
// ==========================================
export default function GestorLogisticaNuvem() {
  const [drivers, setDrivers] = useState(INITIAL_DRIVERS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [mapCenter, setMapCenter] = useState(LOJA_COORD);
  const [mapZoom, setMapZoom] = useState(14);
  const [raioNuvem, setRaioNuvem] = useState(3000); // 3km de raio de busca

  // Simula o timer regressivo do "Modo Nuvem" (30 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prevOrders => 
        prevOrders.map(order => {
          if (order.statusDespacho === 'Buscando Entregador' && order.tempoNuvem > 0) {
            return { ...order, tempoNuvem: order.tempoNuvem - 1 };
          }
          if (order.tempoNuvem === 0 && order.statusDespacho === 'Buscando Entregador') {
             return { ...order, statusDespacho: 'Sem Entregadores', tempoNuvem: 0 }; // Caiu pra manual
          }
          return order;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDriverClick = (driver) => {
    setSelectedDriver(driver);
    setMapCenter(driver.coords);
    setMapZoom(16);
  };

  const closeDriverPanel = () => {
    setSelectedDriver(null);
    setMapCenter(LOJA_COORD);
    setMapZoom(14);
  };

  // Forçar atribuição manual (caso a nuvem falhe)
  const manualAssign = (orderId, driverId) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status: 'Em Rota' } : d));
  };

  // Disparar pedido para a Nuvem (tocar para os mais próximos)
  const dispatchToCloud = (orderId) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, statusDespacho: 'Buscando Entregador', tempoNuvem: 30 } : o));
  };

  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden font-sans flex text-gray-100">
      
      {/* =========================================
          PAINEL ESQUERDO: CONTROLE LOGÍSTICO (Pedidos)
      ============================================= */}
      <aside className="w-[450px] bg-gray-800 flex flex-col shadow-2xl z-20 border-r border-gray-700">
        <div className="p-6 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-lime-400 tracking-tight">Rodrigues Açaí</h1>
              <p className="text-purple-400 text-xs font-bold tracking-widest uppercase">Radar de Entregas</p>
            </div>
            <div className="w-12 h-12 bg-purple-900 rounded-xl flex items-center justify-center border-2 border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.3)]">
              <span className="text-2xl">📡</span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button className="flex-1 bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold py-2 rounded-lg transition-colors flex items-center justify-center text-sm shadow-md">
              <CloudLightning size={16} className="mr-2" /> Raio Nuvem: {raioNuvem/1000}km
            </button>
          </div>
        </div>

        {/* Fila de Pedidos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
            <Package size={16} className="mr-2" /> Fila de Despacho ({orders.length})
          </h2>

          {orders.map(order => (
            <div key={order.id} className="bg-gray-700 rounded-xl p-4 shadow-lg border border-gray-600 relative overflow-hidden">
              
              {/* Overlay Visual se estiver na Nuvem */}
              {order.statusDespacho === 'Buscando Entregador' && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-600">
                  <div className="h-full bg-lime-400 transition-all duration-1000 ease-linear" style={{ width: `${(order.tempoNuvem / 30) * 100}%` }}></div>
                </div>
              )}

              <div className="flex justify-between items-start mb-2">
                <span className="font-black text-white text-lg">{order.id}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  order.tempoEspera > 10 ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-gray-600 text-gray-300'
                }`}>
                  ⏳ {order.tempoEspera}m na loja
                </span>
              </div>
              
              <p className="font-bold text-gray-200">{order.cliente}</p>
              <p className="text-xs text-gray-400 mb-3 truncate">📍 {order.endereco}</p>
              
              <div className="flex justify-between items-center mb-4 bg-gray-800 p-2 rounded-lg">
                <span className="text-sm text-gray-400">Taxa p/ Entregador:</span>
                <span className="font-black text-lime-400">R$ {order.taxa.toFixed(2)}</span>
              </div>

              {/* Ações de Despacho */}
              {order.statusDespacho === 'Buscando Entregador' ? (
                <div className="bg-lime-500/10 border border-lime-500/30 rounded-lg p-3 text-center">
                  <p className="text-lime-400 font-bold text-sm flex items-center justify-center animate-pulse">
                    <CloudLightning size={16} className="mr-2" /> Tocando na Nuvem... {order.tempoNuvem}s
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Aguardando aceite dos próximos.</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  {order.statusDespacho === 'Sem Entregadores' && (
                    <p className="text-red-400 text-xs text-center font-bold">Ninguém aceitou. Despacho Manual necessário.</p>
                  )}
                  <button 
                    onClick={() => dispatchToCloud(order.id)}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition-colors shadow-md flex items-center justify-center"
                  >
                    <CloudLightning size={16} className="mr-2" /> Disparar para Nuvem (30s)
                  </button>
                  
                  <div className="flex space-x-2">
                    <select id={`select-${order.id}`} className="flex-1 bg-gray-800 border border-gray-600 rounded-lg text-sm px-2 py-2 text-gray-200 focus:outline-none focus:border-lime-400">
                      <option value="">Atribuir Direto...</option>
                      {drivers.filter(d => d.status === 'Livre').map(d => (
                        <option key={d.id} value={d.id}>{d.nome} ({d.distanciaLoja}km)</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        const val = document.getElementById(`select-${order.id}`).value;
                        if(val) manualAssign(order.id, val);
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 rounded-lg font-bold transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* =========================================
          ÁREA CENTRAL: MAPA TELA CHEIA
      ============================================= */}
      <main className="flex-1 relative bg-gray-900 z-0">
        
        {/* Camada do Mapa (Dark Mode) */}
        <MapContainer 
          center={LOJA_COORD} 
          zoom={14} 
          className="w-full h-full"
          zoomControl={false}
          style={{ zIndex: 1 }}
        >
          {/* TileLayer estilo Dark para destacar os pins coloridos */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Loja Central e Raio de Cobertura */}
          <Marker position={LOJA_COORD} icon={storeIcon}>
            <Popup className="dark-popup"><div className="font-bold text-gray-900 text-lg">Rodrigues Açaí</div></Popup>
          </Marker>
          <Circle center={LOJA_COORD} pathOptions={{ color: '#8B5CF6', fillColor: '#8B5CF6', fillOpacity: 0.05 }} radius={raioNuvem} />

          {/* Entregadores Espalhados */}
          {drivers.map(driver => (
            <Marker 
              key={driver.id}
              position={driver.coords} 
              icon={createDriverIcon(driver.status)}
              eventHandlers={{ click: () => handleDriverClick(driver) }}
            >
              <Popup closeButton={false} className="dark-popup">
                <div className="text-center p-1 text-gray-900">
                  <p className="font-bold">{driver.nome}</p>
                  <p className="text-xs text-gray-500">{driver.distanciaLoja}km da loja</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* HUD Overlay Superior (Sobre o Mapa) */}
        <div className="absolute top-6 left-6 right-6 z-[400] flex justify-between pointer-events-none">
          {/* Indicadores Globais */}
          <div className="flex space-x-4 pointer-events-auto">
            <div className="bg-gray-800/90 backdrop-blur border border-gray-700 p-3 rounded-xl flex items-center shadow-lg">
              <Bike size={20} className="text-lime-400 mr-3" />
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Frota Ativa</p>
                <p className="text-lg font-black text-white leading-none">{drivers.length} <span className="text-xs text-gray-500 font-medium ml-1">online</span></p>
              </div>
            </div>
            <div className="bg-gray-800/90 backdrop-blur border border-gray-700 p-3 rounded-xl flex items-center shadow-lg">
              <CheckCircle size={20} className="text-green-400 mr-3" />
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Livres p/ Nuvem</p>
                <p className="text-lg font-black text-white leading-none">{drivers.filter(d=>d.status==='Livre').length}</p>
              </div>
            </div>
          </div>

          <button className="bg-gray-800/90 backdrop-blur border border-gray-700 p-3 rounded-xl text-gray-300 hover:text-white pointer-events-auto transition-colors shadow-lg">
            <Crosshair size={24} onClick={() => {setMapCenter(LOJA_COORD); setMapZoom(14);}} />
          </button>
        </div>

      </main>

      {/* =========================================
          PAINEL DIREITO: DETALHES DO ENTREGADOR
          (Desliza da direita quando clicado no mapa)
      ============================================= */}
      <aside className={`absolute top-0 right-0 h-full w-[400px] bg-gray-800 border-l border-gray-700 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-30 transition-transform duration-300 transform ${selectedDriver ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
        {selectedDriver && (
          <div className="flex flex-col h-full text-gray-200">
            {/* Header do Entregador */}
            <div className="p-6 bg-gray-900 border-b border-gray-700 relative">
              <button onClick={closeDriverPanel} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
              
              <div className="flex items-center space-x-4 mb-4 mt-2">
                <div className="w-16 h-16 bg-gray-800 rounded-full border-2 border-gray-600 flex items-center justify-center text-3xl">
                  👨‍🚀
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedDriver.nome}</h2>
                  <p className="text-gray-400 text-sm">{selectedDriver.id} • {selectedDriver.veiculo}</p>
                </div>
              </div>

              <div className="flex space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedDriver.status === 'Livre' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                  selectedDriver.status === 'Em Rota' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-gray-700 border-gray-600 text-gray-400'
                }`}>
                  {selectedDriver.status}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 flex items-center">
                  <Clock size={12} className="mr-1" /> Atualizado: {selectedDriver.ultimaAtualizacao}
                </span>
              </div>
            </div>

            {/* Conteúdo Info Logística */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Telemetria */}
              <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center space-x-2">
                  <Battery size={20} className={selectedDriver.bateria > 20 ? 'text-green-400' : 'text-red-400'} />
                  <span className="font-bold text-sm">{selectedDriver.bateria}% Bateria</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Wifi size={20} className="text-blue-400" />
                  <span className="font-bold text-sm">{selectedDriver.sinal} GPS</span>
                </div>
              </div>

              {/* Distância da Loja Base */}
              <div className="bg-gray-700 p-4 rounded-xl border border-gray-600 flex items-center justify-between">
                 <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Distância da Loja</p>
                    <p className="text-xl font-black text-white">{selectedDriver.distanciaLoja} km</p>
                 </div>
                 <Crosshair size={24} className="text-gray-500" />
              </div>

              {/* Rastreio Financeiro (Carteira do App) */}
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Acerto Financeiro</h3>
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-gray-400 font-medium">Saldo de Repasse p/ Loja</p>
                  <p className={`text-lg font-black ${selectedDriver.carteiraApp > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    R$ {selectedDriver.carteiraApp.toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {selectedDriver.carteiraApp > 0 
                    ? "Ele recebeu dinheiro em espécie de pedidos online e precisa repassar à loja." 
                    : "A loja deve repassar taxas de entrega para ele."}
                </p>
              </div>

              {/* Botões de Contato Rápido */}
              <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center shadow-lg">
                <Phone size={18} className="mr-2" /> Contato WhatsApp
              </button>
            </div>
          </div>
        )}
      </aside>

    </div>
  );
}