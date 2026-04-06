import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const IMGBB_API_KEY = 'e3e4b384bff32476d8b8c517a0e31582';

const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error("Erro no upload da imagem");
    return data.data.url;
};

export default function EntregadorAppPro() {
    // --- ESTADOS DE AUTENTICAÇÃO E CADASTRO ---
    const [entregador, setEntregador] = useState(null);
    const [authModo, setAuthModo] = useState('LOGIN');
    const [etapaCadastro, setEtapaCadastro] = useState(1);
    const [carregandoAuth, setCarregandoAuth] = useState(false);

    const [form, setForm] = useState({ nome: '', email: '', telefone: '', senha: '', modalidade: 'MOTO', placa: '', fotoPerfil: null, fotoCNH: null });
    const [loginEmail, setLoginEmail] = useState('');
    const [loginSenha, setLoginSenha] = useState('');

    // --- ESTADOS DE NAVEGAÇÃO E MENU ---
    const [menuAberto, setMenuAberto] = useState(false);
    const [telaAtual, setTelaAtual] = useState('ENTREGAS'); // ENTREGAS | CARTEIRA | HISTORICO | PERFIL

    // --- ESTADOS DO APP ---
    const [online, setOnline] = useState(false);
    const [pedidosAtribuidos, setPedidosAtribuidos] = useState([]);
    const [pedidosNuvem, setPedidosNuvem] = useState([]); 
    const [historico, setHistorico] = useState([]); 

    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const lastLocationRef = useRef({ lat: 0, lng: 0, time: 0 });
    const inputFotoProvaRef = useRef(null);
    const [uploadingProva, setUploadingProva] = useState(false);

    const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

    // ==========================================
    // 1. LÓGICA DE LOGIN E CADASTRO
    // ==========================================
    const handleCadastro = async (e) => {
        e.preventDefault();
        if (etapaCadastro === 1) {
            if (!form.nome || !form.email || !form.telefone || !form.senha || !form.fotoPerfil) return alert("Preencha tudo.");
            setEtapaCadastro(2); return;
        }
        setCarregandoAuth(true);
        try {
            const urlPerfil = await uploadToImgBB(form.fotoPerfil);
            let urlCNH = null;
            if (form.fotoCNH) urlCNH = await uploadToImgBB(form.fotoCNH);

            const emailLimpo = form.email.toLowerCase().trim();
            const novoPerfil = { ...form, urlPerfil, urlCNH, statusAprovacao: 'PENDENTE', carteira: 0, ganhosHoje: 0, avaliacao: 5.0, dataCadastro: serverTimestamp() };
            delete novoPerfil.fotoPerfil; delete novoPerfil.fotoCNH;

            await setDoc(doc(db, "entregadores", emailLimpo), novoPerfil);
            setEntregador({ id: emailLimpo, ...novoPerfil });
        } catch (error) { alert("Erro ao realizar cadastro."); } 
        finally { setCarregandoAuth(false); }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setCarregandoAuth(true);
        try {
            const docSnap = await getDoc(doc(db, "entregadores", loginEmail.toLowerCase().trim()));
            if (docSnap.exists() && docSnap.data().senha === loginSenha) setEntregador({ id: docSnap.id, ...docSnap.data() });
            else alert("Email ou senha incorretos.");
        } catch (error) { alert("Erro ao fazer login."); } 
        finally { setCarregandoAuth(false); }
    };

    const logout = () => { setEntregador(null); setOnline(false); setMenuAberto(false); };

    // ==========================================
    // 2. ESCUTAR PEDIDOS (NUVEM, ATRIBUÍDOS E HISTÓRICO)
    // ==========================================
    useEffect(() => {
        if (!entregador || entregador.statusAprovacao !== 'APROVADO' || !online) return;

        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const todosPedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const minhasEntregas = todosPedidos.filter(p => p.entregadorId === entregador.id && ['PRONTO', 'SAIU_ENTREGA'].includes(p.status));
            const naNuvem = todosPedidos.filter(p => p.statusDespacho === 'Buscando Entregador');
            const meuHistorico = todosPedidos.filter(p => p.entregadorId === entregador.id && p.status === 'CONCLUIDO').reverse();

            if (naNuvem.length > pedidosNuvem.length) {
                audioRef.current.play().catch(()=>{});
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            }

            setPedidosAtribuidos(minhasEntregas);
            setPedidosNuvem(naNuvem);
            setHistorico(meuHistorico);
        });
        return () => unsubscribe();
    }, [entregador, online, pedidosNuvem.length]);

    // ==========================================
    // 3. AÇÕES OPERACIONAIS (Nuvem, GPS e Prova de Entrega)
    // ==========================================
    const aceitarCorridaNuvem = async (pedido) => {
        try {
            await updateDoc(doc(db, "pedidos", pedido.id), { entregadorId: entregador.id, statusDespacho: 'Atribuído', status: 'SAIU_ENTREGA', despachadoEm: serverTimestamp() });
            await updateDoc(doc(db, "entregadores", entregador.id), { status: 'Em Rota' });
            alert("Corrida aceita! Dirija-se à loja.");
        } catch (error) { alert("Alguém já aceitou ou ocorreu um erro!"); }
    };

    const solicitarGPS = () => {
        if (!navigator.geolocation) return alert("Seu aparelho não suporta GPS.");
        navigator.geolocation.getCurrentPosition(
            async () => { setOnline(true); await updateDoc(doc(db, "entregadores", entregador.id), { status: 'Livre' }); },
            () => { alert("Permita a localização."); setOnline(false); }
        );
    };

    const ficarOffline = async () => {
        setOnline(false);
        await updateDoc(doc(db, "entregadores", entregador.id), { status: 'Offline' });
    };

    useEffect(() => {
        if (!entregador || !online) return;
        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                await updateDoc(doc(db, "entregadores", entregador.id), { coords: { lat: latitude, lng: longitude }, ultimaAtualizacao: serverTimestamp() });
            },
            (err) => console.log("Erro GPS:", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [entregador, online]);

    const handleUploadProva = async (e) => {
        const file = e.target.files[0];
        if (!file || !detalhesPedido) return;

        setUploadingProva(true);
        try {
            const imageUrl = await uploadToImgBB(file);
            const taxaCorrida = detalhesPedido.valores?.taxaEntrega || 6.00;
            
            await updateDoc(doc(db, "pedidos", detalhesPedido.id), { status: 'CONCLUIDO', horarioConcluido: serverTimestamp(), provaEntregaUrl: imageUrl });
            
            // Atualiza Ganhos do Entregador
            const novosGanhos = (entregador.ganhosHoje || 0) + taxaCorrida;
            let novaCarteira = entregador.carteira || 0;
            
            // Se o cliente pagou em dinheiro na entrega, a carteira do app fica "devendo" à loja
            if (detalhesPedido.pagamento?.metodo === 'DINHEIRO') {
                novaCarteira += detalhesPedido.valores?.total || 0;
            }

            await updateDoc(doc(db, "entregadores", entregador.id), { carteira: novaCarteira, ganhosHoje: novosGanhos, status: 'Livre' });
            setEntregador({...entregador, carteira: novaCarteira, ganhosHoje: novosGanhos});
            setDetalhesPedido(null);
        } catch (error) { alert("Erro ao enviar prova."); }
        finally { setUploadingProva(false); }
    };

    const navegarPara = (tela) => { setTelaAtual(tela); setMenuAberto(false); };

    // ==========================================
    // RENDERIZAÇÃO
    // ==========================================
    if (!entregador) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
                <div className="w-20 h-20 bg-[#EA1D2C] rounded-3xl flex items-center justify-center text-white shadow-xl shadow-red-500/30 mb-6">
                    <Lucide.Bike size={40} />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-wide">Rodrigues Log</h1>
                <p className="font-bold text-slate-500 mb-8 tracking-widest text-[10px] uppercase">Portal do Parceiro</p>
                
                {authModo === 'LOGIN' ? (
                    <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                        <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full h-14 bg-slate-50 rounded-xl px-4 text-slate-800 font-bold outline-none focus:border-[#EA1D2C] border" required />
                        <input type="password" placeholder="Senha" value={loginSenha} onChange={e => setLoginSenha(e.target.value)} className="w-full h-14 bg-slate-50 rounded-xl px-4 text-slate-800 font-bold outline-none focus:border-[#EA1D2C] border" required />
                        <button type="submit" disabled={carregandoAuth} className="w-full h-14 bg-[#EA1D2C] text-white rounded-xl font-black uppercase tracking-widest shadow-lg mt-4 active:scale-95 flex items-center justify-center">
                            {carregandoAuth ? <Lucide.Loader2 className="animate-spin" /> : 'Aceder'}
                        </button>
                        <button type="button" onClick={() => setAuthModo('CADASTRO')} className="w-full text-center text-xs font-bold text-slate-500 pt-4 underline">Fazer Cadastro</button>
                    </form>
                ) : (
                    <form onSubmit={handleCadastro} className="w-full max-w-sm space-y-4 bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                        {etapaCadastro === 1 ? (
                            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <input type="text" placeholder="Nome Completo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border" required />
                                <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border" required />
                                <input type="tel" placeholder="Telemóvel / WhatsApp" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border" required />
                                <input type="password" placeholder="Criar Senha" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border" required />
                                <button type="submit" className="w-full h-14 bg-slate-800 text-white rounded-xl font-black uppercase text-xs">Próximo →</button>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <select value={form.modalidade} onChange={e => setForm({...form, modalidade: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border">
                                    <option value="MOTO">Moto</option>
                                    <option value="BIKE">Bicicleta</option>
                                    <option value="CARRO">Carro</option>
                                </select>
                                <input type="text" placeholder="Matrícula do Veículo" value={form.placa} onChange={e => setForm({...form, placa: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border uppercase" required />
                                <div className="flex gap-2 pt-4">
                                    <button type="button" onClick={() => setEtapaCadastro(1)} className="w-1/3 h-14 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs">Voltar</button>
                                    <button type="submit" disabled={carregandoAuth} className="w-2/3 h-14 bg-[#EA1D2C] text-white rounded-xl font-black uppercase text-xs flex justify-center items-center">
                                        {carregandoAuth ? <Lucide.Loader2 className="animate-spin" /> : 'Finalizar'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                        <button type="button" onClick={() => {setAuthModo('LOGIN'); setEtapaCadastro(1);}} className="w-full text-center text-xs font-bold text-slate-500 pt-2 underline">Já tenho conta</button>
                    </form>
                )}
            </div>
        );
    }

    if (entregador.statusAprovacao === 'PENDENTE') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <Lucide.Clock size={60} className="text-amber-500 mb-4" />
                <h2 className="text-2xl font-black text-slate-800 uppercase">Em Análise</h2>
                <p className="text-slate-500 font-bold mt-2 text-sm">Aguarde a aprovação da sua conta pelo Gestor.</p>
                <button onClick={logout} className="mt-10 text-[#EA1D2C] font-bold uppercase text-xs border border-red-200 px-6 py-3 rounded-full">Sair da Conta</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans text-slate-900 overflow-x-hidden relative pb-20">
            <input type="file" accept="image/*" capture="environment" ref={inputFotoProvaRef} onChange={handleUploadProva} className="hidden" />

            {/* MENU LATERAL DRAWER */}
            <AnimatePresence>
                {menuAberto && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 flex backdrop-blur-sm">
                        <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: 'spring', damping: 25, stiffness: 250 }} 
                            className="w-4/5 max-w-[320px] bg-white h-full shadow-2xl flex flex-col">
                            
                            {/* Cabeçalho do Menu */}
                            <div className="p-6 bg-[#EA1D2C] text-white">
                                <div className="w-16 h-16 bg-white/20 rounded-2xl mb-4 flex items-center justify-center overflow-hidden border-2 border-white/50">
                                    {entregador.urlPerfil ? <img src={entregador.urlPerfil} className="w-full h-full object-cover" alt="Perfil"/> : <Lucide.User size={30}/>}
                                </div>
                                <h2 className="text-xl font-black uppercase leading-tight truncate">{entregador.nome}</h2>
                                <p className="text-xs font-bold text-white/80 uppercase mt-1 flex items-center gap-1"><Lucide.Star size={12} fill="currentColor"/> {entregador.avaliacao?.toFixed(1)} • {entregador.modalidade}</p>
                            </div>
                            
                            {/* Links de Navegação */}
                            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                                <button onClick={() => navegarPara('ENTREGAS')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-xs transition-all ${telaAtual === 'ENTREGAS' ? 'bg-red-50 text-[#EA1D2C]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.MapPin size={20} /> Mapa de Entregas
                                </button>
                                <button onClick={() => navegarPara('CARTEIRA')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-xs transition-all ${telaAtual === 'CARTEIRA' ? 'bg-red-50 text-[#EA1D2C]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.Wallet size={20} /> Carteira & Ganhos
                                </button>
                                <button onClick={() => navegarPara('HISTORICO')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-xs transition-all ${telaAtual === 'HISTORICO' ? 'bg-red-50 text-[#EA1D2C]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.History size={20} /> Histórico de Corridas
                                </button>
                                <button onClick={() => navegarPara('PERFIL')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-xs transition-all ${telaAtual === 'PERFIL' ? 'bg-red-50 text-[#EA1D2C]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Lucide.Settings size={20} /> Conta & Veículo
                                </button>
                            </div>
                            
                            <div className="p-4 border-t border-slate-100">
                                <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-xl font-black uppercase text-xs text-slate-500 hover:bg-slate-50">
                                    <Lucide.LogOut size={20} /> Terminar Sessão
                                </button>
                            </div>
                        </motion.div>
                        <div className="flex-1" onClick={() => setMenuAberto(false)} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER FIXO */}
            <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-slate-200">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMenuAberto(true)} className="p-2 text-slate-600 bg-slate-50 rounded-xl active:scale-95">
                            <Lucide.Menu size={24} />
                        </button>
                        <div>
                            <h1 className="font-black text-slate-800 uppercase leading-none">{telaAtual}</h1>
                            {online && telaAtual === 'ENTREGAS' && <p className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1 mt-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"/> Online no Radar</p>}
                        </div>
                    </div>
                    {telaAtual === 'ENTREGAS' && (
                        online ? (
                            <button onClick={ficarOffline} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 active:scale-95">
                                <Lucide.Power size={14} /> Offline
                            </button>
                        ) : (
                            <button onClick={solicitarGPS} className="px-3 py-2 bg-[#EA1D2C] text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1 shadow-lg animate-pulse active:scale-95">
                                <Lucide.MapPin size={14} /> Ficar Online
                            </button>
                        )
                    )}
                </div>
            </header>

            {/* CONTEÚDO DINÂMICO CONFORME A TELA */}
            <main className="p-4">
                {/* TELA: MAPA DE ENTREGAS */}
                {telaAtual === 'ENTREGAS' && (
                    !online ? (
                        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center opacity-40">
                            <Lucide.Coffee size={60} className="mb-4 text-slate-500" />
                            <h2 className="text-xl font-black uppercase text-slate-700">Pausa Ativa</h2>
                            <p className="text-sm font-bold mt-2 text-slate-500">Fique online para receber novos chamados de entrega.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* RADAR DE NUVEM */}
                            {pedidosNuvem.length > 0 && (
                                <div className="space-y-4">
                                    <h2 className="font-black uppercase text-[#EA1D2C] text-sm flex items-center gap-2 animate-pulse">
                                        <Lucide.Radar size={16} /> Radar de Corridas!
                                    </h2>
                                    {pedidosNuvem.map(pedido => (
                                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={pedido.id} 
                                            className="bg-amber-100 rounded-3xl p-5 shadow-lg border-2 border-amber-400 relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-[10px] font-black uppercase text-amber-800">Pedido #{pedido.id.slice(-4)}</p>
                                                <span className="text-xs font-black text-amber-900 bg-amber-300 px-2 py-1 rounded">R$ {pedido.valores?.taxaEntrega?.toFixed(2) || '6.00'} (Sua Taxa)</span>
                                            </div>
                                            <h3 className="font-black text-slate-800">{pedido.endereco?.rua}, {pedido.endereco?.numero}</h3>
                                            <p className="text-xs font-bold text-slate-600 mb-4">{pedido.endereco?.bairro}</p>
                                            
                                            <button onClick={() => aceitarCorridaNuvem(pedido)} className="w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-sm shadow-md active:scale-95 flex items-center justify-center gap-2">
                                                Aceitar Agora <Lucide.Zap size={18} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {/* ENTREGAS ATRIBUÍDAS */}
                            <div>
                                <h2 className="font-black uppercase text-slate-800 text-sm mb-4">Suas Corridas Atuais</h2>
                                {pedidosAtribuidos.length === 0 && pedidosNuvem.length === 0 ? (
                                    <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center">
                                        <Lucide.Map size={40} className="mx-auto text-slate-300 mb-3" />
                                        <p className="font-bold text-slate-500 text-sm">Aguardando novos despachos...</p>
                                    </div>
                                ) : (
                                    pedidosAtribuidos.map(pedido => (
                                        <div key={pedido.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 mb-4">
                                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">A Receber do Cliente</p>
                                                    <p className="font-black text-slate-800 text-xl">R$ {pedido.valores?.total?.toFixed(2)}</p>
                                                    <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase bg-amber-50 px-2 py-0.5 rounded inline-block">{pedido.pagamento?.metodo}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-slate-400">Status</p>
                                                    <p className="text-xs font-black uppercase mt-1 text-[#EA1D2C]">Em Rota</p>
                                                </div>
                                            </div>
                                            <div className="mb-6 flex gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0 text-[#EA1D2C]"><Lucide.MapPin size={20}/></div>
                                                <div>
                                                    <h3 className="font-black text-slate-800 text-sm">{pedido.endereco?.rua}, {pedido.endereco?.numero}</h3>
                                                    <p className="text-xs font-bold text-slate-500">{pedido.endereco?.bairro}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => window.open(`http://googleusercontent.com/maps.google.com/4{pedido.endereco?.rua}, ${pedido.endereco?.numero}, Campo Grande`, '_blank')} className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-700 font-black uppercase text-[10px] flex items-center justify-center gap-1 active:scale-95 border border-slate-200">
                                                        <Lucide.Navigation size={16} /> GPS Route
                                                    </button>
                                                    <a href={`https://wa.me/55${pedido.cliente?.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="w-12 h-14 rounded-xl bg-[#25D366]/10 text-[#25D366] font-black flex items-center justify-center active:scale-95 border border-[#25D366]/20">
                                                        <Lucide.MessageCircle size={20} />
                                                    </a>
                                                </div>
                                                <button disabled={uploadingProva} onClick={() => { setDetalhesPedido(pedido); inputFotoProvaRef.current.click(); }} className="w-full py-4 rounded-xl bg-[#82C91E] text-[#4B0082] font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95">
                                                    {uploadingProva && detalhesPedido?.id === pedido.id ? <Lucide.Loader2 className="animate-spin" /> : <><Lucide.Camera size={18} /> Confirmar Entrega</>}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                )}

                {/* TELA: CARTEIRA (FINANCEIRO) */}
                {telaAtual === 'CARTEIRA' && (
                    <div className="space-y-4">
                        <div className="bg-[#4B0082] rounded-3xl p-6 shadow-lg text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-2 flex items-center gap-1.5"><Lucide.TrendingUp size={12}/> Ganhos de Hoje</p>
                            <p className="text-4xl font-black italic mb-4">R$ {entregador.ganhosHoje?.toFixed(2) || '0.00'}</p>
                            
                            <div className="border-t border-white/20 pt-4 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-white/70">A Repassar p/ Loja</p>
                                    <p className="text-lg font-black text-red-300 mt-1">R$ {entregador.carteira?.toFixed(2) || '0.00'}</p>
                                </div>
                                <Lucide.Wallet size={32} className="text-white/30" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="font-black uppercase text-xs text-slate-800 flex items-center gap-2 mb-2"><Lucide.Info size={16} className="text-[#EA1D2C]"/> Entenda a sua Carteira</h3>
                            <p className="text-xs text-slate-500 font-bold leading-relaxed">
                                Os "Ganhos de Hoje" são as taxas de entrega que você acumulou. O "Repasse p/ Loja" é o dinheiro vivo que você recebeu dos clientes e que deve ser devolvido ao restaurante no fim do turno.
                            </p>
                        </div>
                    </div>
                )}

                {/* TELA: HISTÓRICO DE CORRIDAS */}
                {telaAtual === 'HISTORICO' && (
                    <div className="space-y-3">
                        {historico.length === 0 ? (
                            <div className="text-center py-20 opacity-50">
                                <Lucide.History size={40} className="mx-auto text-slate-400 mb-3" />
                                <p className="text-sm font-black uppercase text-slate-500">Sem corridas finalizadas.</p>
                            </div>
                        ) : (
                            historico.map(pedido => (
                                <div key={pedido.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">#{pedido.id.slice(-4)} • {new Date(pedido.horarioConcluido?.toDate()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                                        <h4 className="text-sm font-black text-slate-800 uppercase mt-1">{pedido.endereco?.bairro}</h4>
                                        <p className="text-[10px] font-bold text-green-500 uppercase mt-1">Concluído</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Taxa</p>
                                        <p className="text-sm font-black text-[#4B0082]">R$ {pedido.valores?.taxaEntrega?.toFixed(2) || '6.00'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* TELA: PERFIL E VEÍCULO */}
                {telaAtual === 'PERFIL' && (
                    <div className="space-y-4">
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 text-center shadow-sm">
                            <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full mb-4 overflow-hidden border-4 border-slate-50">
                                {entregador.urlPerfil ? <img src={entregador.urlPerfil} className="w-full h-full object-cover" /> : <Lucide.User size={40}/>}
                            </div>
                            <h2 className="text-lg font-black uppercase text-slate-800">{entregador.nome}</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase">{entregador.email}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase mt-1">{entregador.telefone}</p>
                        </div>
                        
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="font-black uppercase text-sm text-slate-800 mb-4 border-b border-slate-100 pb-2">Informações do Veículo</h3>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-black text-slate-400 uppercase">Modalidade</span>
                                <span className="text-xs font-black text-slate-800 uppercase bg-slate-100 px-3 py-1 rounded">{entregador.modalidade}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-slate-400 uppercase">Matrícula</span>
                                <span className="text-xs font-black text-slate-800 uppercase bg-slate-100 px-3 py-1 rounded">{entregador.placa || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}