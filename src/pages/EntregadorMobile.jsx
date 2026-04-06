import React, { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react';
import { db, auth } from '../services/firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, serverTimestamp, increment, addDoc, arrayUnion } from "firebase/firestore";
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
// 1. CONFIGURAÇÕES GERAIS E ASSETS
// ========================================================================
const IMG_WELCOME = "https://res.cloudinary.com/dbd9x1o02/image/upload/v1775159380/rodrigues_geral/fjm4ioufyglqbmmy2gn5.png";
const SOUND_ALARM = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const LOJA_COORDS = { lat: -20.4697, lng: -54.6201 }; 
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbd9x1o02/image/upload";
const UPLOAD_PRESET = "fc3i8urq";

// Mapas Temáticos
const MAPA_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MAPA_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

// Ícones do Mapa
const iconLoja = new L.DivIcon({ className: 's-icon', html: `<div class="w-10 h-10 bg-[#4B0082] rounded-xl border-2 border-[#82C91E] flex items-center justify-center shadow-lg"><div class="w-3 h-3 bg-[#82C91E] rounded-full animate-pulse"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const iconEntrega = new L.DivIcon({ className: 'e-icon', html: `<div class="w-10 h-10 bg-[#EA1D2C] rounded-xl border-2 border-white flex items-center justify-center shadow-[0_0_15px_rgba(234,29,44,0.6)] animate-pulse"><div class="w-3 h-3 bg-white rounded-full"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const iconMoto = new L.DivIcon({ className: 'm-icon', html: `<div class="w-12 h-12 bg-[#82C91E] rounded-full border-4 border-white shadow-xl flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B0082" stroke-width="3"><path d="M12 2a9 9 0 0 0-9 9v3.5a2.5 2.5 0 0 0 2.5 2.5h13a2.5 2.5 0 0 0 2.5-2.5V11a9 9 0 0 0-9-9Z"/><path d="M8.5 17v-4a3.5 3.5 0 0 1 7 0v4"/></svg></div>`, iconSize: [48, 48], iconAnchor: [24, 48] });

// ========================================================================
// 2. SISTEMA DE TEMAS E NOTIFICAÇÕES TÁTEIS
// ========================================================================
const ThemeContext = createContext(null);
const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const AppProviders = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('piloto_theme');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => { localStorage.setItem('piloto_theme', JSON.stringify(isDark)); }, [isDark]);

    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, msg, type }]);
        try { Haptics.impact({ style: ImpactStyle.Medium }); } catch(e){} // Vibração Nativa
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const theme = {
        isDark, toggle: () => setIsDark(!isDark),
        bg: isDark ? 'bg-[#0a0a0a]' : 'bg-[#F4F6F8]',
        card: isDark ? 'bg-[#141414]' : 'bg-white',
        text: isDark ? 'text-white' : 'text-slate-900',
        textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
        border: isDark ? 'border-white/10' : 'border-slate-200',
        input: isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30' : 'bg-slate-50 border-slate-200 text-[#4B0082] placeholder:text-slate-400',
        mapStyle: isDark ? MAPA_DARK : MAPA_LIGHT
    };

    return (
        <ThemeContext.Provider value={theme}>
            <ToastContext.Provider value={addToast}>
                <div className={`${theme.bg} ${theme.text} min-h-[100dvh] transition-colors duration-500 font-sans`}>
                    {children}
                    <div className="fixed top-safe pt-4 left-0 right-0 z-[99999] flex flex-col items-center gap-3 pointer-events-none px-4">
                        <AnimatePresence>
                            {toasts.map(t => (
                                <motion.div key={t.id} initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -50, scale: 0.9 }}
                                    className={`w-full max-w-sm p-4 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-black uppercase tracking-wide border-b-4 
                                    ${t.type === 'error' ? 'bg-[#EA1D2C] text-white border-red-900' : t.type === 'success' ? 'bg-[#82C91E] text-[#4B0082] border-green-700' : isDark ? 'bg-slate-800 text-white border-slate-950' : 'bg-white text-slate-800 border-slate-200'}`}>
                                    {t.type === 'error' ? <Lucide.AlertTriangle size={24}/> : t.type === 'success' ? <Lucide.CheckCircle size={24}/> : <Lucide.Info size={24}/>}
                                    <div className="flex-1 leading-tight">{t.msg}</div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </ToastContext.Provider>
        </ThemeContext.Provider>
    );
};

// ========================================================================
// 3. COMPONENTE MAPA DINÂMICO (OSRM ROUTING)
// ========================================================================
function MapUpdater({ bounds }) {
    const map = useMap();
    useEffect(() => { if (bounds?.length > 0) map.fitBounds(bounds, { padding: [50, 50], animate: true }); }, [bounds, map]);
    return null;
}

const LiveMapDriver = ({ pedido, myLocation }) => {
    const theme = useContext(ThemeContext);
    const [rota, setRota] = useState([]);
    const destLat = pedido?.endereco?.lat;
    const destLng = pedido?.endereco?.lng;

    useEffect(() => {
        if (!myLocation || !destLat) return;
        const fetchRoute = async () => {
            try {
                const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${myLocation.lng},${myLocation.lat};${destLng},${destLat}?overview=full&geometries=geojson`);
                const data = await res.json();
                if (data.routes?.[0]) setRota(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
            } catch (e) {}
        };
        fetchRoute();
    }, [myLocation?.lat, myLocation?.lng, destLat, destLng]);

    const bounds = myLocation && destLat ? [[myLocation.lat, myLocation.lng], [destLat, destLng]] : [];

    return (
        <MapContainer center={[LOJA_COORDS.lat, LOJA_COORDS.lng]} zoom={15} zoomControl={false} className={`w-full h-full z-0 ${theme.isDark ? 'bg-[#0a0a0a]' : 'bg-[#e5e5e5]'}`}>
            <TileLayer url={theme.mapStyle} />
            <Marker position={[LOJA_COORDS.lat, LOJA_COORDS.lng]} icon={iconLoja} />
            {destLat && <Marker position={[destLat, destLng]} icon={iconEntrega} />}
            {myLocation && <Marker position={[myLocation.lat, myLocation.lng]} icon={iconMoto} />}
            {rota.length > 0 && <Polyline positions={rota} color="#82C91E" weight={6} opacity={0.8} dashArray="10, 10" />}
            <MapUpdater bounds={bounds} />
        </MapContainer>
    );
};

// ========================================================================
// 4. APLICAÇÃO PRINCIPAL (APP ENTREGADOR)
// ========================================================================
const PilotoApp = () => {
    const theme = useContext(ThemeContext);
    const toast = useToast();
    
    // Auth & Navigation States
    const [secao, setSecao] = useState('LOADING'); // LOADING | INTRO | APP
    const [abaAtiva, setAbaAtiva] = useState('RADAR'); 
    const [loadingMsg, setLoadingMsg] = useState('');
    const [isLoginModo, setIsLoginModo] = useState(true);
    
    // Form & User
    const [form, setForm] = useState({ email: '', senha: '', nome: '', veiculo: '', placa: '', telefone: '' });
    const [piloto, setPiloto] = useState(null);
    
    // Operacional
    const [isOnline, setIsOnline] = useState(false);
    const [myLocation, setMyLocation] = useState(null);
    const [ofertaLeilao, setOfertaLeilao] = useState(null);
    const [pedidoAtivo, setPedidoAtivo] = useState(null);
    const [historico, setHistorico] = useState([]);
    
    // Controles UI
    const [tokenInput, setTokenInput] = useState("");
    const [isSOS, setIsSOS] = useState(false);
    
    // Refs
    const watchGpsRef = useRef(null);
    const audioAlarmeRef = useRef(null);
    const cameraInputRef = useRef(null);

    // Helpers
    const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    // INICIALIZAÇÃO
    useEffect(() => {
        try { audioAlarmeRef.current = new Howl({ src: [SOUND_ALARM], loop: true, volume: 1.0 }); } catch(e){}

        const authListener = onAuthStateChanged(auth, async (user) => {
            if (!user) { setPiloto(null); setSecao('INTRO'); return; }
            
            onSnapshot(doc(db, "entregadores", user.uid), snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setPiloto({ id: snap.id, uid: user.uid, ...data });
                    setIsOnline(data.status !== 'Offline');
                    setSecao('APP');
                } else {
                    // Preenche dados vindos do Google Auth
                    const newData = { nome: user.displayName || 'Piloto', email: user.email, foto: user.photoURL, status: 'Offline', statusAprovacao: 'PENDENTE', ganhosTaxas: 0, debitosLoja: 0, saldoLiquido: 0, totalEntregas: 0, createdAt: serverTimestamp() };
                    setDoc(doc(db, "entregadores", user.uid), newData).then(() => setSecao('APP'));
                }
            });
        });
        return () => authListener();
    }, []);

    // MOTOR DE ROTAS E LEILÃO
    useEffect(() => {
        if (!piloto || secao !== 'APP') return;
        
        // 1. Pedido Ativo (Rota Atual)
        const qAtivo = query(collection(db, "pedidos"), where("entregadorId", "==", piloto.id), where("status", "in", ["A_CAMINHO_LOJA", "AGUARDANDO_COLETA", "SAIU_ENTREGA", "ENTREGADOR_NO_LOCAL"]));
        const unsubAtivo = onSnapshot(qAtivo, snap => {
            if (!snap.empty) {
                setPedidoAtivo({ id: snap.docs[0].id, ...snap.docs[0].data() });
                setAbaAtiva('ROTA');
                setOfertaLeilao(null);
                audioAlarmeRef.current?.stop();
            } else {
                setPedidoAtivo(null);
                if (abaAtiva === 'ROTA') setAbaAtiva('RADAR');
            }
        });

        // 2. Leilão (Ofertas)
        const qOfertas = query(collection(db, "pedidos"), where("status", "==", "PRONTO"), where("statusDespacho", "==", "OFERTA_INDIVIDUAL"));
        const unsubOfertas = onSnapshot(qOfertas, snap => {
            if (!isOnline || pedidoAtivo) return;
            const disponiveis = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.entregadorAtualOferta === piloto.id);
            
            if (disponiveis.length > 0) {
                if (!ofertaLeilao || ofertaLeilao.id !== disponiveis[0].id) {
                    setOfertaLeilao(disponiveis[0]);
                    audioAlarmeRef.current?.play().catch(()=>{}); 
                    try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch(e){}
                }
            } else {
                setOfertaLeilao(null);
                audioAlarmeRef.current?.stop();
            }
        });

        // 3. Histórico do Dia
        const inicioDoDia = new Date(); inicioDoDia.setHours(0,0,0,0);
        const qHist = query(collection(db, "pedidos"), where("entregadorId", "==", piloto.id), where("status", "==", "CONCLUIDO"));
        const unsubHist = onSnapshot(qHist, snap => {
            setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.horarioConcluido?.toDate() >= inicioDoDia));
        });

        return () => { unsubAtivo(); unsubOfertas(); unsubHist(); };
    }, [piloto?.id, isOnline, secao, abaAtiva, pedidoAtivo, ofertaLeilao?.id]);

    // BACKGROUND GPS
    useEffect(() => {
        if (isOnline && piloto) {
            try { Geolocation.requestPermissions(); } catch(e){} 
            if ("geolocation" in navigator) {
                watchGpsRef.current = navigator.geolocation.watchPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        setMyLocation({ lat: latitude, lng: longitude });
                        updateDoc(doc(db, "entregadores", piloto.id), { coords: { lat: latitude, lng: longitude }, lastUpdate: serverTimestamp() }).catch(()=>{});
                    },
                    (error) => toast("GPS Desativado! As lojas não vão te encontrar.", "error"),
                    { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
                );
            }
        } else {
            if (watchGpsRef.current) navigator.geolocation.clearWatch(watchGpsRef.current);
        }
        return () => { if (watchGpsRef.current) navigator.geolocation.clearWatch(watchGpsRef.current); };
    }, [isOnline, piloto, toast]);

    // ========================================================================
    // AÇÕES DO PILOTO
    // ========================================================================
    const handleAuth = async (e) => {
        e.preventDefault(); setLoadingMsg('Autenticando...');
        try {
            if (isLoginModo) {
                await signInWithEmailAndPassword(auth, form.email, form.senha);
            } else {
                const cred = await createUserWithEmailAndPassword(auth, form.email, form.senha);
                await setDoc(doc(db, "entregadores", cred.user.uid), {
                    nome: form.nome, email: form.email, telefone: form.telefone.replace(/\D/g, ''), veiculo: form.veiculo, placa: form.placa.toUpperCase(),
                    statusAprovacao: 'PENDENTE', status: 'Offline', ganhosTaxas: 0, debitosLoja: 0, saldoLiquido: 0, totalEntregas: 0, createdAt: serverTimestamp()
                });
                toast("Conta criada! Aguarde aprovação da loja.", "success");
            }
        } catch (err) { toast(err.message.includes('auth/') ? "Email ou Senha inválidos." : "Erro de Conexão", "error"); } 
        finally { setLoadingMsg(''); }
    };

    const loginGoogle = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { toast("Erro no Google Auth", "error"); }
    };

    const resetSenha = async () => {
        const em = prompt("Digite seu e-mail de recuperação:");
        if(em) { sendPasswordResetEmail(auth, em).then(()=>toast("E-mail de recuperação enviado!", "success")).catch(()=>toast("E-mail não encontrado.", "error")); }
    };

    const alternarStatus = async () => {
        if (!piloto) return;
        if (piloto.statusAprovacao !== 'APROVADO') return toast("Sua conta está em Análise.", "error");
        
        setLoadingMsg('Sincronizando...');
        try {
            const novoStatus = isOnline ? 'Offline' : 'Livre';
            await updateDoc(doc(db, "entregadores", piloto.id), { status: novoStatus });
            setIsOnline(!isOnline);
            toast(isOnline ? "Você está Offline." : "Online! Aguardando corridas.", isOnline ? "info" : "success");
        } catch(e) { toast("Erro de conexão.", "error"); } 
        finally { setLoadingMsg(''); }
    };

    const aceitarMissao = async () => {
        if (!ofertaLeilao || !piloto) return;
        setLoadingMsg('Confirmando Rota...');
        try {
            audioAlarmeRef.current?.stop();
            await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { status: 'A_CAMINHO_LOJA', entregadorId: piloto.id, statusDespacho: 'Aceito pelo Piloto', horarioAceite: serverTimestamp() });
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Em Rota' });
            setOfertaLeilao(null);
            toast("Rota Confirmada! Vá até a loja.", "success");
        } catch(e) { toast("A Rota expirou ou foi cancelada.", "error"); setOfertaLeilao(null); } 
        finally { setLoadingMsg(''); }
    };

    const recusarMissao = async () => {
        audioAlarmeRef.current?.stop(); setOfertaLeilao(null);
        if (ofertaLeilao && piloto) await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { statusDespacho: 'Rejeitado pelo Piloto' }).catch(()=>{});
    };

    const atualizarCorrida = async (novoStatus) => {
        if(!pedidoAtivo) return;
        setLoadingMsg('Atualizando...');
        try { 
            await updateDoc(doc(db, "pedidos", pedidoAtivo.id), { status: novoStatus, statusAtualizadoEm: serverTimestamp() }); 
            try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e){}
        } catch(e) { toast("Falha de conexão.", "error"); } 
        finally { setLoadingMsg(''); }
    };

    const concluirCorrida = async (urlFoto = null) => {
        if (!pedidoAtivo) return;
        if (pedidoAtivo.codigoEntrega && tokenInput !== pedidoAtivo.codigoEntrega) return toast("O Token informado está incorreto!", "error");

        setLoadingMsg('Fechando Rota...');
        try {
            const taxa = Number(pedidoAtivo.valores?.taxa || 0);
            const totalPgto = Number(pedidoAtivo.valores?.total || 0);
            const isDinheiro = pedidoAtivo.pagamento?.metodo?.toUpperCase().includes('DINHEIRO');
            const isMaquininha = pedidoAtivo.pagamento?.metodo?.toUpperCase().includes('CARTÃO') || pedidoAtivo.pagamento?.metodo?.toUpperCase().includes('MAQUININHA');
            const debitoLoja = (isDinheiro || isMaquininha) ? totalPgto : 0;

            let updatePayload = { status: 'CONCLUIDO', horarioConcluido: serverTimestamp() };
            if (urlFoto) updatePayload.provaEntregaUrl = urlFoto;

            await updateDoc(doc(db, "pedidos", pedidoAtivo.id), updatePayload);
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Livre', ganhosTaxas: increment(taxa), debitosLoja: increment(debitoLoja), saldoLiquido: increment(taxa - debitoLoja), totalEntregas: increment(1) });
            
            toast("Rota Finalizada! Excelente.", "success");
            setTokenInput(""); setPedidoAtivo(null); setAbaAtiva('RADAR');
        } catch (e) { toast("Erro ao concluir", "error"); } 
        finally { setLoadingMsg(''); }
    };

    const processarFoto = async (e) => {
        const file = e.target.files[0];
        if (!file || !pedidoAtivo) return;
        setLoadingMsg('Enviando Comprovante...');
        try {
            const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET); formData.append("folder", "rodrigues_acai/provas");
            const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
            const json = await res.json();
            await concluirCorrida(json.secure_url);
        } catch (err) { toast("Erro na imagem. Tente apenas pelo Token.", "error"); setLoadingMsg(''); }
    };

    // ========================================================================
    // TELAS E RENDERIZAÇÃO
    // ========================================================================
    if (secao === 'LOADING') {
        return <div className={`h-[100dvh] flex items-center justify-center ${theme.bg}`}><Lucide.Loader2 size={40} className={`animate-spin ${theme.textMuted}`}/></div>;
    }

    if (secao === 'INTRO') {
        return (
            <div className={`min-h-[100dvh] flex flex-col relative overflow-hidden transition-colors ${theme.bg}`}>
                <AnimatePresence>{loadingMsg && <LoaderGlobal mensagem={loadingMsg} />}</AnimatePresence>
                
                <button onClick={theme.toggle} className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all">
                    {theme.isDark ? <Lucide.Sun size={20} className="text-yellow-400"/> : <Lucide.Moon size={20} className="text-white"/>}
                </button>

                <div className="h-[40vh] w-full relative shrink-0">
                    <img src={IMG_WELCOME} alt="Entregador" className="w-full h-full object-cover object-top" />
                    <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-[#0a0a0a]' : 'from-[#F4F6F8]'} via-transparent to-transparent`} />
                </div>
                
                <div className={`flex-1 px-6 pb-8 relative z-10 -mt-10 flex flex-col ${theme.text}`}>
                    <div className="text-left mb-6">
                        <h1 className="text-4xl font-[1000] italic uppercase tracking-tighter leading-none mb-1">Piloto <span className="text-[#82C91E]">PRO</span></h1>
                        <p className={`text-xs font-bold uppercase tracking-widest ${theme.textMuted}`}>{isLoginModo ? 'Acesse o painel' : 'Junte-se à frota'}</p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-3 flex-1 flex flex-col">
                        {!isLoginModo && <input type="text" placeholder="Nome Completo" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className={`w-full h-14 rounded-2xl px-5 text-sm font-bold outline-none focus:border-[#82C91E] ${theme.input} transition-colors border-2`} required />}
                        <input type="email" placeholder="E-mail" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className={`w-full h-14 rounded-2xl px-5 text-sm font-bold outline-none focus:border-[#82C91E] ${theme.input} transition-colors border-2`} required />
                        {!isLoginModo && <input type="tel" placeholder="WhatsApp (Apenas números)" value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} className={`w-full h-14 rounded-2xl px-5 text-sm font-bold outline-none focus:border-[#82C91E] ${theme.input} transition-colors border-2`} required />}
                        <input type="password" placeholder="Senha" value={form.senha} onChange={e=>setForm({...form, senha: e.target.value})} className={`w-full h-14 rounded-2xl px-5 text-sm font-bold outline-none focus:border-[#82C91E] ${theme.input} transition-colors border-2`} required />
                        {!isLoginModo && <div className="flex gap-3">
                            <input type="text" placeholder="Veículo (Ex: Moto Fan)" value={form.veiculo} onChange={e=>setForm({...form, veiculo: e.target.value})} className={`w-full h-14 rounded-2xl px-5 text-sm font-bold outline-none focus:border-[#82C91E] ${theme.input} transition-colors border-2`} required />
                            <input type="text" placeholder="Placa" value={form.placa} onChange={e=>setForm({...form, placa: e.target.value.toUpperCase()})} className={`w-full h-14 rounded-2xl px-5 text-sm font-bold outline-none focus:border-[#82C91E] ${theme.input} transition-colors border-2 uppercase`} required />
                        </div>}

                        <button type="submit" className="w-full h-14 bg-[#82C91E] text-[#4B0082] rounded-2xl font-[1000] uppercase text-[12px] tracking-widest shadow-[0_0_30px_rgba(130,201,30,0.3)] mt-2 active:scale-95 transition-transform">
                            {isLoginModo ? 'Iniciar Sessão' : 'Enviar Cadastro'}
                        </button>
                    </form>

                    <div className="mt-6 space-y-4">
                        {isLoginModo && (
                            <button onClick={loginGoogle} className={`w-full h-14 ${theme.card} border-2 ${theme.border} rounded-2xl font-[1000] uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 shadow-md active:scale-95 transition-all`}>
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Google
                            </button>
                        )}
                        <div className="flex justify-between items-center px-2">
                            {isLoginModo && <button onClick={resetSenha} className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted} hover:text-[#82C91E]`}>Esqueci a Senha</button>}
                            <button onClick={() => setIsLoginModo(!isLoginModo)} className="text-[10px] font-black uppercase tracking-widest text-[#4B0082] ml-auto">
                                {isLoginModo ? 'Criar Conta Nova' : 'Já tenho conta'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-[100dvh] w-full ${theme.bg} ${theme.text} overflow-hidden relative transition-colors font-sans`}>
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={processarFoto} className="hidden" />
            <AnimatePresence>{loadingMsg && <LoaderGlobal mensagem={loadingMsg} />}</AnimatePresence>

            {/* ALERTA DE LEILÃO */}
            <AnimatePresence>
                {ofertaLeilao && !pedidoAtivo && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9998] bg-[#4B0082]/80 backdrop-blur-sm" onClick={recusarMissao} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className={`fixed bottom-0 left-0 right-0 z-[9999] ${theme.card} rounded-t-[2.5rem] p-6 pb-safe shadow-[0_-20px_50px_rgba(0,0,0,0.5)] flex flex-col border-t ${theme.border}`}>
                            <div className={`w-16 h-1.5 ${theme.isDark ? 'bg-white/20' : 'bg-slate-300'} rounded-full mx-auto mb-6`} />
                            
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-[1000] italic uppercase text-3xl tracking-tighter text-[#4B0082]">Nova Rota!</h3>
                                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse"><Lucide.BellRing size={24} className="text-red-500" /></div>
                            </div>
                            
                            <div className={`bg-gradient-to-r from-[#4B0082] to-[#1F0137] p-6 rounded-3xl mb-6 shadow-xl`}>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Pagamento da Rota</p>
                                <p className="text-5xl font-[1000] italic text-[#82C91E] drop-shadow-md">R$ {Number(ofertaLeilao.valores?.taxa || 0).toFixed(2)}</p>
                            </div>
                            
                            <div className="space-y-6 mb-8 relative px-2">
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-full bg-[#4B0082]/10 flex items-center justify-center shrink-0 border border-[#4B0082]/20"><Lucide.Store size={20} className="text-[#4B0082]"/></div>
                                    <div><p className={`font-[1000] text-lg uppercase italic ${theme.text}`}>Base Rodrigues</p><p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Ponto de Coleta</p></div>
                                </div>
                                <div className={`absolute left-[27px] top-8 bottom-8 w-0.5 ${theme.isDark ? 'bg-white/10' : 'bg-slate-200'} z-0 border-dashed border-l-2`} />
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-full bg-[#EA1D2C]/10 flex items-center justify-center shrink-0 border border-[#EA1D2C]/20"><Lucide.MapPin size={20} className="text-[#EA1D2C]"/></div>
                                    <div><p className={`font-[1000] text-lg uppercase italic ${theme.text}`}>{ofertaLeilao.endereco?.bairro || 'Destino'}</p><p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Entrega ao Cliente</p></div>
                                </div>
                            </div>
                            
                            <div className="flex gap-4 mt-auto">
                                <button onClick={recusarMissao} className={`w-[30%] h-16 ${theme.isDark ? 'bg-white/5 text-white/50' : 'bg-slate-100 text-slate-500'} rounded-[1.5rem] font-black uppercase text-xs tracking-widest active:scale-95 transition-transform`}>Passar</button>
                                <button onClick={aceitarMissao} className="w-[70%] h-16 bg-[#82C91E] text-[#4B0082] rounded-[1.5rem] font-[1000] uppercase text-sm tracking-widest shadow-[0_0_30px_rgba(130,201,30,0.3)] active:scale-95 transition-transform">Aceitar Rota</button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* HEADER COM STATUS */}
            <header className={`${theme.card} p-5 pt-8 flex justify-between items-center shadow-lg border-b ${theme.border} z-20 shrink-0`}>
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-[1.2rem] overflow-hidden border-2 ${isOnline ? 'border-[#82C91E]' : theme.border}`}>
                        {piloto?.foto ? <img src={piloto.foto} alt="Perfil" className="w-full h-full object-cover" /> : <Lucide.User size={28} className={`mx-auto mt-3 ${theme.textMuted}`}/>}
                    </div>
                    <div>
                        <h2 className="text-base font-[1000] uppercase italic tracking-wide truncate max-w-[150px]">{piloto?.nome?.split(' ')[0]}</h2>
                        <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5 ${isOnline ? 'text-[#82C91E]' : theme.textMuted}`}>
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#82C91E] animate-ping' : theme.isDark ? 'bg-slate-600' : 'bg-slate-400'}`} /> 
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
                
                <button onClick={alternarStatus} className={`px-5 py-4 rounded-[1.2rem] font-[1000] text-[10px] uppercase tracking-widest transition-all active:scale-90 border-2 shadow-lg
                    ${isOnline ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-[#82C91E] text-[#4B0082] border-[#82C91E]'}`}>
                    {isOnline ? 'Pausar' : 'Ficar Online'}
                </button>
            </header>

            {/* ÁREA PRINCIPAL */}
            <main className="flex-1 overflow-hidden relative z-0">
                <AnimatePresence mode="wait">
                    
                    {/* TELA: RADAR (ESPERANDO) */}
                    {abaAtiva === 'RADAR' && (
                        <motion.div key="radar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-y-auto p-6 pb-32 custom-scrollbar">
                            <div className="bg-gradient-to-br from-[#1F0137] to-[#4B0082] p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden mb-8 text-white">
                                <div className="absolute top-0 right-0 opacity-10 p-4"><Lucide.Banknote size={150} /></div>
                                <p className="text-[10px] font-black text-[#82C91E] uppercase tracking-widest mb-1 flex items-center gap-2"><Lucide.TrendingUp size={14}/> Ganhos Hoje</p>
                                <h2 className="text-6xl font-[1000] italic tracking-tighter drop-shadow-md my-2">{formatarMoeda(historico.reduce((acc, p) => acc + (p.valores?.taxa || 0), 0))}</h2>
                                <div className="mt-8 pt-6 border-t border-white/10 flex gap-8">
                                    <div><p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Rotas Feitas</p><p className="text-2xl font-black">{historico.length}</p></div>
                                </div>
                            </div>

                            {!isOnline ? (
                                <div className={`text-center pt-10 ${theme.textMuted}`}>
                                    <Lucide.PowerOff size={80} strokeWidth={1} className="mx-auto mb-6 opacity-50" />
                                    <p className="font-black uppercase text-sm tracking-widest">App Pausado</p>
                                    <p className="text-[11px] font-bold mt-2 leading-relaxed max-w-[250px] mx-auto">Fique online para que a base e os clientes vejam sua localização no mapa.</p>
                                </div>
                            ) : !pedidoAtivo ? (
                                <div className="text-center pt-10">
                                    <div className="w-40 h-40 mx-auto rounded-full border-4 border-[#82C91E]/20 flex items-center justify-center relative mb-8">
                                        <div className="absolute inset-0 rounded-full border-[3px] border-[#82C91E] animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50"/>
                                        <Lucide.Radar size={48} className="text-[#82C91E]" />
                                    </div>
                                    <h3 className="font-[1000] text-2xl uppercase italic tracking-tighter mb-2">Buscando Rotas...</h3>
                                    <p className={`font-black uppercase text-[10px] tracking-widest ${theme.textMuted}`}>Deixe a tela acesa e o som ligado.</p>
                                </div>
                            ) : null}
                        </motion.div>
                    )}

                    {/* TELA: ROTA DINÂMICA (MAPA FULL) */}
                    {abaAtiva === 'ROTA' && pedidoAtivo && (
                        <motion.div key="rota" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex flex-col">
                            <div className="flex-1 relative">
                                <LiveMapDriver pedido={pedidoAtivo} myLocation={myLocation} />
                                
                                <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-4">
                                    <button onClick={() => window.open(`https://waze.com/ul?ll=${pedidoAtivo.endereco.lat},${pedidoAtivo.endereco.lng}&navigate=yes`, '_blank')} className="w-16 h-16 bg-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center justify-center border-4 border-[#1F0137] active:scale-90 transition-transform">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/48/Waze_Logo.png" alt="Waze" className="w-8 h-8 object-contain" />
                                    </button>
                                    <button onClick={() => {
                                        const motivo = prompt("🚨 SOS: Qual a emergência? (Pneu, Acidente, etc)");
                                        if(motivo) { updateDoc(doc(db,"pedidos",pedidoAtivo.id), {observacaoSOS: motivo}); setIsSOS(true); toast("SOS Enviado!","success"); }
                                    }} className={`w-16 h-16 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center justify-center border-4 transition-colors ${isSOS ? 'bg-red-600 text-white border-white animate-pulse' : 'bg-white text-red-600 border-red-600'}`}>
                                        <Lucide.Siren size={28} />
                                    </button>
                                </div>
                            </div>

                            <div className={`${theme.card} rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.2)] flex flex-col relative z-[2000] border-t ${theme.border}`}>
                                <div className={`w-16 h-1.5 ${theme.isDark ? 'bg-white/20' : 'bg-slate-300'} rounded-full mx-auto mt-5 mb-3 shrink-0`} />
                                
                                <div className="p-6 pt-2 overflow-y-auto max-h-[65vh] custom-scrollbar">
                                    
                                    {pedidoAtivo.pagamento?.metodo?.includes('Na Entrega') && (
                                        <div className="bg-[#EA1D2C] p-6 rounded-[2rem] mb-6 border-[3px] border-red-400 animate-pulse shadow-[0_0_30px_rgba(234,29,44,0.4)]">
                                            <p className="text-[11px] font-[1000] text-white uppercase tracking-widest mb-1 flex items-center gap-2"><Lucide.AlertOctagon size={18}/> ATENÇÃO: COBRAR NA ENTREGA!</p>
                                            <p className="text-5xl font-[1000] text-white tracking-tighter drop-shadow-md my-2">R$ {Number(pedidoAtivo.valores?.total || 0).toFixed(2)}</p>
                                            <p className="text-[11px] font-bold text-red-100 uppercase mt-2">Pagamento: {pedidoAtivo.pagamento.metodo}</p>
                                            {pedidoAtivo.pagamento.valorTrocoPara && <p className="text-[10px] font-black text-white uppercase mt-3 bg-black/40 px-4 py-3 rounded-xl inline-block shadow-inner">Levar troco para R$ {pedidoAtivo.pagamento.valorTrocoPara}</p>}
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${theme.textMuted}`}><Lucide.MapPin size={14}/> Destino</h3>
                                        <p className="text-2xl font-[1000] uppercase italic leading-tight">{pedidoAtivo.endereco?.rua}, {pedidoAtivo.endereco?.numero}</p>
                                        <p className={`text-sm font-bold uppercase mt-1 ${theme.textMuted}`}>{pedidoAtivo.endereco?.bairro}</p>
                                        {pedidoAtivo.endereco?.complemento && <p className="text-[10px] font-black text-amber-600 uppercase mt-3 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-500/20 inline-block">Ref: {pedidoAtivo.endereco.complemento}</p>}
                                    </div>

                                    <div className={`p-5 rounded-2xl border ${theme.border} mb-6 flex justify-between items-center bg-transparent`}>
                                        <div>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${theme.textMuted}`}>Cliente</p>
                                            <p className="text-lg font-[1000] uppercase">{pedidoAtivo.cliente?.nome}</p>
                                        </div>
                                        <a href={`tel:${pedidoAtivo.cliente?.telefone}`} className={`w-14 h-14 ${theme.isDark ? 'bg-white/10' : 'bg-slate-100'} rounded-2xl flex items-center justify-center active:scale-90 transition-transform border ${theme.border}`}>
                                            <Lucide.Phone size={24} className={theme.text}/>
                                        </a>
                                    </div>

                                    {pedidoAtivo.alertaLoja && (
                                        <div className="bg-blue-600/20 border border-blue-500 p-5 rounded-2xl mb-8">
                                            <p className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-2 mb-2"><Lucide.Bell size={14}/> A Torre Informa</p>
                                            <p className={`text-sm font-bold ${theme.isDark ? 'text-blue-100' : 'text-blue-900'} italic`}>"{pedidoAtivo.alertaLoja}"</p>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3">
                                        {pedidoAtivo.status === 'A_CAMINHO_LOJA' && <button onClick={() => atualizarCorrida('AGUARDANDO_COLETA')} className="w-full h-16 bg-[#82C91E] text-[#4B0082] rounded-[1.5rem] font-[1000] text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(130,201,30,0.3)] active:scale-95 transition-all">Cheguei à Base</button>}
                                        {pedidoAtivo.status === 'AGUARDANDO_COLETA' && <button onClick={() => atualizarCorrida('SAIU_ENTREGA')} className="w-full h-16 bg-[#82C91E] text-[#4B0082] rounded-[1.5rem] font-[1000] text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(130,201,30,0.3)] active:scale-95 transition-all">Pacote Recolhido</button>}
                                        {pedidoAtivo.status === 'SAIU_ENTREGA' && <button onClick={() => atualizarCorrida('ENTREGADOR_NO_LOCAL')} className="w-full h-16 bg-[#82C91E] text-[#4B0082] rounded-[1.5rem] font-[1000] text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(130,201,30,0.3)] active:scale-95 transition-all">Cheguei no Cliente</button>}
                                        
                                        {pedidoAtivo.status === 'ENTREGADOR_NO_LOCAL' && (
                                            <div className={`pt-4 border-t ${theme.border} mt-2`}>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-4 text-center ${theme.textMuted}`}>Finalização Segura</p>
                                                <div className="flex gap-3">
                                                    <input type="number" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Token" className={`flex-[1] border-2 rounded-2xl px-2 text-xl font-[1000] text-center outline-none focus:border-[#82C91E] tracking-[0.1em] transition-colors ${theme.input}`} />
                                                    <button onClick={() => cameraInputRef.current?.click()} className="flex-[1] bg-slate-200 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 flex flex-col justify-center items-center gap-1 border-2 border-slate-300"><Lucide.Camera size={20}/> Com Foto</button>
                                                    <button onClick={() => concluirCorrida()} disabled={tokenInput.length < 4} className="flex-[2] bg-[#82C91E] disabled:bg-slate-700 disabled:opacity-50 text-[#4B0082] rounded-2xl font-[1000] uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(130,201,30,0.3)] active:scale-95 transition-all">Finalizar</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TELA: PERFIL */}
                    {abaAtiva === 'PERFIL' && (
                        <motion.div key="perfil" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-y-auto p-6 pb-32 custom-scrollbar">
                            <div className={`${theme.card} p-8 rounded-[3rem] border ${theme.border} text-center mb-6 shadow-lg`}>
                                <div className={`w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-[#4B0082] mb-5 ${theme.isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    {piloto?.foto ? <img src={piloto.foto} alt="Perfil" className="w-full h-full object-cover" /> : <Lucide.User size={60} className={`mx-auto mt-8 ${theme.textMuted}`}/>}
                                </div>
                                <h2 className="text-2xl font-[1000] uppercase italic tracking-tighter">{piloto?.nome}</h2>
                                <p className={`text-xs font-bold mt-1 ${theme.textMuted}`}>{piloto?.email}</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#82C91E]/10 text-[#82C91E] text-[10px] font-black uppercase tracking-widest rounded-xl border border-[#82C91E]/30">
                                    <Lucide.ShieldCheck size={14}/> Piloto Verificado
                                </span>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className={`${theme.card} p-6 rounded-3xl border ${theme.border} flex items-center justify-between shadow-sm`}>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme.textMuted}`}>Chave PIX (Para Repasse)</p>
                                        <p className="text-base font-bold">{piloto?.pix || 'Não informada'}</p>
                                    </div>
                                    <button className={`p-3 rounded-xl border ${theme.border} active:scale-90`} onClick={() => { const p = prompt("Digite a nova Chave PIX:"); if(p) updateDoc(doc(db,"entregadores",piloto.id),{pix: p}).then(()=>toast("PIX Atualizado", "success")); }}>
                                        <Lucide.Edit2 size={18} className={theme.textMuted}/>
                                    </button>
                                </div>
                                <div className={`${theme.card} p-6 rounded-3xl border ${theme.border} flex items-center justify-between shadow-sm`}>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme.textMuted}`}>Veículo / Placa</p>
                                        <p className="text-base font-bold">{piloto?.veiculo || 'Não informado'} {piloto?.placa && `• ${piloto.placa}`}</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-6 rounded-3xl border ${theme.border} flex items-center justify-between mb-8 bg-transparent`}>
                                <div>
                                    <p className="text-sm font-[1000] uppercase tracking-wide">Modo Noturno / Dark</p>
                                    <p className={`text-[10px] font-bold mt-1 ${theme.textMuted}`}>Tema e mapa escuros para a noite.</p>
                                </div>
                                <button onClick={theme.toggle} className={`w-16 h-10 rounded-full p-1 flex items-center transition-colors ${theme.isDark ? 'bg-[#82C91E]' : 'bg-slate-300'}`}>
                                    <motion.div animate={{ x: theme.isDark ? 24 : 0 }} className={`w-8 h-8 rounded-full shadow-md flex items-center justify-center ${theme.isDark ? 'bg-[#4B0082]' : 'bg-white'}`}>
                                        {theme.isDark ? <Lucide.Moon size={14} className="text-white"/> : <Lucide.Sun size={14} className="text-yellow-500"/>}
                                    </motion.div>
                                </button>
                            </div>

                            <button onClick={() => { if(window.confirm("Tem certeza que quer sair?")) auth.signOut(); }} className="w-full py-6 bg-red-500/10 text-red-500 border-2 border-red-500/20 rounded-[2rem] font-[1000] text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
                                <Lucide.LogOut size={20}/> Desconectar Conta
                            </button>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            {/* NAVBAR INFERIOR TIPO UBER */}
            <nav className={`${theme.card} h-20 border-t ${theme.border} flex justify-around items-center shrink-0 shadow-[0_-20px_30px_rgba(0,0,0,0.1)] pb-safe-bottom fixed bottom-0 left-0 right-0 z-40 transition-colors`}>
                {[
                    { id: 'RADAR', icon: Lucide.Home, label: 'Painel' },
                    { id: 'ROTA', icon: Lucide.Map, label: 'Rota', badge: pedidoAtivo ? '!' : null },
                    { id: 'PERFIL', icon: Lucide.User, label: 'Perfil' }
                ].map(item => (
                    <button key={item.id} onClick={() => { if(item.id === 'ROTA' && !pedidoAtivo) return toast("Nenhuma rota ativa.", "info"); setAbaAtiva(item.id); }} className={`flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-all relative ${abaAtiva === item.id ? (theme.isDark ? 'bg-white/10' : 'bg-[#82C91E]/10') : 'hover:bg-slate-500/10'}`}>
                        <item.icon size={24} strokeWidth={abaAtiva === item.id ? 2.5 : 2} className={abaAtiva === item.id ? (theme.isDark ? 'text-[#82C91E]' : 'text-[#4B0082]') : theme.textMuted} />
                        <span className={`text-[8px] font-black uppercase tracking-widest ${abaAtiva === item.id ? (theme.isDark ? 'text-[#82C91E]' : 'text-[#4B0082]') : theme.textMuted}`}>{item.label}</span>
                        {item.badge && <span className="absolute top-2 right-2 w-3 h-3 bg-[#EA1D2C] border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white animate-pulse" />}
                    </button>
                ))}
            </nav>

        </div>
    );
};

// Envolver com os provedores para o tema funcionar
export default function EntregadorMobileWrapper() {
    return <AppProviders><PilotoApp /></AppProviders>;
}