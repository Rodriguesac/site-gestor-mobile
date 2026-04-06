import React, { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react';
import { db, auth } from '../services/firebase'; 
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, serverTimestamp, increment, addDoc, arrayUnion } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Howl } from 'howler';

// --- CAPACITOR (HARDWARE REAL) ---
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';
import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// ========================================================================
// 1. CONFIGURAÇÕES VISUAIS (TEMA DARK NEON) E ASSETS
// ========================================================================
const SOUND_ALARM = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const LOJA_COORDS = [-20.4697, -54.6201]; 
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbd9x1o02/image/upload";
const UPLOAD_PRESET = "fc3i8urq";

const THEME = {
  bgApp: "bg-[#09090b]", 
  card: "bg-[#18181b]", 
  accentPurple: "text-[#a855f7]", 
  bgPurple: "bg-[#a855f7]",
  accentGreen: "text-[#a3e635]", 
  bgGreen: "bg-[#a3e635]",
  border: "border-white/5"
};

// Ícones do Mapa
const MAPA_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const iconLoja = new L.DivIcon({ className: 's-icon', html: `<div class="w-10 h-10 bg-[#a855f7] rounded-xl border-2 border-[#a3e635] flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]"><div class="w-3 h-3 bg-[#09090b] rounded-full animate-pulse"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const iconCliente = new L.DivIcon({ className: 'e-icon', html: `<div class="w-10 h-10 bg-[#a3e635] rounded-xl border-2 border-[#09090b] flex items-center justify-center shadow-[0_0_15px_rgba(163,230,53,0.5)]"><div class="w-3 h-3 bg-[#09090b] rounded-full"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const iconMoto = new L.DivIcon({ className: 'm-icon', html: `<div class="w-12 h-12 bg-[#09090b] rounded-full border-2 border-[#a3e635] shadow-[0_0_15px_rgba(163,230,53,0.5)] flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3e635" stroke-width="3"><path d="M12 2a9 9 0 0 0-9 9v3.5a2.5 2.5 0 0 0 2.5 2.5h13a2.5 2.5 0 0 0 2.5-2.5V11a9 9 0 0 0-9-9Z"/><path d="M8.5 17v-4a3.5 3.5 0 0 1 7 0v4"/></svg></div>`, iconSize: [48, 48], iconAnchor: [24, 48] });

// ========================================================================
// 2. FUNÇÕES ÚTEIS E LINKS PROFUNDOS (DEEP LINKS)
// ========================================================================
const UTILS = {
    formatarMoeda: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
    mascararCPF: (v) => v?.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, "$1.$2.$3-$4") || '',
    limparDados: (v) => v?.replace(/\D/g, '') || '',
    vibrar: (padrao) => { try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch(e) { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(padrao); } },
    
    // DEEP LINKS CORRIGIDOS PARA ABRIR DIRETO NOS APPS
    abrirWaze: (lat, lng) => {
        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_system');
    },
    abrirGoogleMaps: (lat, lng) => {
        // O parâmetro /dir/ diz ao Google Maps para criar uma rota do local atual até o destino
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_system');
    },
    abrirZap: (tel, nome) => {
        window.open(`https://wa.me/55${tel?.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${nome}, aqui é o entregador da UP! Estou com seu pedido.`)}`, '_system');
    }
};

const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return (R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))).toFixed(1);
};

const obterTaxa = (p) => parseFloat(p?.valores?.taxaEntrega || p?.taxaEntrega || p?.valores?.taxa || 0);
const obterTotal = (p) => parseFloat(p?.valores?.total || p?.total || 0);
const obterEndereco = (p) => ({
    rua: p?.endereco?.rua || 'Endereço', numero: p?.endereco?.numero || 'S/N', bairro: p?.endereco?.bairro || '',
    lat: p?.endereco?.latlng?.lat || p?.endereco?.lat || null, lng: p?.endereco?.latlng?.lng || p?.endereco?.lng || null
});
const obterCliente = (p) => ({
    nome: p?.cliente?.nome || 'Cliente',
    telefone: p?.cliente?.telefone || ''
});

// ========================================================================
// 3. SISTEMA DE TOAST E COMPONENTES VISUAIS
// ========================================================================
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, msg, type }]);
        UTILS.vibrar(type === 'error' ? [50, 50, 50] : 50);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-safe pt-4 left-0 right-0 z-[99999] flex flex-col items-center gap-3 pointer-events-none px-4">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className={`w-full max-w-sm p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wide text-white border-b-4 
                            ${t.type === 'error' ? 'bg-red-900/90 border-red-500' : t.type === 'success' ? 'bg-[#18181b]/90 border-[#a3e635]' : 'bg-[#18181b]/90 border-[#a855f7]'} backdrop-blur-md`}>
                            {t.type === 'error' ? <Lucide.AlertTriangle size={24} className="text-red-500"/> : t.type === 'success' ? <Lucide.CheckCircle size={24} className={THEME.accentGreen}/> : <Lucide.Info size={24} className={THEME.accentPurple}/>}
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const LoaderGlobal = ({ msg }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#09090b]/90 backdrop-blur-md flex flex-col items-center justify-center">
        <div className={`p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-white/10 ${THEME.card}`}>
            <Lucide.Loader2 size={40} className={`animate-spin ${THEME.accentPurple} mb-4`} />
            <p className="text-white font-black uppercase tracking-widest text-[11px] animate-pulse">{msg || 'Processando...'}</p>
        </div>
    </motion.div>
);

const RadarAnimation = () => (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto my-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-white/5 border-dashed" />
        <div className="absolute inset-[15%] rounded-full border border-white/10" />
        <div className="absolute inset-[30%] rounded-full border border-white/10 border-dashed" />
        <div className="absolute inset-[45%] rounded-full border border-white/5" />
        <div className="absolute w-full h-[1px] bg-white/5" />
        <div className="absolute h-full w-[1px] bg-white/5" />
        <div className="absolute inset-0 rounded-full radar-sweep" />
        <div className="absolute w-6 h-6 bg-[#a855f7] rounded-full shadow-[0_0_20px_#a855f7] z-10 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
        <div className="absolute top-[20%] left-[30%] text-[#a3e635] animate-pulse"><Lucide.Bike size={16}/></div>
        <div className="absolute bottom-[30%] right-[25%] text-[#a3e635] animate-pulse" style={{animationDelay: '1s'}}><Lucide.Bike size={14}/></div>
        <div className="absolute top-[40%] right-[15%] text-[#a3e635] animate-pulse" style={{animationDelay: '0.5s'}}><Lucide.Bike size={18}/></div>
        <div className="absolute bottom-[20%] left-[20%] text-[#a3e635] opacity-50"><Lucide.Bike size={12}/></div>
    </div>
);

// ========================================================================
// 4. MAPA DINÂMICO E MAPA ESTÁTICO (EFEITO PRINT)
// ========================================================================
function MapUpdater({ bounds }) {
    const map = useMap();
    useEffect(() => { if (bounds?.length > 0) map.fitBounds(bounds, { padding: [50, 50], animate: true }); }, [bounds, map]);
    return null;
}

// Mapa de Rota Livre (Fullscreen)
const LiveMap = ({ pedido, myLocation, interativo = false }) => {
    const [rota, setRota] = useState([]);
    const end = obterEndereco(pedido);

    useEffect(() => {
        if (!myLocation || !end.lat) return;
        fetch(`https://router.project-osrm.org/route/v1/driving/${myLocation.lng},${myLocation.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => { if (data.routes?.[0]) setRota(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])); })
            .catch(() => {});
    }, [myLocation, end.lat, end.lng]);

    const bounds = myLocation && end.lat ? [[myLocation.lat, myLocation.lng], [end.lat, end.lng]] : [];

    return (
        <MapContainer center={LOJA_COORDS} zoom={14} zoomControl={interativo} dragging={interativo} scrollWheelZoom={interativo} className={`w-full h-full z-0 ${THEME.bgApp} map-dark-filter`}>
            <TileLayer url={MAPA_DARK} />
            <Marker position={LOJA_COORDS} icon={iconLoja} />
            {end.lat && <Marker position={[end.lat, end.lng]} icon={iconCliente} />}
            {myLocation && <Marker position={[myLocation.lat, myLocation.lng]} icon={iconMoto} />}
            {rota.length > 0 && <Polyline positions={rota} color="#a855f7" weight={5} opacity={0.8} dashArray="10, 10" />}
            <MapUpdater bounds={bounds} />
        </MapContainer>
    );
};

// Mapa Estático para o Card (Print Base -> Cliente)
function MapStaticBounds({ bounds }) {
    const map = useMap();
    useEffect(() => { 
        if (bounds?.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40], animate: false }); 
        }
    }, [bounds, map]);
    return null;
}

const PreviewMapaEstatico = ({ pedido }) => {
    const [rota, setRota] = useState([]);
    const end = obterEndereco(pedido);

    useEffect(() => {
        if (!end.lat) return;
        fetch(`https://router.project-osrm.org/route/v1/driving/${LOJA_COORDS[1]},${LOJA_COORDS[0]};${end.lng},${end.lat}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => { if (data.routes?.[0]) setRota(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])); })
            .catch(() => {});
    }, [end.lat, end.lng]);

    // Cria a bounding box que garante mostrar a Loja E o Cliente
    const bounds = end.lat ? [LOJA_COORDS, [end.lat, end.lng]] : [];

    return (
        <MapContainer 
            center={LOJA_COORDS} 
            zoom={14} 
            zoomControl={false} 
            dragging={false} 
            scrollWheelZoom={false} 
            doubleClickZoom={false}
            touchZoom={false}
            className={`w-full h-full z-0 ${THEME.bgApp} map-dark-filter`}
        >
            <TileLayer url={MAPA_DARK} />
            <Marker position={LOJA_COORDS} icon={iconLoja} />
            {end.lat && <Marker position={[end.lat, end.lng]} icon={iconCliente} />}
            {rota.length > 0 && <Polyline positions={rota} color="#a855f7" weight={4} opacity={0.8} dashArray="5, 10" />}
            <MapStaticBounds bounds={bounds} />
        </MapContainer>
    );
};


// ========================================================================
// 5. APP PRINCIPAL DO ENTREGADOR
// ========================================================================
const UpEntregasApp = () => {
    const toast = useToast();
    const [secao, setSecao] = useState('LOADING'); 
    const [abaAtiva, setAbaAtiva] = useState('HOME'); 
    const [loadingMsg, setLoadingMsg] = useState('');
    const [mostrarMapaModal, setMostrarMapaModal] = useState(false);
    
    const [isLoginModo, setIsLoginModo] = useState(true);
    const [form, setForm] = useState({ cpf: '', senha: '', nome: '', veiculo: 'MOTO', placa: '', telefone: '' });
    const [piloto, setPiloto] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [myLocation, setMyLocation] = useState(null);
    const [ofertaLeilao, setOfertaLeilao] = useState(null);
    const [pedidoAtivo, setPedidoAtivo] = useState(null);
    const [temInternet, setTemInternet] = useState(true);
    const [codigoConfirmacao, setCodigoConfirmacao] = useState('');
    const [countAcumulo, setCountAcumulo] = useState(0);

    const audioAlarmeRef = useRef(null);
    const watchIdRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [pedidoParaFinalizar, setPedidoParaFinalizar] = useState(null);

    // INICIALIZAÇÃO
    useEffect(() => {
        try { audioAlarmeRef.current = new Howl({ src: [SOUND_ALARM], loop: true, volume: 1.0 }); } catch(e){}
        Network.getStatus().then(status => setTemInternet(status.connected));
        const networkListener = Network.addListener('networkStatusChange', status => setTemInternet(status.connected));

        const authListener = auth.onAuthStateChanged(user => {
            if (!user) { setPiloto(null); setSecao('INTRO'); return; }
            const cpfLogado = user.email ? user.email.split('@')[0] : localStorage.getItem('@UP:cpf');
            if (!cpfLogado) { auth.signOut(); setSecao('INTRO'); return; }

            onSnapshot(doc(db, "entregadores", cpfLogado), snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setPiloto({ id: snap.id, uid: user.uid, ...data });
                    setIsOnline(data.status !== 'Offline');
                    setSecao('APP');
                } else { setSecao('INTRO'); }
            });
        });
        return () => { authListener(); networkListener.then(l => l.remove()); };
    }, []);

    // RASTREIO DE GPS NO FUNDO
    useEffect(() => {
        if (isOnline && piloto?.statusAprovacao === 'APROVADO') {
            if ("geolocation" in navigator) {
                watchIdRef.current = navigator.geolocation.watchPosition(
                    (pos) => {
                        const { latitude: lat, longitude: lng } = pos.coords;
                        setMyLocation({ lat, lng });
                        if (piloto?.id) {
                            updateDoc(doc(db, "entregadores", piloto.id), { coords: { lat, lng }, lastUpdate: serverTimestamp() }).catch(()=>{});
                        }
                    },
                    () => toast("GPS Indisponível", "error"),
                    { enableHighAccuracy: true, distanceFilter: 10 }
                );
            }
        } else {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
        }
        return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
    }, [isOnline, piloto?.statusAprovacao, piloto?.id]);

    // ESCUTA DE PEDIDOS
    useEffect(() => {
        if (!piloto || secao !== 'APP') return;
        const qPedidos = query(collection(db, "pedidos"), where("status", "in", ["BUSCANDO_ENTREGADOR", "A_CAMINHO_LOJA", "AGUARDANDO_COLETA", "SAIU_ENTREGA", "ENTREGADOR_NO_LOCAL"]));
        const unsubPedidos = onSnapshot(qPedidos, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const ativ = docs.find(p => p.entregadorId === piloto.id);
            setPedidoAtivo(ativ || null);

            if (!ativ && isOnline) {
                const leiloes = docs.filter(p => p.status === 'BUSCANDO_ENTREGADOR' && !p.entregadoresRecusaram?.includes(piloto.id));
                if (leiloes.length > 0) {
                    setCountAcumulo(leiloes.length - 1);
                    if (!ofertaLeilao || ofertaLeilao.id !== leiloes[0].id) {
                        setOfertaLeilao(leiloes[0]);
                        audioAlarmeRef.current?.play().catch(()=>{}); 
                        UTILS.vibrar([200, 100, 200, 100, 500]);
                    }
                } else { setOfertaLeilao(null); audioAlarmeRef.current?.stop(); }
            } else { setOfertaLeilao(null); audioAlarmeRef.current?.stop(); }
        });

        return () => { unsubPedidos(); };
    }, [piloto?.id, isOnline, secao, ofertaLeilao?.id]);

    // AUTH
    const handleAuth = async (e) => {
        e.preventDefault(); setLoadingMsg('Autenticando...');
        const cpfLimpo = UTILS.limparDados(form.cpf);
        const emailStr = `${cpfLimpo}@rodrigues.com`;
        try {
            const docRef = doc(db, "entregadores", cpfLimpo);
            const snap = await getDoc(docRef);
            if (isLoginModo) {
                if (snap.exists() && snap.data().senha === form.senha) {
                    localStorage.setItem('@UP:cpf', cpfLimpo);
                    setCpfLogado(cpfLimpo);
                    try { await signInWithEmailAndPassword(auth, emailStr, form.senha); } catch(err) { await createUserWithEmailAndPassword(auth, emailStr, form.senha); }
                    toast("Bem-vindo de volta!", "success");
                } else { toast("CPF ou Senha incorretos.", "error"); }
            } else {
                if (snap.exists()) { toast("Este CPF já está registrado.", "error"); }
                else {
                    const payload = {
                        nome: form.nome, telefone: UTILS.limparDados(form.telefone), senha: form.senha, 
                        modalidade: form.veiculo, placa: form.placa.toUpperCase(), statusAprovacao: 'PENDENTE', status: 'Offline',
                        ganhosTaxas: 0, debitosLoja: 0, saldoLiquido: 0, totalEntregas: 0, dataCadastro: serverTimestamp(),
                        aceitaDinheiro: true, temMaquininha: true
                    };
                    await setDoc(docRef, payload);
                    const cred = await createUserWithEmailAndPassword(auth, emailStr, form.senha);
                    await updateDoc(docRef, { uid: cred.user.uid });
                    toast("Registro efetuado! Aguarde aprovação.", "success");
                    setIsLoginModo(true);
                }
            }
        } catch (err) { toast("Erro de conexão.", "error"); } finally { setLoadingMsg(''); }
    };

    // TOGGLE STATUS
    const alternarStatusGps = async () => {
        if (!piloto) return;
        if (piloto.statusAprovacao !== 'APROVADO') return toast("Seu perfil ainda está em análise.", "error");
        setLoadingMsg('Sincronizando...');
        try {
            if (!isOnline) {
                try { await Geolocation.requestPermissions(); } catch(e){} 
                setIsOnline(true);
                await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Livre' });
                toast("Você está Online!", "success");
            } else {
                setIsOnline(false); setOfertaLeilao(null); audioAlarmeRef.current?.stop();
                await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Offline' });
                toast("Você está Offline.", "info");
            }
        } catch(e) { toast("Erro ao mudar status.", "error"); } finally { setLoadingMsg(''); }
    };

    // AÇÕES DA CORRIDA
    const aceitarMissao = async () => {
        if (!ofertaLeilao || !piloto) return;
        setLoadingMsg('Confirmando Rota...');
        try {
            audioAlarmeRef.current?.stop();
            await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { 
                status: 'A_CAMINHO_LOJA', entregadorId: piloto.id,
                nomeEntregador: (piloto.nome || 'Piloto').split(' ')[0], veiculoEntregador: piloto.modalidade || 'Moto',
                telefoneEntregador: piloto.telefone || '', horarioAceite: serverTimestamp() 
            });
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Em Rota' });
            setOfertaLeilao(null); setAbaAtiva('HOME'); UTILS.vibrar(100);
            toast("Rota Aceita! Dirija-se à base.", "success");
        } catch(e) { toast("Missão não está mais disponível.", "error"); setOfertaLeilao(null); } finally { setLoadingMsg(''); }
    };

    const recusarMissao = async () => {
        audioAlarmeRef.current?.stop(); UTILS.vibrar(50);
        if (ofertaLeilao && piloto) await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { entregadoresRecusaram: arrayUnion(piloto.id) }).catch(()=>{});
        setOfertaLeilao(null);
    };

    const atualizarStatusCorrida = async (novoStatus) => {
        if(!pedidoAtivo) return;
        setLoadingMsg('Atualizando...');
        try { 
            await updateDoc(doc(db, "pedidos", pedidoAtivo.id), { status: novoStatus, statusAtualizadoEm: serverTimestamp() }); 
            UTILS.vibrar(50); 
        } 
        catch(e) { toast("Falha de conexão.", "error"); } finally { setLoadingMsg(''); }
    };

    // FINALIZAÇÃO
    const finalizarCorridaValida = async () => {
        if (!pedidoAtivo || codigoConfirmacao.length < 4) return;
        
        // Verifica se o token inserido bate com o token finalização (ou últimos 4 dígitos do telefone como backup)
        const tokenReal = pedidoAtivo.tokenFinalizacao ? String(pedidoAtivo.tokenFinalizacao) : pedidoAtivo.cliente?.telefone?.slice(-4);
        
        if (String(tokenReal) !== String(codigoConfirmacao)) {
            return toast("Código de confirmação incorreto!", "error");
        }

        tirarFotoProva(pedidoAtivo);
    };

    const tirarFotoProva = (pedido) => {
        setPedidoParaFinalizar(pedido);
        if(cameraInputRef.current) cameraInputRef.current.click();
    };

    const finalizarComFoto = async (e) => {
        const file = e.target.files[0];
        if (!file || !pedidoParaFinalizar || !piloto) return;
        setLoadingMsg('Calculando ganhos e processando foto...');
        try {
            const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET); formData.append("folder", "rodrigues_acai/provas");
            const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
            const json = await res.json();
            const taxa = obterTaxa(pedidoParaFinalizar);
            const total = obterTotal(pedidoParaFinalizar);
            const metodoPgto = (pedidoParaFinalizar.pagamento?.metodo || '').toUpperCase();
            const debitoLoja = (metodoPgto.includes('DINHEIRO') || metodoPgto.includes('MAQUININHA') || metodoPgto.includes('NA ENTREGA')) ? total : 0;
            
            await updateDoc(doc(db, "pedidos", pedidoParaFinalizar.id), { status: 'CONCLUIDO', provaEntregaUrl: json.secure_url, horarioConclusao: serverTimestamp() });
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Livre', ganhosTaxas: increment(taxa), debitosLoja: increment(debitoLoja), saldoLiquido: increment(taxa - debitoLoja), totalEntregas: increment(1) });
            
            setCodigoConfirmacao(''); UTILS.vibrar([100, 50, 100, 50, 200]);
            toast("Entrega concluída com sucesso!", "success");
        } catch (err) { toast("Erro ao finalizar a entrega.", "error"); } finally { setLoadingMsg(''); setPedidoParaFinalizar(null); if(e.target) e.target.value = null; }
    };

    // ========================================================================
    // RENDERIZAÇÃO
    // ========================================================================
    const endCliente = pedidoAtivo ? obterEndereco(pedidoAtivo) : null;
    const temLatLgn = endCliente?.lat && endCliente?.lng;
    const distReal = temLatLgn && myLocation ? calcularDistancia(myLocation.lat, myLocation.lng, endCliente.lat, endCliente.lng) : (ofertaLeilao ? calcularDistancia(LOJA_COORDS[0], LOJA_COORDS[1], obterEndereco(ofertaLeilao).lat, obterEndereco(ofertaLeilao).lng) : "0.0");

    if (secao === 'LOADING') return <div className={`h-[100dvh] w-full ${THEME.bgApp} flex items-center justify-center`}><Lucide.Loader2 size={40} className={`animate-spin ${THEME.accentPurple}`}/></div>;

    if (secao === 'INTRO') {
        const inputClass = `w-full h-14 rounded-2xl bg-[#18181b] border border-white/5 px-5 text-white outline-none focus:border-[#a855f7] shadow-inner`;
        return (
            <div className={`min-h-[100dvh] flex flex-col font-sans ${THEME.bgApp} text-white p-8 relative`}>
                <AnimatePresence>{loadingMsg && <LoaderGlobal msg={loadingMsg} />}</AnimatePresence>
                <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                    <div className="mb-10 text-center">
                        <div className={`w-20 h-20 bg-[#18181b] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl border ${THEME.border}`}>
                            <Lucide.Bike size={40} className={THEME.accentPurple}/>
                        </div>
                        <h1 className="text-4xl font-black italic tracking-tighter">UP! <span className={THEME.accentGreen}>Piloto</span></h1>
                        <p className="text-gray-500 text-sm mt-2">{isLoginModo ? 'Acesso ao sistema' : 'Faça seu cadastro'}</p>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4">
                        {!isLoginModo && <input type="text" placeholder="Nome Completo" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className={inputClass} required />}
                        <input type="tel" placeholder="CPF" value={UTILS.mascararCPF(form.cpf)} onChange={e=>setForm({...form, cpf: e.target.value})} maxLength={14} className={inputClass} required />
                        {!isLoginModo && <input type="tel" placeholder="WhatsApp" value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} className={inputClass} required />}
                        <input type="password" placeholder="Senha" value={form.senha} onChange={e=>setForm({...form, senha: e.target.value})} className={inputClass} required />
                        {!isLoginModo && <input type="text" placeholder="Placa do Veículo" value={form.placa} onChange={e=>setForm({...form, placa: e.target.value.toUpperCase()})} className={`${inputClass} uppercase`} required />}
                        
                        <button type="submit" className={`w-full py-4 mt-2 rounded-2xl font-black uppercase tracking-widest text-sm text-black ${THEME.bgGreen} shadow-[0_0_20px_rgba(163,230,53,0.3)] active:scale-95 transition-all`}>
                            {isLoginModo ? 'Entrar na Conta' : 'Enviar Cadastro'}
                        </button>
                    </form>
                    <button onClick={() => setIsLoginModo(!isLoginModo)} className="mt-8 text-gray-500 font-bold text-sm w-full">{isLoginModo ? 'Criar nova conta' : 'Já tenho conta'}</button>
                    {isLoginModo && <button onClick={() => { const e=prompt("Digite o email cadastrado:"); if(e) sendPasswordResetEmail(auth, e).then(()=>toast("Email enviado!","success")); }} className="mt-4 text-gray-600 font-bold text-xs w-full">Recuperar Senha</button>}
                </div>
            </div>
        );
    }

    if (!piloto) return null;

    if (piloto?.statusAprovacao !== 'APROVADO') return (
        <div className={`h-[100dvh] ${THEME.bgApp} flex flex-col items-center justify-center p-8 text-center text-white`}>
            <Lucide.Clock size={80} className="text-orange-500 mb-6 animate-pulse"/>
            <h2 className="text-2xl font-black uppercase italic mb-3">Em Análise</h2>
            <p className="text-sm font-medium text-gray-500 mb-8">Seu cadastro está sendo revisado. Tente novamente mais tarde.</p>
            <button onClick={()=>{auth.signOut(); localStorage.removeItem('@UP:cpf');}} className={`px-8 py-3 ${THEME.card} rounded-xl font-bold text-xs uppercase border ${THEME.border}`}>Sair</button>
        </div>
    );

    return (
        <div className={`flex flex-col h-[100dvh] w-full font-sans ${THEME.bgApp} text-white overflow-hidden relative`}>
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={finalizarComFoto} className="hidden" />
            <AnimatePresence>{loadingMsg && <LoaderGlobal msg={loadingMsg} />}</AnimatePresence>
            {!temInternet && <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="absolute top-0 z-[10000] w-full bg-red-600 text-white text-center py-2 font-bold text-[11px]">Sem conexão com a internet</motion.div>}

            <style>{`
                .radar-sweep { background: conic-gradient(from 0deg, transparent 70%, rgba(168, 85, 247, 0.4) 100%); animation: sweep 3s linear infinite; }
                @keyframes sweep { to { transform: rotate(360deg); } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .map-dark-filter .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
            `}</style>

            {/* MODAL MAPA FULLSCREEN COM ROTA DINÂMICA */}
            <AnimatePresence>
                {mostrarMapaModal && temLatLgn && (
                    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} className={`fixed inset-0 z-[99999] ${THEME.bgApp} flex flex-col`}>
                        <div className={`p-6 border-b ${THEME.border} flex justify-between items-center z-10 bg-[#09090b]`}>
                            <div><h3 className="font-bold text-lg">Mapa de Rota</h3><p className={`text-[11px] font-bold ${THEME.accentGreen}`}>Distância: {distReal} km</p></div>
                            <button onClick={() => setMostrarMapaModal(false)} className={`w-12 h-12 ${THEME.card} rounded-full flex items-center justify-center border ${THEME.border}`}><Lucide.X size={20}/></button>
                        </div>
                        <div className="flex-1 relative z-0">
                            <LiveMap pedido={pedidoAtivo || ofertaLeilao} myLocation={myLocation} interativo={true} />
                        </div>
                        <div className={`p-6 ${THEME.card} rounded-t-[2rem] border-t ${THEME.border} grid grid-cols-2 gap-3 z-10`}>
                            <button onClick={() => { setMostrarMapaModal(false); UTILS.abrirGoogleMaps(endCliente.lat, endCliente.lng); }} className={`h-16 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all`}>
                                <Lucide.MapPin size={20}/> G. Maps
                            </button>
                            <button onClick={() => { setMostrarMapaModal(false); UTILS.abrirWaze(endCliente.lat, endCliente.lng); }} className={`h-16 bg-[#EEF2F9] text-[#05C8F2] border border-[#05C8F2]/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all`}>
                                <Lucide.Navigation size={20} className="fill-current"/> Waze
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="flex-1 overflow-y-auto hide-scrollbar pb-28 relative">
                <AnimatePresence mode="wait">
                    
                    {/* ABA: HOME / RADAR */}
                    {abaAtiva === 'HOME' && (
                        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col min-h-full">
                            
                            <header className="px-6 pt-12 pb-2 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-white/10 overflow-hidden flex items-center justify-center">
                                        {piloto?.urlPerfil ? <img src={piloto.urlPerfil} className="w-full h-full object-cover"/> : <Lucide.User size={24} className="text-gray-500"/>}
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs">Boa noite,</p>
                                        <div className="flex items-center gap-2">
                                            <h1 className="font-bold text-lg">{piloto?.nome?.split(' ')[0] || 'Piloto'}</h1>
                                            <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-bold border ${isOnline ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div> {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </header>

                            <div className={`${THEME.card} mx-6 mt-4 p-4 rounded-2xl flex justify-between items-center border ${THEME.border}`}>
                                <div>
                                    <h2 className="font-bold text-sm">Disponível para corridas</h2>
                                    <p className="text-gray-400 text-[10px] mt-0.5">{isOnline ? 'Você está recebendo pedidos' : 'Fique online para operar'}</p>
                                </div>
                                <div onClick={alternarStatusGps} className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${isOnline ? THEME.bgGreen : 'bg-gray-700'}`}>
                                    <motion.div layout transition={{ type: "spring", stiffness: 700, damping: 30 }} className={`w-6 h-6 rounded-full shadow-md ${isOnline ? 'bg-[#09090b] ml-6' : 'bg-gray-300 ml-0'}`} />
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 mt-4">
                                <div className={`flex-1 ${THEME.card} p-4 rounded-2xl border ${THEME.border}`}>
                                    <p className="text-gray-400 text-[10px] mb-1">Ganhos hoje</p>
                                    <p className="font-black text-lg">{UTILS.formatarMoeda(piloto?.ganhosTaxas || 0)}</p>
                                </div>
                                <div className={`flex-1 ${THEME.card} p-4 rounded-2xl border ${THEME.border}`}>
                                    <p className="text-gray-400 text-[10px] mb-1">Entregas</p>
                                    <p className="font-black text-lg">{(piloto?.totalEntregas || 0).toString().padStart(2, '0')}</p>
                                </div>
                                <div className={`flex-1 ${THEME.card} p-4 rounded-2xl border ${THEME.border}`}>
                                    <p className="text-gray-400 text-[10px] mb-1">Avaliação</p>
                                    <p className="font-black text-lg flex items-center gap-1"><Lucide.Star size={14} className="fill-[#eab308] text-[#eab308]"/> 5,0</p>
                                </div>
                            </div>

                            {!pedidoAtivo ? (
                                <div className="flex-1 flex flex-col justify-center relative mt-4">
                                    <AnimatePresence>
                                        {ofertaLeilao && isOnline && (
                                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`mx-6 mb-2 ${THEME.bgPurple} rounded-2xl p-4 flex justify-between items-center shadow-[0_10px_30px_rgba(168,85,247,0.3)]`}>
                                                <div>
                                                    <h3 className="font-bold text-white text-sm">Nova entrega disponível!</h3>
                                                    <p className="text-white/80 text-[10px]">Aprox. {distReal} km até o destino</p>
                                                </div>
                                                <button onClick={aceitarMissao} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white active:scale-95"><Lucide.Check size={20}/></button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="relative">
                                        <RadarAnimation />
                                        <div className={`absolute bottom-0 right-[20%] ${THEME.card} border ${THEME.border} px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold`}>
                                            Pedidos próximos <span className={`w-5 h-5 ${THEME.bgPurple} rounded-full flex items-center justify-center text-[10px]`}>{countAcumulo > 0 ? countAcumulo : 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 px-6">
                                    <div className={`${THEME.card} rounded-[2rem] border ${THEME.border} p-5 relative overflow-hidden shadow-2xl`}>
                                        <div className="absolute top-0 left-0 w-full h-1 bg-[#a855f7]" />
                                        
                                        <div className="flex justify-between items-start mb-5">
                                            <div>
                                                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1">Status da entrega</p>
                                                <h3 className="font-black text-xl text-white">{pedidoAtivo.status.replace(/_/g, ' ')}</h3>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1">Ganhos</p>
                                                <p className={`font-black text-xl ${THEME.accentGreen}`}>{UTILS.formatarMoeda(obterTaxa(pedidoAtivo))}</p>
                                            </div>
                                        </div>

                                        {/* AQUI ESTÁ O MAPA ESTÁTICO (EFEITO PRINT) */}
                                        <div onClick={() => setMostrarMapaModal(true)} className="w-full h-32 rounded-2xl overflow-hidden mb-5 relative border border-white/10 cursor-pointer group shadow-inner">
                                            {/* Película invisível por cima para não deixar o usuário arrastar o mapa por acidente e habilitar o clique */}
                                            <div className="absolute inset-0 z-20 bg-black/10 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <span className="bg-[#18181b] border border-white/10 text-white px-4 py-2 rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shadow-lg">
                                                    <Lucide.Maximize2 size={14}/> Ampliar Rota
                                                </span>
                                            </div>

                                            {/* O mapa estático com o auto-zoom configurado (Base e Cliente) */}
                                            <div className="absolute inset-0 z-10 pointer-events-none">
                                                <PreviewMapaEstatico pedido={pedidoAtivo} />
                                            </div>
                                        </div>

                                        {pedidoAtivo.pagamento?.metodo?.toUpperCase().includes('NA ENTREGA') && (
                                            <div className="bg-red-500/20 border border-red-500/50 text-white p-4 rounded-xl mb-5 text-center">
                                                <p className="text-[10px] font-black uppercase text-red-400">Cobrar do Cliente na Entrega</p>
                                                <p className="text-2xl font-black text-red-400">{UTILS.formatarMoeda(obterTotal(pedidoAtivo))}</p>
                                                <p className="text-[10px] font-bold mt-1 text-red-300">Modo: {pedidoAtivo.pagamento.metodo}</p>
                                            </div>
                                        )}

                                        <div className="space-y-4 mb-6">
                                            <div className="flex gap-4 items-center">
                                                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${THEME.accentPurple}`}><Lucide.User size={20}/></div>
                                                <div className="flex-1"><p className="font-bold text-sm">{obterCliente(pedidoAtivo).nome}</p><p className="text-[10px] text-gray-500">{pedidoAtivo.pagamento?.metodo || 'Pagamento Online'}</p></div>
                                                <button onClick={() => UTILS.abrirZap(obterCliente(pedidoAtivo).telefone, obterCliente(pedidoAtivo).nome)} className="w-10 h-10 bg-[#25D366]/20 text-[#25D366] rounded-xl flex items-center justify-center"><Lucide.MessageCircle size={20}/></button>
                                            </div>
                                        </div>

                                        {pedidoAtivo.status === 'ENTREGADOR_NO_LOCAL' && (
                                            <div className="mb-5 bg-white/5 p-4 rounded-2xl border border-white/10">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 text-center">Token do Cliente (4 dígitos)</p>
                                                <input type="number" maxLength={4} value={codigoConfirmacao} onChange={e=>setCodigoConfirmacao(e.target.value)} placeholder="0000" className="w-full h-12 bg-[#09090b] rounded-xl border border-white/10 text-center font-black text-2xl tracking-[0.3em] outline-none text-white focus:border-[#a3e635]" />
                                            </div>
                                        )}

                                        {pedidoAtivo.status === 'A_CAMINHO_LOJA' && <button onClick={() => atualizarStatusCorrida('AGUARDANDO_COLETA')} className={`w-full py-4 ${THEME.bgPurple} text-white rounded-2xl font-black uppercase text-sm`}>Cheguei à Base</button>}
                                        {pedidoAtivo.status === 'AGUARDANDO_COLETA' && <button onClick={() => atualizarStatusCorrida('SAIU_ENTREGA')} className={`w-full py-4 ${THEME.bgPurple} text-white rounded-2xl font-black uppercase text-sm`}>Peguei o Pacote</button>}
                                        {pedidoAtivo.status === 'SAIU_ENTREGA' && <button onClick={() => atualizarStatusCorrida('ENTREGADOR_NO_LOCAL')} className={`w-full py-4 ${THEME.bgPurple} text-white rounded-2xl font-black uppercase text-sm`}>Cheguei ao Destino</button>}
                                        {pedidoAtivo.status === 'ENTREGADOR_NO_LOCAL' && <button onClick={finalizarCorridaValida} className={`w-full py-4 ${THEME.bgGreen} text-[#09090b] rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2`}><Lucide.CheckCircle size={20}/> Finalizar Entrega</button>}
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* ABA: CARTEIRA */}
                    {abaAtiva === 'CARTEIRA' && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6 pt-12">
                            <h2 className="text-2xl font-bold mb-6">Financeiro</h2>
                            <div className={`${THEME.card} p-8 rounded-[2rem] border ${THEME.border} mb-6 relative overflow-hidden`}>
                                <div className={`absolute -right-4 -bottom-4 opacity-5 ${THEME.accentPurple}`}><Lucide.Wallet size={120} /></div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Saldo a Receber</p>
                                <p className={`text-5xl font-black mb-8 ${THEME.accentGreen}`}>{UTILS.formatarMoeda(piloto?.saldoLiquido)}</p>
                                <div className="space-y-3">
                                    <div className="bg-white/5 p-4 rounded-xl flex justify-between font-bold text-sm text-gray-300"><span>Seus Ganhos (Taxas)</span><span className={THEME.accentGreen}>{UTILS.formatarMoeda(piloto?.ganhosTaxas)}</span></div>
                                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex justify-between font-bold text-sm text-red-400"><span>Dívida com a Loja</span><span>{UTILS.formatarMoeda(piloto?.debitosLoja)}</span></div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ABA: PERFIL */}
                    {abaAtiva === 'PERFIL' && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6 pt-12 space-y-6">
                            <h2 className="text-2xl font-bold mb-6">Perfil do Piloto</h2>
                            
                            <div className={`${THEME.card} p-6 rounded-[2rem] border ${THEME.border} flex items-center gap-4`}>
                                <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-white/10 overflow-hidden flex items-center justify-center">
                                    {piloto?.urlPerfil ? <img src={piloto.urlPerfil} className="w-full h-full object-cover"/> : <Lucide.User size={30} className="text-gray-500"/>}
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">{piloto?.nome}</h3>
                                    <p className="text-gray-500 text-xs font-black tracking-widest">{UTILS.mascararCPF(piloto?.cpf)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => updateDoc(doc(db,"entregadores",piloto?.id), {aceitaDinheiro: !piloto?.aceitaDinheiro})} className={`${THEME.card} h-24 rounded-3xl border ${piloto?.aceitaDinheiro ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#a3e635]' : THEME.border + ' text-gray-500'} flex flex-col items-center justify-center gap-2 transition-colors`}>
                                    <Lucide.Banknote size={24}/>
                                    <span className="text-[10px] font-black uppercase">Tenho Troco</span>
                                </button>
                                <button onClick={() => updateDoc(doc(db,"entregadores",piloto?.id), {temMaquininha: !piloto?.temMaquininha})} className={`${THEME.card} h-24 rounded-3xl border ${piloto?.temMaquininha ? 'border-[#a855f7]/50 bg-[#a855f7]/10 text-[#a855f7]' : THEME.border + ' text-gray-500'} flex flex-col items-center justify-center gap-2 transition-colors`}>
                                    <Lucide.CreditCard size={24}/>
                                    <span className="text-[10px] font-black uppercase">Maquininha</span>
                                </button>
                            </div>

                            <button onClick={()=>{if(window.confirm("Deseja sair?")) { auth.signOut(); localStorage.removeItem('@UP:cpf'); setPiloto(null); setSecao('INTRO'); }}} className={`w-full py-4 ${THEME.card} border border-red-500/30 text-red-500 rounded-2xl font-bold text-sm uppercase tracking-widest active:scale-95 transition-all`}>Desconectar</button>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            {/* BARRA DE NAVEGAÇÃO INFERIOR */}
            <div className={`absolute bottom-6 left-6 right-6 ${THEME.card} border ${THEME.border} rounded-[2rem] h-[72px] flex justify-around items-center px-6 shadow-2xl backdrop-blur-xl bg-opacity-90 z-50`}>
                {[ { id: 'HOME', icon: Lucide.Home, label: 'Início' }, { id: 'CARTEIRA', icon: Lucide.Wallet, label: 'Ganhos' }, { id: 'PERFIL', icon: Lucide.User, label: 'Perfil' } ].map(i => {
                    const isActive = abaAtiva === i.id;
                    return (
                        <button key={i.id} onClick={() => setAbaAtiva(i.id)} className="relative w-14 h-14 flex flex-col items-center justify-center group">
                            <i.icon size={22} className={`transition-colors duration-300 z-10 ${isActive ? THEME.accentGreen : 'text-gray-500 group-hover:text-gray-300'}`} strokeWidth={isActive ? 2.5 : 2} />
                            {isActive && <motion.div layoutId="nav-pill" className={`absolute inset-2 rounded-xl bg-gradient-to-t from-[#a3e635]/20 to-transparent blur-sm z-0`} />}
                            {isActive && <div className={`absolute bottom-1 w-1 h-1 rounded-full ${THEME.bgGreen}`} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function AppEntregadorWrapper() {
    return <ToastProvider><UpEntregasApp /></ToastProvider>;
}