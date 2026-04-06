import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { MapContainer, TileLayer, useMapEvents, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, doc, addDoc, serverTimestamp } from 'firebase/firestore';

const STORE_COORDS = [-20.43131, -54.55412];
const TOMTOM_KEY = 'tmsKTjnNOPUHNDHOYh2m12VrmwejmK8t'; 
const TAGS_RAPIDAS = ["Deixar na portaria", "Não tocar campainha", "Ligar ao chegar", "Cuidado com o cão"];

function MapCenterEvents({ onMoveEnd }) {
  const map = useMapEvents({ moveend: () => { const center = map.getCenter(); onMoveEnd(center.lat, center.lng); } });
  return null;
}

function RecenterMap({ coords }) {
    const map = useMap();
    useEffect(() => { if (coords && coords.length === 2) map.flyTo(coords, 17, { animate: true, duration: 1.5 }); }, [coords, map]);
    return null;
}

const calcularDistanciaHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2)); // Retorna número puro
};

export default function ModalEndereco({ isOpen, onClose }) {
  const numeroInputRef = useRef(null);
  
  // --- A REGRA DO REI (PAINEL LOGÍSTICA) ---
  const [configLogistica, setConfigLogistica] = useState(null);
  
  // --- ESTADOS ---
  const [etapa, setEtapa] = useState('BUSCA'); 
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [calculandoLogistica, setCalculandoLogistica] = useState(false);
  const [salvando, setSalvando] = useState(false); 
  
  const [rotaCoords, setRotaCoords] = useState([]);
  const [mapCenter, setMapCenter] = useState(STORE_COORDS);
  
  const [dados, setDados] = useState({ 
      rua: '', numero: '', bairro: '', cep: '', latlng: null 
  });
  
  // Valores numéricos puros para não dar erro no Carrinho/Checkout
  const [kmCalculado, setKmCalculado] = useState(null);
  const [taxaCalculada, setTaxaCalculada] = useState(null);

  const [complemento, setComplemento] = useState('');
  const [tipoLocal, setTipoLocal] = useState('Casa');
  const [precisaConfirmarNumero, setPrecisaConfirmarNumero] = useState(false);

  // 1. ESCUTA O PAINEL LOGÍSTICA
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, "configuracoes_loja", "logistica"), (snap) => {
      if (snap.exists()) setConfigLogistica(snap.data());
    });
    return () => unsub();
  }, [isOpen]);

  // 2. CARREGA ENDEREÇOS DO CLIENTE
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    const unsub = onSnapshot(query(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), orderBy("createdAt", "desc")), (snap) => {
        setEnderecosSalvos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isOpen]);

  const extrairNumeroDaBusca = (texto) => {
    const match = texto.match(/(?:,\s*|\s+)(\d+)(?:\s*|-*[a-zA-Z])?$/);
    return match ? match[1] : '';
  };

  // BUSCA TOMTOM DEBOUNCE
  useEffect(() => {
    if (busca.trim().length < 3) { setSugestoes([]); setShowSugestoes(false); return; }
    const timer = setTimeout(async () => {
      if (etapa === 'BUSCA') {
        try {
          const res = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(busca)}.json?key=${TOMTOM_KEY}&countrySet=BR&lat=${STORE_COORDS[0]}&lon=${STORE_COORDS[1]}&radius=30000&limit=5&typeahead=true`);
          const data = await res.json();
          if (data.results?.length > 0) {
              setSugestoes(data.results.filter(item => item.address?.municipality === 'Campo Grande' || item.address?.localName === 'Campo Grande'));
              setShowSugestoes(true);
          } else setShowSugestoes(false);
        } catch (e) { console.error(e); }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [busca, etapa]);

  // ============================================================================
  // O CÉREBRO: MEDE A DISTÂNCIA E PERGUNTA O PREÇO À TABELA LOGÍSTICA
  // ============================================================================
  const processarLocalizacaoCentral = async (lat, lng, numeroPreservado = null) => {
      setCalculandoLogistica(true);
      setDados(prev => ({ ...prev, latlng: { lat, lng } }));

      let kmFinal = 0;
      let rotaVisual = [];

      // 1. MEDE O KM
      try {
        const resRota = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
        const dataRota = await resRota.json();
        if (dataRota.routes?.length > 0) {
          kmFinal = dataRota.routes[0].distance / 1000;
          rotaVisual = dataRota.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        } else throw new Error();
      } catch (e) { 
        kmFinal = calcularDistanciaHaversine(STORE_COORDS[0], STORE_COORDS[1], lat, lng);
        rotaVisual = [[STORE_COORDS[0], STORE_COORDS[1]], [lat, lng]]; 
      }

      setRotaCoords(rotaVisual);
      setKmCalculado(kmFinal);

      // 2. BUSCA O NOME DA RUA
      try {
          const geoRes = await fetch(`https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_KEY}&radius=100`);
          const geoData = await geoRes.json();
          if (geoData.addresses?.length > 0) {
              const addr = geoData.addresses[0].address;
              const numFinal = numeroPreservado || addr.streetNumber || '';
              setDados(prev => ({
                  ...prev,
                  rua: (addr.streetName || addr.route || '').toUpperCase(), 
                  numero: numFinal,
                  bairro: (addr.municipalitySubdivision || '').toUpperCase(),
                  cep: addr.postalCode || "79000-000",
              }));
              if (!numFinal) setPrecisaConfirmarNumero(true);
          }
      } catch(e) {}

      setCalculandoLogistica(false);
  };

  // 3. CALCULA A TAXA ASSIM QUE O KM OU A TABELA ATUALIZAM
  useEffect(() => {
      if (kmCalculado !== null && configLogistica) {
          let valorTaxa = 0;
          if (configLogistica.tabelaTaxas?.length > 0) {
              const regraAplicada = configLogistica.tabelaTaxas.find(r => kmCalculado <= r.distanciaKm);
              if (regraAplicada) {
                  valorTaxa = regraAplicada.valor;
              } else {
                  const ultimaRegra = configLogistica.tabelaTaxas[configLogistica.tabelaTaxas.length - 1];
                  const kmExtra = kmCalculado - ultimaRegra.distanciaKm;
                  valorTaxa = ultimaRegra.valor + (kmExtra * (configLogistica.valorKmAdicional || 0));
              }
          } else {
              valorTaxa = 6.00; // Default caso não haja tabela
          }
          setTaxaCalculada(valorTaxa);
      }
  }, [kmCalculado, configLogistica]);

  // --- AÇÕES ---
  const selecionarSugestao = async (sug) => {
    setBuscando(true); setShowSugestoes(false);
    const numeroDigitado = sug.address?.streetNumber || extrairNumeroDaBusca(busca);
    
    setDados(prev => ({
        ...prev, rua: (sug.address?.streetName || sug.address?.freeformAddress || '').toUpperCase(),
        numero: numeroDigitado, bairro: (sug.address?.municipalitySubdivision || '').toUpperCase(),
        cep: '', latlng: { lat: sug.position.lat, lng: sug.position.lon }
    }));
    setMapCenter([sug.position.lat, sug.position.lon]);
    setEtapa('MAPA');
    await processarLocalizacaoCentral(sug.position.lat, sug.position.lon, numeroDigitado);
    setBuscando(false);
  };

  const usarGPS = () => {
      setBuscandoGps(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
          setEtapa('MAPA');
          await processarLocalizacaoCentral(pos.coords.latitude, pos.coords.longitude);
          setBuscandoGps(false);
      }, () => { alert("Erro no GPS. Digite o endereço."); setBuscandoGps(false); }, { enableHighAccuracy: true });
  };

  const usarSalvo = (end) => {
    setDados({ rua: end.rua, numero: end.numero, bairro: end.bairro, cep: end.cep, latlng: end.latlng });
    setComplemento(end.complemento || ''); setTipoLocal(end.tipo || 'Casa');
    setMapCenter([end.latlng.lat, end.latlng.lng]);
    setEtapa('MAPA');
    processarLocalizacaoCentral(end.latlng.lat, end.latlng.lng, end.numero);
  };

  const adicionarTag = (tag) => setComplemento(prev => prev ? prev + ", " + tag : tag);

  const validarCoordenadasFinais = async (texto) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto + ', Campo Grande, MS, Brasil')}&limit=1`);
      const data = await res.json();
      if (data?.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (e) {} return null;
  };

  // 4. GUARDA O VALOR NUMÉRICO PURO!
  const confirmarEndereco = async () => {
      if (!dados.rua || !dados.numero) { setPrecisaConfirmarNumero(true); numeroInputRef.current?.focus(); return alert("Informe o número."); }
      
      setSalvando(true);
      try {
        const coordsFinais = await validarCoordenadasFinais(`${dados.rua}, ${dados.numero}, ${dados.bairro}`);
        const latFinal = coordsFinais?.lat || dados.latlng?.lat || STORE_COORDS[0];
        const lngFinal = coordsFinais?.lng || dados.latlng?.lng || STORE_COORDS[1];

        // GUARDA TAXA COMO NÚMERO
        const payloadBase = { 
            ...dados, 
            lat: latFinal, lng: lngFinal, latlng: { lat: latFinal, lng: lngFinal }, 
            complemento, tipo: tipoLocal,
            km: kmCalculado || 0,
            taxa: taxaCalculada || 0 // NUMBER PURO!
        };
        
        if (auth.currentUser) {
            await addDoc(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), { ...payloadBase, createdAt: serverTimestamp() });
        }

        localStorage.setItem('endereco_rodrigues', JSON.stringify({ ...payloadBase, createdAt: new Date().toISOString() }));
        window.dispatchEvent(new Event('enderecoAtualizado'));
        onClose();
      } catch (err) { alert("Erro ao salvar endereço."); } finally { setSalvando(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm bg-black/60 selection:bg-[#82C91E]/30">
      <div className="w-full max-w-md bg-white sm:rounded-[3rem] rounded-t-[3rem] shadow-2xl overflow-hidden h-[95vh] sm:h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
        
        {etapa === 'BUSCA' && (
            <div className="flex flex-col h-full bg-white">
                <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-100">
                  <h2 className="text-[#4B0082] font-[1000] italic uppercase text-lg leading-none">Onde entregar?</h2>
                  <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"><Lucide.X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar relative">
                    <div className="flex bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-[#EA1D2C] focus-within:bg-white shadow-sm p-1.5 items-center transition-all relative z-50">
                         <Lucide.Search size={20} className="text-[#EA1D2C] ml-3" />
                         <input value={busca} onChange={e => setBusca(e.target.value)} className="flex-1 bg-transparent p-3 text-slate-800 font-bold text-sm outline-none placeholder:text-slate-400" placeholder="Rua e número, bairro" autoFocus />
                         {busca && !buscando && <button onClick={() => {setBusca(''); setShowSugestoes(false);}} className="mr-3 text-slate-400"><Lucide.XCircle size={18} /></button>}
                    </div>

                    <AnimatePresence>
                        {showSugestoes && sugestoes.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-40 -mt-2">
                                {sugestoes.map((sug, i) => (
                                    <button key={i} onClick={() => selecionarSugestao(sug)} className="w-full text-left p-4 border-b border-slate-50 hover:bg-[#82C91E]/10 flex items-center gap-3 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Lucide.MapPin size={14} className="text-[#4B0082]" /></div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-[12px] font-[1000] text-[#4B0082] truncate">{sug.address?.streetName || sug.address?.freeformAddress}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-0.5">{sug.address?.municipalitySubdivision || 'Campo Grande'}, MS</p>
                                        </div>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!busca && (
                        <button onClick={usarGPS} disabled={buscandoGps} className="w-full text-left py-3 flex items-center gap-4 hover:opacity-70 transition-all border-b border-slate-100 pb-5">
                            <Lucide.Crosshair size={22} className={`text-[#4B0082] ${buscandoGps ? 'animate-spin' : ''}`} />
                            <span className="text-sm font-bold text-[#4B0082]">Usar minha localização atual</span>
                        </button>
                    )}

                    {!busca && enderecosSalvos.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">Endereços Salvos</p>
                            {enderecosSalvos.map(end => (
                                <button key={end.id} onClick={() => usarSalvo(end)} className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm hover:border-[#EA1D2C] transition-all">
                                    <div className="p-2.5 rounded-full text-slate-500 bg-slate-50">
                                        {end.tipo === 'Casa' ? <Lucide.Home size={18}/> : end.tipo === 'Trabalho' ? <Lucide.Briefcase size={18}/> : <Lucide.MapPin size={18}/>}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{end.rua}, {end.numero}</p>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{end.bairro} • {end.complemento || end.tipo}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {etapa === 'MAPA' && (
            <div className="flex flex-col h-full bg-white relative">
                <button onClick={() => setEtapa('BUSCA')} className="absolute top-4 left-4 z-[500] p-3 bg-white shadow-lg rounded-full text-[#EA1D2C] hover:bg-slate-50 transition-all active:scale-95">
                    <Lucide.ChevronLeft size={24} />
                </button>

                <div className="relative h-[45%] w-full shrink-0 z-10 bg-slate-100 retro-map-tiles">
                  {mapCenter && (
                    <MapContainer center={mapCenter} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                      {rotaCoords.length > 0 && <Polyline positions={rotaCoords} color="#4B0082" weight={4} opacity={0.6} dashArray="8, 12" />}
                      <MapCenterEvents onMoveEnd={(lat, lng) => processarLocalizacaoCentral(lat, lng, dados.numero)} />
                      <RecenterMap coords={mapCenter} />
                    </MapContainer>
                  )}
                  <div className="absolute inset-0 z-[400] shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none" />

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                      <div className="bg-white px-3 py-1.5 rounded-lg shadow-lg mb-2 text-center animate-bounce-slow border border-slate-100">
                          <p className="text-xs font-bold text-slate-800">Você está aqui?</p>
                          <p className="text-[9px] text-slate-400">Ajuste a localização</p>
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-r border-b border-slate-100" />
                      </div>
                      <div className="drop-shadow-[0_8px_8px_rgba(234,29,44,0.4)]">
                          <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 48C20 48 40 30.6 40 18.3C40 8.2 31.0 0 20 0C9.0 0 0 8.2 0 18.3C0 30.6 20 48 20 48Z" fill="#EA1D2C"/>
                              <circle cx="20" cy="18" r="6" fill="white"/>
                          </svg>
                      </div>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white z-20 custom-scrollbar text-left rounded-t-3xl -mt-6 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] relative">
                     <div className="mb-4">
                         <h3 className="text-sm font-black text-[#4B0082] uppercase italic">{dados.rua || 'Buscando logradouro...'}</h3>
                         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{dados.bairro ? `${dados.bairro}, Campo Grande - MS` : 'Localizando bairro...'}</p>
                     </div>
                     
                     <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                           <label className={`text-[10px] font-black uppercase tracking-widest ${precisaConfirmarNumero ? 'text-[#EA1D2C]' : 'text-slate-500'}`}>Número</label>
                           <input 
                             ref={numeroInputRef} 
                             value={dados.numero} 
                             onChange={e => {setDados({...dados, numero: e.target.value}); setPrecisaConfirmarNumero(false);}} 
                             className={`w-full bg-white p-3 rounded-xl border-2 ${precisaConfirmarNumero ? 'border-[#EA1D2C] bg-red-50' : 'border-slate-100 focus:border-[#4B0082]'} text-slate-800 font-black text-sm outline-none transition-all`} 
                             placeholder="Ex: 601" 
                           />
                        </div>
                        <div className="col-span-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Complemento</label>
                           <input 
                             value={complemento} 
                             onChange={e => setComplemento(e.target.value)} 
                             placeholder="Apto/Bloco" 
                             className="w-full bg-white p-3 rounded-xl border-2 border-slate-100 focus:border-[#4B0082] text-slate-800 font-bold text-sm outline-none transition-all" 
                           />
                        </div>
                     </div>

                     <div className="pt-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Tipo de Local</label>
                         <div className="flex gap-2">
                             {['Casa', 'Trabalho'].map(t => (
                             <button key={t} onClick={() => setTipoLocal(t)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all ${tipoLocal === t ? 'bg-[#EA1D2C]/10 text-[#EA1D2C] border-2 border-[#EA1D2C]/30 shadow-md' : 'bg-slate-50 text-slate-400 border-2 border-slate-100 hover:bg-slate-100'}`}>
                                 {t === 'Casa' ? <Lucide.Home size={14}/> : <Lucide.Briefcase size={14}/>} {t}
                             </button>
                             ))}
                         </div>
                     </div>

                     <div className="flex items-center justify-between bg-[#F1F5F9] p-4 rounded-2xl mt-4 border border-slate-200">
                         <div className="flex items-center gap-2 text-slate-500">
                             <Lucide.Bike size={18} className="text-[#82C91E]" /> <span className="text-[10px] font-black uppercase tracking-widest">Serviço de Entrega</span>
                         </div>
                         <div className="text-right">
                             <p className="text-[9px] text-slate-400 font-black uppercase">{calculandoLogistica ? '...' : kmCalculado?.toFixed(1)} km de distância</p>
                             <p className="text-lg font-black text-[#4B0082]">
                                 {calculandoLogistica || taxaCalculada === null ? <Lucide.Loader2 size={16} className="animate-spin inline text-[#82C91E]"/> : `R$ ${taxaCalculada.toFixed(2).replace('.', ',')}`}
                             </p>
                         </div>
                     </div>

                     <button onClick={confirmarEndereco} disabled={salvando || taxaCalculada === null || calculandoLogistica} className="w-full py-5 bg-[#EA1D2C] text-white disabled:bg-slate-300 disabled:shadow-none rounded-[2rem] font-[1000] uppercase italic text-sm shadow-xl shadow-red-500/20 active:scale-95 transition-all mt-4 flex items-center justify-center gap-2">
                        {salvando ? <Lucide.Loader2 size={20} className="animate-spin" /> : <><Lucide.CheckCircle size={20} /> Salvar Local de Entrega</>}
                     </button>
                </div>
            </div>
        )}
      </div>
      <style>{`.retro-map-tiles .leaflet-tile-pane { filter: sepia(0.8) contrast(1.2) brightness(0.9) saturate(0.6) hue-rotate(-10deg); }`}</style>
    </div>
  );
}