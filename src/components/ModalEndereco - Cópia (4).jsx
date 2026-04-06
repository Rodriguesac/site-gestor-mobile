import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { MapContainer, TileLayer, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CONFIGURAÇÕES DO SISTEMA ---
const STORE_COORDS = [-20.43131, -54.55412];
const TOMTOM_KEY = 'tmsKTjnNOPUHNDHOYh2m12VrmwejmK8t'; 

const TAGS_RAPIDAS = ["Deixar na portaria", "Não tocar campainha", "Ligar ao chegar", "Cuidado com o cão"];

// 1. COMPONENTE PARA RASTREAR O CENTRO DO MAPA (Estilo iFood)
function MapCenterEvents({ onMoveEnd }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMoveEnd(center.lat, center.lng);
    },
  });
  return null;
}

export default function ModalEndereco({ isOpen, onClose }) {
  const numeroInputRef = useRef(null);
  
  // --- ESTADOS ---
  const [etapa, setEtapa] = useState('BUSCA'); // 'BUSCA' | 'MAPA'
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  
  const [rotaCoords, setRotaCoords] = useState([]);
  const [dados, setDados] = useState({ 
      rua: '', numero: '', bairro: '', cep: '', km: '0.0', taxa: '0,00', latlng: null 
  });
  
  const [complemento, setComplemento] = useState('');
  const [tipoLocal, setTipoLocal] = useState('Casa');
  const [precisaConfirmarNumero, setPrecisaConfirmarNumero] = useState(false);

  // Carregar Endereços Salvos
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    const q = query(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setEnderecosSalvos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [isOpen]);

  // Função para extrair o número digitado na busca (Ex: "Rua Uirapuru 601")
  const extrairNumeroDaBusca = (texto) => {
    const match = texto.match(/(?:,\s*|\s+)(\d+)(?:\s*|-*[a-zA-Z])?$/);
    return match ? match[1] : '';
  };

  // Busca Inteligente TomTom
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (etapa === 'BUSCA' && busca.length > 3) {
        setBuscando(true);
        try {
          // 'typeahead=true' melhora a busca enquanto o cliente digita
          const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(busca)}.json?key=${TOMTOM_KEY}&countrySet=BR&lat=${STORE_COORDS[0]}&lon=${STORE_COORDS[1]}&radius=30000&limit=6&typeahead=true`;
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
    }, 500);
    return () => clearTimeout(timer);
  }, [busca, etapa]);

  // Cálculo de Logística
  const calcularLogistica = async (lat, lng) => {
      try {
        const resRota = await fetch(`https://router.project-osrm.org/route/v1/driving/${STORE_COORDS[1]},${STORE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`);
        const dataRota = await resRota.json();
        if (dataRota.routes?.length > 0) {
          const r = dataRota.routes[0];
          const kmVal = (r.distance / 1000).toFixed(1);
          setRotaCoords(r.geometry.coordinates.map(c => [c[1], c[0]]));
          return { km: kmVal, taxa: parseFloat(kmVal).toFixed(2).replace('.', ',') };
        }
      } catch (e) { console.error("Erro rota", e); }
      return { km: "0.0", taxa: "0,00" };
  };

  // Reverse Geocoding (Quando o mapa desliza)
  const processarLocalizacaoCentral = async (lat, lng, preservarNumero = null) => {
    try {
      const urlTomTom = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_KEY}&radius=100`;
      const geoRes = await fetch(urlTomTom);
      const geoData = await geoRes.json();

      if (geoData.addresses && geoData.addresses.length > 0) {
        const addr = geoData.addresses[0].address;
        
        // Se o utilizador digitou um número na busca, forçamos o uso dele. Se não, pegamos do mapa.
        const numFinal = preservarNumero || addr.streetNumber || '';
        
        setDados(prev => ({
          ...prev,
          rua: (addr.streetName || addr.route || '').toUpperCase(), 
          numero: numFinal,
          bairro: (addr.municipalitySubdivision || '').toUpperCase(),
          cep: addr.postalCode || "79000-000",
          latlng: { lat, lng }
        }));

        if (!numFinal) setPrecisaConfirmarNumero(true);
        
        // Atualiza logística em background sem travar a UI
        calcularLogistica(lat, lng).then(log => {
            setDados(d => ({ ...d, km: log.km, taxa: log.taxa }));
        });
      }
    } catch (e) { console.error(e); }
  };

  // --- AÇÕES DO USUÁRIO ---
  
  // Ao clicar numa sugestão da lista
  const selecionarSugestao = async (sug) => {
    setBuscando(true);
    const numeroDigitado = sug.address?.streetNumber || extrairNumeroDaBusca(busca);
    
    // Atualização otimista (UI rápida)
    setDados({
        rua: (sug.address?.streetName || sug.address?.freeformAddress || '').toUpperCase(),
        numero: numeroDigitado,
        bairro: (sug.address?.municipalitySubdivision || '').toUpperCase(),
        cep: '', km: '...', taxa: '...', latlng: { lat: sug.position.lat, lng: sug.position.lon }
    });
    
    setEtapa('MAPA'); // Vai direto para o mapa
    await processarLocalizacaoCentral(sug.position.lat, sug.position.lon, numeroDigitado);
    setBuscando(false);
  };

  const usarGPS = () => {
      setBuscandoGps(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          setDados(prev => ({ ...prev, latlng: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));
          setEtapa('MAPA');
          await processarLocalizacaoCentral(pos.coords.latitude, pos.coords.longitude);
          setBuscandoGps(false);
      }, () => {
          alert("Erro no GPS. Digite o endereço.");
          setBuscandoGps(false);
      }, { enableHighAccuracy: true });
  };

  const usarSalvo = (end) => {
    setDados(end); setComplemento(end.complemento || ''); setTipoLocal(end.tipo || 'Casa');
    setEtapa('MAPA');
    calcularLogistica(end.latlng.lat, end.latlng.lng).then(log => setDados(d => ({ ...d, km: log.km, taxa: log.taxa })));
  };

  const confirmarEndereco = async () => {
      if (!dados.rua || !dados.numero) {
          setPrecisaConfirmarNumero(true);
          numeroInputRef.current?.focus(); 
          return alert("Informe o número do local.");
      }
      const payload = { ...dados, complemento, tipo: tipoLocal, createdAt: serverTimestamp() };
      
      if (auth.currentUser) await addDoc(collection(db, "usuarios", auth.currentUser.uid, "meus_enderecos"), payload);
      localStorage.setItem('endereco_rodrigues', JSON.stringify(payload));
      window.dispatchEvent(new Event('enderecoAtualizado'));
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm bg-black/60 selection:bg-[#82C91E]/30">
      <div className="w-full max-w-md bg-white sm:rounded-[3rem] rounded-t-[3rem] shadow-2xl overflow-hidden h-[95vh] sm:h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
        
        {/* =======================================
            ETAPA 1: BUSCA DE ENDEREÇO (iFood Style)
            ======================================= */}
        {etapa === 'BUSCA' && (
            <div className="flex flex-col h-full bg-white">
                <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-100">
                  <h2 className="text-[#4B0082] font-[1000] italic uppercase text-lg leading-none">Onde entregar?</h2>
                  <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500"><Lucide.X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
                    {/* INPUT COM ÍCONE VERMELHO IGUAL IFOOD */}
                    <div className="flex bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-[#e91d2d] focus-within:bg-white shadow-sm p-1.5 items-center transition-all">
                         <Lucide.MapPin size={20} className="text-[#e91d2d] ml-3" fill="currentColor" strokeWidth={0} />
                         <input value={busca} onChange={e => setBusca(e.target.value)} className="flex-1 bg-transparent p-3 text-slate-800 font-bold text-sm outline-none placeholder:text-slate-400" placeholder="Rua e número, bairro" autoFocus />
                         {buscando && <Lucide.Loader2 size={18} className="text-[#e91d2d] animate-spin mr-3"/>}
                         {busca && !buscando && <button onClick={() => setBusca('')} className="mr-3 text-slate-400"><Lucide.XCircle size={18} /></button>}
                    </div>

                    {!busca && (
                        <button onClick={usarGPS} disabled={buscandoGps} className="w-full text-left py-3 flex items-center gap-4 hover:opacity-70 transition-all border-b border-slate-100 pb-5">
                            <Lucide.Crosshair size={22} className={`text-[#4B0082] ${buscandoGps ? 'animate-spin' : ''}`} />
                            <span className="text-sm font-bold text-[#4B0082]">Usar minha localização atual</span>
                        </button>
                    )}

                    {/* SUGESTÕES (Com destaque para o número) */}
                    {busca && sugestoes.length > 0 && (
                        <div className="space-y-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">Resultados</p>
                             {sugestoes.map((sug, i) => {
                                 // Formata o nome para incluir o número digitado se a API não retornar
                                 const numStr = sug.address?.streetNumber || extrairNumeroDaBusca(busca);
                                 const logradouro = sug.address?.streetName || sug.address?.freeformAddress;
                                 const enderecoCompleto = numStr ? `${logradouro}, ${numStr}` : logradouro;

                                 return (
                                     <button key={i} onClick={() => selecionarSugestao(sug)} className="w-full text-left p-4 bg-white border-b border-slate-50 flex items-start gap-4 hover:bg-slate-50 transition-all">
                                         <Lucide.MapPin size={20} className="text-slate-300 mt-1 shrink-0" />
                                         <div className="flex-1 min-w-0">
                                             <p className="text-sm font-bold text-slate-800 truncate">{sug.poi?.name || enderecoCompleto}</p>
                                             <p className="text-[11px] text-slate-400 truncate mt-0.5">{sug.address?.municipalitySubdivision || 'Campo Grande'}, MS</p>
                                         </div>
                                     </button>
                                 )
                             })}
                        </div>
                    )}

                    {/* LOCAIS SALVOS */}
                    {!busca && enderecosSalvos.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">Endereços Salvos</p>
                            {enderecosSalvos.map(end => (
                                <button key={end.id} onClick={() => usarSalvo(end)} className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm hover:border-[#e91d2d] transition-all">
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

        {/* =======================================
            ETAPA 2: AJUSTE E FORMULÁRIO (iFood Style)
            ======================================= */}
        {etapa === 'MAPA' && (
            <div className="flex flex-col h-full bg-white relative">
                
                {/* BOTÃO VOLTAR FLUTUANTE */}
                <button onClick={() => setEtapa('BUSCA')} className="absolute top-4 left-4 z-[500] p-3 bg-white shadow-lg rounded-full text-[#e91d2d] hover:bg-slate-50">
                    <Lucide.ChevronLeft size={24} />
                </button>

                {/* ÁREA DO MAPA (Metade superior) */}
                <div className="relative h-[45%] w-full shrink-0 z-10 bg-slate-100">
                  {dados.latlng && (
                    <MapContainer center={dados.latlng} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                      {rotaCoords.length > 0 && <Polyline positions={rotaCoords} color="#4B0082" weight={4} opacity={0.6} dashArray="8, 12" />}
                      
                      {/* Evento que atualiza os dados quando o mapa desliza */}
                      <MapCenterEvents onMoveEnd={(lat, lng) => processarLocalizacaoCentral(lat, lng, dados.numero)} />
                    </MapContainer>
                  )}

                  {/* ALFINETE FIXO NO CENTRO DA TELA (iFood / Uber style) */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[400] pointer-events-none flex flex-col items-center">
                      {/* Balão de Tooltip */}
                      <div className="bg-white px-3 py-1.5 rounded-lg shadow-lg mb-2 text-center animate-bounce-slow">
                          <p className="text-xs font-bold text-slate-800">Você está aqui?</p>
                          <p className="text-[9px] text-slate-400">Ajuste a localização</p>
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
                      </div>
                      
                      {/* Ícone de Pin Vermelho */}
                      <div className="drop-shadow-[0_8px_8px_rgba(233,29,45,0.4)] transition-transform duration-300">
                          <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 48C20 48 40 30.6 40 18.3C40 8.2 31.0 0 20 0C9.0 0 0 8.2 0 18.3C0 30.6 20 48 20 48Z" fill="#e91d2d"/>
                              <circle cx="20" cy="18" r="6" fill="white"/>
                          </svg>
                      </div>
                  </div>
                </div>

                {/* FORMULÁRIO DE ENDEREÇO (Metade inferior) */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white z-20 custom-scrollbar text-left rounded-t-3xl -mt-6 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] relative">
                     
                     <div className="mb-4">
                         <h3 className="text-sm font-bold text-slate-800">{dados.rua || 'Buscando logradouro...'}</h3>
                         <p className="text-xs text-slate-500 mt-0.5">{dados.bairro}, Campo Grande - MS</p>
                     </div>
                     
                     <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                           <label className={`text-[10px] font-bold ${precisaConfirmarNumero ? 'text-[#e91d2d]' : 'text-slate-500'}`}>Número</label>
                           <input 
                             ref={numeroInputRef} 
                             value={dados.numero} 
                             onChange={e => {setDados({...dados, numero: e.target.value}); setPrecisaConfirmarNumero(false);}} 
                             className={`w-full bg-white p-3 rounded-xl border ${precisaConfirmarNumero ? 'border-[#e91d2d] ring-1 ring-[#e91d2d]/20' : 'border-slate-200 focus:border-[#4B0082]'} text-slate-800 font-bold text-sm outline-none transition-all`} 
                             placeholder="Ex: 601" 
                           />
                        </div>
                        <div className="col-span-2">
                           <label className="text-[10px] font-bold text-slate-500">Complemento</label>
                           <input 
                             value={complemento} 
                             onChange={e => setComplemento(e.target.value)} 
                             placeholder="Apto/Bloco/Casa" 
                             className="w-full bg-white p-3 rounded-xl border border-slate-200 focus:border-[#4B0082] text-slate-800 text-sm outline-none transition-all" 
                           />
                        </div>
                     </div>

                     {/* Favoritar como (Botões estilo iFood) */}
                     <div className="pt-2">
                         <label className="text-[10px] font-bold text-slate-500 mb-2 block">Favoritar como</label>
                         <div className="flex gap-2">
                             {['Casa', 'Trabalho'].map(t => (
                             <button key={t} onClick={() => setTipoLocal(t)} className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${tipoLocal === t ? 'bg-[#e91d2d]/10 text-[#e91d2d] border border-[#e91d2d]/30' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'}`}>
                                 {t === 'Casa' ? <Lucide.Home size={14}/> : <Lucide.Briefcase size={14}/>} {t}
                             </button>
                             ))}
                         </div>
                     </div>

                     {/* Resumo de Taxa */}
                     <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl mt-4 border border-slate-100">
                         <div className="flex items-center gap-2 text-slate-500">
                             <Lucide.Bike size={16} /> <span className="text-xs font-bold">Taxa de Entrega</span>
                         </div>
                         <div className="text-right">
                             <p className="text-[10px] text-slate-400 font-bold">{dados.km} km</p>
                             <p className="text-sm font-black text-[#82C91E]">R$ {dados.taxa}</p>
                         </div>
                     </div>

                     <button onClick={confirmarEndereco} className="w-full py-4 bg-[#e91d2d] text-white rounded-xl font-bold text-sm hover:bg-[#d01927] active:scale-[0.98] transition-all mt-4">
                        Salvar endereço
                     </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}