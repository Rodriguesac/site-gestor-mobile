import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from "../services/firebase"; 
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export default function Enderecos({ setModal, onConfirm }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const clientMarker = useRef(null);
  const routeLayer = useRef(null);

  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [tipoLocal, setTipoLocal] = useState('casa');
  const [complemento, setComplemento] = useState('');
  const [numero, setNumero] = useState('');

  const [configLogistica, setConfigLogistica] = useState({
    taxaBase: 7.00,
    valorPorKm: 1.50,
    kmCortesia: 0,
    raioMaximo: 15
  });

  const [enderecoCliente, setEnderecoCliente] = useState(() => {
    const salvo = localStorage.getItem('@RodriguesAcai:endereco');
    return salvo ? JSON.parse(salvo) : {
      endereco: '',
      confirmado: false,
      taxa: '0,00',
      km: '0.00',
      latlng: null
    };
  });

  const STORE_COORDS = [-20.43131, -54.55412];

  // Carrega configurações de entrega do Firebase
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuracoes", "logistica"), (docSnap) => {
      if (docSnap.exists()) setConfigLogistica(docSnap.data());
    });
    return () => unsub();
  }, []);

  const calcularTaxaDinamica = (distanciaKm) => {
    const d = parseFloat(distanciaKm);
    const { taxaBase, valorPorKm, kmCortesia, raioMaximo } = configLogistica;
    if (d > raioMaximo) return "FORA DA ÁREA";
    if (d <= kmCortesia) return "0,00";
    const total = taxaBase + (d * valorPorKm);
    return total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Inicializa o Mapa
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current, { 
        zoomControl: false, 
        attributionControl: false 
      }).setView(STORE_COORDS, 15);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);

      // Ícone da Loja
      L.marker(STORE_COORDS, { 
        icon: L.divIcon({ 
          className: 'custom-icon', 
          html: '<div style="background:#4A044E; padding:8px; border-radius:50%; border:2px solid white; shadow:lg">🏪</div>', 
          iconSize: [40, 40] 
        }) 
      }).addTo(mapInstance.current);

      mapInstance.current.on('click', (e) => processarLocal(e.latlng.lat, e.latlng.lng));
    }
  }, []);

  const handleBusca = async (texto) => {
    setBusca(texto);
    if (texto.length < 4) {
        setSugestoes([]);
        return;
    };
    try {
      const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&outFields=Match_addr,Addr_type&singleLine=${encodeURIComponent(texto + ", Campo Grande, MS")}&maxLocations=5`);
      const data = await res.json();
      setSugestoes(data.candidates || []);
    } catch (e) { console.error(e); }
  };

  const processarLocal = async (lat, lng, labelManual) => {
    setSugestoes([]);
    setLoadingMap(true);
    let enderecoFinal = labelManual || "Localização no mapa";

    if (clientMarker.current) {
      clientMarker.current.setLatLng([lat, lng]);
    } else {
      clientMarker.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstance.current);
    }

    try {
      // Cálculo de rota via OSRM
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
      const data = await res.json();
      
      if (data.routes?.length > 0) {
        const r = data.routes[0];
        const km = (r.distance / 1000).toFixed(2);
        const valorTaxa = calcularTaxaDinamica(km);
        
        setEnderecoCliente({ endereco: enderecoFinal, km, taxa: valorTaxa, latlng: { lat, lng } });

        if (routeLayer.current) mapInstance.current.removeLayer(routeLayer.current);
        routeLayer.current = L.geoJSON(r.geometry, { style: { color: '#4A044E', weight: 5, opacity: 0.6 } }).addTo(mapInstance.current);
        
        mapInstance.current.fitBounds(L.geoJSON(r.geometry).getBounds(), { padding: [50, 50] });
      }
    } catch (error) {
        console.error("Erro ao processar rota", error);
    } finally { setLoadingMap(false); }
  };

  const confirmarFinal = async () => {
    const final = { 
        ...enderecoCliente, 
        confirmado: true, 
        tipo: tipoLocal, 
        complemento, 
        numero,
        enderecoCompleto: `${enderecoCliente.endereco}, ${numero} - ${complemento}`
    };
    
    localStorage.setItem('@RodriguesAcai:endereco', JSON.stringify(final));
    
    const user = JSON.parse(localStorage.getItem('@RodriguesAcai:user'));
    if (user?.uid) {
      await setDoc(doc(db, "usuarios", user.uid), { enderecoPadrao: final }, { merge: true });
    }

    if (onConfirm) onConfirm(final);
    window.dispatchEvent(new Event('storage'));
    setModal(false);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4">
      <div className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
        
        {/* MAPA */}
        <div ref={mapRef} className="h-64 md:h-72 bg-zinc-100 relative">
            {loadingMap && (
                <div className="absolute inset-0 z-[1000] bg-white/40 flex items-center justify-center">
                    <Lucide.Loader2 className="animate-spin text-[#4A044E]" size={30} />
                </div>
            )}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-black italic uppercase text-lg">Onde entregamos?</h2>
            <button onClick={() => setModal(false)} className="p-2 bg-zinc-100 rounded-full"><Lucide.X size={20}/></button>
          </div>

          <div className="relative">
            <Lucide.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              className="w-full bg-zinc-50 p-4 pl-12 rounded-2xl border border-zinc-100 outline-none focus:border-[#4A044E] font-bold" 
              placeholder="Rua e Bairro..."
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
            />
          </div>

          {/* SUGESTOES */}
          {sugestoes.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto border-b pb-4">
              {sugestoes.map((s, i) => (
                <div 
                    key={i} 
                    onClick={() => processarLocal(s.location.y, s.location.x, s.address)} 
                    className="p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl cursor-pointer text-xs font-bold text-zinc-600 border border-zinc-100"
                >
                  {s.address}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input 
              className="w-full bg-zinc-50 p-4 rounded-2xl border border-zinc-100 font-bold" 
              placeholder="Número"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
            <input 
              className="w-full bg-zinc-50 p-4 rounded-2xl border border-zinc-100 font-bold" 
              placeholder="Complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {['casa', 'trabalho', 'outro'].map(t => (
              <button 
                key={t} 
                onClick={() => setTipoLocal(t)} 
                className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase italic transition-all ${tipoLocal === t ? 'bg-[#4A044E] border-[#4A044E] text-white' : 'border-zinc-100 text-zinc-400'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <button 
            onClick={confirmarFinal}
            disabled={!enderecoCliente.latlng || enderecoCliente.taxa === "FORA DA ÁREA" || !numero}
            className="w-full bg-[#4A044E] text-white py-5 rounded-2xl font-black uppercase italic shadow-lg disabled:opacity-30 transition-all active:scale-95"
          >
            {enderecoCliente.taxa === "FORA DA ÁREA" ? "ÁREA NÃO ATENDIDA" : `CONFIRMAR - TAXA R$ ${enderecoCliente.taxa}`}
          </button>
        </div>
      </div>
    </div>
  );
}