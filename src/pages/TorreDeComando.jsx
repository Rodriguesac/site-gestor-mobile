import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../services/firebase'; 
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, where } from "firebase/firestore";
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';

// ==========================================
// 1. SISTEMA DE TOAST (NOTIFICAÇÕES DA TORRE)
// ==========================================
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-black uppercase tracking-wide text-white
                            ${t.type === 'error' ? 'bg-[#EA1D2C]' : t.type === 'success' ? 'bg-[#82C91E] text-[#4B0082]' : 'bg-slate-800'}`}>
                            {t.type === 'error' && <Lucide.AlertCircle size={20} />}
                            {t.type === 'success' && <Lucide.CheckCircle size={20} />}
                            {t.type === 'info' && <Lucide.Info size={20} />}
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

// ==========================================
// 2. CONFIGURAÇÕES E MAPA
// ==========================================
const LOJA_COORD = [-20.43127, -54.55416]; 

const createDriverIcon = (status, isCritico) => {
  let color = status === 'Livre' ? '#A3E635' : status === 'Coletando' ? '#F59E0B' : status === 'Em Rota' ? '#8B5CF6' : '#6B7280';
  if (isCritico) color = '#EA1D2C'; 

  const glow = status === 'Livre' && !isCritico ? 'shadow-[0_0_20px_rgba(163,230,53,0.5)]' : 
               status === 'Coletando' && !isCritico ? 'shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse' : 
               status === 'Em Rota' && !isCritico ? 'shadow-[0_0_20px_rgba(139,92,246,0.5)]' : 
               isCritico ? 'shadow-[0_0_20px_rgba(234,29,44,0.7)] animate-pulse' : '';

  return L.divIcon({
    className: 'custom-driver-icon',
    html: `<div class="relative flex items-center justify-center w-12 h-12 bg-gray-900 rounded-full border-4 ${glow}" style="border-color: ${color}; font-size: 20px;">🛵</div>`,
    iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -24]
  });
}; 

const storeIcon = L.divIcon({
  className: 'store-icon',
  html: `<div class="flex items-center justify-center w-16 h-16 bg-[#4B0082] rounded-2xl border-4 border-[#82C91E] shadow-[0_0_30px_rgba(130,201,30,0.6)] z-50 p-1">
            <img src="https://i.ibb.co/MDJK337g/Chat-GPT-Image-30-de-dez-de-2025-13-05-06.png" alt="Logo Loja" class="w-full h-full object-contain drop-shadow-md" />
         </div>`,
  iconSize: [64, 64], 
  iconAnchor: [32, 32]
});

const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.5 }); }, [center, zoom, map]);
  return null;
};

const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
  const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
};

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

// ==========================================
// 3. NÚCLEO DA TORRE DE COMANDO
// ==========================================
const TorreLogisticaContent = () => {
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [mapCenter, setMapCenter] = useState(LOJA_COORD);
  const [raioNuvem, setRaioNuvem] = useState(3000); 
  const audioNovaCarga = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    const unsubLogistica = onSnapshot(doc(db, "configuracoes_loja", "logistica"), (snap) => {
        if (snap.exists() && snap.data().raioOnda1) {
            setRaioNuvem(snap.data().raioOnda1 * 1000); 
        }
    });

    const q = query(collection(db, "entregadores"), where("status", "!=", "Offline"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const ativos = snap.docs.map(d => {
        const data = d.data();
        const dist = data.coords ? calcularDistancia(LOJA_COORD[0], LOJA_COORD[1], data.coords.lat, data.coords.lng) : "0.0";
        const isCritico = data.telemetria?.critica || false; 
        return { id: d.id, ...data, distanciaLoja: dist, isCritico };
      });
      setDrivers(ativos);
      if (selectedDriver) {
          const updatedSelected = ativos.find(d => d.id === selectedDriver.id);
          if (updatedSelected) setSelectedDriver(updatedSelected);
      }
    });

    return () => { unsubscribe(); unsubLogistica(); };
  }, [selectedDriver]);

  useEffect(() => {
    // CORREÇÃO CRUCIAL AQUI: A torre precisa continuar a ver o pedido quando ele está "BUSCANDO_ENTREGADOR"
    const q = query(collection(db, "pedidos"), where("status", "in", ["PRONTO", "BUSCANDO_ENTREGADOR"]));
    const unsubscribe = onSnapshot(q, (snap) => {
      let novosPedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      novosPedidos = novosPedidos
        .filter(p => p.tipoPedido === 'ENTREGA')
        .sort((a, b) => {
            const timeA = a.statusAtualizadoEm?.toMillis?.() || a.statusAtualizadoEm?.valueOf?.() || a.createdAt?.toMillis?.() || Date.now();
            const timeB = b.statusAtualizadoEm?.toMillis?.() || b.statusAtualizadoEm?.valueOf?.() || b.createdAt?.toMillis?.() || Date.now();
            return timeA - timeB;
        });

      setOrders(prev => {
        if (novosPedidos.length > prev.length) {
            audioNovaCarga.current.play().catch(()=>{});
            toast("Novo pedido pronto para despacho!", "info");
        }
        return novosPedidos;
      });
    });
    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prevOrders => 
        prevOrders.map(order => {
          if (order.statusDespacho === 'Buscando Entregador' && order.tempoNuvem > 0) {
            return { ...order, tempoNuvem: order.tempoNuvem - 1 };
          }
          if (order.statusDespacho === 'Buscando Entregador' && order.tempoNuvem === 0) {
            // CORREÇÃO CRUCIAL: Se o timer acabar e ninguém aceitar, volta para PRONTO
            updateDoc(doc(db, "pedidos", order.id), { status: 'PRONTO', statusDespacho: 'Sem Entregadores' }).catch(()=>{});
            toast(`Nenhum piloto aceitou o pedido #${order.id.slice(-4)}. Despacho manual obrigatório.`, "error");
            return { ...order, status: 'PRONTO', statusDespacho: 'Sem Entregadores' };
          }
          return order;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [toast]);

  // CORREÇÃO AQUI: Faltava atualizar o "status" para o motorista enxergar
  const dispararModoNuvem = async (orderId) => {
    try {
        await updateDoc(doc(db, "pedidos", orderId), {
            status: 'BUSCANDO_ENTREGADOR', // ESSENCIAL PARA APARECER NO APP
            statusDespacho: 'Buscando Entregador',
            tempoNuvem: 30, 
            nuvemAtivadaEm: serverTimestamp()
        });
        toast("Chamada lançada no Radar da Nuvem!", "success");
    } catch (e) { toast("Erro ao ativar radar.", "error"); }
  };

  const despachoManual = async (order, driverId) => {
    if (!driverId) return toast("Selecione um piloto na lista.", "error");
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return toast("Piloto não encontrado.", "error");

    if (order.pagamento?.metodo === 'DINHEIRO' && !driver.aceitaDinheiro) {
        return toast(`O piloto ${driver.nome} não aceita dinheiro.`, "error");
    }
    if (order.pagamento?.metodo === 'MAQUININHA' && !driver.temMaquininha) {
        return toast(`O piloto ${driver.nome} não tem maquineta.`, "error");
    }

    try {
      await updateDoc(doc(db, "pedidos", order.id), {
        entregadorId: driver.id,
        status: 'A_CAMINHO_LOJA', // Mudado para manter a sequência do motoboy correta
        statusDespacho: 'Atribuído Manualmente',
        despachadoEm: serverTimestamp()
      });
      await updateDoc(doc(db, "entregadores", driver.id), { status: 'Coletando' });
      toast(`Pedido atribuído a ${driver.nome}! Ele está na Loja (Coletando).`, "success");
    } catch (e) { toast("Erro ao forçar atribuição.", "error"); }
  };

  const calcularMinutosEspera = (data) => {
    if (!data) return 0;
    const inicio = data.toDate ? data.toDate() : new Date(data);
    return Math.floor((new Date() - inicio) / 60000);
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] flex overflow-hidden text-gray-100 font-sans selection:bg-lime-400 selection:text-black">
      
      <aside className="w-[480px] bg-gray-900 border-r border-gray-800 flex flex-col z-20 shadow-[20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-7 bg-black/60 border-b border-gray-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl"></div>
          <div className="flex items-center justify-between mb-5 relative z-10">
            <div>
              <h1 className="text-3xl font-black text-lime-400 tracking-tighter uppercase italic drop-shadow-md">Comando <span className="text-white">Central</span></h1>
              <p className="text-purple-400 text-[10px] font-black tracking-[0.2em] uppercase mt-1">Logística Rodrigues Açaí</p>
            </div>
            <div className="w-14 h-14 bg-purple-900 rounded-2xl flex items-center justify-center border-2 border-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.3)]">
              <Lucide.CloudLightning size={28} className="text-lime-400 animate-pulse" />
            </div>
          </div>
          <div className="w-full bg-lime-500/10 border border-lime-500/30 text-lime-400 font-black py-2.5 rounded-xl text-center text-xs tracking-widest uppercase flex items-center justify-center gap-2 relative z-10">
            <Lucide.Radar size={16}/> Radar de Nuvem Ativo: {raioNuvem/1000}km
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-gray-900/50">
          <div className="flex justify-between items-end px-1 mb-2">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Lucide.Package size={16}/> Doca de Expedição
            </h2>
            <span className="bg-purple-900 text-purple-200 text-xs px-2.5 py-1 rounded-md font-black shadow-inner">{orders.length} Pacotes</span>
          </div>

          <AnimatePresence>
            {orders.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center pt-24 opacity-30">
                    <Lucide.CheckCircle size={70} className="mb-4 text-gray-500"/>
                    <p className="font-black uppercase tracking-widest text-sm text-gray-400">Doca Limpa</p>
                </motion.div>
            ) : (
                orders.map(order => {
                const dataBase = order.statusAtualizadoEm || order.createdAt;
                const tempoEspera = calcularMinutosEspera(dataBase);
                const isCritico = tempoEspera > 10; 
                const isDinheiro = order.pagamento?.metodo === 'DINHEIRO';
                const isMaquininha = order.pagamento?.metodo === 'MAQUININHA';

                return (
                    <motion.div key={order.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`bg-gray-800 rounded-3xl p-6 shadow-2xl border-2 relative overflow-hidden transition-all ${isCritico ? 'border-red-500/50 shadow-red-500/10' : 'border-gray-700 hover:border-purple-500/50'}`}>
                    
                    {order.statusDespacho === 'Buscando Entregador' && (
                        <div className="absolute top-0 left-0 w-full h-2 bg-gray-700">
                        <div className="h-full bg-lime-400 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(163,230,53,0.8)]" style={{ width: `${(order.tempoNuvem / 30) * 100}%` }}></div>
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-4">
                        <span className="font-black text-white text-2xl tracking-tighter">#{order.id.slice(-4)}</span>
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase shadow-sm ${isCritico ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                        <Lucide.Clock size={12} className="inline mr-1"/> {tempoEspera}m Aguardando
                        </span>
                    </div>
                    
                    <p className="font-bold text-gray-200 text-sm truncate uppercase">{order.cliente?.nome || 'Cliente Local'}</p>
                    <p className="text-xs text-gray-500 mb-5 truncate italic flex items-center gap-1 mt-1"><Lucide.MapPin size={12}/> {order.endereco?.rua}, {order.endereco?.numero}</p>
                    
                    <div className="flex justify-between items-center mb-6 bg-gray-950 p-4 rounded-2xl border border-gray-800 shadow-inner">
                        <div>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">A Pagar na Entrega:</span>
                            <span className={`text-xs font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 inline-block ${isDinheiro ? 'bg-green-900/40 text-green-400 border border-green-800' : isMaquininha ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'bg-gray-800 text-gray-300'}`}>
                                {isDinheiro ? <Lucide.Banknote size={12}/> : <Lucide.CreditCard size={12}/>} {order.pagamento?.metodo}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Taxa do Piloto:</span>
                            <span className="font-black text-lime-400 text-xl">{formatarMoeda(order.valores?.taxaEntrega || 6)}</span>
                        </div>
                    </div>

                    {order.statusDespacho === 'Buscando Entregador' ? (
                        <div className="bg-lime-500/10 border border-lime-500/30 rounded-2xl p-5 text-center shadow-inner">
                            <p className="text-lime-400 font-black text-sm flex items-center justify-center gap-2 animate-pulse uppercase tracking-wider">
                                <Lucide.CloudLightning size={20} /> Tocando no Radar... {order.tempoNuvem}s
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                        {order.statusDespacho === 'Sem Entregadores' && (
                            <p className="text-red-400 text-[10px] font-black uppercase text-center flex items-center justify-center gap-1.5 bg-red-900/20 p-2 rounded-lg"><Lucide.AlertTriangle size={14}/> Ninguém aceitou a chamada. Force o despacho.</p>
                        )}
                        
                        <button onClick={() => dispararModoNuvem(order.id)} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-purple-900/50 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                            <Lucide.CloudLightning size={18} /> Jogar no Radar (Nuvem)
                        </button>
                        
                        <div className="flex gap-2">
                            <select id={`manual-${order.id}`} className="flex-1 bg-gray-950 border border-gray-700 rounded-2xl text-[10px] uppercase font-bold px-4 text-gray-300 outline-none focus:border-lime-400 cursor-pointer">
                                <option value="">Forçar Atribuição Manual...</option>
                                {drivers.filter(d => ['Livre', 'Coletando'].includes(d.status)).map(d => {
                                    let aviso = "";
                                    if (isDinheiro && !d.aceitaDinheiro) aviso = " ⚠️(Sem Troco)";
                                    if (isMaquininha && !d.temMaquininha) aviso = " ⚠️(Sem Máquina)";
                                    const statusDisplay = d.status === 'Coletando' ? ' (MOCHILA ABERTA)' : '';
                                    return <option key={d.id} value={d.id}>{d.nome} {statusDisplay} - {d.distanciaLoja}km {aviso}</option>
                                })}
                            </select>
                            <button onClick={() => despachoManual(order, document.getElementById(`manual-${order.id}`).value)} className="bg-gray-700 hover:bg-gray-600 text-white px-6 rounded-2xl font-black text-xs transition-all uppercase shadow-md active:scale-95">
                            OK
                            </button>
                        </div>
                        </div>
                    )}
                    </motion.div>
                );
                })
            )}
          </AnimatePresence>
        </div>
      </aside>

      <main className="flex-1 relative z-0">
        <MapContainer center={LOJA_COORD} zoom={14} className="w-full h-full" zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapController center={mapCenter} zoom={15} />
          
          <Marker position={LOJA_COORD} icon={storeIcon} />
          <Circle center={LOJA_COORD} pathOptions={{ color: '#8B5CF6', fillColor: '#8B5CF6', fillOpacity: 0.05 }} radius={raioNuvem} />
          
          {drivers.map(driver => {
             if(!driver.coords) return null;
             return (
               <Marker key={driver.id} position={[driver.coords.lat, driver.coords.lng]} icon={createDriverIcon(driver.status, driver.isCritico)}
                 eventHandlers={{ click: () => { setSelectedDriver(driver); setMapCenter([driver.coords.lat, driver.coords.lng]); } }}>
                 <Popup closeButton={false} className="dark-popup">
                   <div className="text-center p-2">
                     <p className="font-black text-gray-900 text-sm uppercase">{driver.nome}</p>
                     <p className="text-[10px] uppercase font-bold text-gray-500 mt-1">{driver.distanciaLoja} km da base</p>
                     {driver.status === 'Coletando' && (
                         <p className="text-[9px] font-black text-amber-500 uppercase mt-1 bg-amber-50 rounded px-1">Aguardando na Loja</p>
                     )}
                   </div>
                 </Popup>
               </Marker>
             );
          })}
        </MapContainer>

        <div className="absolute top-6 left-6 z-[400] flex flex-col gap-4 pointer-events-none">
          <div className="flex gap-4">
              <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 p-4 rounded-3xl flex items-center shadow-2xl pointer-events-auto">
                <Lucide.Bike size={28} className="text-purple-500 mr-4" />
                <div>
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Pilotos Na Rua</p>
                  <p className="text-2xl font-black text-white leading-none">{drivers.filter(d => d.status === 'Em Rota').length}</p>
                </div>
              </div>
              <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 p-4 rounded-3xl flex items-center shadow-2xl pointer-events-auto">
                <Lucide.CheckCircle size={28} className="text-lime-400 mr-4" />
                <div>
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Livres p/ Despacho</p>
                  <p className="text-2xl font-black text-white leading-none">{drivers.filter(d => d.status === 'Livre').length}</p>
                </div>
              </div>
              <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 p-4 rounded-3xl flex items-center shadow-2xl pointer-events-auto border-b-2 border-b-amber-500">
                <Lucide.PackagePlus size={28} className="text-amber-500 mr-4" />
                <div>
                  <p className="text-[9px] text-amber-500/80 font-black uppercase tracking-widest mb-1">Na Loja (Coletando)</p>
                  <p className="text-2xl font-black text-amber-500 leading-none">{drivers.filter(d => d.status === 'Coletando').length}</p>
                </div>
              </div>
          </div>
          <button onClick={() => setMapCenter(LOJA_COORD)} className="w-14 h-14 bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-2xl text-gray-400 hover:text-white pointer-events-auto transition-all shadow-2xl flex items-center justify-center active:scale-95 mt-2">
            <Lucide.Crosshair size={24} />
          </button>
        </div>
      </main>

      <aside className={`absolute top-0 right-0 h-full w-[420px] bg-gray-900 border-l border-gray-800 shadow-[-20px_0_50px_rgba(0,0,0,0.7)] z-30 transition-transform duration-500 transform ${selectedDriver ? 'translate-x-0' : 'translate-x-full opacity-0'}`}>
        {selectedDriver && (
          <div className="flex flex-col h-full text-gray-200">
            <div className="p-8 bg-black/60 border-b border-gray-800 relative">
              <button onClick={() => setSelectedDriver(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white bg-gray-800 p-2 rounded-full transition-colors"><Lucide.X size={20} /></button>
              
              <div className="flex items-center gap-5 mb-5 mt-2">
                <div className={`w-24 h-24 bg-gray-800 rounded-3xl border-4 flex items-center justify-center overflow-hidden shadow-2xl ${selectedDriver.status === 'Livre' ? 'border-lime-400 shadow-lime-400/20' : selectedDriver.status === 'Coletando' ? 'border-amber-500 shadow-amber-500/20' : 'border-purple-500 shadow-purple-500/20'}`}>
                  {selectedDriver.urlPerfil ? <img src={selectedDriver.urlPerfil} className="w-full h-full object-cover" alt="Perfil"/> : <Lucide.User size={40} className="text-gray-500"/>}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">{selectedDriver.nome}</h2>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest bg-gray-800 px-3 py-1 rounded-lg inline-block border border-gray-700">{selectedDriver.modalidade} • {selectedDriver.placa || 'S/ PLACA'}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border shadow-inner ${selectedDriver.status === 'Livre' ? 'bg-green-500/10 border-green-500/50 text-green-400' : selectedDriver.status === 'Coletando' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-purple-500/20 border-purple-500/50 text-purple-400'}`}>
                  ● Status: {selectedDriver.status}
                </span>
                {selectedDriver.isCritico && (
                   <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/50 bg-red-500/10 text-red-400 flex items-center gap-1 shadow-inner animate-pulse">
                      <Lucide.AlertTriangle size={12}/> Atenção Necessária
                   </span>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-gray-900/50">
              <div>
                 <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Lucide.Search size={14}/> Telemetria de Campo</p>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-inner flex flex-col items-center justify-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Bateria App</p>
                        <div className="flex items-center gap-2">
                            {selectedDriver.telemetria?.critica ? <Lucide.BatteryWarning size={24} className="text-red-500"/> : <Lucide.Battery size={24} className="text-green-500" />}
                            <span className={`text-2xl font-black ${selectedDriver.telemetria?.critica ? 'text-red-400' : 'text-white'}`}>{selectedDriver.telemetria?.bateria || '100'}%</span>
                        </div>
                    </div>
                    <div className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-inner flex flex-col items-center justify-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Posição Real</p>
                        <div className="flex items-center gap-2">
                            <Lucide.Navigation size={24} className="text-blue-400" />
                            <span className="text-2xl font-black text-white">{selectedDriver.distanciaLoja} <span className="text-xs text-gray-500">km</span></span>
                        </div>
                    </div>
                 </div>
              </div>

              <div>
                 <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Lucide.Info size={14}/> Preferências do Piloto</p>
                 <div className="bg-gray-800 p-5 rounded-3xl border border-gray-700 shadow-inner space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-300 uppercase">Aceita Dinheiro (Tem Troco)</span>
                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${selectedDriver.aceitaDinheiro ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>{selectedDriver.aceitaDinheiro ? 'SIM' : 'NÃO'}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-700/50 pt-3">
                        <span className="text-xs font-bold text-gray-300 uppercase">Tem Maquininha Própria</span>
                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${selectedDriver.temMaquininha ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>{selectedDriver.temMaquininha ? 'SIM' : 'NÃO'}</span>
                    </div>
                 </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Lucide.DollarSign size={14}/> Acerto Financeiro (DRE)</p>
                <div className={`p-6 rounded-3xl border shadow-lg relative overflow-hidden ${selectedDriver.saldoLiquido < 0 ? 'bg-gradient-to-br from-red-900/80 to-black border-red-800' : 'bg-gradient-to-br from-green-900/80 to-black border-green-800'}`}>
                  
                  <div className="flex justify-between items-start mb-2 relative z-10">
                     <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">Situação do Saldo Atual</p>
                     <span className="text-[9px] font-black uppercase bg-black/40 px-2 py-1 rounded text-white backdrop-blur-sm border border-white/10">{selectedDriver.frequenciaRepasse || 'SEMANAL'}</span>
                  </div>
                  
                  <p className="text-4xl font-black text-white italic tracking-tighter relative z-10 mb-4">
                      {formatarMoeda(Math.abs(selectedDriver.saldoLiquido || 0))}
                  </p>

                  <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 relative z-10">
                      <p className="text-xs font-black uppercase text-white flex items-center gap-2">
                          {selectedDriver.saldoLiquido < 0 ? <><Lucide.AlertTriangle size={16} className="text-red-400"/> Ele deve à Loja (Pegou em Espécie)</> : <><Lucide.CheckCircle size={16} className="text-green-400"/> A Loja deve a Ele (Taxas Geradas)</>}
                      </p>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between px-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Taxas: <span className="text-green-400">{formatarMoeda(selectedDriver.ganhosTaxas)}</span></p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Retido: <span className="text-red-400">{formatarMoeda(selectedDriver.debitosLoja)}</span></p>
                </div>
              </div>

            </div>
            
            <div className="p-6 bg-black border-t border-gray-800">
                <a href={`https://wa.me/55${selectedDriver.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="w-full bg-[#25D366] hover:bg-[#20b858] text-gray-900 font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(37,211,102,0.1)] transition-transform active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest">
                    <Lucide.Phone size={20} /> Chamar no WhatsApp
                </a>
            </div>

          </div>
        )}
      </aside>

    </div>
  );
};

export default function TorreDeComandoWrapper() {
    return (
        <ToastProvider>
            <TorreLogisticaContent />
        </ToastProvider>
    );
}