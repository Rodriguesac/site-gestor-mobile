import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { MapContainer, TileLayer, useMapEvents, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from "../services/firebase";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CONFIGURAÇÕES DO SISTEMA ---
const STORE_COORDS = [-20.43131, -54.55412];
const TOMTOM_KEY = 'tmsKTjnNOPUHNDHOYh2m12VrmwejmK8t'; // Sua chave
const PRIMARY_COLOR = '#82C91E';

// Ícone da Loja
const storeIcon = L.divIcon({
  className: 'custom-store-icon',
  html: `<div style="background: white; padding: 2px; border: 2px solid ${PRIMARY_COLOR}; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
            <img src="https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png" style="width: 24px; height: 24px; object-fit: contain;" />
         </div>`,
  iconSize: [28, 28], iconAnchor: [14, 14]
});

const TAGS_RAPIDAS = ["Não tocar campainha", "Deixar na portaria", "Ligar ao chegar", "Cuidado com o cão"];

export default function ModalEndereco({ isOpen, onClose }) {
  const mapRef = useRef(null);
  const numeroInputRef = useRef(null);
  const compRef = useRef(null); // <-- CORREÇÃO: A ref do complemento que faltava
  
  // --- CONTROLE DE ETAPAS ---
  const [etapa, setEtapa] = useState('BUSCA'); // 'BUSCA' | 'MAPA'

  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [isMovendoMapa, setIsMovendoMapa] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  
  const [rotaCoords, setRotaCoords] = useState([]);
  
  const [dados, setDados] = useState({ 
      rua: '', numero: '', bairro: '', cep: '', km: '0.0', taxa: '0,00', latlng: null 
  });
  
  const [complemento, setComplemento] = useState('');
  const [tipoLocal, setTipoLocal] = useState('Casa');
  const [precisaConfirmarNumero, setPrecisaConfirmarNumero] = useState(false);

  const isCondominio = /residencial|condominio|apto|apartamento|bloco|edificio|vila/i.test(dados.rua + ' ' + dados.bairro);

  const handleCepChange = (e) => {
    let valor = e.target.value.replace(/\D/g, ''); 
    if (valor.length > 5) valor = valor.replace(/^(\d{5})(\d)/, '$1-$2'); 
    setDados({ ...dados, cep: valor.slice(0, 9) }); 
  };

  const buscarCepPorRua = async (nomeRua) => {
    try {
      const ruaLimpa = nomeRua.replace(/^(RUA|AVENIDA|AV\.|TRAVESSA|R\.)\s+/i, '').trim();
      if (ruaLimpa.length < 3) return null;
      const res = await fetch(`https://viacep.com.br/ws/MS/Campo Grande/${encodeURIComponent(ruaLimpa)}/json/`);
      const data = await res.json();
      if (data && data.length > 0 && data[0].cep) return data[0].cep; 
    } catch (e) { console.error("Erro ViaCEP:", e); }
    return null;
  };

  // 1. MOTOR DE BUSCA (TOMTOM)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (etapa === 'BUSCA' && busca.length > 4) {
        setBuscando(true);
        try {
          const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(busca)}.json?key=${TOMTOM_KEY}&countrySet=BR&lat=${STORE_COORDS[0]}&lon=${STORE_COORDS[1]}&radius=30000&limit=6`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results) {
              setSugestoes(data.results.filter(item => item.address?.municipality === 'Campo Grande' || item.address?.localName === 'Campo Grande'));
          }
        } catch (e) { console.error(e); }
        setBuscando(false);
      } else { setSugestoes([]); }
    }, 800);
    return () => clearTimeout(timer);
  }, [busca, etapa]);

  const calcularLogistica = async (lat, lng) => {
      const resRota = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
      const dataRota = await resRota.json();
      if (dataRota.routes?.length > 0) {
        const r = dataRota.routes[0];
        const kmVal = (r.distance / 1000).toFixed(1);
        const taxaNum = parseFloat(kmVal); 
        setRotaCoords(r.geometry.coordinates.map(c => [c[1], c[0]]));
        return { km: kmVal, taxa: taxaNum.toFixed(2).replace('.', ',') };
      }
      return { km: "0.0", taxa: "0,00" };
  };

  // 2. INTELIGÊNCIA CENTRAL (ARRASTE + CEP)
  const processarLocalizacaoCentral = async (lat, lng, forcarBusca = false) => {
    try {
      const logistica = await calcularLogistica(lat, lng);
      const urlTomTom = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_KEY}&radius=100`;
      const geoRes = await fetch(urlTomTom);
      const geoData = await geoRes.json();

      if (geoData.addresses && geoData.addresses.length > 0) {
        const addr = geoData.addresses[0].address;
        if (addr.municipality !== 'Campo Grande' && addr.localName !== 'Campo Grande') {
            alert("Atenção: Entregas restritas a Campo Grande/MS.");
            return;
        }

        let numeroExtraido = addr.streetNumber || '';
        if (!numeroExtraido && forcarBusca) {
           const match = busca.match(/\d+/); 
           if (match) numeroExtraido = match[0];
        }

        const novaRua = (addr.streetName || addr.route || '').toUpperCase();
        if (numeroExtraido) setPrecisaConfirmarNumero(true);

        let cepFinal = addr.postalCode || '';
        const cepViaCep = await buscarCepPorRua(novaRua);
        if (cepViaCep) cepFinal = cepViaCep;
        else if (!cepFinal) cepFinal = "79000-000";

        setDados({
          rua: novaRua, numero: numeroExtraido,
          bairro: (addr.municipalitySubdivision || addr.countrySecondarySubdivision || '').toUpperCase(),
          cep: cepFinal, km: logistica.km, taxa: logistica.taxa, latlng: { lat, lng }
        });
      }
    } catch (e) { console.error(e); }
  };

  // --- AÇÕES DO USUÁRIO ---
  const selecionarSugestao = async (sug) => {
    const lat = sug.position.lat;
    const lon = sug.position.lon;
    setBuscando(true);
    await processarLocalizacaoCentral(lat, lon, true);
    setBuscando(false);
    setEtapa('MAPA'); // Avança para a Etapa 2
  };

  const usarMinhaLocalizacao = () => {
      setBuscandoGps(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          await processarLocalizacaoCentral(latitude, longitude, false);
          setBuscandoGps(false);
          setEtapa('MAPA'); // Avança para a Etapa 2
      }, (err) => {
          alert("Não foi possível acessar seu GPS. Por favor, digite o endereço.");
          setBuscandoGps(false);
      }, { enableHighAccuracy: true });
  };

  function MonitorDeMovimento() {
    useMapEvents({
      dragstart: () => setIsMovendoMapa(true),
      dragend: (e) => {
        setIsMovendoMapa(false);
        const center = e.target.getCenter();
        processarLocalizacaoCentral(center.lat, center.lng, false);
        if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      }
    });
    return null;
  }

  const adicionarTag = (tag) => setComplemento(prev => prev ? `${prev}, ${tag}` : tag);

  const confirmarEndereco = async () => {
      if (!dados.rua) return alert("Selecione uma rua no mapa.");
      if (!dados.numero) {
          numeroInputRef.current?.focus(); 
          return alert("Informe o número (ou S/N).");
      }
      
      const cepNumeros = dados.cep.replace(/\D/g, '');
      if (cepNumeros.length !== 8) {
          return alert("O CEP precisa estar completo (8 números).");
      }
      
      const payload = { ...dados, complemento, tipo: tipoLocal, createdAt: serverTimestamp() };
      
      if (auth.currentUser) await addDoc(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), payload);
      localStorage.setItem('endereco_rodrigues', JSON.stringify(payload));
      window.dispatchEvent(new Event('enderecoAtualizado'));
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm bg-black/60">
      <div className="w-full max-w-md bg-white sm:rounded-[3rem] rounded-t-[3rem] shadow-2xl overflow-hidden h-[90vh] sm:h-[85vh] flex flex-col animate-in slide-in-from-bottom-10">
        
        {/* =========================================================
            ETAPA 1: BUSCA DE ENDEREÇO
        ========================================================= */}
        {etapa === 'BUSCA' && (
            <div className="flex flex-col h-full">
                <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-100 shrink-0">
                  <div>
                    <span className="text-[9px] font-black text-[#82C91E] uppercase tracking-widest">Passo 1 de 2</span>
                    <h2 className="text-[#4B0082] font-[1000] italic uppercase text-xl leading-none">Onde Entregar?</h2>
                  </div>
                  <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500">
                    <Lucide.X size={20} />
                  </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {/* INPUT PRINCIPAL */}
                    <div className="flex bg-slate-50 rounded-2xl border-2 border-transparent focus-within:border-[#82C91E] focus-within:bg-white shadow-sm transition-all p-2 items-center mb-4">
                         <Lucide.Search size={20} className="text-[#4B0082] ml-3" />
                         <input 
                             value={busca} 
                             onChange={e => setBusca(e.target.value)} 
                             className="flex-1 bg-transparent p-3 text-[#4B0082] font-black italic text-sm outline-none uppercase placeholder:text-slate-400" 
                             placeholder="Rua e número..." 
                             autoFocus
                         />
                         {buscando && <Lucide.Loader2 size={18} className="text-[#82C91E] animate-spin mr-3"/>}
                         {busca && !buscando && <button onClick={() => { setBusca(''); setSugestoes([]); }} className="p-2 text-slate-300 hover:text-red-500 mr-1"><Lucide.XCircle size={18}/></button>}
                    </div>

                    {/* BOTÃO GPS */}
                    {!busca && (
                        <button onClick={usarMinhaLocalizacao} disabled={buscandoGps} className="w-full p-4 mb-4 bg-[#4B0082]/5 border border-[#4B0082]/10 rounded-2xl flex items-center gap-4 hover:bg-[#4B0082]/10 transition-colors">
                            <div className="bg-[#4B0082] p-2.5 rounded-full text-[#82C91E]">
                                {buscandoGps ? <Lucide.Loader2 size={18} className="animate-spin" /> : <Lucide.Crosshair size={18} />}
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-[1000] text-[#4B0082] uppercase">Usar Localização Atual</p>
                                <p className="text-[10px] font-bold text-slate-500">Ative o GPS para maior precisão</p>
                            </div>
                        </button>
                    )}

                    {/* LISTA DE RESULTADOS */}
                    <div className="space-y-2">
                         {sugestoes.map((sug, i) => (
                             <button key={i} onClick={() => selecionarSugestao(sug)} className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl hover:border-[#82C91E] hover:shadow-md transition-all flex items-center gap-4">
                                 <div className="bg-slate-50 p-3 rounded-full text-slate-400"><Lucide.MapPin size={18}/></div>
                                 <div className="flex-1">
                                     <p className="text-xs font-[1000] text-[#4B0082] uppercase truncate">
                                        {sug.address?.streetName || sug.address?.freeformAddress} {sug.address?.streetNumber && `, Nº ${sug.address.streetNumber}`}
                                     </p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase">{sug.address?.municipalitySubdivision || 'Campo Grande'}</p>
                                 </div>
                                 <Lucide.ChevronRight size={16} className="text-slate-300" />
                             </button>
                         ))}
                    </div>
                </div>
            </div>
        )}

        {/* =========================================================
            ETAPA 2: AJUSTE FINO (MAPA E FORMULÁRIO)
        ========================================================= */}
        {etapa === 'MAPA' && (
            <div className="flex flex-col h-full">
                {/* HEADER VOLTAR */}
                <div className="p-4 flex items-center gap-3 border-b border-slate-100 shrink-0 bg-white z-50 shadow-sm">
                  <button onClick={() => setEtapa('BUSCA')} className="p-2 bg-slate-50 rounded-full text-[#4B0082] hover:bg-slate-100">
                    <Lucide.ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-[#4B0082] font-[1000] italic uppercase text-sm leading-none">Ajuste Fino</h2>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Mova o mapa se necessário</span>
                  </div>
                </div>

                {/* MAPA */}
                <div className="relative h-[35%] min-h-[200px] w-full shrink-0 bg-slate-100 z-10">
                  <MapContainer center={dados.latlng || STORE_COORDS} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={mapRef}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <Marker position={STORE_COORDS} icon={storeIcon} />
                    {rotaCoords.length > 0 && <Polyline positions={rotaCoords} color="#4B0082" weight={5} opacity={0.7} dashArray="10, 10" />}
                    <MonitorDeMovimento />
                  </MapContainer>

                  {/* PINO FIXO COM SOMBRA */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                      <div className={`bg-[#4B0082] text-white text-[8px] font-black uppercase px-3 py-1 rounded-full mb-1 transition-all duration-200 ${isMovendoMapa ? 'opacity-100 -translate-y-2 shadow-lg' : 'opacity-0'}`}>Solte pra marcar</div>
                      <div className={`transition-all duration-300 ${isMovendoMapa ? '-translate-y-4 shadow-2xl scale-110' : 'drop-shadow-lg'} relative flex items-center justify-center`}>
                          <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_6px_6px_rgba(75,0,130,0.5)]">
                              <ellipse cx="20" cy="46" rx="8" ry="2" fill="black" fillOpacity="0.2"/>
                              <path d="M20 48C20 48 40 30.6186 40 18.2818C40 8.18521 31.0457 0 20 0C8.9543 0 0 8.18521 0 18.2818C0 30.6186 20 48 20 48Z" fill="#4B0082"/>
                              <path d="M20 47.5L19.6464 47.1464L19.6464 47.1464C19.6464 47.1464 39.5 29.8329 39.5 18.2818C39.5 8.41163 30.7716 0.5 20 0.5C9.22843 0.5 0.5 8.41163 0.5 18.2818C0.5 29.8329 20.3536 47.1464 20.3536 47.1464L20 47.5Z" stroke="white"/>
                              <circle cx="20" cy="18" r="6" fill="white"/>
                              <circle cx="20" cy="18" r="4" fill="#82C91E"/>
                          </svg>
                      </div>
                  </div>

                  {/* HUD DE TAXA */}
                  {!isMovendoMapa && dados.latlng && (
                      <div className="absolute bottom-4 right-4 z-[400] bg-white/95 backdrop-blur-sm p-2 px-4 rounded-full border border-slate-100 shadow-xl flex gap-3 animate-in fade-in">
                          <p className="text-[10px] font-black text-slate-500 uppercase flex items-center">{dados.km} km</p>
                          <div className="w-px h-4 bg-slate-200 my-auto"></div>
                          <p className="text-xs font-[1000] text-[#4B0082] italic flex items-center">R$ {dados.taxa}</p>
                      </div>
                  )}
                </div>

                {/* FORMULÁRIO DE PREENCHIMENTO */}
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white z-20">
                  <div className="space-y-4">
                     
                     <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-3">
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Rua / Avenida</label>
                           <input value={dados.rua} readOnly className="w-full bg-slate-50 p-3 rounded-xl border border-slate-100 text-[#4B0082] font-black text-xs outline-none uppercase truncate" />
                        </div>
                        
                        <div className="col-span-1 relative">
                           <label className={`text-[9px] font-black uppercase ml-1 transition-colors ${precisaConfirmarNumero ? 'text-red-500 animate-pulse' : 'text-[#82C91E]'}`}>{precisaConfirmarNumero ? 'Confirme o Nº' : 'Número'}</label>
                           <input 
                              ref={numeroInputRef} 
                              value={dados.numero} 
                              onChange={e => { setDados({...dados, numero: e.target.value}); setPrecisaConfirmarNumero(false); }} 
                              onFocus={() => setPrecisaConfirmarNumero(false)} 
                              className={`w-full bg-white p-3 rounded-xl border-2 text-[#4B0082] font-[1000] text-sm outline-none text-center transition-all ${precisaConfirmarNumero ? 'border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]' : 'border-slate-200 focus:border-[#82C91E]'}`} 
                              placeholder="S/N" 
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                         <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Bairro</label>
                           <input value={dados.bairro} onChange={e => setDados({...dados, bairro: e.target.value.toUpperCase()})} className="w-full bg-transparent p-2 border-b-2 border-slate-100 text-[#4B0082] font-bold text-xs outline-none uppercase truncate" />
                         </div>
                         <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">CEP</label>
                           <input value={dados.cep} onChange={handleCepChange} className="w-full bg-transparent p-2 border-b-2 border-slate-100 focus:border-[#82C91E] text-[#4B0082] font-black text-xs outline-none transition-all" maxLength={9} />
                         </div>
                     </div>

                     <div className="pt-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Complemento / Ponto de Referência</label>
                         <input ref={compRef} value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, Bloco, Casa 2, Frente de loja..." className="w-full bg-white p-3 rounded-xl border-2 border-slate-200 focus:border-[#82C91E] text-[#4B0082] font-bold text-xs outline-none transition-all" />
                         
                         <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-1">
                             {TAGS_RAPIDAS.map(tag => (
                                 <button key={tag} onClick={() => adicionarTag(tag)} className="shrink-0 bg-white border border-slate-200 text-slate-500 hover:text-[#4B0082] hover:border-[#4B0082] px-3 py-1.5 rounded-full text-[9px] font-bold uppercase transition-all">
                                     + {tag}
                                 </button>
                             ))}
                         </div>
                     </div>
                     
                     <div className="flex gap-2 pt-2">
                         {['Casa', 'Trabalho', 'Outro'].map(t => (
                         <button key={t} onClick={() => setTipoLocal(t)} className={`flex-1 py-3 rounded-xl font-black uppercase italic text-[10px] flex justify-center items-center gap-1 transition-all ${tipoLocal === t ? 'bg-[#4B0082] text-[#82C91E] shadow-sm' : 'bg-white text-slate-400 border border-slate-200'}`}>
                             {t}
                         </button>
                         ))}
                     </div>
                  </div>

                  <button 
                     onClick={confirmarEndereco} 
                     className="w-full py-5 bg-[#82C91E] text-[#4B0082] rounded-[2rem] font-[1000] uppercase italic text-sm shadow-xl shadow-[#82C91E]/20 hover:brightness-105 active:scale-95 transition-all flex justify-center items-center gap-2 mt-6"
                  >
                    Salvar Endereço <Lucide.Check size={20} strokeWidth={3} />
                  </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}