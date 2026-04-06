import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

const IMGBB_API_KEY = 'e3e4b384bff32476d8b8c517a0e31582';

// Função auxiliar para enviar fotos para o ImgBB
const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error("Erro no upload da imagem");
    return data.data.url;
};

export default function EntregadorAppV2() {
    // --- ESTADOS DE AUTENTICAÇÃO E CADASTRO ---
    const [entregador, setEntregador] = useState(null);
    const [authModo, setAuthModo] = useState('LOGIN'); // LOGIN | CADASTRO
    const [etapaCadastro, setEtapaCadastro] = useState(1);
    const [carregandoAuth, setCarregandoAuth] = useState(false);

    // Formulário de Cadastro
    const [form, setForm] = useState({
        nome: '', email: '', telefone: '', senha: '', modalidade: 'MOTO', placa: '', fotoPerfil: null, fotoCNH: null
    });

    // Formulário de Login
    const [loginEmail, setLoginEmail] = useState('');
    const [loginSenha, setLoginSenha] = useState('');

    // --- ESTADOS DO APP (PÓS-LOGIN) ---
    const [online, setOnline] = useState(false);
    const [pedidosAtribuidos, setPedidosAtribuidos] = useState([]);
    const [detalhesPedido, setDetalhesPedido] = useState(null);
    const lastLocationRef = useRef({ lat: 0, lng: 0, time: 0 });
    const inputFotoProvaRef = useRef(null);
    const [uploadingProva, setUploadingProva] = useState(false);

    // ==========================================
    // 1. LÓGICA DE LOGIN E CADASTRO
    // ==========================================
    const handleCadastro = async (e) => {
        e.preventDefault();
        if (etapaCadastro === 1) {
            if (!form.nome || !form.email || !form.telefone || !form.senha || !form.fotoPerfil) {
                return alert("Preencha todos os campos e adicione uma foto de perfil.");
            }
            setEtapaCadastro(2);
            return;
        }

        if (['MOTO', 'CARRO'].includes(form.modalidade) && (!form.placa || !form.fotoCNH)) {
            return alert("Para veículos motorizados, CNH e Placa são obrigatórios.");
        }

        setCarregandoAuth(true);
        try {
            // 1. Upload das fotos para o ImgBB
            const urlPerfil = await uploadToImgBB(form.fotoPerfil);
            let urlCNH = null;
            if (form.fotoCNH) urlCNH = await uploadToImgBB(form.fotoCNH);

            // 2. Salva no Firestore (Usando o Email como ID do documento para facilitar o login)
            const emailLimpo = form.email.toLowerCase().trim();
            const novoPerfil = {
                nome: form.nome,
                email: emailLimpo,
                telefone: form.telefone,
                senha: form.senha, // Nota: Em produção real, usa-se Firebase Auth. Aqui usamos Firestore direto.
                modalidade: form.modalidade,
                placa: form.placa.toUpperCase(),
                urlPerfil,
                urlCNH,
                statusAprovacao: 'PENDENTE', // Bloqueia o entregador até a loja aprovar
                carteira: 0,
                dataCadastro: serverTimestamp()
            };

            await setDoc(doc(db, "entregadores", emailLimpo), novoPerfil);
            setEntregador({ id: emailLimpo, ...novoPerfil });
        } catch (error) {
            alert("Erro ao realizar cadastro. Tente novamente.");
            console.error(error);
        } finally {
            setCarregandoAuth(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setCarregandoAuth(true);
        try {
            const emailLimpo = loginEmail.toLowerCase().trim();
            const docSnap = await getDoc(doc(db, "entregadores", emailLimpo));
            
            if (docSnap.exists() && docSnap.data().senha === loginSenha) {
                setEntregador({ id: docSnap.id, ...docSnap.data() });
            } else {
                alert("Email ou senha incorretos.");
            }
        } catch (error) {
            alert("Erro ao fazer login.");
        } finally {
            setCarregandoAuth(false);
        }
    };

    const logout = () => { setEntregador(null); setOnline(false); };

    // ==========================================
    // 2. SINCRONIZAÇÃO DE PEDIDOS (Atribuídos pela Loja)
    // ==========================================
    useEffect(() => {
        if (!entregador || entregador.statusAprovacao !== 'APROVADO' || !online) return;

        const q = query(collection(db, "pedidos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const todosPedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // FILTRO ESTREITO: Só pega o que foi despachado EXATAMENTE para ele
            const minhasEntregas = todosPedidos.filter(p => 
                p.entregadorId === entregador.id && 
                ['PRONTO', 'SAIU_ENTREGA'].includes(p.status)
            );
            setPedidosAtribuidos(minhasEntregas);
        });
        return () => unsubscribe();
    }, [entregador, online]);

    // ==========================================
    // 3. PERMISSÃO DE GPS E RASTREIO INTELIGENTE
    // ==========================================
    const solicitarGPS = () => {
        if (!navigator.geolocation) return alert("Seu aparelho não suporta GPS.");
        navigator.geolocation.getCurrentPosition(
            () => setOnline(true),
            () => { alert("Você precisa permitir a localização para ficar Online e receber corridas."); setOnline(false); }
        );
    };

    useEffect(() => {
        if (!entregador || !online) return;

        const calcDistancia = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3; const rlat1 = lat1 * Math.PI/180; const rlat2 = lat2 * Math.PI/180;
            const a = Math.sin((lat2-lat1) * Math.PI/180/2)**2 + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin((lon2-lon1) * Math.PI/180/2)**2;
            return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
        };

        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const now = Date.now();
                const { latitude, longitude } = pos.coords;
                const last = lastLocationRef.current;
                
                if (calcDistancia(last.lat, last.lng, latitude, longitude) > 20 || (now - last.time) > 20000) {
                    lastLocationRef.current = { lat: latitude, lng: longitude, time: now };
                    await updateDoc(doc(db, "entregadores", entregador.id), { 
                        localizacao: { lat: latitude, lng: longitude }, 
                        ultimaAtualizacao: serverTimestamp() 
                    });
                }
            },
            (err) => console.log("Erro GPS:", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [entregador, online]);

    // ==========================================
    // 4. AÇÕES DA ENTREGA
    // ==========================================
    const confirmarColeta = async (pedido) => {
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        await updateDoc(doc(db, "pedidos", pedido.id), { status: 'SAIU_ENTREGA', horarioSaida: serverTimestamp() });
        setDetalhesPedido(null);
    };

    const handleUploadProva = async (e) => {
        const file = e.target.files[0];
        if (!file || !detalhesPedido) return;

        setUploadingProva(true);
        try {
            const imageUrl = await uploadToImgBB(file);
            await updateDoc(doc(db, "pedidos", detalhesPedido.id), { 
                status: 'CONCLUIDO', horarioConcluido: serverTimestamp(), provaEntregaUrl: imageUrl 
            });
            await updateDoc(doc(db, "entregadores", entregador.id), { carteira: (entregador.carteira || 0) + 5 });
            setEntregador({...entregador, carteira: (entregador.carteira || 0) + 5});
            setDetalhesPedido(null);
        } catch (error) { alert("Erro ao enviar prova de entrega."); }
        finally { setUploadingProva(false); }
    };

    // --- COMPONENTES VISUAIS ANTI-ERRO ---
    const BotaoArrastar = ({ onAccept, texto }) => (
        <div className="relative w-full h-16 bg-blue-50 rounded-2xl overflow-hidden flex items-center justify-center border border-blue-200">
            <p className="text-blue-500 font-black uppercase text-xs z-0 tracking-widest">{texto} →</p>
            <motion.div drag="x" dragConstraints={{ left: 0, right: 220 }} dragElastic={0.1} onDragEnd={(e, info) => { if (info.offset.x > 180) onAccept(); }}
                className="absolute left-1 w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg cursor-grab active:cursor-grabbing z-10">
                <Lucide.ChevronsRight size={28} />
            </motion.div>
        </div>
    );

    // ==========================================
    // RENDERIZAÇÃO DAS TELAS
    // ==========================================

    // TELA A: LOGIN E CADASTRO
    if (!entregador) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
                <div className="w-20 h-20 bg-[#EA1D2C] rounded-3xl flex items-center justify-center text-white shadow-xl shadow-red-500/30 mb-6">
                    <Lucide.Bike size={40} />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-wide">Rodrigues Log</h1>
                <p className="font-bold text-slate-500 mb-8 tracking-widest text-[10px] uppercase">Portal do Entregador</p>
                
                {authModo === 'LOGIN' ? (
                    <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full h-14 bg-slate-50 rounded-xl px-4 text-slate-800 font-bold outline-none border border-slate-200 focus:border-[#EA1D2C]" required />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Senha</label>
                            <input type="password" value={loginSenha} onChange={e => setLoginSenha(e.target.value)} className="w-full h-14 bg-slate-50 rounded-xl px-4 text-slate-800 font-bold outline-none border border-slate-200 focus:border-[#EA1D2C]" required />
                        </div>
                        <button type="submit" disabled={carregandoAuth} className="w-full h-14 bg-[#EA1D2C] text-white rounded-xl font-black uppercase tracking-widest shadow-lg mt-4 active:scale-95 flex items-center justify-center">
                            {carregandoAuth ? <Lucide.Loader2 className="animate-spin" /> : 'Entrar na Conta'}
                        </button>
                        <button type="button" onClick={() => setAuthModo('CADASTRO')} className="w-full text-center text-xs font-bold text-slate-500 pt-4 underline">Não tem conta? Cadastre-se</button>
                    </form>
                ) : (
                    <form onSubmit={handleCadastro} className="w-full max-w-sm space-y-4 bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                        {etapaCadastro === 1 ? (
                            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <div className="flex flex-col items-center mb-6">
                                    <label className="w-24 h-24 bg-slate-100 rounded-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 cursor-pointer overflow-hidden relative">
                                        {form.fotoPerfil ? <img src={URL.createObjectURL(form.fotoPerfil)} className="w-full h-full object-cover" /> : <><Lucide.Camera className="text-slate-400 mb-1" /><span className="text-[8px] font-bold text-slate-400 uppercase">Foto Rosto</span></>}
                                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={e => setForm({...form, fotoPerfil: e.target.files[0]})} />
                                    </label>
                                </div>
                                <input type="text" placeholder="Nome Completo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border border-slate-200" required />
                                <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border border-slate-200" required />
                                <input type="tel" placeholder="Telefone / WhatsApp" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border border-slate-200" required />
                                <input type="password" placeholder="Crie uma Senha" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border border-slate-200" required />
                                <button type="submit" className="w-full h-14 bg-slate-800 text-white rounded-xl font-black uppercase text-xs">Próxima Etapa →</button>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Veículo</label>
                                    <select value={form.modalidade} onChange={e => setForm({...form, modalidade: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border border-slate-200">
                                        <option value="MOTO">Moto</option>
                                        <option value="BIKE">Bicicleta</option>
                                        <option value="CARRO">Carro</option>
                                    </select>
                                </div>
                                {['MOTO', 'CARRO'].includes(form.modalidade) && (
                                    <>
                                        <input type="text" placeholder="Placa do Veículo" value={form.placa} onChange={e => setForm({...form, placa: e.target.value})} className="w-full h-12 bg-slate-50 rounded-xl px-4 text-sm font-bold border border-slate-200 uppercase" required />
                                        <label className="w-full h-24 bg-slate-50 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 cursor-pointer">
                                            {form.fotoCNH ? <span className="text-green-500 font-bold text-xs"><Lucide.CheckCircle className="inline mb-1"/> CNH Anexada</span> : <><Lucide.FileImage className="text-slate-400 mb-1" /><span className="text-[10px] font-bold text-slate-400 uppercase">Anexar Foto da CNH</span></>}
                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setForm({...form, fotoCNH: e.target.files[0]})} />
                                        </label>
                                    </>
                                )}
                                <div className="flex gap-2 pt-4">
                                    <button type="button" onClick={() => setEtapaCadastro(1)} className="w-1/3 h-14 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs">Voltar</button>
                                    <button type="submit" disabled={carregandoAuth} className="w-2/3 h-14 bg-[#EA1D2C] text-white rounded-xl font-black uppercase text-xs flex items-center justify-center">
                                        {carregandoAuth ? <Lucide.Loader2 className="animate-spin" /> : 'Finalizar Cadastro'}
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

    // TELA B: SALA DE ESPERA (Aprovação Pendente)
    if (entregador.statusAprovacao === 'PENDENTE') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 mb-6 relative">
                    <img src={entregador.urlPerfil} className="w-full h-full object-cover rounded-full border-4 border-slate-200 grayscale" alt="Perfil" />
                    <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-2 rounded-full"><Lucide.Clock size={20} /></div>
                </div>
                <h2 className="text-2xl font-black text-slate-800 uppercase">Cadastro em Análise</h2>
                <p className="text-slate-500 font-bold mt-2 text-sm max-w-xs">A equipe do Rodrigues Açaí está analisando seus documentos. Volte mais tarde ou entre em contato com a loja.</p>
                <button onClick={logout} className="mt-10 text-[#EA1D2C] font-bold uppercase text-xs border border-red-200 px-6 py-3 rounded-full">Sair da Conta</button>
            </div>
        );
    }

    // TELA C: APP PRINCIPAL (Logado e Aprovado)
    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans pb-24 text-slate-900">
            <input type="file" accept="image/*" capture="environment" ref={inputFotoProvaRef} onChange={handleUploadProva} className="hidden" />

            {/* HEADER DO ENTREGADOR */}
            <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-slate-200">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src={entregador.urlPerfil} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100" />
                        <div>
                            <h1 className="font-black text-slate-800 leading-none truncate w-32">{entregador.nome}</h1>
                            <div className="flex items-center gap-1 mt-1">
                                <Lucide.Star size={10} fill="#f59e0b" className="text-amber-500" />
                                <span className="text-[10px] font-bold text-slate-500">5.0 • {entregador.modalidade}</span>
                            </div>
                        </div>
                    </div>
                    {online ? (
                        <button onClick={() => setOnline(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                            Ficar Offline <Lucide.Power size={14} />
                        </button>
                    ) : (
                        <button onClick={solicitarGPS} className="px-4 py-2 bg-[#EA1D2C] text-white rounded-full text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-red-500/30 animate-pulse">
                            <Lucide.MapPin size={14} /> Ficar Online
                        </button>
                    )}
                </div>
            </header>

            {!online ? (
                <div className="flex flex-col items-center justify-center pt-32 px-6 text-center opacity-40">
                    <Lucide.Coffee size={60} className="mb-4 text-slate-500" />
                    <h2 className="text-xl font-black uppercase text-slate-700">Pausa para o café</h2>
                    <p className="text-sm font-bold mt-2 text-slate-500">Fique online e permita o GPS para receber as rotas despachadas para você.</p>
                </div>
            ) : (
                <main className="p-4 space-y-4">
                    <div className="flex justify-between items-end mb-2">
                        <h2 className="font-black uppercase text-slate-800 text-lg">Suas Entregas</h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200 px-2 py-1 rounded-full">{pedidosAtribuidos.length} Pendentes</span>
                    </div>

                    <AnimatePresence>
                        {pedidosAtribuidos.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-3xl border border-slate-200 border-dashed text-center mt-10">
                                <Lucide.CheckCircle2 size={40} className="mx-auto text-slate-300 mb-3" />
                                <p className="font-bold text-slate-500 text-sm">Nenhum pedido atribuído a você no momento.</p>
                            </motion.div>
                        ) : (
                            pedidosAtribuidos.map(pedido => (
                                <motion.div layout initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={pedido.id} 
                                    className={`bg-white rounded-3xl p-5 shadow-sm border-2 overflow-hidden ${pedido.status === 'PRONTO' ? 'border-blue-400' : 'border-[#EA1D2C]'}`}>
                                    
                                    <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pedido #{pedido.id.slice(-4)}</p>
                                            <p className="font-black text-slate-800 text-xl">R$ {pedido.valores?.total?.toFixed(2)}</p>
                                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block">{pedido.pagamento?.metodo}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-slate-400">Status</p>
                                            <p className={`text-xs font-black uppercase mt-1 ${pedido.status === 'PRONTO' ? 'text-blue-500' : 'text-[#EA1D2C]'}`}>
                                                {pedido.status === 'PRONTO' ? 'Retirar na Loja' : 'Em Rota'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0 text-slate-500"><Lucide.MapPin size={20}/></div>
                                            <div>
                                                <h3 className="font-black text-slate-800">{pedido.endereco?.rua}, {pedido.endereco?.numero}</h3>
                                                <p className="text-xs font-bold text-slate-500">{pedido.endereco?.bairro} {pedido.endereco?.complemento && `- ${pedido.endereco.complemento}`}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {pedido.status === 'PRONTO' ? (
                                        <BotaoArrastar texto="Confirmar Coleta" onAccept={() => confirmarColeta(pedido)} />
                                    ) : (
                                        <div className="space-y-3">
                                            <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=$$${pedido.endereco?.rua}, ${pedido.endereco?.numero}`, '_blank')} className="w-full py-4 rounded-xl bg-slate-800 text-white font-black uppercase text-xs flex items-center justify-center gap-2">
                                                <Lucide.Navigation size={18} /> Navegar pelo GPS
                                            </button>
                                            <button disabled={uploadingProva} onClick={() => { setDetalhesPedido(pedido); inputFotoProvaRef.current.click(); }} className="w-full py-4 rounded-xl bg-green-500 text-white font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95">
                                                {uploadingProva && detalhesPedido?.id === pedido.id ? <Lucide.Loader2 className="animate-spin" /> : <><Lucide.Camera size={18} /> Tirar Foto e Concluir</>}
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </main>
            )}
        </div>
    );
}