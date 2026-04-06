import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { MapContainer, TileLayer, useMapEvents, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from "../services/firebase";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CONFIGURAÇÕES INICIAIS ---
const STORE_COORDS = [-20.43131, -54.55412];
const PRIMARY_COLOR = '#82C91E';
// A chave que você forneceu:
const TOMTOM_KEY = 'tmsKTjnNOPUHNDHOYh2m12VrmwejmK8t'; 

// Ícone da Loja
const storeIcon = L.divIcon({
  className: 'custom-store-icon',
  html: `<div style="background: white; padding: 2px; border: 2px solid ${PRIMARY_COLOR}; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
            <img src="https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png" style="width: 24px; height: 24px; object-fit: contain;" />
         </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

export default function ModalEndereco({ isOpen, onClose }) {
  const mapRef = useRef(null);
  const numeroInputRef = useRef(null);
  
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [isMovendoMapa, setIsMovendoMapa] = useState(false);
  const [rotaCoords, setRotaCoords] = useState([]);
  
  const [dados, setDados] = useState({ rua: '', numero: '', bairro: '', cep: '', km: '0.0', taxa: '0,00', latlng: null });
  const [complemento, setComplemento] = useState('');
  const [tipoLocal, setTipoLocal] = useState('Casa');
  const [precisaConfirmarNumero, setPrecisaConfirmarNumero] = useState(false);

  // 1. MOTOR DE BUSCA (TOMTOM)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (busca.length > 4 && !busca.includes('📍')) {
        setBuscando(true);
        try {
          // Busca focada no Brasil, priorizando a região de Campo Grande
          const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(busca)}.json?key=${TOMTOM_KEY}&countrySet=BR&lat=${STORE_COORDS[0]}&lon=${STORE_COORDS[1]}&radius=30000&limit=5`;
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.results) {
              // Filtra garantindo que seja Campo Grande
              const sugestoesFiltradas = data.results.filter(item => 
                  item.address?.municipality === 'Campo Grande' || 
                  item.address?.localName === 'Campo Grande'
              );
              setSugestoes(sugestoesFiltradas);
          }
        } catch (e) { console.error("Erro na busca TomTom:", e); }
        setBuscando(false);
      } else {
        setSugestoes([]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [busca]);

  // 2. INTELIGÊNCIA CENTRAL (REVERSE GEOCODE TOMTOM + ROTA OSRM)
  const processarLocalizacaoCentral = async (lat, lng, forcarBusca = false) => {
    try {
      // Continua usando OSRM de graça para a Rota e Taxa
      const resRota = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
      const dataRota = await resRota.json();
      
      let kmVal = "0.0", taxaVal = "0,00";
      if (dataRota.routes?.length > 0) {
        kmVal = (dataRota.routes[0].distance / 1000).toFixed(1);
        taxaVal = (parseFloat(kmVal) * 1.5).toFixed(2); // Sua regra de taxa
        setRotaCoords(dataRota.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
      }

      // Reverse Geocoding no TOMTOM (Aqui vem a precisão do número)
      const urlTomTom = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_KEY}&radius=100`;
      const geoRes = await fetch(urlTomTom);
      const geoData = await geoRes.json();

      if (geoData.addresses && geoData.addresses.length > 0) {
        const addr = geoData.addresses[0].address;
        
        // Proteção contra cidades vizinhas
        if (addr.municipality !== 'Campo Grande' && addr.localName !== 'Campo Grande') {
            alert("Entregas apenas em Campo Grande/MS.");
            return;
        }

        // TOMTOM traz o número direto no "streetNumber"
        let numeroExtraido = addr.streetNumber || '';
        
        // Se o TomTom não achou o número no arraste, tentamos salvar puxando do que o cliente digitou
        if (!numeroExtraido && forcarBusca) {
           const match = busca.match(/\d+/); 
           if (match) numeroExtraido = match[0];
        }

        const novaRua = (addr.streetName || addr.route || '').toUpperCase();
        const novoBairro = (addr.municipalitySubdivision || addr.countrySecondarySubdivision || '').toUpperCase();
        
        // Se o número foi preenchido por nós (TomTom ou Regex), avisamos o cliente para checar
        if (numeroExtraido) {
            setPrecisaConfirmarNumero(true);
        }

        setDados({
          rua: novaRua,
          numero: numeroExtraido,
          bairro: novoBairro,
          cep: addr.postalCode || '',
          km: kmVal, taxa: taxaVal.replace('.', ','), latlng: { lat, lng }
        });

        setBusca(`📍 ${novaRua}${numeroExtraido ? `, ${numeroExtraido}` : ''}`);
        setSugestoes([]); 
      }
    } catch (e) { console.error("Erro no TomTom Reverse:", e); }
  };

  const selecionarSugestao = (sug) => {
    const lat = sug.position.lat;
    const lon = sug.position.lon;
    if (mapRef.current) mapRef.current.flyTo([lat, lon], 18, { animate: true, duration: 1.5 });
    
    // Passa a posição exata selecionada para recalcular rota e formatar tudo
    processarLocalizacaoCentral(lat, lon, true);
  };

  function MonitorDeMovimento() {
    useMapEvents({
      dragstart: () => setIsMovendoMapa(true),
      moveend: (e) => {
        setIsMovendoMapa(false);
        const center = e.target.getCenter();
        processarLocalizacaoCentral(center.lat, center.lng, false);
      }
    });
    return null;
  }

  const confirmarEndereco = async () => {
      if (!dados.rua) return alert("Por favor, selecione uma rua.");
      if (!dados.numero) {
          numeroInputRef.current?.focus(); 
          return alert("Por favor, informe o número da residência (ou 'S/N').");
      }
      
      const payload = { ...dados, complemento, tipo: tipoLocal, timestamp: serverTimestamp() };
      
      if (auth.currentUser) {
          await addDoc(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), payload);
      }
      localStorage.setItem('endereco_rodrigues', JSON.stringify(payload));
      window.dispatchEvent(new Event('enderecoAtualizado'));
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm bg-black/60">
      <div className="w-full max-w-md bg-white sm:rounded-[3rem] rounded-t-[3rem] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in slide-in-from-bottom-10">
        
        {/* HEADER */}
        <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-100 shrink-0">
          <div>
            <span className="text-[9px] font-black text-[#82C91E] uppercase tracking-widest">Açaí no ponto certo</span>
            <h2 className="text-[#4B0082] font-[1000] italic uppercase text-lg leading-none">Onde Entregar?</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500">
            <Lucide.X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* MAPA */}
          <div className="relative h-56 w-full rounded-[2.5rem] overflow-hidden border-2 border-slate-100 shadow-inner shrink-0 bg-slate-100">
            <MapContainer center={STORE_COORDS} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={mapRef}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Marker position={STORE_COORDS} icon={storeIcon} />
              {rotaCoords.length > 0 && <Polyline positions={rotaCoords} color="#4B0082" weight={5} opacity={0.7} dashArray="10, 10" />}
              <MonitorDeMovimento />
            </MapContainer>

            {/* PINO FIXO CENTRAL */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                <div className={`bg-[#4B0082] text-white text-[8px] font-black uppercase px-3 py-1 rounded-full mb-1 transition-all duration-300 ${isMovendoMapa ? 'opacity-100 -translate-y-2 shadow-lg' : 'opacity-0'}`}>Solte para marcar</div>
                <div className={`transition-all duration-300 ${isMovendoMapa ? '-translate-y-3 scale-110 drop-shadow-2xl' : 'drop-shadow-lg'} bg-[#4B0082] text-[#82C91E] border-2 border-white rounded-full w-10 h-10 flex items-center justify-center relative`}>
                    <Lucide.MapPin size={22} fill="currentColor" className="text-[#4B0082]"/>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
            </div>
          </div>

          {/* CAMPO DE BUSCA */}
          <div className="relative z-50">
             <div className="flex bg-slate-50 rounded-2xl border-2 border-transparent focus-within:border-[#82C91E] focus-within:bg-white shadow-sm transition-all p-1 items-center">
                 <Lucide.Search size={18} className="text-[#4B0082] ml-3" />
                 <input 
                   value={busca} 
                   onChange={e => setBusca(e.target.value)}
                   className="flex-1 bg-transparent p-3 text-[#4B0082] font-black italic text-[11px] sm:text-xs outline-none uppercase placeholder:text-slate-400" 
                   placeholder="Buscar rua e número..."
                 />
                 {buscando && <Lucide.Loader2 size={16} className="text-[#82C91E] animate-spin mr-3"/>}
                 {busca && !buscando && (
                     <button onClick={() => { setBusca(''); setSugestoes([]); }} className="p-2 text-slate-300 hover:text-red-500 mr-1"><Lucide.XCircle size={18}/></button>
                 )}
             </div>

             {/* RESULTADOS DA BUSCA TOMTOM */}
             {sugestoes.length > 0 && (
                 <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-[6000] animate-in fade-in">
                     {sugestoes.map((sug, i) => (
                         <button key={i} onClick={() => selecionarSugestao(sug)} className="w-full text-left p-4 border-b border-slate-50 hover:bg-[#4B0082]/5 flex items-start gap-3 transition-colors">
                             <div className="bg-[#82C91E]/20 p-2 rounded-full mt-1"><Lucide.MapPin size={16} className="text-[#4B0082]"/></div>
                             <div>
                                 {/* Extrai e exibe o número diretamente do TomTom se existir */}
                                 <p className="text-[11px] font-[1000] text-[#4B0082] uppercase">
                                     {sug.address?.streetName || sug.address?.freeformAddress} 
                                     {sug.address?.streetNumber && `, Nº ${sug.address.streetNumber}`}
                                 </p>
                                 <p className="text-[9px] font-bold text-slate-500 uppercase">
                                     {sug.address?.municipalitySubdivision || 'Campo Grande'} 
                                     {sug.address?.postalCode && ` • CEP: ${sug.address.postalCode}`}
                                 </p>
                             </div>
                         </button>
                     ))}
                 </div>
             )}
          </div>

          {/* FORMULÁRIO FINAL */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-[2rem] border border-slate-100 relative">
             <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                   <label className="text-[8px] font-black text-[#82C91E] uppercase ml-1">Rua Detectada</label>
                   <input value={dados.rua} readOnly className="w-full bg-transparent p-3 border-b border-slate-200 text-[#4B0082] font-black text-xs outline-none uppercase truncate" />
                </div>
                
                {/* CAMPO DE NÚMERO */}
                <div className="col-span-1 relative">
                   <label className={`text-[8px] font-black uppercase ml-1 transition-colors ${precisaConfirmarNumero ? 'text-red-500 animate-pulse' : 'text-[#82C91E]'}`}>
                       {precisaConfirmarNumero ? 'Confirme o Nº' : 'Número'}
                   </label>
                   <input 
                       ref={numeroInputRef}
                       value={dados.numero} 
                       onChange={e => {
                           setDados({...dados, numero: e.target.value});
                           setPrecisaConfirmarNumero(false);
                       }}
                       onFocus={() => setPrecisaConfirmarNumero(false)}
                       className={`w-full bg-white p-3 rounded-xl border-2 text-[#4B0082] font-black text-xs outline-none text-center transition-all ${precisaConfirmarNumero ? 'border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]' : 'border-slate-200 focus:border-[#82C91E]'}`} 
                       placeholder="Ex: 120" 
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Bairro</label>
                   <input value={dados.bairro} onChange={e => setDados({...dados, bairro: e.target.value.toUpperCase()})} className="w-full bg-transparent p-2 border-b border-slate-200 text-[#4B0082] font-bold text-[10px] outline-none uppercase truncate" />
                 </div>
                 <div>
                   <label className="text-[8px] font-black text-slate-400 uppercase ml-1">CEP</label>
                   <input value={dados.cep} readOnly className="w-full bg-transparent p-2 border-b border-transparent text-slate-500 font-bold text-[10px] outline-none" placeholder="00000-000" />
                 </div>
             </div>

             <div>
                <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Complemento (Apto, Bloco, Casa 2...)" className="w-full bg-white p-3 rounded-xl border border-slate-200 text-[#4B0082] font-bold text-xs outline-none" />
             </div>
          </div>

          <button onClick={confirmarEndereco} className="w-full py-4 bg-[#82C91E] text-[#4B0082] rounded-[2rem] font-[1000] uppercase italic text-sm shadow-xl shadow-[#82C91E]/20 hover:brightness-105 active:scale-95 transition-all flex justify-center items-center gap-2 mt-2">
            Salvar e Continuar <Lucide.ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}