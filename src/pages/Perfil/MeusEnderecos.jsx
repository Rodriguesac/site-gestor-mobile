import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Lucide from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from "../../services/firebase";
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STORE_COORDS = [-20.43131, -54.55412];
const PRIMARY_COLOR = '#82C91E';

export default function MeusEnderecos() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const clientMarker = useRef(null);
  const routeLayer = useRef(null);
  
  const [enderecos, setEnderecos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  const [tipoLocal, setTipoLocal] = useState('Casa');
  const [enderecoCliente, setEnderecoCliente] = useState({ endereco: '', taxa: '0,00', km: '0.00', latlng: null });
  const [configLogistica, setConfigLogistica] = useState({ taxaBase: 0, valorPorKm: 1.5 });
  const [tentouSalvar, setTentouSalvar] = useState(false);

  // Carregar Regras de Logística
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "logistica"), (snap) => {
      if (snap.exists()) setConfigLogistica(snap.data());
    });
    return () => unsub();
  }, []);

  // Carregar Histórico
  const carregarHistorico = useCallback(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), orderBy("id", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEnderecos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    let unsub;
    const interval = setInterval(() => {
      if (auth.currentUser) {
        unsub = carregarHistorico();
        clearInterval(interval);
      }
    }, 500);
    return () => { if (unsub) unsub(); clearInterval(interval); };
  }, [carregarHistorico]);

  // FUNÇÃO PRINCIPAL: Processar Local e FECHAR SUGESTÕES
  const processarLocal = async (lat, lng, label) => {
    setSugestoes([]); 
    setTentouSalvar(false);
    
    const logradouro = label.split(',')[0];
    setBusca(logradouro);

    const partes = label.split(',');
    if (partes.length > 1) setBairro(partes[1].trim());

    if (mapInstance.current) {
      const clientIcon = L.divIcon({
        className: 'user-marker',
        html: `<div class="relative flex flex-col items-center">
                  <span class="bg-[#0b0e13] text-[#82C91E] text-[8px] font-black px-2 py-1 rounded-full border border-[#82C91E]/50 shadow-lg uppercase mb-1">VOCÊ</span>
                  <div class="w-5 h-5 bg-[#82C91E] rounded-full border-2 border-white shadow-[0_0_15px_#82C91E]"></div>
               </div>`,
        iconSize: [60, 60], iconAnchor: [30, 50]
      });

      if (clientMarker.current) clientMarker.current.setLatLng([lat, lng]);
      else clientMarker.current = L.marker([lat, lng], { icon: clientIcon }).addTo(mapInstance.current);

      try {
        const resR = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
        const dataR = await resR.json();
        if (dataR.routes?.length > 0) {
          const r = dataR.routes[0];
          const km = (r.distance / 1000).toFixed(2);
          const taxaVal = (configLogistica.taxaBase + (parseFloat(km) * configLogistica.valorPorKm));
          setEnderecoCliente({
            endereco: label,
            km,
            taxa: taxaVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            latlng: { lat, lng }
          });
          if (routeLayer.current) mapInstance.current.removeLayer(routeLayer.current);
          routeLayer.current = L.geoJSON(r.geometry, { style: { color: PRIMARY_COLOR, weight: 6, opacity: 0.8, lineCap: 'round' } }).addTo(mapInstance.current);
          mapInstance.current.fitBounds(routeLayer.current.getBounds(), { padding: [50, 50] });
        }
      } catch (e) { console.error(e); }
    }
  };

  // Mapa Inicial (ESTILO CLARO VOYAGER)
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(STORE_COORDS, 15);
      
      // MUDANÇA: Mapa claro e limpo
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);

      // MUDANÇA: Ícone da Loja com a Logo
      const storeIcon = L.divIcon({
        className: 'store-icon',
        html: `<div class="bg-white p-1 rounded-full border-2 border-[#82C91E] shadow-lg flex items-center justify-center overflow-hidden">
                  <img src="https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png" class="w-7 h-7 object-contain" />
               </div>`,
        iconSize: [40, 40]
      });
      L.marker(STORE_COORDS, { icon: storeIcon }).addTo(mapInstance.current);

      mapInstance.current.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lng},${lat}`);
        const data = await res.json();
        processarLocal(lat, lng, data.address?.Address || "Local selecionado");
      });
    }
  }, []);

  // Autocomplete com Trava
  useEffect(() => {
    if (busca.length < 5) {
      setSugestoes([]);
      return;
    }
    const t = setTimeout(async () => {
      if (enderecoCliente.endereco.split(',')[0] === busca) return;

      const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(busca + ", Campo Grande, MS")}&maxLocations=5`);
      const data = await res.json();
      setSugestoes(data.candidates || []);
    }, 400);
    return () => clearTimeout(t);
  }, [busca, enderecoCliente.endereco]);

  const salvarEndereco = async () => {
    if (!auth.currentUser || !numero || !bairro) { setTentouSalvar(true); setTimeout(() => setTentouSalvar(false), 1000); return; }
    const id = Date.now().toString();
    const finalData = { ...enderecoCliente, numero, complemento, bairro, tipo: tipoLocal, id };
    await setDoc(doc(db, "usuarios", auth.currentUser.uid, "meus_enderecos", id), finalData);
    localStorage.setItem('endereco_rodrigues', JSON.stringify(finalData));
    window.dispatchEvent(new Event('enderecoAtualizado'));
    navigate('/perfil');
  };

  const selecionarEndereco = (end) => {
    localStorage.setItem('endereco_rodrigues', JSON.stringify(end));
    window.dispatchEvent(new Event('enderecoAtualizado'));
    navigate('/perfil');
  };

  const deletarEndereco = async (e, id) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, "usuarios", auth.currentUser.uid, "meus_enderecos", id));
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0e13] text-zinc-400 font-sans selection:bg-[#82C91E] selection:text-black overflow-hidden">
      
      {/* Seção Fixa Superior */}
      <section className="relative h-[30vh] w-full shrink-0 overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0b0e13] pointer-events-none" />
        
        <button onClick={() => navigate('/perfil')} className="absolute top-6 left-6 z-[1000] bg-[#161922]/90 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white shadow-2xl active:scale-90 transition-all">
          <Lucide.ChevronLeft size={20} />
        </button>

        <div className="absolute bottom-4 left-6 right-6 z-[1000]">
          <h1 className="text-white text-xl font-[1000] italic uppercase tracking-tighter leading-none">
            Meus <span className="text-[#82C91E]">Endereços</span>
          </h1>
          <p className="text-[9px] font-bold text-zinc-500 uppercase italic mt-1 tracking-widest">Gestão de Entrega Inteligente</p>
        </div>
      </section>

      {/* Busca Fixa */}
      <div className="px-6 -mt-4 relative z-[1001] shrink-0">
        <div className="bg-[#161922] p-1 rounded-[2rem] border border-white/5 flex items-center gap-3 px-5 h-14 shadow-2xl shadow-black/50">
          <Lucide.Search size={18} className="text-[#82C91E] shrink-0" />
          <input 
            value={busca} 
            onChange={e => setBusca(e.target.value)}
            placeholder="PROCURAR ENDEREÇO..."
            className="bg-transparent outline-none w-full font-black text-white uppercase italic text-[11px] placeholder:text-zinc-700"
          />
        </div>

        {sugestoes.length > 0 && (
          <div className="absolute left-6 right-6 mt-2 bg-[#161922] rounded-3xl border border-[#82C91E]/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[2000] overflow-hidden backdrop-blur-xl">
            {sugestoes.map((s, i) => (
              <button key={i} onClick={() => processarLocal(s.location.y, s.location.x, s.address)} className="w-full p-4 text-left border-b border-white/5 hover:bg-[#82C91E]/5 transition-all flex items-start gap-4 active:bg-[#82C91E]/20">
                <div className="mt-1 text-[#82C91E]"><Lucide.MapPin size={14} /></div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase italic leading-tight">{s.address.split(',')[0]}</p>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase italic mt-0.5">{s.address.split(',').slice(1).join(',')}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-6 scroll-smooth">
        {enderecoCliente.latlng && (
          <div className={`space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${tentouSalvar ? 'animate-shake' : ''}`}>
            <div className="bg-gradient-to-r from-[#161922] to-[#1a1e29] p-5 rounded-[2rem] border border-[#82C91E]/30 flex justify-between items-center shadow-xl">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-[#82C91E] uppercase italic tracking-[0.2em] mb-1">Taxa Estimada</span>
                <span className="text-2xl font-[1000] text-white uppercase italic tracking-tighter leading-none">R$ {enderecoCliente.taxa}</span>
              </div>
              <div className="text-right">
                <span className="bg-[#82C91E] text-black px-2 py-0.5 rounded-lg font-[1000] text-[10px] italic">{enderecoCliente.km} KM</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`bg-[#161922] p-4 rounded-2xl border transition-all ${!numero && tentouSalvar ? 'border-red-500' : 'border-white/5'}`}>
                <label className="text-[7px] font-black text-zinc-600 uppercase mb-1 block">Número</label>
                <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="000" className="bg-transparent outline-none font-black text-white uppercase italic text-sm w-full placeholder:text-zinc-800" />
              </div>
              <div className={`bg-[#161922] p-4 rounded-2xl border transition-all ${!bairro && tentouSalvar ? 'border-red-500' : 'border-white/5'}`}>
                <label className="text-[7px] font-black text-zinc-600 uppercase mb-1 block">Bairro</label>
                <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="BAIRRO" className="bg-transparent outline-none font-black text-white uppercase italic text-sm w-full placeholder:text-zinc-800" />
              </div>
            </div>

            <div className="bg-[#161922] p-4 rounded-2xl border border-white/5">
              <label className="text-[7px] font-black text-zinc-600 uppercase mb-1 block">Complemento</label>
              <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="EX: APTO 201, BLOCO B" className="bg-transparent outline-none font-black text-white uppercase italic text-xs w-full placeholder:text-zinc-800" />
            </div>

            <div className="space-y-2">
              <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block ml-1">Selecione o Tipo</label>
              <div className="flex gap-2">
                {['Casa', 'Trabalho', 'Outro'].map(tipo => (
                  <button 
                    key={tipo}
                    onClick={() => setTipoLocal(tipo)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black italic text-[10px] uppercase transition-all border ${tipoLocal === tipo ? 'bg-[#82C91E] text-black border-[#82C91E] shadow-lg shadow-[#82C91E]/20' : 'bg-[#161922] text-zinc-500 border-white/5 hover:border-zinc-700'}`}
                  >
                    {tipo === 'Casa' ? <Lucide.Home size={14} /> : tipo === 'Trabalho' ? <Lucide.Briefcase size={14} /> : <Lucide.MapPin size={14} />}
                    {tipo}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={salvarEndereco} className={`w-full h-14 rounded-2xl font-[1000] uppercase italic text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${(!numero || !bairro) && tentouSalvar ? 'bg-red-500 text-white' : 'bg-[#82C91E] text-black'}`}>
              SALVAR ENDEREÇO <Lucide.Check size={16} />
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between sticky top-0 bg-[#0b0e13] py-2 z-10">
            <h2 className="text-[10px] font-black text-zinc-600 uppercase italic tracking-[0.2em]">Meus Salvos ({enderecos.length})</h2>
            <div className="h-px flex-1 bg-zinc-800/40 ml-4"></div>
          </div>

          <div className="grid gap-3 pb-10">
            {loading ? (
              <div className="py-10 flex flex-col items-center gap-3 text-zinc-800">
                <div className="w-8 h-8 border-2 border-[#82C91E]/10 border-t-[#82C91E] rounded-full animate-spin"></div>
              </div>
            ) : (
              enderecos.map((end) => (
                <div key={end.id} onClick={() => selecionarEndereco(end)} className="group bg-[#161922] p-1.5 rounded-[1.8rem] border border-white/5 flex items-center gap-4 transition-all hover:border-[#82C91E]/40 relative active:scale-[0.98]">
                  <div className="bg-[#0b0e13] w-12 h-12 rounded-2xl flex items-center justify-center text-[#82C91E] border border-white/5 shrink-0 ml-1">
                    {end.tipo === 'Casa' ? <Lucide.Home size={22} /> : end.tipo === 'Trabalho' ? <Lucide.Briefcase size={22} /> : <Lucide.MapPin size={22} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-white uppercase italic text-[11px] truncate">{end.bairro}</h3>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase italic truncate">{end.endereco?.split(',')[0]}, {end.numero}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-[#82C91E] uppercase italic">Taxa R$ {end.taxa}</span>
                    </div>
                  </div>
                  <button onClick={(e) => deletarEndereco(e, end.id)} className="mr-4 p-2 text-zinc-800 hover:text-red-500 transition-colors">
                    <Lucide.Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .leaflet-container { background: #f8f9fa !important; }
      `}</style>
    </div>
  );
}