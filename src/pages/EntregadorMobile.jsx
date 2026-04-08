import React, { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react';
import { db, auth } from '../services/firebase'; 
import { 
    doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, 
    where, serverTimestamp, increment, arrayUnion, orderBy, limit 
} from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Howl } from 'howler';

// --- CAPACITOR / HARDWARE ---
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ========================================================================
// 1. CONFIGURAÇÕES GERAIS, TEMAS E CONSTANTES
// ========================================================================
const APP_VERSION = "4.2.0-ULTIMATE";
const SOUND_ALARM = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const LOJA_COORDS = [-20.4697, -54.6201]; 
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbd9x1o02/image/upload";
const UPLOAD_PRESET = "fc3i8urq";

const MAPA_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MAPA_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const PALETTE = {
    dark: {
        bgApp: "bg-[#09090b]", card: "bg-[#18181b]", textBase: "text-white", textMuted: "text-gray-400",
        border: "border-white/5", inputBg: "bg-white/5", accentPurple: "text-[#a855f7]", 
        bgPurple: "bg-[#a855f7]", accentGreen: "text-[#a3e635]", bgGreen: "bg-[#a3e635]",
        mapFilter: "filter invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)"
    },
    light: {
        bgApp: "bg-[#f8fafc]", card: "bg-white", textBase: "text-[#0f172a]", textMuted: "text-gray-500",
        border: "border-gray-200", inputBg: "bg-gray-100", accentPurple: "text-[#9333ea]", 
        bgPurple: "bg-[#9333ea]", accentGreen: "text-[#65a30d]", bgGreen: "bg-[#84cc16]",
        mapFilter: "none"
    }
};

const iconLoja = new L.DivIcon({ className: 'custom-icon', html: `<div class="w-10 h-10 bg-purple-600 rounded-xl border-2 border-white flex items-center justify-center shadow-lg"><div class="w-3 h-3 bg-white rounded-full animate-pulse"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const iconCliente = new L.DivIcon({ className: 'custom-icon', html: `<div class="w-10 h-10 bg-green-500 rounded-xl border-2 border-white flex items-center justify-center shadow-lg"><div class="w-3 h-3 bg-white rounded-full"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });

// ========================================================================
// 2. FUNÇÕES UTILITÁRIAS
// ========================================================================
const UTILS = {
    formatarMoeda: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
    mascararCPF: (v) => v?.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, "$1.$2.$3-$4") || '',
    limparDados: (v) => v?.replace(/\D/g, '') || '',
    vibrar: (padrao = 'heavy') => { 
        try { Haptics.impact({ style: padrao === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light }); } catch(e) {} 
    },
    abrirWaze: (lat, lng) => window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_system'),
    abrirZap: (tel, nome) => window.open(`https://api.whatsapp.com/send?phone=55${tel?.replace(/\D/g, '')}&text=Olá ${nome}, sou o entregador da UP! e estou a caminho com o seu pedido.`, '_system'),
    calcularDistancia: (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
        const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return (R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))).toFixed(1);
    }
};

// ========================================================================
// 3. CONTEXTOS (TOAST) E COMPONENTES AUXILIARES
// ========================================================================
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, msg, type }]);
        UTILS.vibrar(type === 'error' ? 'heavy' : 'light');
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-safe pt-12 left-0 right-0 z-[99999] flex flex-col items-center gap-3 pointer-events-none px-4">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className={`w-full max-w-sm p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-wide text-white border-b-4 
                            ${t.type === 'error' ? 'bg-red-900/95 border-red-500' : t.type === 'success' ? 'bg-[#18181b]/95 border-[#a3e635]' : 'bg-[#18181b]/95 border-[#a855f7]'} backdrop-blur-md`}>
                            {t.type === 'error' ? <Lucide.AlertOctagon size={24} className="text-red-500"/> : t.type === 'success' ? <Lucide.CheckCircle size={24} className="text-[#a3e635]"/> : <Lucide.Info size={24} className="text-[#a855f7]"/>}
                            <span className="flex-1">{t.msg}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const LoaderGlobal = ({ msg, theme }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <div className={`p-8 rounded-[2rem] shadow-2xl flex flex-col items-center border ${theme.border} ${theme.card}`}>
            <Lucide.Loader2 size={40} className={`animate-spin ${theme.accentPurple} mb-4`} />
            <p className={`${theme.textBase} font-black uppercase tracking-widest text-[11px] animate-pulse`}>{msg || 'Processando...'}</p>
        </div>
    </motion.div>
);

function MapStaticBounds({ bounds }) {
    const map = useMap();
    useEffect(() => { if (bounds?.length > 0) map.fitBounds(bounds, { padding: [40, 40], animate: false }); }, [bounds, map]);
    return null;
}

const MiniMapPrint = ({ pedido, isDark }) => {
    const end = { lat: pedido?.endereco?.latlng?.lat || pedido?.endereco?.lat, lng: pedido?.endereco?.latlng?.lng || pedido?.endereco?.lng };
    const [rota, setRota] = useState([]);

    useEffect(() => {
        if (!end.lat) return;
        fetch(`https://router.project-osrm.org/route/v1/driving/${LOJA_COORDS[1]},${LOJA_COORDS[0]};${end.lng},${end.lat}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => { if (data.routes?.[0]) setRota(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])); }).catch(() => {});
    }, [end.lat, end.lng]);

    const bounds = end.lat ? [LOJA_COORDS, [end.lat, end.lng]] : [];

    return (
        <div className="w-full h-full rounded-2xl overflow-hidden relative border border-white/10 shadow-inner">
            <MapContainer center={LOJA_COORDS} zoom={13} zoomControl={false} dragging={false} scrollWheelZoom={false} className="w-full h-full z-0" style={{ filter: isDark ? PALETTE.dark.mapFilter : PALETTE.light.mapFilter }}>
                <TileLayer url={isDark ? MAPA_DARK : MAPA_LIGHT} />
                <Marker position={LOJA_COORDS} icon={iconLoja} />
                {end.lat && <Marker position={[end.lat, end.lng]} icon={iconCliente} />}
                {rota.length > 0 && <Polyline positions={rota} color="#a855f7" weight={5} opacity={0.8} dashArray="5, 10" />}
                <MapStaticBounds bounds={bounds} />
            </MapContainer>
            <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none" />
        </div>
    );
};

// ========================================================================
// 4. APLICATIVO PRINCIPAL
// ========================================================================
const UpEntregasApp = () => {
    const toast = useToast();
    
    // --- ESTADOS DE SESSÃO E DADOS ---
    const [cpfLogado, setCpfLogado] = useState(localStorage.getItem('@UP:cpf') || null);
    const [piloto, setPiloto] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [historico, setHistorico] = useState([]);
    
    // --- ESTADOS DE PEDIDOS ---
    const [pedidoAtivo, setPedidoAtivo] = useState(null);
    const [ofertaLeilao, setOfertaLeilao] = useState(null);
    
    // --- ESTADOS DE UI E CONFIGURAÇÕES ---
    const [secao, setSecao] = useState('LOADING'); // LOADING | INTRO | APP
    const [abaAtiva, setAbaAtiva] = useState('HOME'); // HOME | CARTEIRA | PERFIL
    const [loadingMsg, setLoadingMsg] = useState('');
    const [config, setConfig] = useState(JSON.parse(localStorage.getItem('@UP:config')) || { volume: 1.0, darkMode: true, gpsAltaPrecisao: true });
    const [form, setForm] = useState({ cpf: '', senha: '', nome: '', veiculo: 'MOTO', placa: '', telefone: '' });
    const [isLoginModo, setIsLoginModo] = useState(true);
    
    // --- ESTADOS DE CORRIDA E VALIDAÇÃO ---
    const [telaCorridaAtiva, setTelaCorridaAtiva] = useState(false); // Modal Tela Cheia Rota Ativa
    const [detalhesRotaAbertos, setDetalhesRotaAbertos] = useState(false); // Toggle do Mapa no Leilão
    const [tempoExpiracao, setTempoExpiracao] = useState(60);
    const [codigoInput, setCodigoInput] = useState('');

    // --- REFs ---
    const audioAlarmeRef = useRef(null);
    const watchIdRef = useRef(null);
    const cameraInputRef = useRef(null);
    const timerRef = useRef(null);

    const theme = config.darkMode ? PALETTE.dark : PALETTE.light;

    // --- SALVAR CONFIGS ---
    useEffect(() => { localStorage.setItem('@UP:config', JSON.stringify(config)); }, [config]);

    // --- EFEITO 1: INICIALIZAÇÃO ---
    useEffect(() => {
        try { audioAlarmeRef.current = new Howl({ src: [SOUND_ALARM], loop: true, volume: config.volume }); } catch(e){}
        if (!cpfLogado) { setSecao('INTRO'); return; }

        const unsub = onSnapshot(doc(db, "entregadores", cpfLogado), snap => {
            if (snap.exists()) {
                setPiloto({ id: snap.id, ...snap.data() });
                setIsOnline(snap.data().status !== 'Offline');
                setSecao('APP');
            } else { 
                localStorage.removeItem('@UP:cpf'); setCpfLogado(null); setSecao('INTRO'); 
            }
        });
        return () => unsub();
    }, [cpfLogado]);

    // --- EFEITO 2: GEOLOCALIZAÇÃO ---
    useEffect(() => {
        if (!piloto?.id || secao !== 'APP') return;
        const iniciarGPS = async () => {
            if (isOnline && piloto.statusAprovacao === 'APROVADO') {
                try {
                    await Geolocation.requestPermissions();
                    watchIdRef.current = await Geolocation.watchPosition({ enableHighAccuracy: config.gpsAltaPrecisao, timeout: 10000, maximumAge: 0 }, 
                        (pos) => {
                            if (pos) updateDoc(doc(db, "entregadores", piloto.id), { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, lastUpdate: serverTimestamp() }).catch(()=>{});
                        }
                    );
                } catch(e) {}
            } else { if (watchIdRef.current) { Geolocation.clearWatch({ id: watchIdRef.current }); watchIdRef.current = null; } }
        };
        iniciarGPS();
        return () => { if (watchIdRef.current) Geolocation.clearWatch({ id: watchIdRef.current }); };
    }, [piloto?.id, isOnline, piloto?.statusAprovacao, config.gpsAltaPrecisao, secao]);

    // --- EFEITO 3: RADAR DE PEDIDOS E HISTÓRICO ---
    useEffect(() => {
        if (!piloto?.id || secao !== 'APP' || piloto.statusAprovacao !== 'APROVADO') return;

        // 1. Pedido Ativo
        const qAtivo = query(collection(db, "pedidos"), where("entregadorId", "==", piloto.id), where("status", "in", ["A_CAMINHO_LOJA", "AGUARDANDO_COLETA", "SAIU_ENTREGA", "ENTREGADOR_NO_LOCAL"]));
        const unsubAtivo = onSnapshot(qAtivo, snap => {
            if (!snap.empty) {
                setPedidoAtivo({ id: snap.docs[0].id, ...snap.docs[0].data() });
                setOfertaLeilao(null); audioAlarmeRef.current?.stop();
            } else {
                setPedidoAtivo(null); setTelaCorridaAtiva(false);
            }
        });

        // 2. Leilão (Novos Pedidos)
        const qRadar = query(collection(db, "pedidos"), where("status", "==", "BUSCANDO_ENTREGADOR"));
        const unsubRadar = onSnapshot(qRadar, snap => {
            if (isOnline && !pedidoAtivo) {
                const ofertasValidas = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(o => !o.entregadoresRecusaram?.includes(piloto.id));
                if (ofertasValidas.length > 0) {
                    const novaOferta = ofertasValidas[0];
                    if (!ofertaLeilao || ofertaLeilao.id !== novaOferta.id) {
                        setOfertaLeilao(novaOferta); setTempoExpiracao(60); setDetalhesRotaAbertos(false);
                        audioAlarmeRef.current?.volume(config.volume); audioAlarmeRef.current?.play(); UTILS.vibrar('heavy');
                    }
                } else { setOfertaLeilao(null); audioAlarmeRef.current?.stop(); }
            } else { setOfertaLeilao(null); audioAlarmeRef.current?.stop(); }
        });

        // 3. Histórico
        const qHist = query(collection(db, "pedidos"), where("entregadorId", "==", piloto.id), where("status", "==", "CONCLUIDO"), orderBy("horarioConclusao", "desc"), limit(10));
        const unsubHist = onSnapshot(qHist, snap => { setHistorico(snap.docs.map(d => ({id: d.id, ...d.data()}))); });

        return () => { unsubAtivo(); unsubRadar(); unsubHist(); audioAlarmeRef.current?.stop(); };
    }, [piloto?.id, isOnline, secao, pedidoAtivo?.id, piloto?.statusAprovacao, config.volume, ofertaLeilao?.id]);

    // --- EFEITO 4: CRONÔMETRO DA OFERTA ---
    useEffect(() => {
        if (ofertaLeilao) {
            timerRef.current = setInterval(() => {
                setTempoExpiracao(prev => {
                    if (prev <= 1) { recusarOferta(); return 0; }
                    return prev - 1;
                });
            }, 1000);
        } else { clearInterval(timerRef.current); }
        return () => clearInterval(timerRef.current);
    }, [ofertaLeilao]);

    // ========================================================================
    // AÇÕES E HANDLERS
    // ========================================================================
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoadingMsg('Conectando...');
        const cpfLimpo = UTILS.limparDados(form.cpf);
        const emailStr = `${cpfLimpo}@rodrigues.com`;
        try {
            const snap = await getDoc(doc(db, "entregadores", cpfLimpo));
            if (isLoginModo) {
                if (snap.exists() && snap.data().senha === form.senha) {
                    localStorage.setItem('@UP:cpf', cpfLimpo); setCpfLogado(cpfLimpo);
                    signInWithEmailAndPassword(auth, emailStr, form.senha).catch(()=>{});
                } else { toast("Dados inválidos.", "error"); }
            } else {
                if (snap.exists()) { toast("CPF já cadastrado.", "error"); } 
                else {
                    await setDoc(doc(db, "entregadores", cpfLimpo), {
                        nome: form.nome, cpf: cpfLimpo, telefone: UTILS.limparDados(form.telefone), senha: form.senha, 
                        placa: form.placa.toUpperCase(), statusAprovacao: 'PENDENTE', status: 'Offline', ganhosTaxas: 0, totalEntregas: 0, dataCadastro: serverTimestamp()
                    });
                    createUserWithEmailAndPassword(auth, emailStr, form.senha).catch(()=>{});
                    toast("Cadastro em análise!", "success"); setIsLoginModo(true);
                }
            }
        } catch (err) { toast("Erro de rede.", "error"); } finally { setLoadingMsg(''); }
    };

    const alternarStatusGps = async () => {
        if (!piloto) return;
        setLoadingMsg('Atualizando status...');
        try {
            const novoStatus = !isOnline;
            setIsOnline(novoStatus);
            await updateDoc(doc(db, "entregadores", piloto.id), { status: novoStatus ? 'Livre' : 'Offline' });
            if(novoStatus) toast("Você está Online!", "success");
        } catch(e) { toast("Erro ao conectar.", "error"); setIsOnline(!isOnline); } finally { setLoadingMsg(''); }
    };

    const aceitarOferta = async () => {
        if (!ofertaLeilao || !piloto) return;
        setLoadingMsg('Garantindo a corrida...');
        clearInterval(timerRef.current); audioAlarmeRef.current?.stop();
        try {
            await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { status: 'A_CAMINHO_LOJA', entregadorId: piloto.id, nomeEntregador: piloto.nome, horarioAceite: serverTimestamp() });
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Em Rota' });
            setOfertaLeilao(null); setAbaAtiva('HOME'); UTILS.vibrar('heavy'); toast("Corrida confirmada!", "success");
        } catch(e) { toast("Outro piloto aceitou primeiro.", "error"); setOfertaLeilao(null); } finally { setLoadingMsg(''); }
    };

    const recusarOferta = async () => {
        if (!ofertaLeilao || !piloto) return;
        audioAlarmeRef.current?.stop(); clearInterval(timerRef.current);
        try { await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { entregadoresRecusaram: arrayUnion(piloto.id) }); } catch(e) {}
        setOfertaLeilao(null);
    };

    const atualizarPassoPedido = async (novoStatus) => {
        if (!pedidoAtivo) return;
        setLoadingMsg('Sincronizando...');
        try { await updateDoc(doc(db, "pedidos", pedidoAtivo.id), { status: novoStatus, statusAtualizadoEm: serverTimestamp() }); UTILS.vibrar('light'); } 
        catch(e) { toast("Erro de conexão.", "error"); } finally { setLoadingMsg(''); }
    };

    const tentarFinalizar = async () => {
        if (!pedidoAtivo) return;
        const exigeCodigo = pedidoAtivo.regras?.exigirCodigo;
        const exigeFoto = pedidoAtivo.regras?.exigirFoto;

        if (exigeCodigo) {
            const codigoCorreto = pedidoAtivo.codigoConfirmacao || pedidoAtivo.cliente?.telefone?.slice(-4);
            if (codigoInput !== String(codigoCorreto)) return toast("Código incorreto!", "error");
        }
        if (exigeFoto) { cameraInputRef.current.click(); } 
        else { concluirEntregaDB(null); }
    };

    const processarFotoFinalizacao = async (e) => {
        const file = e.target.files[0];
        if (!file || !pedidoAtivo || !piloto) return;
        setLoadingMsg('Enviando foto...');
        try {
            const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
            const json = await res.json();
            await concluirEntregaDB(json.secure_url);
            if(e.target) e.target.value = null;
        } catch (err) { toast("Falha no envio.", "error"); setLoadingMsg(''); }
    };

    const concluirEntregaDB = async (fotoUrl) => {
        setLoadingMsg('Finalizando e calculando ganhos...');
        const taxa = parseFloat(pedidoAtivo.taxaEntrega || pedidoAtivo.valores?.taxa || 0);
        await updateDoc(doc(db, "pedidos", pedidoAtivo.id), { status: 'CONCLUIDO', horarioConclusao: serverTimestamp(), ...(fotoUrl && { provaEntregaUrl: fotoUrl }) });
        await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Livre', ganhosTaxas: increment(taxa), totalEntregas: increment(1) });
        setCodigoInput(''); setTelaCorridaAtiva(false); UTILS.vibrar('heavy'); toast("Corrida Finalizada!", "success"); setLoadingMsg('');
    };

    const deslogar = () => { auth.signOut().catch(()=>{}); localStorage.removeItem('@UP:cpf'); setCpfLogado(null); setPiloto(null); setSecao('INTRO'); };

    // ========================================================================
    // RENDERIZAÇÃO
    // ========================================================================
    if (secao === 'LOADING') return <div className={`h-[100dvh] w-full ${theme.bgApp} flex items-center justify-center`}><Lucide.Loader2 size={40} className={`animate-spin ${theme.accentPurple}`}/></div>;

    if (secao === 'INTRO') {
        const inputClass = `w-full h-14 rounded-2xl ${theme.inputBg} border ${theme.border} px-5 ${theme.textBase} outline-none focus:border-purple-500 transition-colors`;
        return (
            <div className={`min-h-[100dvh] flex flex-col font-sans ${theme.bgApp} ${theme.textBase} p-8 relative`}>
                <AnimatePresence>{loadingMsg && <LoaderGlobal msg={loadingMsg} theme={theme}/>}</AnimatePresence>
                <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                    <div className="mb-10 text-center">
                        <div className={`w-24 h-24 ${theme.card} rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl border ${theme.border}`}><Lucide.Bike size={48} className={theme.accentPurple}/></div>
                        <h1 className="text-5xl font-black italic tracking-tighter">UP! <span className={theme.accentGreen}>Piloto</span></h1>
                        <p className={`${theme.textMuted} text-[10px] font-bold uppercase tracking-[0.3em] mt-2`}>Acesso Restrito</p>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4">
                        {!isLoginModo && <input type="text" placeholder="Nome Completo" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className={inputClass} required />}
                        <input type="tel" placeholder="CPF" value={UTILS.mascararCPF(form.cpf)} onChange={e=>setForm({...form, cpf: e.target.value})} maxLength={14} className={inputClass} required />
                        {!isLoginModo && <input type="tel" placeholder="WhatsApp" value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} className={inputClass} required />}
                        <input type="password" placeholder="Senha" value={form.senha} onChange={e=>setForm({...form, senha: e.target.value})} className={inputClass} required />
                        {!isLoginModo && <input type="text" placeholder="Placa da Moto" value={form.placa} onChange={e=>setForm({...form, placa: e.target.value.toUpperCase()})} className={`${inputClass} uppercase`} />}
                        
                        <button type="submit" className={`w-full h-16 mt-4 rounded-2xl font-black uppercase tracking-widest text-sm ${config.darkMode ? 'text-black bg-[#a3e635]' : 'text-white bg-purple-600'} active:scale-95 transition-all`}>
                            {isLoginModo ? 'Acessar Radar' : 'Enviar Cadastro'}
                        </button>
                    </form>
                    <button onClick={() => setIsLoginModo(!isLoginModo)} className={`mt-8 ${theme.textMuted} font-bold text-xs uppercase tracking-widest w-full hover:${theme.textBase} transition-colors`}>{isLoginModo ? 'Quero me cadastrar' : 'Já sou piloto'}</button>
                </div>
            </div>
        );
    }

    if (piloto && piloto.statusAprovacao !== 'APROVADO') return (
        <div className={`h-[100dvh] ${theme.bgApp} ${theme.textBase} flex flex-col items-center justify-center p-8 text-center`}>
            <div className="w-32 h-32 rounded-full bg-orange-500/10 flex items-center justify-center mb-6"><Lucide.Clock size={64} className="text-orange-500 animate-pulse"/></div>
            <h2 className="text-3xl font-black uppercase italic mb-3">Em Análise</h2>
            <p className={`${theme.textMuted} text-sm font-medium mb-10 px-4`}>Sua documentação está sendo analisada pela nossa equipe. Retorne em breve.</p>
            <button onClick={deslogar} className={`w-full max-w-xs h-16 ${theme.card} rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/30 text-red-500 active:scale-95`}>Desconectar</button>
        </div>
    );

    return (
        <div className={`h-[100dvh] w-full font-sans ${theme.bgApp} ${theme.textBase} overflow-hidden relative transition-colors duration-300`}>
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={processarFotoFinalizacao} className="hidden" />
            <AnimatePresence>{loadingMsg && <LoaderGlobal msg={loadingMsg} theme={theme} />}</AnimatePresence>

            {/* --- MODAL FULLSCREEN: NOVA OFERTA (LEILÃO) --- */}
            <AnimatePresence>
                {ofertaLeilao && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className={`fixed inset-0 z-[9999] ${config.darkMode ? 'bg-[#09090b]' : 'bg-[#f8fafc]'} text-white flex flex-col p-6`}>
                        <div className={`flex-1 flex flex-col items-center justify-center text-center mt-10 ${!config.darkMode && 'text-gray-900'}`}>
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-28 h-28 bg-[#a3e635] rounded-[2rem] flex items-center justify-center mb-8 border-4 border-transparent shadow-[0_0_50px_rgba(163,230,53,0.5)]">
                                <Lucide.Bike size={56} className="text-[#09090b]" />
                            </motion.div>
                            
                            <h2 className="text-4xl font-black italic tracking-tighter mb-2">NOVA CORRIDA</h2>
                            <p className="text-[#a3e635] text-6xl font-black tracking-tighter mb-4 drop-shadow-lg">{UTILS.formatarMoeda(ofertaLeilao.taxaEntrega || ofertaLeilao.valores?.taxa)}</p>
                            
                            {ofertaLeilao.isRotaDupla && (
                                <div className="bg-blue-500/20 border border-blue-500/50 px-4 py-2 rounded-xl mb-6 text-blue-400 font-black text-[10px] uppercase flex items-center justify-center gap-2">
                                    <Lucide.Waypoints size={16}/> Rota de Aproximação (Dupla)
                                </div>
                            )}

                            <div className="flex justify-center gap-10 mb-8 w-full px-4">
                                <div className="text-center"><p className={`text-[10px] font-black uppercase ${config.darkMode ? 'text-gray-500' : 'text-gray-400'} mb-1`}>Distância</p><p className="text-xl font-black">{UTILS.calcularDistancia(LOJA_COORDS[0], LOJA_COORDS[1], ofertaLeilao.endereco?.lat, ofertaLeilao.endereco?.lng)} km</p></div>
                                <div className={`w-[2px] ${config.darkMode ? 'bg-white/10' : 'bg-black/10'} rounded-full`} />
                                <div className="text-center"><p className={`text-[10px] font-black uppercase ${config.darkMode ? 'text-gray-500' : 'text-gray-400'} mb-1`}>Expira Em</p><p className={`text-xl font-black ${tempoExpiracao < 15 ? 'text-red-500 animate-pulse' : ''}`}>00:{tempoExpiracao.toString().padStart(2, '0')}</p></div>
                            </div>

                            <button onClick={() => setDetalhesRotaAbertos(!detalhesRotaAbertos)} className={`px-6 py-3 rounded-full ${config.darkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-black/5 border-black/10 text-gray-700'} border text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2 mx-auto`}>
                                <Lucide.Map size={16}/> {detalhesRotaAbertos ? "Ocultar" : "Ver Rota / Regras"}
                            </button>

                            <AnimatePresence>
                                {detalhesRotaAbertos && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`w-full max-w-sm mx-auto ${config.darkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'} rounded-3xl p-4 border overflow-hidden text-left mb-4 shadow-xl`}>
                                        <div className="w-full h-32 bg-gray-900 rounded-2xl mb-4 overflow-hidden relative"><MiniMapPrint pedido={ofertaLeilao} isDark={config.darkMode} /></div>
                                        <div className="space-y-3">
                                            <div><p className={`text-[9px] font-black uppercase ${theme.accentPurple}`}>Coleta</p><p className="text-xs font-bold truncate">Base Central UP!</p></div>
                                            <div><p className={`text-[9px] font-black uppercase ${theme.accentGreen}`}>Entrega</p><p className="text-xs font-bold truncate">{ofertaLeilao.endereco?.rua}, {ofertaLeilao.endereco?.numero}</p><p className={`text-[10px] ${theme.textMuted}`}>{ofertaLeilao.endereco?.bairro}</p></div>
                                            
                                            <div className={`pt-2 border-t ${theme.border} flex flex-wrap gap-2`}>
                                                {ofertaLeilao.tags?.includes('PIZZA') && <span className="bg-orange-500/20 text-orange-500 text-[8px] font-black px-2 py-1 rounded-md uppercase border border-orange-500/30">Leva Pizza</span>}
                                                {ofertaLeilao.regras?.exigirFoto && <span className="bg-gray-500/20 text-gray-500 text-[8px] font-black px-2 py-1 rounded-md uppercase border border-gray-500/30">Exige Foto</span>}
                                                {ofertaLeilao.regras?.exigirCodigo && <span className="bg-gray-500/20 text-gray-500 text-[8px] font-black px-2 py-1 rounded-md uppercase border border-gray-500/30">Exige Código</span>}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className={`flex gap-4 pb-8 pt-4 bg-gradient-to-t ${config.darkMode ? 'from-[#09090b]' : 'from-[#f8fafc]'} to-transparent`}>
                            <button onClick={recusarOferta} className={`flex-1 h-20 ${config.darkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-black/5 border-black/10 text-gray-600'} border rounded-[2rem] font-black uppercase text-xs active:bg-red-500/20 active:text-red-500 transition-all flex flex-col items-center justify-center gap-1`}><Lucide.X size={24}/> Recusar</button>
                            <button onClick={aceitarOferta} className="flex-[2] h-20 bg-[#a3e635] text-[#09090b] rounded-[2rem] font-black uppercase text-sm shadow-[0_15px_40px_rgba(163,230,53,0.3)] active:scale-95 transition-all flex flex-col items-center justify-center gap-1"><Lucide.CheckCircle size={28}/> Aceitar</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- MODAL TELA CHEIA: CORRIDA EM ANDAMENTO --- */}
            <AnimatePresence>
                {telaCorridaAtiva && pedidoAtivo && (
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ damping: 25, stiffness: 200 }} className={`fixed inset-0 z-[8000] ${theme.bgApp} ${theme.textBase} overflow-y-auto pb-10`}>
                        <div className={`sticky top-0 ${theme.bgApp} bg-opacity-90 backdrop-blur-md p-6 flex justify-between items-center border-b ${theme.border} z-10`}>
                            <div><p className={`text-[10px] font-black uppercase ${theme.textMuted}`}>Rota Ativa</p><p className="font-black">#{pedidoAtivo.id.slice(-4)}</p></div>
                            <button onClick={() => setTelaCorridaAtiva(false)} className={`w-12 h-12 ${theme.inputBg} rounded-full flex items-center justify-center`}><Lucide.ChevronDown size={28}/></button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* ALERTAS */}
                            {pedidoAtivo.tags?.includes('PIZZA') && (
                                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl flex items-center gap-3 text-orange-500">
                                    <Lucide.Pizza size={24} className="shrink-0"/><div className="pt-1"><p className="text-[10px] font-black uppercase leading-tight">Cuidado Redobrado</p><p className="text-xs font-bold leading-tight">Contém Pizza. Mantenha na horizontal.</p></div>
                                </div>
                            )}
                            {pedidoAtivo.isRotaDupla && (
                                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl flex items-center gap-3 text-blue-500">
                                    <Lucide.Waypoints size={24} className="shrink-0"/><div className="pt-1"><p className="text-[10px] font-black uppercase leading-tight">Rota Agrupada</p><p className="text-xs font-bold leading-tight">Siga a ordem lógica na bag.</p></div>
                                </div>
                            )}

                            {/* DESTINO CARD */}
                            <div className={`${theme.card} p-5 rounded-3xl border ${theme.border}`}>
                                <div className="flex gap-4 items-start mb-4">
                                    <div className={`w-12 h-12 rounded-2xl ${theme.inputBg} flex items-center justify-center ${theme.accentPurple} shrink-0`}><Lucide.MapPin size={24}/></div>
                                    <div className="pt-1">
                                        <p className={`text-[9px] ${theme.textMuted} font-black uppercase tracking-widest mb-1`}>Destino</p>
                                        <h3 className="font-black text-sm leading-tight">{pedidoAtivo.endereco?.rua}, {pedidoAtivo.endereco?.numero}</h3>
                                        <p className={`text-[11px] ${theme.textMuted} font-medium mt-1`}>{pedidoAtivo.endereco?.bairro}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => UTILS.abrirWaze(pedidoAtivo.endereco?.lat, pedidoAtivo.endereco?.lng)} className={`h-12 ${theme.inputBg} rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 active:scale-95`}><Lucide.Navigation size={16}/> GPS Waze</button>
                                    <button onClick={() => UTILS.abrirZap(pedidoAtivo.cliente?.telefone, pedidoAtivo.cliente?.nome)} className={`h-12 ${theme.inputBg} rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 text-green-500 active:scale-95`}><Lucide.MessageCircle size={16}/> Chat Cliente</button>
                                </div>
                            </div>

                            {/* ITENS E FINANCEIRO */}
                            <div className="flex gap-3">
                                <div className={`flex-[2] ${theme.card} p-4 rounded-3xl border ${theme.border}`}>
                                    <p className={`text-[9px] ${theme.textMuted} font-black uppercase mb-3`}>Conferência ({pedidoAtivo.itens?.length || 0})</p>
                                    <div className="space-y-2">
                                        {pedidoAtivo.itens?.map((i, idx) => (
                                            <p key={idx} className={`text-xs font-bold truncate ${theme.textBase}`}><span className={`${theme.accentGreen} mr-1`}>{i.qtd}x</span> {i.nome}</p>
                                        ))}
                                    </div>
                                </div>
                                <div className={`flex-1 ${theme.card} p-4 rounded-3xl border ${theme.border} text-center flex flex-col justify-center`}>
                                    <p className={`text-[9px] ${theme.textMuted} font-black uppercase mb-1`}>Pagamento</p>
                                    <p className={`text-[10px] font-black uppercase ${theme.textBase} mb-2`}>{pedidoAtivo.pagamento?.metodo || 'Online'}</p>
                                    {pedidoAtivo.pagamento?.metodo?.toUpperCase().includes('ENTREGA') && <p className="text-xs font-black text-red-500 bg-red-500/10 py-1 rounded-lg border border-red-500/20">{UTILS.formatarMoeda(pedidoAtivo.valores?.total)}</p>}
                                </div>
                            </div>

                            {/* FLUXO DE BOTÕES E VALIDAÇÃO */}
                            <div className={`pt-6 border-t ${theme.border}`}>
                                <h3 className={`font-black uppercase text-[10px] ${theme.textMuted} text-center mb-4 tracking-[0.2em]`}>{pedidoAtivo.status.replace(/_/g, ' ')}</h3>
                                
                                {pedidoAtivo.status === 'A_CAMINHO_LOJA' && <button onClick={() => atualizarPassoPedido('AGUARDANDO_COLETA')} className={`w-full h-16 ${theme.bgPurple} text-white rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95 transition-transform`}>Cheguei na Base</button>}
                                {pedidoAtivo.status === 'AGUARDANDO_COLETA' && <button onClick={() => atualizarPassoPedido('SAIU_ENTREGA')} className={`w-full h-16 ${theme.bgPurple} text-white rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2`}><Lucide.PackageCheck size={20}/> Peguei o Pedido</button>}
                                {pedidoAtivo.status === 'SAIU_ENTREGA' && <button onClick={() => atualizarPassoPedido('ENTREGADOR_NO_LOCAL')} className={`w-full h-16 ${theme.bgPurple} text-white rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95 transition-transform`}>Cheguei no Destino</button>}
                                
                                {pedidoAtivo.status === 'ENTREGADOR_NO_LOCAL' && (
                                    <div className="space-y-4">
                                        {pedidoAtivo.regras?.exigirCodigo && (
                                            <div className={`${theme.inputBg} p-5 rounded-2xl border ${theme.border} text-center shadow-inner`}>
                                                <p className={`text-[10px] font-black uppercase ${theme.textMuted} mb-3`}>Informe o Código do Cliente</p>
                                                <input type="number" placeholder="0000" maxLength={4} value={codigoInput} onChange={e=>setCodigoInput(e.target.value)} className={`w-full h-16 bg-transparent text-center text-3xl font-black tracking-[0.5em] rounded-xl outline-none focus:border-[#a3e635] border ${theme.border} transition-colors ${theme.textBase}`} />
                                            </div>
                                        )}
                                        <button onClick={tentarFinalizar} className={`w-full h-16 ${theme.bgGreen} text-[#09090b] rounded-2xl font-black uppercase text-sm shadow-[0_10px_30px_rgba(163,230,53,0.3)] flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
                                            {pedidoAtivo.regras?.exigirFoto ? <><Lucide.Camera size={20}/> Tirar Foto e Concluir</> : <><Lucide.CheckCircle size={20}/> Concluir Entrega</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- NAVEGAÇÃO PRINCIPAL (MAIN) --- */}
            <main className="h-full overflow-y-auto pb-32 hide-scrollbar">
                
                {/* ABA 1: HOME (RADAR & MINI-CARD) */}
                {abaAtiva === 'HOME' && (
                    <div className="p-6 pt-12">
                        <header className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black italic tracking-tighter">RADAR</h2>
                            <button onClick={alternarStatusGps} className={`w-16 h-8 rounded-full p-1 transition-colors shadow-inner flex items-center ${isOnline ? theme.bgGreen : (config.darkMode ? 'bg-gray-800' : 'bg-gray-300')}`}>
                                <motion.layout className={`w-6 h-6 bg-white rounded-full shadow-md ${isOnline ? 'ml-8' : 'ml-0'}`}/>
                            </button>
                        </header>

                        {pedidoAtivo ? (
                            <div className="space-y-3">
                                <p className={`text-[10px] font-black uppercase ${theme.textMuted} tracking-widest`}>Corrida em Andamento</p>
                                <div onClick={() => setTelaCorridaAtiva(true)} className={`${theme.card} p-5 rounded-[2rem] border border-purple-500/40 shadow-[0_10px_30px_rgba(168,85,247,0.1)] cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden`}>
                                    <div className="absolute top-0 left-0 w-2 h-full bg-purple-500" />
                                    <div className="flex justify-between items-start mb-4 pl-2">
                                        <div><p className={`text-[9px] font-black uppercase ${theme.accentPurple} mb-1`}>{pedidoAtivo.status.replace(/_/g, ' ')}</p><h3 className="font-black text-base">{pedidoAtivo.endereco?.bairro}</h3></div>
                                        <div className={`w-10 h-10 rounded-full ${theme.inputBg} flex items-center justify-center ${theme.textBase}`}><Lucide.ArrowRight size={20}/></div>
                                    </div>
                                    <div className="flex gap-2 pl-2 flex-wrap">
                                        {pedidoAtivo.tags?.includes('PIZZA') && <span className="bg-orange-500/20 text-orange-500 text-[8px] font-black px-2 py-1 rounded-md uppercase border border-orange-500/30">Pizza</span>}
                                        {pedidoAtivo.isRotaDupla && <span className="bg-blue-500/20 text-blue-500 text-[8px] font-black px-2 py-1 rounded-md uppercase border border-blue-500/30">Aproximação</span>}
                                        {pedidoAtivo.regras?.exigirFoto && <span className={`${theme.inputBg} ${theme.textMuted} text-[8px] font-black px-2 py-1 rounded-md uppercase border ${theme.border}`}>Cód/Foto</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-24 flex flex-col items-center">
                                {isOnline ? (
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <div className={`absolute inset-0 rounded-full border-2 ${theme.border} opacity-20`} />
                                        <div className={`absolute inset-4 rounded-full border-2 border-dashed ${theme.border} opacity-30`} />
                                        <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent 70%, rgba(168, 85, 247, 0.4) 100%)`, animation: 'sweep 3s linear infinite' }} />
                                        <Lucide.Radar size={48} className={`${theme.accentPurple} z-10 animate-pulse`}/>
                                        <style>{`@keyframes sweep { to { transform: rotate(360deg); } }`}</style>
                                    </div>
                                ) : (
                                    <div className="w-32 h-32 rounded-full border-4 border-dashed border-gray-500/30 flex items-center justify-center mb-6"><Lucide.Moon size={48} className="text-gray-500/50"/></div>
                                )}
                                <p className={`font-black uppercase text-[10px] tracking-[0.3em] mt-6 ${theme.textMuted}`}>{isOnline ? 'Rastreando Região...' : 'Sistema Pausado'}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ABA 2: CARTEIRA */}
                {abaAtiva === 'CARTEIRA' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6 pt-12 space-y-6">
                        <h2 className="text-3xl font-black italic tracking-tighter">FINANÇAS</h2>
                        
                        <div className={`${theme.card} p-8 rounded-[2.5rem] border ${theme.border} relative overflow-hidden shadow-xl`}>
                            <div className={`absolute -right-4 -top-4 p-4 opacity-10 ${theme.accentPurple}`}><Lucide.Wallet size={120}/></div>
                            <p className={`text-[10px] ${theme.textMuted} font-black uppercase tracking-widest mb-2`}>Saldo de Taxas (Hoje)</p>
                            <h3 className={`text-5xl font-black ${theme.accentGreen} tracking-tighter`}>{UTILS.formatarMoeda(piloto?.ganhosTaxas)}</h3>
                            
                            <div className="mt-8 flex gap-3">
                                <div className={`flex-1 ${theme.inputBg} p-4 rounded-2xl text-center border ${theme.border}`}><p className={`text-[8px] ${theme.textMuted} font-black uppercase tracking-widest mb-1`}>Entregas</p><p className="font-black text-lg">{piloto?.totalEntregas || 0}</p></div>
                                <div className={`flex-1 ${theme.inputBg} p-4 rounded-2xl text-center border ${theme.border}`}><p className={`text-[8px] ${theme.textMuted} font-black uppercase tracking-widest mb-1`}>Avaliação</p><p className="font-black text-lg text-yellow-500 flex items-center justify-center gap-1"><Lucide.Star size={14} className="fill-current"/> 5.0</p></div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className={`text-[10px] font-black uppercase ${theme.textMuted} tracking-[0.2em] px-2`}>Histórico (Últimas 10)</h4>
                            {historico.length > 0 ? historico.map(h => (
                                <div key={h.id} className={`${theme.card} p-4 rounded-2xl border ${theme.border} flex justify-between items-center`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20`}><Lucide.CheckCircle2 size={24}/></div>
                                        <div><p className={`text-xs font-black uppercase ${theme.textBase}`}>#{h.id.slice(-4)}</p><p className={`text-[10px] ${theme.textMuted}`}>{h.endereco?.bairro || 'Entrega Concluída'}</p></div>
                                    </div>
                                    <div className="text-right"><p className={`text-sm font-black ${theme.accentGreen}`}>+{UTILS.formatarMoeda(h.taxaEntrega || h.valores?.taxa)}</p><p className={`text-[8px] uppercase font-bold ${theme.textMuted} mt-1`}>Concluído</p></div>
                                </div>
                            )) : (
                                <div className={`${theme.card} p-10 rounded-3xl border ${theme.border} text-center flex flex-col items-center justify-center`}><Lucide.History size={40} className={`${theme.textMuted} mb-4 opacity-50`}/><p className={`text-xs font-bold uppercase ${theme.textMuted}`}>Nenhuma entrega no histórico</p></div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ABA 3: PERFIL */}
                {abaAtiva === 'PERFIL' && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-6 pt-12 space-y-6">
                        <h2 className="text-3xl font-black italic tracking-tighter">AJUSTES</h2>
                        
                        <div className={`${theme.card} p-6 rounded-[2.5rem] border ${theme.border} shadow-lg`}>
                            <div className={`flex items-center gap-5 border-b ${theme.border} pb-6 mb-6`}>
                                <div className={`w-20 h-20 rounded-full ${theme.inputBg} border-2 ${theme.border} flex items-center justify-center font-black text-3xl ${theme.accentPurple} shadow-inner`}>{piloto?.nome?.charAt(0)}</div>
                                <div className="flex-1"><h3 className="font-black text-xl leading-tight mb-1">{piloto?.nome}</h3><p className={`text-[10px] ${theme.textMuted} font-black uppercase tracking-widest bg-black/10 inline-block px-3 py-1 rounded-full`}>{piloto?.modalidade || 'MOTO'} • {piloto?.placa || 'S/ PLACA'}</p></div>
                            </div>
                            <div className="space-y-4 px-2">
                                <div className="flex justify-between items-center text-xs"><span className={`font-bold uppercase text-[9px] ${theme.textMuted} tracking-widest`}>CPF</span><span className="font-black tracking-widest">{UTILS.mascararCPF(piloto?.cpf)}</span></div>
                                <div className="flex justify-between items-center text-xs"><span className={`font-bold uppercase text-[9px] ${theme.textMuted} tracking-widest`}>Telefone</span><span className="font-black">{piloto?.telefone || 'Não informado'}</span></div>
                            </div>
                        </div>

                        <div className={`${theme.card} rounded-[2rem] border ${theme.border} overflow-hidden shadow-lg`}>
                            <div className={`p-5 ${theme.inputBg} border-b ${theme.border} font-black text-[9px] uppercase ${theme.textMuted} tracking-[0.2em]`}>Preferências do App</div>
                            <div className="p-6 space-y-8">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl ${theme.inputBg} flex items-center justify-center ${theme.textBase}`}><Lucide.Moon size={20}/></div><div><p className="text-xs font-black uppercase">Modo Escuro</p><p className={`text-[9px] ${theme.textMuted} font-bold`}>Aparência do sistema</p></div></div>
                                    <button onClick={() => setConfig({...config, darkMode: !config.darkMode})} className={`w-14 h-8 rounded-full p-1 transition-colors ${config.darkMode ? theme.bgPurple : 'bg-gray-300'}`}><div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${config.darkMode ? 'ml-6' : 'ml-0'}`}/></button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl ${theme.inputBg} flex items-center justify-center ${theme.textBase}`}><Lucide.Volume2 size={20}/></div><div><p className="text-xs font-black uppercase">Volume do Alerta</p><p className={`text-[9px] ${theme.textMuted} font-bold`}>Toque de nova corrida</p></div></div>
                                    <input type="range" min="0" max="1" step="0.1" value={config.volume} onChange={e=>setConfig({...config, volume:parseFloat(e.target.value)})} className={`w-24 accent-purple-500 h-2 bg-black/20 rounded-lg appearance-none cursor-pointer`} />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl ${theme.inputBg} flex items-center justify-center ${theme.textBase}`}><Lucide.Crosshair size={20}/></div><div><p className="text-xs font-black uppercase">GPS Alta Precisão</p><p className={`text-[9px] ${theme.textMuted} font-bold`}>Consome mais bateria</p></div></div>
                                    <button onClick={() => setConfig({...config, gpsAltaPrecisao: !config.gpsAltaPrecisao})} className={`w-14 h-8 rounded-full p-1 transition-colors ${config.gpsAltaPrecisao ? theme.bgGreen : 'bg-gray-300'}`}><div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${config.gpsAltaPrecisao ? 'ml-6' : 'ml-0'}`}/></button>
                                </div>
                                <div className={`pt-6 border-t ${theme.border} flex justify-between items-center`}><span className={`text-[10px] font-black uppercase ${theme.textMuted} tracking-widest`}>Versão do App</span><span className="text-[10px] font-black">{APP_VERSION}</span></div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => UTILS.abrirZap('5567999999999', 'Suporte Central')} className={`flex-1 h-16 ${theme.card} border ${theme.border} rounded-2xl flex flex-col items-center justify-center gap-1 font-black uppercase text-[10px] ${theme.accentPurple} shadow-sm active:scale-95 transition-transform`}><Lucide.Headphones size={20}/> Suporte</button>
                            <button onClick={deslogar} className={`flex-1 h-16 ${theme.card} border border-red-500/20 rounded-2xl flex flex-col items-center justify-center gap-1 font-black uppercase text-[10px] text-red-500 shadow-sm active:scale-95 transition-transform`}><Lucide.LogOut size={20}/> Desconectar</button>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* --- NAV BAR INFERIOR --- */}
            <nav className={`fixed bottom-6 left-6 right-6 h-20 ${theme.card} border ${theme.border} rounded-[2.5rem] flex items-center justify-around px-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[100] backdrop-blur-2xl bg-opacity-95`}>
                {[ 
                    { id: 'HOME', icon: Lucide.Radar, label: 'Radar' }, 
                    { id: 'CARTEIRA', icon: Lucide.Wallet, label: 'Finanças' }, 
                    { id: 'PERFIL', icon: Lucide.Settings2, label: 'Ajustes' } 
                ].map(i => {
                    const ativo = abaAtiva === i.id;
                    return (
                        <button key={i.id} onClick={() => setAbaAtiva(i.id)} className={`relative flex flex-col items-center justify-center w-20 h-full transition-all duration-300 ${ativo ? theme.accentGreen : theme.textMuted}`}>
                            <motion.div animate={{ y: ativo ? -5 : 0 }} className="flex flex-col items-center gap-1.5 z-10"><i.icon size={24} strokeWidth={ativo ? 2.5 : 2}/><span className="text-[8px] font-black uppercase tracking-tighter">{i.label}</span></motion.div>
                            {ativo && <motion.div layoutId="nav-indicator" className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${theme.bgGreen}`} />}
                        </button>
                    )
                })}
            </nav>
        </div>
    );
};

export default function AppEntregadorWrapper() {
    return <ToastProvider><UpEntregasApp /></ToastProvider>;
}