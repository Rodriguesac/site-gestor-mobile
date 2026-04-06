import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { MapContainer, TileLayer, useMapEvents, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CONFIGURAÇÕES DO SISTEMA ---
const STORE_COORDS = [-20.43131, -54.55412];
const TOMTOM_KEY = 'tmsKTjnNOPUHNDHOYh2m12VrmwejmK8t'; 
const PRIMARY_COLOR = '#82C91E'; // Verde Rodrigues
const SECONDARY_COLOR = '#4B0082'; // Roxo Rodrigues

// Ícone da Loja Personalizado
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
  
  // --- CONTROLE DE FLUXO ---
  const [etapa, setEtapa] = useState('BUSCA'); // 'BUSCA' | 'MAPA'
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);
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

  // 1. CARREGAR ENDEREÇOS SALVOS (FIREBASE)
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    const q = query(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEnderecosSalvos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isOpen]);

  // 2. BUSCA INTELIGENTE (ENDEREÇOS + PONTOS DE INTERESSE)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (etapa === 'BUSCA' && busca.length > 3) {
        setBuscando(true);
        try {
          // Usamos 'search' em vez de 'geocode' para achar locais como "Parque das Nações"
          const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(busca)}.json?key=${TOMTOM_KEY}&countrySet=BR&lat=${STORE_COORDS[0]}&lon=${STORE_COORDS[1]}&radius=30000&limit=8&idxSet=POI,Str,Geo`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results) {
              setSugestoes(data.results.filter(item => 
                item.address?.municipality === 'Campo Grande' || item.address?.localName === 'Campo Grande'
              ));
          }
        } catch (e) { console.error(e); }
        setBuscando(false);
      } else { setSugestoes([]); }
    }, 600);
    return () => clearTimeout(timer);
  }, [busca, etapa]);

  // 3. LOGÍSTICA (REGRA DE R$ 1,00 POR KM)
  const calcularLogistica = async (lat, lng) => {
      const resRota = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
      const dataRota = await resRota.json();
      if (dataRota.routes?.length > 0) {
        const r = dataRota.routes[0];
        const kmVal = (r.distance / 1000).toFixed(1);
        const taxaNum = parseFloat(kmVal); // 1 Real por KM
        setRotaCoords(r.geometry.coordinates.map(c => [c[1], c[0]]));
        return { km: kmVal, taxa: taxaNum.toFixed(2).replace('.', ',') };
      }
      return { km: "0.0", taxa: "0,00" };
  };

  // 4. VALIDAÇÃO DE CEP COMPLETO (VIACEP)
  const buscarCepExato = async (nomeRua) => {
    try {
      const ruaLimpa = nomeRua.replace(/^(RUA|AVENIDA|AV\.|TRAVESSA|R\.)\s+/i, '').trim();
      if (ruaLimpa.length < 3) return null;
      const res = await fetch(`https://viacep.com.br/ws/MS/Campo Grande/${encodeURIComponent(ruaLimpa)}/json/`);
      const data = await res.json();
      if (data && data.length > 0 && data[0].cep) return data[0].cep; 
    } catch (e) { console.error("Erro ViaCEP:", e); }
    return null;
  };

  // 5. PROCESSAMENTO DE LOCALIZAÇÃO CENTRAL
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
        const cepViaCep = await buscarCepExato(novaRua);

        setDados({
          rua: novaRua, 
          numero: numeroExtraido,
          bairro: (addr.municipalitySubdivision || addr.countrySecondarySubdivision || '').toUpperCase(),
          cep: cepViaCep || addr.postalCode || "79000-000",
          km: logistica.km, 
          taxa: logistica.taxa, 
          latlng: { lat, lng }
        });

        if (numeroExtraido) setPrecisaConfirmarNumero(true);
      }
    } catch (e) { console.error(e); }
  };

  // --- AÇÕES DO USUÁRIO ---
  const selecionarSugestao = async (sug) => {
    setBuscando(true);
    await processarLocalizacaoCentral(sug.position.lat, sug.position.lon, true);
    setBuscando(false);
    setEtapa('MAPA'); // Avança para ajuste fino
  };

  const usarSalvo = (end) => {
    setDados(end);
    setComplemento(end.complemento || '');
    setTipoLocal(end.tipo || 'Casa');
    setEtapa('MAPA');
  };

  const usarGPS = () => {
      setBuscandoGps(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          await processarLocalizacaoCentral(pos.coords.latitude, pos.coords.longitude, false);
          setBuscandoGps(false);
          setEtapa('MAPA');
      }, () => {
          alert("Erro no GPS. Digite o endereço.");
          setBuscandoGps(false);
      }, { enableHighAccuracy: true });
  };

  const confirmarEndereco = async () => {
      if (!dados.rua || !dados.numero) {
          numeroInputRef.current?.focus(); 
          return alert("Informe rua e número.");
      }
      
      const payload = { 
        ...dados, 
        complemento, 
        tipo: tipoLocal, 
        createdAt: serverTimestamp() // Garante ordenação correta
      };
      
      if (auth.currentUser) await addDoc(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), payload);
      localStorage.setItem('endereco_rodrigues', JSON.stringify(payload));
      window.dispatchEvent(new Event('enderecoAtualizado'));
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm bg-black/60 selection:bg-[#82C91E]/30">
      <div className="w-full max-w-md bg-white sm:rounded-[3rem] rounded-t-[3rem] shadow-2xl overflow-hidden h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
        
        {/* ETAPA 1: BUSCA DE ENDEREÇO OU LOCAL */}
        {etapa === 'BUSCA' && (
            <div className="flex flex-col h-full">
                <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-100">
                  <h2 className="text-[#4B0082] font-[1000] italic uppercase text-xl leading-none">Onde Entregar?</h2>
                  <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500"><Lucide.X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
                    <div className="flex bg-slate-50 rounded-2xl border-2 border-transparent focus-within:border-[#82C91E] focus-within:bg-white shadow-sm p-1.5 items-center transition-all">
                         <Lucide.Search size={20} className="text-[#4B0082] ml-3" />
                         <input value={busca} onChange={e => setBusca(e.target.value)} className="flex-1 bg-transparent p-3 text-[#4B0082] font-black italic text-sm outline-none uppercase placeholder:text-slate-400" placeholder="Rua, Parque ou Local..." autoFocus />
                         {buscando && <Lucide.Loader2 size={18} className="text-[#82C91E] animate-spin mr-3"/>}
                    </div>

                    {/* LOCAIS GUARDADOS */}
                    {!busca && enderecosSalvos.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 italic">Locais Salvos</p>
                            {enderecosSalvos.map(end => (
                                <button key={end.id} onClick={() => usarSalvo(end)} className="w-full text-left p-4 bg-white border border-slate-100 rounded-[2rem] flex items-center gap-4 hover:border-[#82C91E] transition-all shadow-sm">
                                    <div className="bg-[#4B0082]/5 p-2.5 rounded-2xl text-[#4B0082]"><Lucide.MapPin size={18}/></div>
                                    <div className="flex-1 text-left">
                                        <p className="text-xs font-[1000] text-[#4B0082] uppercase truncate">{end.tipo}: {end.rua}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate leading-none mt-1">{end.bairro}, {end.numero}</p>
                                    </div>
                                    <Lucide.ChevronRight size={16} className="text-slate-200" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* RESULTADOS DA PESQUISA TOMTOM (Inclusivo para POIs) */}
                    <div className="space-y-2">
                         {sugestoes.map((sug, i) => (
                             <button key={i} onClick={() => selecionarSugestao(sug)} className="w-full text-left p-4 bg-white border border-slate-50 rounded-2xl flex items-center gap-4 hover:border-[#82C91E] transition-all">
                                 <div className="bg-slate-50 p-3 rounded-full text-slate-400"><Lucide.Navigation size={18}/></div>
                                 <div className="flex-1 text-left min-w-0">
                                     <p className="text-xs font-[1000] text-[#4B0082] uppercase truncate">
                                        {sug.poi?.name || (sug.address?.streetName ? `${sug.address.streetName}${sug.address.streetNumber ? ', ' + sug.address.streetNumber : ''}` : sug.address?.freeformAddress)}
                                     </p>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">{sug.address?.municipalitySubdivision || 'Campo Grande'}</p>
                                 </div>
                             </button>
                         ))}
                    </div>

                    {!busca && (
                        <button onClick={usarGPS} disabled={buscandoGps} className="w-full p-5 bg-[#82C91E]/10 border border-[#82C91E]/20 rounded-[2.5rem] flex items-center justify-center gap-4 hover:bg-[#82C91E]/20 transition-all group">
                            <Lucide.Crosshair size={20} className={`text-[#82C91E] ${buscandoGps ? 'animate-spin' : 'group-hover:scale-110'}`} />
                            <span className="text-xs font-[1000] text-[#4B0082] uppercase italic">Minha Localização Atual</span>
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* ETAPA 2: AJUSTE NO MAPA E DETALHES (IFood Style) */}
        {etapa === 'MAPA' && (
            <div className="flex flex-col h-full">
                <header className="p-4 flex items-center gap-4 border-b border-slate-100 bg-white z-50">
                  <button onClick={() => setEtapa('BUSCA')} className="p-2 bg-slate-50 rounded-full text-[#4B0082] hover:bg-slate-100"><Lucide.ArrowLeft size={20} /></button>
                  <h2 className="text-[#4B0082] font-[1000] italic uppercase text-sm leading-none">Ajuste no Mapa</h2>
                </header>

                <div className="relative h-[45%] w-full shrink-0 z-10">
                  <MapContainer center={dados.latlng || STORE_COORDS} zoom={17} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={mapRef}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <Marker position={STORE_COORDS} icon={storeIcon} />
                    {rotaCoords.length > 0 && <Polyline positions={rotaCoords} color="#4B0082" weight={4} opacity={0.6} dashArray="8, 12" />}
                    <useMapEvents dragend={(e) => {
                        const center = e.target.getCenter();
                        processarLocalizacaoCentral(center.lat, center.lng);
                    }} />
                  </MapContainer>

                  {/* PONTEIRO GOTA COM SOMBRA */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                      <div className="drop-shadow-[0_10px_10px_rgba(75,0,130,0.5)] transition-transform duration-300">
                          <svg width="42" height="50" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 48C20 48 40 30.6 40 18.3C40 8.2 31.0 0 20 0C9.0 0 0 8.2 0 18.3C0 30.6 20 48 20 48Z" fill="#4B0082"/>
                              <circle cx="20" cy="18" r="7" fill="white"/>
                              <circle cx="20" cy="18" r="4" fill="#82C91E"/>
                          </svg>
                      </div>
                  </div>

                  {/* HUD DE TAXA DINÂMICA */}
                  <div className="absolute bottom-4 right-4 z-[400] bg-white/95 backdrop-blur-sm p-3 px-5 rounded-full border border-slate-100 shadow-xl flex gap-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase italic">{dados.km} km</p>
                      <div className="w-px h-3 bg-slate-200 my-auto" />
                      <p className="text-xs font-[1000] text-[#4B0082] italic">R$ {dados.taxa}</p>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white z-20 custom-scrollbar text-left">
                     <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Rua / Logradouro</label>
                        <input value={dados.rua} readOnly className="w-full bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-[#4B0082] font-black text-xs uppercase" />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className={`text-[9px] font-black uppercase ml-1 ${precisaConfirmarNumero ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>Número</label>
                           <input ref={numeroInputRef} value={dados.numero} onChange={e => {setDados({...dados, numero: e.target.value}); setPrecisaConfirmarNumero(false);}} className="w-full bg-white p-3.5 rounded-2xl border-2 border-slate-100 focus:border-[#82C91E] text-[#4B0082] font-black text-sm text-center outline-none" placeholder="S/N" />
                        </div>
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-1">CEP (Correios)</label>
                           <input value={dados.cep} readOnly className="w-full bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-slate-500 font-bold text-xs text-center" />
                        </div>
                     </div>

                     <div>
                         <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Complemento / Referência</label>
                         <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, Bloco, Casa nos fundos..." className="w-full bg-white p-3.5 rounded-2xl border-2 border-slate-100 focus:border-[#82C91E] text-[#4B0082] font-bold text-xs outline-none" />
                         <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-1">
                             {TAGS_RAPIDAS.map(tag => (
                                 <button key={tag} onClick={() => setComplemento(tag)} className="shrink-0 bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase hover:bg-[#4B0082] hover:text-white transition-all">+ {tag}</button>
                             ))}
                         </div>
                     </div>
                     
                     <div className="flex gap-2 pt-2">
                         {['Casa', 'Trabalho', 'Outro'].map(t => (
                         <button key={t} onClick={() => setTipoLocal(t)} className={`flex-1 py-3.5 rounded-2xl font-[1000] uppercase italic text-[10px] transition-all ${tipoLocal === t ? 'bg-[#4B0082] text-[#82C91E] shadow-lg' : 'bg-slate-50 text-slate-300'}`}>{t}</button>
                         ))}
                     </div>

                     <button onClick={confirmarEndereco} className="w-full py-5 bg-[#82C91E] text-[#4B0082] rounded-[2.5rem] font-[1000] uppercase italic text-sm shadow-xl shadow-[#82C91E]/20 active:scale-95 transition-all flex justify-center items-center gap-2 mt-2">
                        Salvar e Continuar <Lucide.ArrowRight size={20} />
                     </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}