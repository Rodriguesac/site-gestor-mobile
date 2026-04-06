import React, { useEffect, useState, useRef } from 'react';
import { db, auth } from '../services/firebase'; 
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, serverTimestamp, increment, addDoc, arrayUnion } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Howl } from 'howler';

// --- CAPACITOR (HARDWARE REAL) ---
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// ========================================================================
// 1. CONFIGURAÇÕES E ASSETS GERAIS
// ========================================================================
const IMG_WELCOME = "https://res.cloudinary.com/dbd9x1o02/image/upload/v1775159380/rodrigues_geral/fjm4ioufyglqbmmy2gn5.png";
const SOUND_ALARM = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const LOJA_COORDS = [-20.4697, -54.6201]; 
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbd9x1o02/image/upload";
const UPLOAD_PRESET = "fc3i8urq";

// Ícones do Mapa
const iconLoja = new L.DivIcon({ className: 's-icon', html: `<div class="w-10 h-10 bg-[#4B0082] rounded-xl border-2 border-[#82C91E] flex items-center justify-center shadow-lg"><div class="w-3 h-3 bg-[#82C91E] rounded-full animate-pulse"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const iconEntrega = new L.DivIcon({ className: 'e-icon', html: `<div class="w-10 h-10 bg-[#EA1D2C] rounded-xl border-2 border-white flex items-center justify-center shadow-lg"><div class="w-3 h-3 bg-white rounded-full"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });

// ========================================================================
// 2. FUNÇÕES TRADUTORAS E MATEMÁTICAS
// ========================================================================
const UTILS = {
    formatarMoeda: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
    mascararCPF: (v) => v?.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, "$1.$2.$3-$4") || '',
    limparDados: (v) => v?.replace(/\D/g, '') || '',
    vibrar: (padrao) => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(padrao); },
    abrirMaps: (end) => { if(end?.lat && end?.lng) window.open(`http://googleusercontent.com/maps.google.com/maps?q=${end.lat},${end.lng}`, '_system'); },
    abrirZap: (tel, nome) => { if(tel) window.open(`https://wa.me/55${tel.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${nome || ''}, aqui é o piloto da Rodrigues Açaí! Estou a caminho.`)}`, '_blank'); }
};

// Cálculo exato de KM entre duas coordenadas (Haversine)
const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180; 
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
};

// Proteção para puxar as taxas do Firebase
const obterTaxa = (p) => parseFloat(p?.valores?.taxaEntrega || p?.taxaEntrega || p?.frete || p?.valores?.frete || 0);
const obterTotal = (p) => parseFloat(p?.valores?.total || p?.total || 0);
const obterEndereco = (p) => ({
    rua: p?.endereco?.rua || 'Endereço não informado',
    numero: p?.endereco?.numero || 'S/N',
    bairro: p?.endereco?.bairro || '',
    lat: p?.endereco?.latlng?.lat || p?.endereco?.lat || null,
    lng: p?.endereco?.latlng?.lng || p?.endereco?.lng || null
});
const obterCliente = (p) => ({
    nome: p?.cliente?.nome || 'Cliente Local',
    telefone: p?.cliente?.telefone || ''
});

// ========================================================================
// 3. COMPONENTES VISUAIS REUTILIZÁVEIS
// ========================================================================
const LoaderGlobal = ({ mensagem }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#4B0082]/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border-b-4 border-[#82C91E]">
            <Lucide.Loader2 size={40} className="animate-spin text-[#4B0082] mb-4" />
            <p className="text-[#4B0082] font-black uppercase tracking-widest text-[11px] animate-pulse">{mensagem || 'A processar...'}</p>
        </div>
    </motion.div>
);

// ========================================================================
// 4. APLICAÇÃO PRINCIPAL (APP ENTREGADOR)
// ========================================================================
export default function EntregadorMobile() {
    const [secao, setSecao] = useState('LOADING'); 
    const [abaAtiva, setAbaAtiva] = useState('RADAR'); 
    const [loadingMsg, setLoadingMsg] = useState('');
    const [mostrarMapaModal, setMostrarMapaModal] = useState(false);
    
    // Auth e Usuário
    const [isLoginModo, setIsLoginModo] = useState(true);
    const [form, setForm] = useState({ cpf: '', senha: '', nome: '', veiculo: 'MOTO', placa: '', telefone: '' });
    const [piloto, setPiloto] = useState(null);
    
    // Operacional
    const [isOnline, setIsOnline] = useState(false);
    const [ofertaLeilao, setOfertaLeilao] = useState(null);
    const [pedidoAtivo, setPedidoAtivo] = useState(null);
    const [chatMsgs, setChatMsgs] = useState([]);
    const [novaMsg, setNovaMsg] = useState('');
    const [temInternet, setTemInternet] = useState(true);
    const [pixInput, setPixInput] = useState('');

    // Refs
    const audioAlarmeRef = useRef(null);
    const watchGpsRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [pedidoParaFinalizar, setPedidoParaFinalizar] = useState(null);

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
                    if (data.chavePix) setPixInput(data.chavePix);
                    setSecao('APP');
                } else { setSecao('INTRO'); }
            });
        });
        return () => { authListener(); networkListener.then(l => l.remove()); };
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault(); setLoadingMsg('A autenticar...');
        const cpfLimpo = UTILS.limparDados(form.cpf);
        const emailStr = `${cpfLimpo}@rodrigues.com`;
        try {
            const docRef = doc(db, "entregadores", cpfLimpo);
            const snap = await getDoc(docRef);

            if (isLoginModo) {
                if (snap.exists() && snap.data().senha === form.senha) {
                    localStorage.setItem('@UP:cpf', cpfLimpo);
                    try { await signInWithEmailAndPassword(auth, emailStr, form.senha); } catch(err) { await createUserWithEmailAndPassword(auth, emailStr, form.senha); }
                } else { alert("CPF ou Senha incorretos."); }
            } else {
                if (snap.exists()) { alert("Este CPF já está registado."); }
                else {
                    const payload = {
                        nome: form.nome, telefone: UTILS.limparDados(form.telefone), senha: form.senha, 
                        modalidade: form.veiculo, placa: form.placa, statusAprovacao: 'PENDENTE', status: 'Offline',
                        ganhosTaxas: 0, debitosLoja: 0, saldoLiquido: 0, totalEntregas: 0, dataCadastro: serverTimestamp(),
                        aceitaDinheiro: true, temMaquininha: true, frequenciaRepasse: 'SEMANAL', modoVoltarCasa: false, setorPreferencia: 'C'
                    };
                    await setDoc(docRef, payload);
                    const cred = await createUserWithEmailAndPassword(auth, emailStr, form.senha);
                    await updateDoc(docRef, { uid: cred.user.uid });
                    alert("Registo efetuado! Aguarde a aprovação.");
                    setIsLoginModo(true);
                }
            }
        } catch (err) { alert("Erro de rede."); } finally { setLoadingMsg(''); }
    };

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
                    if (!ofertaLeilao || ofertaLeilao.id !== leiloes[0].id) {
                        setOfertaLeilao(leiloes[0]);
                        audioAlarmeRef.current?.play().catch(()=>{}); 
                        UTILS.vibrar([200, 100, 200, 100, 500]);
                    }
                } else { setOfertaLeilao(null); audioAlarmeRef.current?.stop(); }
            } else { setOfertaLeilao(null); audioAlarmeRef.current?.stop(); }
        });

        const unsubChat = onSnapshot(query(collection(db, `entregadores/${piloto.id}/mensagens`), orderBy("timestamp", "asc")), snap => {
            setChatMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubPedidos(); unsubChat(); };
    }, [piloto?.id, isOnline, secao, ofertaLeilao?.id]);

    const alternarStatusGps = async () => {
        if (!piloto) return;
        if (piloto.statusAprovacao !== 'APROVADO') return alert("O seu perfil ainda está em análise.");
        setLoadingMsg('A processar...');
        try {
            if (!isOnline) {
                try { await Geolocation.requestPermissions(); } catch(e){} 
                try {
                    BackgroundGeolocation.addWatcher(
                        { backgroundMessage: "App rodando", backgroundTitle: "Buscando", requestPermissions: true, stale: false, distanceFilter: 10 },
                        (location, error) => { if (!error) updateDoc(doc(db, "entregadores", piloto.id), { coords: { lat: location.latitude, lng: location.longitude } }).catch(()=>{}); }
                    ).then(id => { watchGpsRef.current = id; });
                } catch(e) { console.log("Background indisponível."); }

                setIsOnline(true);
                await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Livre' });
                try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch(e){}
            } else {
                setIsOnline(false); setOfertaLeilao(null); audioAlarmeRef.current?.stop();
                try { if (watchGpsRef.current) BackgroundGeolocation.removeWatcher({ id: watchGpsRef.current }); } catch(e){}
                await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Offline' });
                try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e){}
            }
        } catch(e) { alert("Ative o GPS."); } finally { setLoadingMsg(''); }
    };

    const aceitarMissao = async () => {
        if (!ofertaLeilao || !piloto) return;
        setLoadingMsg('A confirmar...');
        try {
            audioAlarmeRef.current?.stop();
            await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { 
                status: 'A_CAMINHO_LOJA', entregadorId: piloto.id,
                nomeEntregador: (piloto.nome || 'Piloto').split(' ')[0], veiculoEntregador: piloto.modalidade || 'Moto',
                telefoneEntregador: piloto.telefone || '', horarioAceite: serverTimestamp() 
            });
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Em Rota' });
            setOfertaLeilao(null); setAbaAtiva('RADAR'); UTILS.vibrar(100);
        } catch(e) { alert("Missão expirada."); setOfertaLeilao(null); } finally { setLoadingMsg(''); }
    };

    const recusarMissao = async () => {
        audioAlarmeRef.current?.stop(); UTILS.vibrar(50);
        if (ofertaLeilao && piloto) await updateDoc(doc(db, "pedidos", ofertaLeilao.id), { entregadoresRecusaram: arrayUnion(piloto.id) }).catch(()=>{});
        setOfertaLeilao(null);
    };

    const atualizarStatusCorrida = async (novoStatus) => {
        if(!pedidoAtivo) return;
        setLoadingMsg('A atualizar...');
        try { await updateDoc(doc(db, "pedidos", pedidoAtivo.id), { status: novoStatus, statusAtualizadoEm: serverTimestamp() }); UTILS.vibrar(50); } 
        catch(e) { alert("Falha na rede."); } finally { setLoadingMsg(''); }
    };

    const tirarFotoProva = (pedido) => {
        setPedidoParaFinalizar(pedido);
        if(cameraInputRef.current) cameraInputRef.current.click();
    };

    const finalizarComFoto = async (e) => {
        const file = e.target.files[0];
        if (!file || !pedidoParaFinalizar || !piloto) return;
        
        setLoadingMsg('Calculando ganhos...');
        try {
            const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", UPLOAD_PRESET); formData.append("folder", "rodrigues_acai/provas");
            const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
            const json = await res.json();
            
            const taxa = obterTaxa(pedidoParaFinalizar);
            const total = obterTotal(pedidoParaFinalizar);
            const metodoPgto = (pedidoParaFinalizar.pagamento?.metodo || '').toUpperCase();
            const debitoLoja = (metodoPgto.includes('DINHEIRO') || metodoPgto.includes('MAQUININHA')) ? total : 0;

            await updateDoc(doc(db, "pedidos", pedidoParaFinalizar.id), { status: 'CONCLUIDO', provaEntregaUrl: json.secure_url, horarioConclusao: serverTimestamp() });
            await updateDoc(doc(db, "entregadores", piloto.id), { status: 'Livre', ganhosTaxas: increment(taxa), debitosLoja: increment(debitoLoja), saldoLiquido: increment(taxa - debitoLoja), totalEntregas: increment(1) });
            UTILS.vibrar([100, 50, 100, 50, 200]);
        } catch (err) { alert("Erro ao enviar imagem."); } finally { setLoadingMsg(''); setPedidoParaFinalizar(null); if(e.target) e.target.value = null; }
    };

    const enviarChat = async (e) => {
        e.preventDefault(); if (!novaMsg.trim() || !piloto) return;
        await addDoc(collection(db, `entregadores/${piloto.id}/mensagens`), { texto: novaMsg, remetente: 'PILOTO', timestamp: serverTimestamp() });
        setNovaMsg('');
    };

    // FUNÇÕES ESPECIAIS DO DASHBOARD OPERACIONAL
    const atualizarPerfilConfig = async (campo, valor) => {
        try {
            await updateDoc(doc(db, "entregadores", piloto.id), { [campo]: valor });
            UTILS.vibrar(20);
        } catch(e) { console.error("Erro ao atualizar config", e); }
    };

    const acionarSOS = async () => {
        if(window.confirm("🚨 TEM CERTEZA? Isso enviará um alerta de EMERGÊNCIA para a Base!")) {
            UTILS.vibrar([500, 200, 500, 200, 1000]);
            try {
                await addDoc(collection(db, `entregadores/${piloto.id}/mensagens`), { 
                    texto: "🚨 ALERTA S.O.S ACIONADO PELO PILOTO! O MOTORISTA PRECISA DE ASSISTÊNCIA IMEDIATA!", 
                    remetente: 'PILOTO', urgente: true, timestamp: serverTimestamp() 
                });
                alert("Alerta enviado com sucesso! A base foi notificada.");
            } catch (e) { alert("Erro de conexão."); }
        }
    };

    const acionarResgate = async () => {
        const item = window.prompt("O que precisa resgatar? (Ex: Esqueceu a Maquininha, Faltou a Coca...)");
        if(item && item.trim() !== '') {
            try {
                await addDoc(collection(db, `entregadores/${piloto.id}/mensagens`), { 
                    texto: `🔄 SOLICITAÇÃO DE RESGATE: Preciso resgatar / buscar o seguinte item: ${item}`, 
                    remetente: 'PILOTO', timestamp: serverTimestamp() 
                });
                alert("A base foi notificada sobre o resgate.");
                setAbaAtiva('CHAT');
            } catch(e) { alert("Falha ao enviar aviso."); }
        }
    };

    const direcoesBussola = [
        { id: 'NO', label: 'NO' }, { id: 'N', label: 'N' }, { id: 'NE', label: 'NE' },
        { id: 'O', label: 'O' },   { id: 'C', label: 'QUALQUER' }, { id: 'L', label: 'L' },
        { id: 'SO', label: 'SO' }, { id: 'S', label: 'S' },   { id: 'SE', label: 'SE' }
    ];

    // Variáveis úteis para a Rota Ativa
    const endCliente = pedidoAtivo ? obterEndereco(pedidoAtivo) : null;
    const temLatLgn = endCliente?.lat && endCliente?.lng;
    const distReal = temLatLgn ? calcularDistancia(LOJA_COORDS[0], LOJA_COORDS[1], endCliente.lat, endCliente.lng) : "0.0";

    // ========================================================================
    // INTERFACES (UI)
    // ========================================================================
    if (secao === 'LOADING') {
        return <div className="h-screen bg-[#F4F6F8] flex items-center justify-center"><Lucide.Loader2 size={40} className="animate-spin text-[#4B0082]"/></div>;
    }

    if (secao === 'INTRO') {
        const inputClass = "w-full h-14 rounded-xl bg-white border border-[#E5D5F5] px-4 text-[#4B0082] font-medium outline-none focus:border-[#82C91E] focus:ring-1 focus:ring-[#82C91E] shadow-sm";
        return (
            <div className="min-h-[100dvh] flex flex-col font-sans bg-[#F4F6F8] relative">
                <AnimatePresence>{loadingMsg && <LoaderGlobal mensagem={loadingMsg} />}</AnimatePresence>
                <div className="h-[40vh] w-full relative">
                    <img src={IMG_WELCOME} alt="Fundo" className="w-full h-full object-cover object-top" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#F4F6F8] via-transparent to-transparent" />
                </div>
                <div className="flex-1 bg-[#F4F6F8] px-6 pb-8 relative z-10 -mt-10 flex flex-col">
                    <div className="text-left mb-6">
                        <h1 className="text-3xl font-extrabold text-[#4B0082] mb-1 tracking-tight">Painel Pilotos</h1>
                        <p className="text-gray-500 text-sm font-medium">{isLoginModo ? 'Aceda para operar' : 'Faça parte da nossa frota'}</p>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4 flex-1">
                        {!isLoginModo && <input type="text" placeholder="Nome Completo" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className={inputClass} required />}
                        <input type="tel" placeholder="CPF" value={UTILS.mascararCPF(form.cpf)} onChange={e=>setForm({...form, cpf: e.target.value})} maxLength={14} className={inputClass} required />
                        {!isLoginModo && <input type="tel" placeholder="WhatsApp" value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} className={inputClass} required />}
                        <input type="password" placeholder="Senha" value={form.senha} onChange={e=>setForm({...form, senha: e.target.value})} className={inputClass} required />
                        {!isLoginModo && <input type="text" placeholder="Matrícula" value={form.placa} onChange={e=>setForm({...form, placa: e.target.value.toUpperCase()})} className={`${inputClass} uppercase`} required />}
                        <div className="pt-2">
                            <button type="submit" className="w-full h-14 bg-[#82C91E] text-[#4B0082] rounded-xl font-extrabold text-[15px] shadow-md active:scale-95 transition-all">
                                {isLoginModo ? 'Iniciar Sessão' : 'Concluir Registo'}
                            </button>
                        </div>
                    </form>
                    <button onClick={() => setIsLoginModo(!isLoginModo)} className="w-full mt-6 text-[#4B0082] font-bold text-sm">
                        {isLoginModo ? 'Criar conta' : 'Já tenho conta'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full font-sans bg-[#F4F6F8] text-[#333333] overflow-hidden relative">
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={finalizarComFoto} className="hidden" />
            <AnimatePresence>{loadingMsg && <LoaderGlobal mensagem={loadingMsg} />}</AnimatePresence>
            {!temInternet && (
                <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="absolute top-0 z-[10000] w-full bg-red-600 text-white text-center py-2 font-semibold text-[11px] shadow-sm">
                    Sem ligação à internet
                </motion.div>
            )}

            {/* MODAL FULL-SCREEN DO MAPA INTERATIVO (RETRO) */}
            <AnimatePresence>
                {mostrarMapaModal && temLatLgn && (
                    <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-[99999] bg-[#F4F6F8] flex flex-col">
                        <div className="p-5 bg-[#4B0082] text-white flex justify-between items-center shadow-lg relative z-10 rounded-b-3xl">
                            <div>
                                <h3 className="font-extrabold text-xl">Rota da Entrega</h3>
                                <p className="text-[11px] font-bold text-[#82C91E] uppercase tracking-widest mt-0.5">Total a percorrer: {distReal} KM</p>
                            </div>
                            <button onClick={() => setMostrarMapaModal(false)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-90 transition-all border border-white/20"><Lucide.X size={24}/></button>
                        </div>
                        
                        <div className="flex-1 relative z-0 retro-map-tiles">
                            <MapContainer center={LOJA_COORDS} zoom={13} className="w-full h-full" zoomControl={false}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                <Marker position={LOJA_COORDS} icon={iconLoja}><Popup className="font-bold">Base Rodrigues</Popup></Marker>
                                <Marker position={[endCliente.lat, endCliente.lng]} icon={iconEntrega}><Popup className="font-bold">{obterCliente(pedidoAtivo).nome}</Popup></Marker>
                                <Polyline positions={[LOJA_COORDS, [endCliente.lat, endCliente.lng]]} color="#4B0082" weight={4} dashArray="5, 10" />
                            </MapContainer>
                            <div className="absolute inset-0 z-[400] shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] pointer-events-none" />
                        </div>
                        
                        <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] relative z-10 rounded-t-[2rem]">
                            <button onClick={() => { setMostrarMapaModal(false); UTILS.abrirMaps(endCliente); }} className="w-full h-16 bg-[#82C91E] text-[#4B0082] rounded-[20px] font-extrabold text-[16px] flex items-center justify-center gap-3 shadow-lg shadow-[#82C91E]/30 active:scale-95 transition-all">
                                <Lucide.Navigation size={22} fill="currentColor"/> Iniciar GPS do Telemóvel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL BOTTOM SHEET DE LEILÃO */}
            <AnimatePresence>
                {ofertaLeilao && !pedidoAtivo && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9998] bg-[#4B0082]/60 backdrop-blur-sm" onClick={recusarMissao} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-[32px] p-6 pb-safe shadow-2xl flex flex-col">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-extrabold text-2xl text-[#4B0082]">Nova Rota!</h3>
                                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center animate-pulse"><Lucide.BellRing size={24} className="text-red-500" /></div>
                            </div>
                            <div className="bg-[#F4F6F8] p-5 rounded-2xl mb-6 flex justify-between items-center border border-[#E5D5F5]">
                                <div><p className="text-[#4B0082]/70 text-xs font-bold mb-1 uppercase tracking-wider">O seu Ganho</p><p className="text-4xl font-extrabold text-[#82C91E]">R$ {obterTaxa(ofertaLeilao).toFixed(2)}</p></div>
                            </div>
                            <div className="space-y-6 mb-8 relative">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-[#4B0082]/10 flex items-center justify-center z-10"><Lucide.Store size={16} className="text-[#4B0082]"/></div>
                                    <div><p className="font-bold text-[16px] text-gray-900">Base Rodrigues</p><p className="text-gray-500 text-xs mt-0.5">Recolha</p></div>
                                </div>
                                <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-[#E5D5F5] z-0" />
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-[#82C91E]/20 flex items-center justify-center z-10"><Lucide.MapPin size={16} className="text-[#4B0082]"/></div>
                                    <div><p className="font-bold text-[16px] text-gray-900">{obterEndereco(ofertaLeilao).bairro || 'Destino'}</p><p className="text-gray-500 text-xs mt-0.5">Entrega Final</p></div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={recusarMissao} className="w-[30%] h-14 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95 transition-transform">Passar</button>
                                <button onClick={aceitarMissao} className="w-[70%] h-14 bg-[#82C91E] text-[#4B0082] rounded-xl font-extrabold text-[16px] shadow-lg shadow-[#82C91E]/30 active:scale-95 transition-transform">Aceitar Pedido</button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* HEADER GESTOR */}
            <header className="px-6 pt-14 pb-5 bg-[#4B0082] flex justify-between items-center z-50 shadow-md rounded-b-[32px]">
                <div>
                    <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-1">Painel Pro</p>
                    <h1 className="font-extrabold text-2xl text-white leading-tight">{(piloto?.nome || 'Piloto').split(' ')[0]}</h1>
                </div>
                <button onClick={alternarStatusGps} className={`px-5 py-3 rounded-full text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${isOnline ? 'bg-[#82C91E] text-[#4B0082]' : 'bg-white/20 text-white backdrop-blur-md'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
                    {isOnline ? 'A Operar' : 'Ligar'}
                </button>
            </header>

            {/* ÁREA PRINCIPAL COM TRANSIÇÕES */}
            <main className="flex-1 overflow-y-auto pb-[100px] relative p-5">
                <AnimatePresence mode="wait">
                    
                    {abaAtiva === 'RADAR' && (
                        <motion.div key="radar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
                            {!pedidoAtivo ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                                    <div className="mb-8 relative">
                                        {isOnline ? (
                                            <div className="w-28 h-28 bg-[#4B0082]/10 rounded-full flex items-center justify-center relative">
                                                <motion.div animate={{ scale: [1, 1.5], opacity: [0.3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-[#82C91E] rounded-full" />
                                                <Lucide.MapPin size={40} className="text-[#82C91E] relative z-10" />
                                            </div>
                                        ) : (
                                            <div className="w-28 h-28 bg-gray-200/50 rounded-full flex items-center justify-center"><Lucide.Moon size={40} className="text-gray-400" /></div>
                                        )}
                                    </div>
                                    <h2 className="text-[24px] font-extrabold text-[#4B0082] mb-3">{isOnline ? 'A procurar rotas' : 'Sistema inativo'}</h2>
                                    <p className="text-[15px] text-gray-500 font-medium">{isOnline ? 'Aguarde. O GPS rastreia em segundo plano.' : 'Ligue o seu estado para receber tarefas.'}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-[24px] p-6 border border-[#E5D5F5] shadow-sm">
                                        
                                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-100">
                                            <div>
                                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Tarefa #{pedidoAtivo.id.slice(-4)}</p>
                                                <p className="font-extrabold text-[#4B0082] text-sm mt-1">{pedidoAtivo.status.replace(/_/g, ' ')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">A Receber</p>
                                                <p className="font-extrabold text-[#82C91E] text-xl">R$ {obterTaxa(pedidoAtivo).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        
                                        {/* THUMBNAIL DO MAPA FIXO (AGORA RETRO) */}
                                        {temLatLgn && (
                                            <div onClick={() => setMostrarMapaModal(true)} className="h-32 w-full bg-amber-50/50 rounded-[1.5rem] overflow-hidden mb-6 relative border-2 border-[#E5D5F5] shadow-sm cursor-pointer group">
                                                <div className="absolute inset-0 z-10 bg-[#4B0082]/10 flex items-center justify-center group-hover:bg-[#4B0082]/20 transition-all">
                                                    <span className="bg-white/95 text-[#4B0082] px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2 border border-[#E5D5F5]">
                                                        <Lucide.Map size={14}/> Abrir Mapa ({distReal} km)
                                                    </span>
                                                </div>
                                                <MapContainer center={[endCliente.lat, endCliente.lng]} zoom={13} zoomControl={false} dragging={false} scrollWheelZoom={false} className="w-full h-full retro-map-tiles">
                                                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                                    <Marker position={LOJA_COORDS} icon={iconLoja} />
                                                    <Marker position={[endCliente.lat, endCliente.lng]} icon={iconEntrega} />
                                                    <Polyline positions={[LOJA_COORDS, [endCliente.lat, endCliente.lng]]} color="#4B0082" weight={3} dashArray="5, 10" />
                                                </MapContainer>
                                            </div>
                                        )}

                                        <div className="mb-8">
                                            <div className="flex items-start gap-4 mb-5">
                                                <div className="w-10 h-10 rounded-full bg-[#F4F6F8] flex items-center justify-center"><Lucide.User size={18} className="text-[#4B0082]" /></div>
                                                <div className="mt-1"><p className="font-bold text-[16px] text-[#333333] leading-none">{obterCliente(pedidoAtivo).nome}</p><p className="text-xs text-gray-500 mt-1.5 font-medium">Cliente Final</p></div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-full bg-[#F4F6F8] flex items-center justify-center"><Lucide.MapPin size={18} className="text-[#82C91E]" /></div>
                                                <div className="mt-1"><p className="font-bold text-[16px] text-[#333333] leading-tight">{endCliente.rua}, {endCliente.numero}</p><p className="text-xs text-gray-500 mt-1.5 font-medium">{endCliente.bairro}</p></div>
                                            </div>
                                        </div>

                                        {(pedidoAtivo.pagamento?.metodo?.includes('DINHEIRO') || pedidoAtivo.pagamento?.metodo?.includes('MAQUININHA')) && (
                                            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1 flex items-center gap-1.5"><Lucide.Banknote size={14}/> Cobrar do cliente</p>
                                                <p className="font-extrabold text-orange-600 text-2xl">R$ {obterTotal(pedidoAtivo).toFixed(2)}</p>
                                                <p className="text-xs text-orange-800 font-medium mt-1">Método: {pedidoAtivo.pagamento?.metodo}</p>
                                            </div>
                                        )}
                                        
                                        <div className="flex gap-3 mb-6">
                                            <button onClick={() => setMostrarMapaModal(true)} className="flex-1 h-14 bg-[#F4F6F8] text-[#4B0082] rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[#E5D5F5] active:scale-95 transition-all"><Lucide.Map size={18}/> Ver Mapa</button>
                                            <button onClick={() => UTILS.abrirZap(obterCliente(pedidoAtivo).telefone, obterCliente(pedidoAtivo).nome)} className="w-14 h-14 bg-[#82C91E]/20 text-[#82C91E] rounded-xl flex items-center justify-center hover:bg-[#82C91E]/30 active:scale-95 transition-all"><Lucide.MessageCircle size={24}/></button>
                                        </div>

                                        {pedidoAtivo.status === 'A_CAMINHO_LOJA' && <button onClick={() => atualizarStatusCorrida('AGUARDANDO_COLETA')} className="w-full h-14 bg-[#82C91E] text-[#4B0082] rounded-xl font-extrabold text-[16px] shadow-lg shadow-[#82C91E]/30 active:scale-95 transition-all">Cheguei à Base</button>}
                                        {pedidoAtivo.status === 'AGUARDANDO_COLETA' && <button onClick={() => atualizarStatusCorrida('SAIU_ENTREGA')} className="w-full h-14 bg-[#82C91E] text-[#4B0082] rounded-xl font-extrabold text-[16px] shadow-lg shadow-[#82C91E]/30 active:scale-95 transition-all">Recolhi o Pacote</button>}
                                        {pedidoAtivo.status === 'SAIU_ENTREGA' && <button onClick={() => atualizarStatusCorrida('ENTREGADOR_NO_LOCAL')} className="w-full h-14 bg-[#82C91E] text-[#4B0082] rounded-xl font-extrabold text-[16px] shadow-lg shadow-[#82C91E]/30 active:scale-95 transition-all">Cheguei ao Destino</button>}
                                        {pedidoAtivo.status === 'ENTREGADOR_NO_LOCAL' && <button onClick={() => tirarFotoProva(pedidoAtivo)} className="w-full h-14 bg-[#82C91E] text-[#4B0082] rounded-xl font-extrabold text-[16px] flex items-center justify-center gap-2 shadow-lg shadow-[#82C91E]/30 active:scale-95 transition-all"><Lucide.Camera size={20}/> Fotografar e Concluir</button>}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {abaAtiva === 'CARTEIRA' && (
                        <motion.div key="carteira" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
                            <h2 className="text-[24px] font-extrabold text-[#4B0082] mb-6">Financeiro</h2>
                            
                            <div className="bg-white rounded-[24px] p-6 mb-5 border border-[#E5D5F5] shadow-sm relative overflow-hidden">
                                <div className="absolute -right-4 -bottom-4 opacity-5"><Lucide.Wallet size={120} className="text-[#4B0082]" /></div>
                                <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2">Saldo Líquido</p>
                                <p className="text-[42px] font-extrabold text-[#82C91E] mb-6 leading-none relative z-10">{UTILS.formatarMoeda(piloto?.saldoLiquido)}</p>
                                
                                <div className="bg-[#F4F6F8] p-4 rounded-xl flex justify-between items-center mb-3 relative z-10">
                                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-[#82C91E]"/><span className="text-[13px] font-bold text-gray-600">Ganhos de Taxas</span></div>
                                    <span className="font-extrabold text-[#333333] text-[15px]">{UTILS.formatarMoeda(piloto?.ganhosTaxas)}</span>
                                </div>
                                <div className="bg-red-50 p-4 rounded-xl flex justify-between items-center relative z-10">
                                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/><span className="text-[13px] font-bold text-gray-600">A repassar à Loja</span></div>
                                    <span className="font-extrabold text-red-500 text-[15px]">{UTILS.formatarMoeda(piloto?.debitosLoja)}</span>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-[24px] border border-[#E5D5F5] p-6 shadow-sm flex items-center justify-between">
                                <div><p className="text-[28px] font-extrabold text-[#4B0082] leading-none mb-1">{piloto?.totalEntregas || 0}</p><p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Entregas hoje</p></div>
                                <div className="w-14 h-14 bg-[#82C91E]/10 rounded-full flex items-center justify-center"><Lucide.CheckCircle size={28} className="text-[#82C91E]" /></div>
                            </div>
                        </motion.div>
                    )}

                    {abaAtiva === 'CHAT' && (
                        <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col h-full">
                            <h2 className="text-[24px] font-extrabold text-[#4B0082] mb-6">Central de Apoio</h2>
                            <div className="flex-1 rounded-[24px] border border-[#E5D5F5] bg-white overflow-hidden flex flex-col shadow-sm">
                                <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
                                    {chatMsgs.length === 0 && <div className="h-full flex flex-col justify-center items-center opacity-40"><Lucide.MessageSquare size={40} className="mb-4 text-gray-400"/><p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Sem mensagens</p></div>}
                                    {chatMsgs.map(m => (
                                        <div key={m.id} className={`flex flex-col max-w-[85%] ${m.remetente === 'PILOTO' ? 'self-end items-end' : 'self-start items-start'}`}>
                                            <div className={`px-5 py-3.5 text-[13px] font-medium leading-relaxed shadow-sm ${m.remetente === 'PILOTO' ? 'bg-[#4B0082] text-white rounded-2xl rounded-br-sm' : 'bg-[#F4F6F8] text-[#333333] rounded-2xl rounded-bl-sm border border-gray-100'}`}>{m.texto}</div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={enviarChat} className="p-4 bg-white border-t border-gray-100 flex gap-3">
                                    <input type="text" value={novaMsg} onChange={e=>setNovaMsg(e.target.value)} placeholder="Escreva aqui..." className="flex-1 h-14 rounded-full bg-[#F4F6F8] px-6 text-[#333333] text-[14px] font-medium outline-none focus:ring-2 focus:ring-[#82C91E]/50 border border-transparent focus:border-[#82C91E]" />
                                    <button type="submit" className="w-14 h-14 bg-[#82C91E] text-[#4B0082] rounded-full flex items-center justify-center active:scale-95 transition-transform"><Lucide.Send size={20} className="ml-1"/></button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {abaAtiva === 'PERFIL' && (
                        <motion.div key="perfil" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
                            <h2 className="text-[24px] font-extrabold text-[#4B0082] mb-6">Menu Operacional</h2>
                            
                            {/* 1. OPÇÕES FINANCEIRAS: CHAVE PIX */}
                            <div className="bg-white rounded-[24px] border border-[#E5D5F5] overflow-hidden shadow-sm mb-5 p-5">
                                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Lucide.Banknote size={14}/> Opções Financeiras</h3>
                                <div className="bg-[#F4F6F8] p-4 rounded-xl border border-gray-200 focus-within:border-[#82C91E] transition-colors">
                                    <label className="text-[10px] font-bold text-[#4B0082] uppercase tracking-wider mb-2 block">Sua Chave PIX (Para repasses)</label>
                                    <input 
                                        type="text" 
                                        value={pixInput} 
                                        onChange={e => setPixInput(e.target.value)} 
                                        onBlur={() => atualizarPerfilConfig('chavePix', pixInput)}
                                        placeholder="Ex: seu-email@gmail.com ou CPF" 
                                        className="w-full bg-transparent text-[14px] font-bold text-[#333333] outline-none"
                                    />
                                </div>
                            </div>

                            {/* 2. OPÇÕES DE ROTAS: BÚSSOLA PIZZA E VOLTAR PRA CASA */}
                            <div className="bg-white rounded-[24px] border border-[#E5D5F5] overflow-hidden shadow-sm mb-5 p-5">
                                <div className="flex justify-between items-center mb-5">
                                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Lucide.Compass size={14}/> Controle de Rotas</h3>
                                    
                                    {/* Toggle Voltar pra Casa */}
                                    <button onClick={() => atualizarPerfilConfig('modoVoltarCasa', !piloto?.modoVoltarCasa)} className={`w-14 h-7 rounded-full transition-all relative border flex items-center px-1 ${piloto?.modoVoltarCasa ? 'bg-[#82C91E] border-[#82C91E]' : 'bg-gray-200 border-gray-300'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${piloto?.modoVoltarCasa ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <p className="text-[12px] font-medium text-gray-500 mb-4">{piloto?.modoVoltarCasa ? '🏡 Modo Voltar para Casa ATIVADO. Buscando rotas na direção escolhida abaixo:' : 'Escolha um Setor (Pizza) para priorizar:'}</p>

                                {/* Grade da "Pizza" (Bússola Direcional) */}
                                <div className="grid grid-cols-3 gap-2 bg-[#F4F6F8] p-4 rounded-xl border border-gray-200">
                                    {direcoesBussola.map(dir => (
                                        <button 
                                            key={dir.id}
                                            onClick={() => atualizarPerfilConfig('setorPreferencia', dir.id)}
                                            className={`py-3 rounded-lg text-[10px] font-bold transition-all ${piloto?.setorPreferencia === dir.id ? 'bg-[#4B0082] text-[#82C91E] shadow-md border-2 border-[#82C91E]' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            {dir.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3. AÇÕES RÁPIDAS (S.O.S E RESGATAR ITEM) */}
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <button onClick={acionarResgate} className="bg-amber-500 hover:bg-amber-600 text-white rounded-[20px] p-4 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform border border-amber-600">
                                    <Lucide.PackageOpen size={28}/>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-center leading-tight">Resgatar<br/>Outro Item</span>
                                </button>
                                <button onClick={acionarSOS} className="bg-[#EA1D2C] hover:bg-red-700 text-white rounded-[20px] p-4 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform border border-red-800">
                                    <Lucide.Siren size={28} className="animate-pulse"/>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-center leading-tight">S.O.S<br/>Emergência</span>
                                </button>
                            </div>

                            {/* 4. PERFIL BÁSICO E SAIR */}
                            <div className="bg-white rounded-[24px] border border-[#E5D5F5] overflow-hidden shadow-sm mt-auto">
                                <div className="p-5 border-b border-gray-100 flex items-center gap-4 bg-[#F4F6F8]">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-gray-200 shadow-sm shrink-0"><Lucide.User size={24} className="text-[#4B0082]" /></div>
                                    <div className="overflow-hidden">
                                        <p className="font-extrabold text-[#333333] text-[16px] mb-0.5 truncate">{piloto?.nome}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Doc: {UTILS.mascararCPF(piloto?.cpf || '')}</p>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <button onClick={() => { auth.signOut(); localStorage.removeItem('@UP:cpf'); setPiloto(null); setSecao('INTRO'); }} className="w-full flex items-center justify-between p-4 text-left hover:bg-red-50 rounded-xl transition-colors group">
                                        <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors"><Lucide.LogOut size={20} className="text-red-600"/></div> <span className="font-bold text-red-600 text-[14px]">Sair da Conta</span></div>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            {/* BARRA DE NAVEGAÇÃO INFERIOR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pb-safe z-[9000] shadow-[0_-10px_40px_rgba(75,0,130,0.05)]">
                <nav className="flex justify-between items-center h-[80px]">
                    {[ 
                        { id: 'RADAR', label: 'Início', icon: Lucide.Home }, 
                        { id: 'CARTEIRA', label: 'Ganhos', icon: Lucide.Wallet }, 
                        { id: 'CHAT', label: 'Chat', icon: Lucide.MessageSquare },
                        { id: 'PERFIL', label: 'Menu', icon: Lucide.Menu } 
                    ].map(i => (
                        <button key={i.id} onClick={() => { setAbaAtiva(i.id); UTILS.vibrar(15); }} className="flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-all relative active:scale-90">
                            {abaAtiva === i.id && <motion.div layoutId="nav-indicator" className="absolute top-0 w-10 h-1 bg-[#82C91E] rounded-b-full" />}
                            <i.icon size={24} className={`mt-1 transition-colors ${abaAtiva === i.id ? 'text-[#4B0082]' : 'text-gray-400'}`} strokeWidth={abaAtiva === i.id ? 2.5 : 2} />
                            <span className={`text-[10px] font-bold transition-colors ${abaAtiva === i.id ? 'text-[#4B0082]' : 'text-gray-400'}`}>{i.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            <style>{`
                /* CSS PARA O MAPA RETRO VINTAGE */
                .retro-map-tiles .leaflet-tile-pane {
                    filter: sepia(0.8) contrast(1.2) brightness(0.9) saturate(0.6) hue-rotate(-10deg);
                }
            `}</style>
        </div>
    );
}