import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { db } from '../services/firebase'; 
// CORREÇÃO: setDoc adicionado à importação
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy, setDoc } from "firebase/firestore";
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// 1. SISTEMA DE TOAST (NOTIFICAÇÕES DO PAINEL)
// ============================================================================
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                            className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-black uppercase tracking-wide text-white border-b-4
                            ${t.type === 'error' ? 'bg-[#EA1D2C] border-red-900' : t.type === 'success' ? 'bg-[#82C91E] text-[#4B0082] border-green-700' : 'bg-slate-800 border-slate-900'}`}>
                            {t.type === 'error' && <Lucide.AlertOctagon size={28} className="shrink-0" />}
                            {t.type === 'success' && <Lucide.CheckSquare size={28} className="shrink-0" />}
                            {t.type === 'info' && <Lucide.Info size={28} className="shrink-0" />}
                            <div className="flex-1 leading-tight">{t.msg}</div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

// ============================================================================
// 2. CONFIGURAÇÕES E FORMATAÇÕES
// ============================================================================
const CLOUDINARY_CLOUD_NAME = 'dbd9x1o02'; 
const CLOUDINARY_UPLOAD_PRESET = 'fc3i8urq'; 
const LOGO_APP = 'https://res.cloudinary.com/dbd9x1o02/image/upload/v1774934438/rodrigues_geral/vvrauvi5vxs3ukdqd1qn.png';

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

const formatarCPF = (v) => {
    if (!v) return '';
    return v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

// ============================================================================
// 3. COMPONENTE PRINCIPAL DA FROTA
// ============================================================================
const PainelEntregadoresContent = () => {
    const toast = useToast();
    const [entregadores, setEntregadores] = useState([]);
    
    // --- ESTADOS DE UI E NAVEGAÇÃO ---
    const [tabAtiva, setTabAtiva] = useState('ATIVOS'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [modalAberto, setModalAberto] = useState(false);
    const [fotoAmpliada, setFotoAmpliada] = useState(null); 
    const [uploading, setUploading] = useState(false);
    
    // --- ESTADOS DO MODAL DE SENHA ---
    const [modalSenha, setModalSenha] = useState({ aberto: false, pilotoId: null, pilotoNome: '', novaSenha: '' });
    const [mostrarSenha, setMostrarSenha] = useState(false);

    // --- ESTADOS DE FORMULÁRIO (CRIAR/EDITAR) ---
    const [editandoId, setEditandoId] = useState(null);
    const [formData, setFormData] = useState({
        nome: '', cpf: '', telefone: '', placa: '', urlPerfil: '', modalidade: 'MOTO',
        statusAprovacao: 'PENDENTE', status: 'Offline', aceitaDinheiro: true, temMaquininha: true, frequenciaRepasse: 'SEMANAL', senha: ''
    });

    // ------------------------------------------------------------------------
    // ESCUTA EM TEMPO REAL DO FIREBASE
    // ------------------------------------------------------------------------
    useEffect(() => {
        const q = query(collection(db, "entregadores"), orderBy("dataCadastro", "desc"));
        // CORREÇÃO: Adicionado tratamento de erro para queda de conexão/permissões
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setEntregadores(data);
        }, (error) => {
            console.error("Erro Firebase (Entregadores):", error);
            toast("Erro de conexão. Verifique sua internet.", "error");
        });
        return () => unsub();
    }, [toast]);

    // ------------------------------------------------------------------------
    // GESTÃO DE IMAGENS (CLOUDINARY)
    // ------------------------------------------------------------------------
    const handleUploadCloudinary = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setUploading(true);
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        data.append("folder", "rodrigues_acai/entregadores_admin");

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: data });
            const fileRes = await res.json();
            if (!fileRes.secure_url) throw new Error("Falha no link da imagem");
            
            setFormData({ ...formData, urlPerfil: fileRes.secure_url });
            toast("Foto enviada com sucesso!", "success");
        } catch (err) { 
            toast("Erro no upload da foto. Verifique sua conexão.", "error"); 
        } finally { 
            setUploading(false); 
        }
    };

    // ------------------------------------------------------------------------
    // AÇÕES DE BASE DE DADOS (CRUD)
    // ------------------------------------------------------------------------
    const salvarEntregador = async (e) => {
        e.preventDefault();
        const cpfLimpo = formData.cpf.replace(/\D/g, '');
        if (cpfLimpo.length !== 11) return toast("CPF inválido. Necessário 11 dígitos.", "error");

        try {
            const payload = { ...formData, cpf: cpfLimpo };
            
            if (editandoId) {
                await updateDoc(doc(db, "entregadores", editandoId), payload);
                toast(`Dados de ${formData.nome} atualizados!`, "success");
            } else {
                await setDoc(doc(db, "entregadores", cpfLimpo), { 
                    ...payload, 
                    saldoLiquido: 0, ganhosTaxas: 0, debitosLoja: 0, 
                    entregasRealizadas: 0, dataCadastro: serverTimestamp(),
                    statusAprovacao: 'APROVADO'
                });
                toast(`Piloto ${formData.nome} cadastrado com sucesso!`, "success");
            }
            setModalAberto(false);
        } catch (e) {
            console.error(e);
            toast("Erro ao salvar entregador no banco de dados.", "error");
        }
    };

    const aprovarEntregador = async (ent) => {
        if(window.confirm(`Aprovar o piloto ${ent.nome} para a frota?`)) {
            try {
                await updateDoc(doc(db, "entregadores", ent.id), { 
                    statusAprovacao: 'APROVADO', status: 'Offline', dataAprovacao: serverTimestamp()
                });
                toast(`O piloto ${ent.nome} foi APROVADO!`, "success");
            } catch (e) { toast("Falha ao tentar aprovar piloto.", "error"); }
        }
    };

    const excluirEntregador = async (id, nome) => {
        if(window.confirm(`ATENÇÃO: Deseja EXCLUIR permanentemente o piloto ${nome}? Esta ação é irreversível.`)) {
            try {
                await deleteDoc(doc(db, "entregadores", id));
                toast(`Piloto ${nome} foi excluído do sistema.`, "success");
            } catch (e) {
                toast("Erro ao excluir motorista. Verifique permissões.", "error");
            }
        }
    };

    // ------------------------------------------------------------------------
    // GESTÃO DE SENHAS (RECUPERAÇÃO / RESET)
    // ------------------------------------------------------------------------
    const salvarNovaSenha = async (e) => {
        e.preventDefault();
        if (modalSenha.novaSenha.length < 4) return toast("A senha deve ter pelo menos 4 caracteres.", "error");

        try {
            await updateDoc(doc(db, "entregadores", modalSenha.pilotoId), {
                senha: modalSenha.novaSenha,
                solicitouResetSenha: false 
            });
            toast(`Senha de ${modalSenha.pilotoNome} atualizada com sucesso!`, "success");
            setModalSenha({ aberto: false, pilotoId: null, pilotoNome: '', novaSenha: '' });
        } catch (error) {
            toast("Erro ao redefinir a senha.", "error");
        }
    };

    // ------------------------------------------------------------------------
    // GESTÃO FINANCEIRA (DRE E ACERTO)
    // ------------------------------------------------------------------------
    const realizarAcertoFinanceiro = async (ent) => {
        if (ent.saldoLiquido === 0) return toast("O saldo já está zerado.", "info");
        
        const isDevedor = ent.saldoLiquido < 0;
        const msg = isDevedor 
            ? `O piloto DEVE R$ ${Math.abs(ent.saldoLiquido).toFixed(2)} à loja.\n\nConfirma o recebimento e o zeramento do caixa?`
            : `A loja DEVE R$ ${Math.abs(ent.saldoLiquido).toFixed(2)} ao piloto.\n\nJá realizou o pagamento? Confirma o zeramento?`;
          
        if(window.confirm(msg)) {
            try {
                await addDoc(collection(db, "entregadores", ent.id, "repasses"), {
                    valor: Math.abs(ent.saldoLiquido),
                    tipo: isDevedor ? 'PAGO_A_LOJA' : 'PAGO_AO_PILOTO',
                    data: new Date().toLocaleDateString('pt-BR'),
                    timestamp: serverTimestamp()
                });

                await updateDoc(doc(db, "entregadores", ent.id), {
                    saldoLiquido: 0, ganhosTaxas: 0, debitosLoja: 0, ultimoAcerto: serverTimestamp()
                });
                
                toast("Acerto finalizado! O saldo foi zerado.", "success");
            } catch (e) { toast("Erro ao processar acerto financeiro.", "error"); }
        }
    };

    // ------------------------------------------------------------------------
    // PROCESSAMENTO E MÉTRICAS DO DASHBOARD
    // ------------------------------------------------------------------------
    const ativos = entregadores.filter(e => e.statusAprovacao === 'APROVADO');
    const pendentes = entregadores.filter(e => e.statusAprovacao === 'PENDENTE');

    const ativosFiltrados = ativos.filter(e => 
        e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.cpf.includes(searchTerm.replace(/\D/g, '')) ||
        (e.placa && e.placa.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const metricas = {
        totalAtivos: ativos.length,
        onlineAgora: ativos.filter(e => ['Livre', 'Coletando', 'Em Rota'].includes(e.status)).length,
        totalAPagar: ativos.filter(e => e.saldoLiquido > 0).reduce((acc, e) => acc + e.saldoLiquido, 0),
        totalAReceber: ativos.filter(e => e.saldoLiquido < 0).reduce((acc, e) => acc + Math.abs(e.saldoLiquido), 0) 
    };

    // ------------------------------------------------------------------------
    // RENDERIZAÇÃO DA PÁGINA
    // ------------------------------------------------------------------------
    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#82C91E]/30">
            <div className="flex-1 overflow-y-auto p-8 md:p-12 relative z-10">
                
                <header className="flex justify-between items-center bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 mb-6">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-[#1F0137] to-[#4B0082] rounded-[2rem] flex items-center justify-center text-[#82C91E] shadow-2xl overflow-hidden p-3 border-4 border-[#82C91E]/20">
                            <img src={LOGO_APP} className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(130,201,30,0.8)]" alt="Logo" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-[1000] uppercase italic text-[#4B0082] tracking-tighter">Central de <span className="text-[#82C91E]">Frota</span></h1>
                            <p className="text-slate-400 font-black uppercase text-[11px] tracking-[0.3em] mt-1">DRE e Gestão Operacional</p>
                        </div>
                    </div>
                    <button onClick={() => { 
                        setEditandoId(null); 
                        setFormData({ nome: '', cpf: '', telefone: '', placa: '', urlPerfil: '', modalidade: 'MOTO', statusAprovacao: 'PENDENTE', status: 'Offline', aceitaDinheiro: true, temMaquininha: true, frequenciaRepasse: 'SEMANAL', senha: '' }); 
                        setModalAberto(true); 
                    }} className="bg-[#4B0082] hover:bg-[#1F0137] text-[#82C91E] px-8 py-5 rounded-[2rem] font-[1000] uppercase italic text-xs tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95">
                        <Lucide.UserPlus size={22} /> Novo Piloto
                    </button>
                </header>

                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center"><Lucide.Users size={24}/></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total na Frota</p>
                            <p className="text-2xl font-[1000] text-[#4B0082]">{metricas.totalAtivos}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center"><Lucide.Wifi size={24}/></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Online Agora</p>
                            <p className="text-2xl font-[1000] text-green-500">{metricas.onlineAgora}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-green-600 flex items-center justify-center"><Lucide.ArrowUpRight size={24}/></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dívidas (A Pagar)</p>
                            <p className="text-xl font-[1000] text-green-600">{formatarMoeda(metricas.totalAPagar)}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center"><Lucide.ArrowDownRight size={24}/></div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caixa Retido (A Receber)</p>
                            <p className="text-xl font-[1000] text-red-500">{formatarMoeda(metricas.totalAReceber)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <div className="bg-slate-200/50 p-2 rounded-[2rem] shadow-inner border border-slate-200 inline-flex gap-2">
                        <button onClick={() => setTabAtiva('ATIVOS')} className={`px-8 py-3 rounded-[1.5rem] font-[1000] uppercase italic text-[10px] tracking-widest transition-all ${tabAtiva === 'ATIVOS' ? 'bg-[#4B0082] text-[#82C91E] shadow-md' : 'text-slate-500 hover:bg-white'}`}>Frota Ativa</button>
                        <button onClick={() => setTabAtiva('PENDENTES')} className={`px-8 py-3 rounded-[1.5rem] font-[1000] uppercase italic text-[10px] tracking-widest transition-all relative ${tabAtiva === 'PENDENTES' ? 'bg-[#82C91E] text-[#4B0082] shadow-md' : 'text-slate-500 hover:bg-white'}`}>
                            Análises Pendentes
                            {pendentes.length > 0 && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 border border-white rounded-full animate-pulse"/>}
                        </button>
                    </div>

                    {tabAtiva === 'ATIVOS' && (
                        <div className="flex bg-white rounded-2xl border border-slate-200 shadow-sm p-2 w-[400px] focus-within:border-[#4B0082] transition-colors">
                            <Lucide.Search className="text-slate-400 ml-3 mt-1.5" size={20}/>
                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar piloto ou placa..." className="flex-1 bg-transparent border-none outline-none px-4 text-sm font-bold text-[#4B0082]" />
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-6 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="col-span-3">Identificação do Piloto</div>
                        <div className="col-span-2">Status & Veículo</div>
                        <div className="col-span-2">Preferências</div>
                        <div className="col-span-3">Acerto Financeiro (DRE)</div>
                        <div className="col-span-2 text-center">Ações Táticas</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        <AnimatePresence>
                            {(tabAtiva === 'ATIVOS' ? ativosFiltrados : pendentes).length === 0 && (
                                <div className="p-20 text-center text-slate-400">
                                    <Lucide.SearchX size={60} className="mx-auto mb-4 opacity-50"/>
                                    <p className="font-black uppercase tracking-widest">Nenhum piloto encontrado na lista.</p>
                                </div>
                            )}

                            {(tabAtiva === 'ATIVOS' ? ativosFiltrados : pendentes).map(ent => (
                                <motion.div key={ent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-12 gap-4 p-6 items-center hover:bg-slate-50/50 transition-colors">
                                    
                                    <div className="col-span-3 flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-sm shrink-0">
                                            {ent.urlPerfil ? <img src={ent.urlPerfil} className="w-full h-full object-cover" alt="Avatar"/> : <Lucide.User className="m-auto mt-4 text-slate-300"/>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-[1000] text-[#4B0082] uppercase italic truncate">{ent.nome}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatarCPF(ent.cpf)}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ent.telefone}</p>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border mb-2
                                            ${ent.status === 'Livre' ? 'bg-green-50 text-green-600 border-green-200' : ent.status === 'Offline' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${ent.status === 'Livre' ? 'bg-green-500 animate-pulse' : ent.status === 'Offline' ? 'bg-slate-400' : 'bg-purple-500'}`} />
                                            {ent.status}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-[1000] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">{ent.modalidade}</span>
                                            {ent.placa && <span className="text-[9px] font-[1000] border border-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase">{ent.placa}</span>}
                                        </div>
                                    </div>

                                    <div className="col-span-2 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${ent.aceitaDinheiro ? 'bg-green-500' : 'bg-red-500'}`}/>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tem Troco (Dinheiro)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${ent.temMaquininha ? 'bg-green-500' : 'bg-red-500'}`}/>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tem Maquininha</span>
                                        </div>
                                    </div>

                                    <div className="col-span-3">
                                        {tabAtiva === 'PENDENTES' ? (
                                            <button onClick={() => setFotoAmpliada(ent.urlCNH)} className="px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-colors flex items-center gap-2">
                                                <Lucide.IdCard size={14}/> Checar CNH (EAR)
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <p className={`text-lg font-[1000] italic leading-none ${ent.saldoLiquido < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {formatarMoeda(Math.abs(ent.saldoLiquido || 0))}
                                                    </p>
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                        {ent.saldoLiquido < 0 ? 'Loja deve receber' : 'Piloto deve receber'} • {ent.frequenciaRepasse}
                                                    </p>
                                                </div>
                                                <button onClick={() => realizarAcertoFinanceiro(ent)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-[#4B0082] hover:text-[#82C91E] flex items-center justify-center transition-colors shadow-sm" title="Zerar Caixa">
                                                    <Lucide.CheckSquare size={18}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 flex justify-center gap-2">
                                        {tabAtiva === 'PENDENTES' ? (
                                            <button onClick={() => aprovarEntregador(ent)} className="flex-1 py-2 bg-[#82C91E] text-[#4B0082] rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 shadow-md">Aprovar</button>
                                        ) : (
                                            <>
                                                <button onClick={() => setModalSenha({ aberto: true, pilotoId: ent.id, pilotoNome: ent.nome, novaSenha: '' })} className="w-10 h-10 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl flex items-center justify-center hover:bg-amber-100 hover:text-amber-600 transition-colors relative" title="Alterar Senha">
                                                    <Lucide.KeyRound size={16}/>
                                                    {ent.solicitouResetSenha && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"/>}
                                                </button>
                                                <button onClick={() => { setEditandoId(ent.id); setFormData(ent); setModalAberto(true); }} className="w-10 h-10 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors" title="Editar">
                                                    <Lucide.Edit2 size={16}/>
                                                </button>
                                            </>
                                        )}
                                        <button onClick={() => excluirEntregador(ent.id, ent.nome)} className="w-10 h-10 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" title="Excluir">
                                            <Lucide.Trash2 size={16}/>
                                        </button>
                                    </div>
                                    
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* MODAIS (CÓDIGOS IDÊNTICOS MANTIDOS AQUI - CÓDIGO ENCURTADO VISUALMENTE PRA NÃO FICAR LONGO) */}
            <AnimatePresence>
                {modalSenha.aberto && (
                    <div className="fixed inset-0 z-[4000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white max-w-md w-full p-8 rounded-[3rem] shadow-2xl border border-slate-100 relative">
                            <button onClick={() => setModalSenha({...modalSenha, aberto: false})} className="absolute top-6 right-6 text-slate-400 hover:text-red-500"><Lucide.X size={24}/></button>
                            
                            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6 border border-amber-100">
                                <Lucide.KeyRound size={30} />
                            </div>
                            
                            <h2 className="text-2xl font-[1000] text-[#4B0082] uppercase italic tracking-tighter mb-1">Redefinir Senha</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Criando nova credencial para: <span className="text-[#82C91E] font-black">{modalSenha.pilotoNome}</span></p>

                            <form onSubmit={salvarNovaSenha} className="space-y-6">
                                <div className="relative">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-2">Nova Senha de Acesso</label>
                                    <input 
                                        type={mostrarSenha ? "text" : "password"} 
                                        value={modalSenha.novaSenha} 
                                        onChange={e => setModalSenha({...modalSenha, novaSenha: e.target.value})} 
                                        className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 font-black text-lg text-[#4B0082] focus:border-[#82C91E] outline-none transition-colors pr-14"
                                        placeholder="Digite a nova senha" required minLength={4}
                                    />
                                    <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-4 top-10 text-slate-400 hover:text-[#4B0082]">
                                        {mostrarSenha ? <Lucide.EyeOff size={20}/> : <Lucide.Eye size={20}/>}
                                    </button>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-relaxed">Dica: Após salvar, copie a nova senha e envie para o motoboy via WhatsApp para que ele possa acessar o aplicativo.</p>
                                </div>
                                <button type="submit" className="w-full py-5 bg-[#4B0082] text-[#82C91E] rounded-[2rem] font-[1000] uppercase italic tracking-widest text-sm shadow-xl hover:bg-[#1F0137] active:scale-95 transition-all">
                                    Salvar Nova Senha
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {modalAberto && (
                    <div className="fixed inset-0 z-[3000] bg-[#4B0082]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden border-b-[20px] border-[#82C91E] flex flex-col max-h-[90vh]">
                            <div className="p-8 bg-gradient-to-r from-[#1F0137] to-[#4B0082] flex justify-between items-center text-white relative overflow-hidden shrink-0 shadow-lg">
                                <div className="absolute top-0 right-0 opacity-10"><Lucide.UserCog size={150} className="-mt-10 -mr-10" /></div>
                                <div>
                                    <h2 className="text-3xl font-[1000] uppercase italic tracking-tighter relative z-10">{editandoId ? 'Editar Piloto' : 'Novo Recruta'}</h2>
                                    <p className="text-[10px] font-black text-[#82C91E] uppercase tracking-widest mt-1 relative z-10">Base de Dados Central Rodrigues</p>
                                </div>
                                <button onClick={() => setModalAberto(false)} className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-red-500 border border-white/20 transition-all active:scale-90 relative z-10 shadow-sm">
                                    <Lucide.X size={28}/>
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/50">
                                <form id="form-piloto" onSubmit={salvarEntregador} className="space-y-8">
                                    <div className="flex flex-col sm:flex-row items-center gap-8 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-3 h-full bg-[#4B0082]" />
                                        <div className="w-32 h-32 bg-slate-50 rounded-[2.5rem] overflow-hidden shadow-inner border-4 border-slate-100 shrink-0 flex items-center justify-center relative group">
                                            {formData.urlPerfil ? <img src={formData.urlPerfil} className="w-full h-full object-cover" alt="Perfil" /> : <Lucide.Camera size={40} className="text-slate-300" />}
                                            {uploading && <div className="absolute inset-0 bg-[#82C91E]/90 backdrop-blur-sm flex items-center justify-center"><Lucide.Loader2 className="animate-spin text-[#4B0082]" size={30}/></div>}
                                        </div>
                                        <div className="flex-1 text-center sm:text-left w-full">
                                            <p className="text-sm font-[1000] uppercase text-[#4B0082] italic mb-1">Foto de Identificação</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 leading-relaxed max-w-sm">Esta foto aparecerá no ecrã de rastreio do cliente.</p>
                                            <div className="relative inline-block w-full sm:w-auto">
                                                <input type="file" onChange={handleUploadCloudinary} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                                <div className="bg-[#82C91E]/10 border-2 border-[#82C91E]/50 text-[#4B0082] font-[1000] text-[10px] uppercase tracking-widest px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-colors hover:bg-[#82C91E]/20">
                                                    <Lucide.UploadCloud size={16}/> Enviar nova foto
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Lucide.User size={14}/> Nome Completo</label>
                                            <input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 font-bold text-[#4B0082] outline-none focus:border-[#82C91E]" />
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Lucide.Fingerprint size={14}/> CPF (ID de Login)</label>
                                            <input required value={formatarCPF(formData.cpf)} onChange={e => setFormData({...formData, cpf: e.target.value})} maxLength={14} className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 font-bold text-[#4B0082] outline-none focus:border-[#82C91E]" />
                                        </div>
                                        {!editandoId && (
                                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Lucide.Key size={14}/> Senha Inicial</label>
                                                <input required value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 font-bold text-[#4B0082] outline-none focus:border-[#82C91E]" />
                                            </div>
                                        )}
                                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Lucide.Phone size={14}/> WhatsApp</label>
                                            <input required value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 font-bold text-[#4B0082] outline-none focus:border-[#82C91E]" />
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm col-span-1 md:col-span-2">
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Lucide.Bike size={14}/> Veículo</label>
                                                    <select value={formData.modalidade} onChange={e => setFormData({...formData, modalidade: e.target.value})} className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 font-bold text-[#4B0082] outline-none focus:border-[#82C91E]">
                                                        <option value="MOTO">Moto</option><option value="BIKE">Bicicleta</option><option value="CARRO">Carro</option>
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Lucide.Car size={14}/> Placa</label>
                                                    <input value={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value.toUpperCase()})} maxLength={8} className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 font-bold text-[#4B0082] uppercase outline-none focus:border-[#82C91E]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="p-8 bg-white border-t border-slate-100 shrink-0 flex gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                                <button type="button" onClick={() => setModalAberto(false)} className="w-1/3 py-5 bg-slate-50 border-2 border-slate-200 text-slate-500 rounded-[2rem] font-[1000] uppercase tracking-widest text-[11px] hover:bg-slate-100 transition-colors active:scale-95">Cancelar</button>
                                <button type="submit" form="form-piloto" disabled={uploading} className="w-2/3 py-5 bg-[#4B0082] text-[#82C91E] rounded-[2rem] font-[1000] italic uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(75,0,130,0.3)] hover:bg-[#1F0137] active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <Lucide.Save size={20}/> Gravar no Sistema
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {fotoAmpliada && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[5000] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 sm:p-12">
                        <div className="relative max-w-4xl w-full flex flex-col items-center">
                            <button onClick={() => setFotoAmpliada(null)} className="absolute -top-16 right-0 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all border border-white/20 active:scale-90"><Lucide.X size={32}/></button>
                            <img src={fotoAmpliada} className="w-full h-auto max-h-[85vh] rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-white/20 object-contain bg-black/50" alt="CNH Documento" />
                            <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.3em] mt-6">Verificação de Documento Original</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function PainelEntregadoresWrapper() {
    return <ToastProvider><PainelEntregadoresContent /></ToastProvider>;
}