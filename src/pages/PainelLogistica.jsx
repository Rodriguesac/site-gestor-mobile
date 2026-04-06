import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { db } from '../services/firebase'; 
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
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
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div 
                            key={t.id} 
                            initial={{ opacity: 0, x: 50, scale: 0.9 }} 
                            animate={{ opacity: 1, x: 0, scale: 1 }} 
                            exit={{ opacity: 0, x: 50, scale: 0.9 }}
                            className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-black uppercase tracking-wide text-white border-b-4
                            ${t.type === 'error' ? 'bg-[#EA1D2C] border-red-900' : t.type === 'success' ? 'bg-[#82C91E] text-[#4B0082] border-green-700' : 'bg-slate-800 border-slate-900'}`}
                        >
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
// 2. UTILITÁRIOS E CONFIGURAÇÃO PADRÃO
// ============================================================================
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

// Motor Inteligente de Tabela + Batching
const defaultConfig = {
    tabelaTaxas: [
        { id: 't1', distanciaKm: 1, label: '1 KM', valor: 5.00, tempo: 30 },
        { id: 't2', distanciaKm: 3, label: '3 KM', valor: 7.00, tempo: 40 },
        { id: 't3', distanciaKm: 5, label: '5 KM', valor: 10.00, tempo: 50 }
    ],
    valorKmAdicional: 2.00, 
    margemLoja: 2.00, // <--- NOVO: Margem retida pela loja antes de repassar ao motoboy
    expressAtivo: true,
    taxaExpress: 5.00,
    tempoExpressMin: 15,
    tempoExpressMax: 25,
    raioOnda1: 3,
    tempoOnda1: 60,
    esperaMaximaLoja: 10,       
    desvioRotaMaximo: 2.5,     
    margemSegurancaBatch: 5,   
    limiteMochila: 3           
};

// ============================================================================
// 3. COMPONENTE DE INPUT CUSTOMIZADO
// ============================================================================
const InputNumero = ({ label, icon: Icon, valor, onChange, sufixo = "", min = 0, step = "1", disabled = false }) => (
    <div className={`bg-slate-50 p-5 rounded-[2rem] border border-slate-100 transition-all ${disabled ? 'opacity-50' : 'focus-within:border-[#82C91E] focus-within:ring-4 focus-within:ring-[#82C91E]/10'}`}>
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
            <Icon size={14} className="text-[#4B0082]" /> {label}
        </label>
        <div className="flex items-center gap-3">
            <input 
                type="number" 
                min={min} 
                step={step}
                value={valor} 
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)} 
                className="w-full bg-transparent text-2xl font-[1000] text-[#4B0082] outline-none disabled:bg-transparent"
            />
            {sufixo && <span className="text-sm font-bold text-slate-400 uppercase">{sufixo}</span>}
        </div>
    </div>
);

// ============================================================================
// 4. COMPONENTE PRINCIPAL DO PAINEL LOGÍSTICO
// ============================================================================
const ConfiguracoesContent = () => {
    const toast = useToast();
    
    // --- ESTADOS GERAIS ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('TABELA'); // TABELA | AGRUPAMENTO | EXPRESS | RADAR
    const [config, setConfig] = useState(defaultConfig);
    const [kmSimulado, setKmSimulado] = useState(3.5);

    // --- ESTADO PARA ADICIONAR NOVA REGRA NA TABELA ---
    const [novaRegra, setNovaRegra] = useState({
        distancia: '',
        unidade: 'km', // 'km' ou 'm'
        valor: '',
        tempo: ''
    });

    // ------------------------------------------------------------------------
    // SINCRONIZAÇÃO COM FIREBASE
    // ------------------------------------------------------------------------
    useEffect(() => {
        const docRef = doc(db, "configuracoes_loja", "logistica");
        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setConfig({ ...defaultConfig, ...snap.data() });
            } else {
                setDoc(docRef, defaultConfig);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Erro ao buscar logistica:", error);
            toast("Erro de conexão com o banco de dados.", "error");
            setIsLoading(false);
        });

        return () => unsub();
    }, [toast]);

    // ------------------------------------------------------------------------
    // FUNÇÕES DA TABELA DE ROTEIRIZAÇÃO
    // ------------------------------------------------------------------------
    const adicionarRegra = () => {
        const dist = parseFloat(novaRegra.distancia);
        const val = parseFloat(novaRegra.valor);
        const tmp = parseInt(novaRegra.tempo);

        if (isNaN(dist) || isNaN(val) || isNaN(tmp) || dist <= 0) {
            return toast("Preencha todos os campos da nova regra corretamente.", "error");
        }

        // Converte tudo para KM no sistema interno
        const distanciaKm = novaRegra.unidade === 'm' ? dist / 1000 : dist;
        const label = novaRegra.unidade === 'm' ? `${dist} Metros` : `${dist} KM`;

        if (config.tabelaTaxas.some(r => r.distanciaKm === distanciaKm)) {
            return toast("Já existe uma regra para esta exata distância.", "error");
        }

        const novaTabela = [...config.tabelaTaxas, {
            id: Math.random().toString(36).substr(2, 9),
            distanciaKm,
            label,
            valor: val,
            tempo: tmp
        }].sort((a, b) => a.distanciaKm - b.distanciaKm);

        setConfig({ ...config, tabelaTaxas: novaTabela });
        setNovaRegra({ distancia: '', unidade: 'km', valor: '', tempo: '' });
        toast(`Regra de ${label} adicionada!`, "success");
    };

    const removerRegra = (idRemover) => {
        const novaTabela = config.tabelaTaxas.filter(r => r.id !== idRemover);
        setConfig({ ...config, tabelaTaxas: novaTabela });
    };

    // ------------------------------------------------------------------------
    // OUTRAS FUNÇÕES DE MANIPULAÇÃO
    // ------------------------------------------------------------------------
    const handleInputChange = (campo, valor) => {
        setConfig(prev => ({ ...prev, [campo]: Number(valor) }));
    };

    const toggleExpress = () => {
        setConfig(prev => ({ ...prev, expressAtivo: !prev.expressAtivo }));
    };

    const salvarConfiguracoes = async () => {
        setIsSaving(true);
        try {
            if (config.tabelaTaxas.length === 0) {
                toast("A tabela de frete não pode ficar vazia.", "error");
                setIsSaving(false);
                return;
            }

            const docRef = doc(db, "configuracoes_loja", "logistica");
            await setDoc(docRef, { ...config, atualizadoEm: serverTimestamp() }, { merge: true });
            
            toast("Matriz Logística atualizada em tempo real!", "success");
        } catch (error) {
            console.error(error);
            toast("Erro ao gravar novas configurações.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    // ------------------------------------------------------------------------
    // MOTOR DO SIMULADOR DE FRETE
    // ------------------------------------------------------------------------
    const calcularFreteSimulado = (km) => {
        if (!config.tabelaTaxas || config.tabelaTaxas.length === 0) return { valor: 0, tempo: 0, limite: 'Tabela Vazia' };
        
        for (let regra of config.tabelaTaxas) {
            if (km <= regra.distanciaKm) {
                return { valor: regra.valor, tempo: regra.tempo, limite: regra.label };
            }
        }
        
        const ultimaRegra = config.tabelaTaxas[config.tabelaTaxas.length - 1];
        const kmExtra = km - ultimaRegra.distanciaKm;
        const valorExtra = kmExtra * (config.valorKmAdicional || 0);
        
        return { 
            valor: ultimaRegra.valor + valorExtra, 
            tempo: ultimaRegra.tempo + (Math.ceil(kmExtra) * 5), 
            limite: `Excedeu ${ultimaRegra.label}`
        };
    };

    const simulacaoAtual = calcularFreteSimulado(kmSimulado);

    // ------------------------------------------------------------------------
    // RENDERIZAÇÃO DE CARREGAMENTO
    // ------------------------------------------------------------------------
    if (isLoading) {
        return (
            <div className="h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-10 text-center">
                <div className="w-20 h-20 border-4 border-[#4B0082] border-t-[#82C91E] rounded-full animate-spin mb-6 mx-auto" />
                <h2 className="text-xl font-[1000] uppercase italic text-[#4B0082] tracking-tighter">Carregando Tabelas...</h2>
            </div>
        );
    }

    // ------------------------------------------------------------------------
    // RENDERIZAÇÃO DA PÁGINA PRINCIPAL
    // ------------------------------------------------------------------------
    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#82C91E]/30">
            
            <div className="flex-1 overflow-y-auto p-8 md:p-12 relative z-10 flex gap-8">
                
                {/* ==========================================
                    ÁREA DE CONFIGURAÇÕES (ESQUERDA)
                ========================================== */}
                <div className="flex-1 max-w-4xl flex flex-col">
                    
                    {/* CABEÇALHO */}
                    <header className="flex justify-between items-center bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 mb-8">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-[#1F0137] to-[#4B0082] rounded-[2rem] flex items-center justify-center text-[#82C91E] shadow-2xl overflow-hidden p-4 border-4 border-[#82C91E]/20">
                                <Lucide.TableProperties size={40} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-[1000] uppercase italic text-[#4B0082] tracking-tighter">Matriz <span className="text-[#82C91E]">Logística</span></h1>
                                <p className="text-slate-400 font-black uppercase text-[11px] tracking-[0.3em] mt-1">
                                    Configuração de Fretamento e Batching
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={salvarConfiguracoes} 
                            disabled={isSaving}
                            className="bg-[#4B0082] hover:bg-[#1F0137] text-[#82C91E] px-10 py-5 rounded-[2rem] font-[1000] uppercase italic text-sm tracking-widest shadow-[0_10px_30px_rgba(75,0,130,0.3)] flex items-center gap-3 transition-all active:scale-95"
                        >
                            {isSaving ? <><Lucide.Loader2 size={24} className="animate-spin"/> Salvando...</> : <><Lucide.Save size={24} /> Publicar Tabela</>}
                        </button>
                    </header>

                    {/* ABAS DE NAVEGAÇÃO */}
                    <div className="bg-slate-200/50 p-3 rounded-[3.5rem] shadow-inner border border-slate-200 inline-flex gap-2 items-center mb-8">
                        {[
                            { id: 'TABELA', label: 'Tabela de Fretes', icon: Lucide.ListTree },
                            { id: 'AGRUPAMENTO', label: 'Batching (Agrupar)', icon: Lucide.Layers },
                            { id: 'EXPRESS', label: 'Modo Express', icon: Lucide.Zap },
                            { id: 'RADAR', label: 'Radar Piloto', icon: Lucide.Radar }
                        ].map(aba => (
                            <button 
                                key={aba.id} 
                                onClick={() => setAbaAtiva(aba.id)} 
                                className={`px-8 py-5 rounded-[3rem] font-[1000] uppercase italic text-[10px] tracking-widest transition-all flex items-center gap-2
                                ${abaAtiva === aba.id ? 'bg-[#4B0082] text-[#82C91E] shadow-xl' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
                            >
                                <aba.icon size={18}/> {aba.label}
                            </button>
                        ))}
                    </div>

                    {/* CONTEÚDO DAS ABAS */}
                    <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 flex-1">
                        <AnimatePresence mode="wait">
                            
                            {/* ========================================================
                                ABA 1: TABELA DE FRETES (CORE)
                            ======================================================== */}
                            {abaAtiva === 'TABELA' && (
                                <motion.div key="tabela" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                                    
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <div>
                                            <h2 className="text-xl font-[1000] text-[#4B0082] uppercase tracking-tighter italic flex items-center gap-2">
                                                <Lucide.Map size={24}/> Regras de Distância
                                            </h2>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                Defina o preço e o tempo para cada faixa de distância.
                                            </p>
                                        </div>
                                    </div>

                                    {/* FORMULÁRIO PARA ADICIONAR NOVA REGRA */}
                                    <div className="bg-[#F8FAFC] p-6 rounded-[2.5rem] border-2 border-slate-200/60 shadow-inner flex items-end gap-3">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-1 block">Distância (Até)</label>
                                            <div className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm focus-within:border-[#82C91E]">
                                                <input type="number" step="0.01" value={novaRegra.distancia} onChange={e => setNovaRegra({...novaRegra, distancia: e.target.value})} placeholder="Ex: 0.5" className="w-full p-4 font-black text-[#4B0082] outline-none" />
                                                <select value={novaRegra.unidade} onChange={e => setNovaRegra({...novaRegra, unidade: e.target.value})} className="bg-slate-50 font-bold text-xs uppercase px-4 border-l border-slate-200 outline-none text-[#4B0082]">
                                                    <option value="km">KM</option>
                                                    <option value="m">Metros</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="w-1/4">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-1 block">Valor Pago (R$)</label>
                                            <input type="number" step="0.50" value={novaRegra.valor} onChange={e => setNovaRegra({...novaRegra, valor: e.target.value})} placeholder="Ex: 5.00" className="w-full p-4 bg-white rounded-2xl border border-slate-200 font-black text-[#4B0082] outline-none focus:border-[#82C91E] shadow-sm" />
                                        </div>
                                        <div className="w-1/4">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-1 block">Tempo (Min)</label>
                                            <input type="number" value={novaRegra.tempo} onChange={e => setNovaRegra({...novaRegra, tempo: e.target.value})} placeholder="Ex: 30" className="w-full p-4 bg-white rounded-2xl border border-slate-200 font-black text-[#4B0082] outline-none focus:border-[#82C91E] shadow-sm" />
                                        </div>
                                        <button onClick={adicionarRegra} className="w-14 h-14 bg-[#82C91E] text-[#4B0082] rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all shrink-0 mb-0.5">
                                            <Lucide.Plus size={24} strokeWidth={3} />
                                        </button>
                                    </div>

                                    {/* LISTAGEM DAS REGRAS EXISTENTES */}
                                    <div className="space-y-3 mt-8">
                                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Tabela Ativa (Ordem Crescente)</h3>
                                        
                                        {config.tabelaTaxas.map((regra, idx) => (
                                            <div key={regra.id} className="flex items-center justify-between bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm group hover:border-[#82C91E]/30 transition-all">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-black text-xs">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Entregas Até</p>
                                                        <p className="text-xl font-[1000] text-[#4B0082]">{regra.label}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-12">
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Taxa Cobrada</p>
                                                        <p className="text-lg font-black text-[#82C91E]">{formatarMoeda(regra.valor)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Previsão</p>
                                                        <p className="text-lg font-black text-slate-700">{regra.tempo} min</p>
                                                    </div>
                                                    <button onClick={() => removerRegra(regra.id)} className="p-3 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all active:scale-90">
                                                        <Lucide.Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {config.tabelaTaxas.length === 0 && (
                                            <div className="text-center p-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                                <p className="text-slate-400 font-bold uppercase text-xs">Tabela Vazia. Adicione regras acima.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* REGRA EXCEDENTE E MARGEM DA LOJA (REPASSE) */}
                                    <div className="pt-8 border-t border-dashed border-slate-200 mt-8 space-y-4">
                                        
                                        <div className="bg-red-50/50 p-6 rounded-[2rem] border border-red-100 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-[1000] uppercase italic text-red-600 flex items-center gap-2"><Lucide.AlertTriangle size={18}/> KM Excedente (Fora da Tabela)</h3>
                                                <p className="text-[10px] font-bold text-red-900/50 uppercase tracking-widest mt-1">Se o cliente morar além de {config.tabelaTaxas.length > 0 ? config.tabelaTaxas[config.tabelaTaxas.length-1].label : '0 KM'}, quanto cobrar por cada KM extra?</p>
                                            </div>
                                            <div className="w-1/3">
                                                <div className="flex items-center bg-white rounded-xl border border-red-200 px-4 focus-within:border-red-500">
                                                    <span className="text-sm font-black text-slate-400">R$</span>
                                                    <input type="number" step="0.50" value={config.valorKmAdicional} onChange={e => handleInputChange('valorKmAdicional', e.target.value)} className="w-full p-3 font-black text-red-600 outline-none bg-transparent" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-[#4B0082]/5 p-6 rounded-[2rem] border border-[#4B0082]/10 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-[1000] uppercase italic text-[#4B0082] flex items-center gap-2"><Lucide.Scissors size={18}/> Margem da Loja (Retenção)</h3>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Valor fixo deduzido da taxa de entrega que fica para a loja. O restante vai para o piloto.</p>
                                            </div>
                                            <div className="w-1/3">
                                                <div className="flex items-center bg-white rounded-xl border border-slate-200 px-4 focus-within:border-[#82C91E]">
                                                    <span className="text-sm font-black text-slate-400">R$</span>
                                                    <input type="number" step="0.50" value={config.margemLoja ?? 0} onChange={e => handleInputChange('margemLoja', e.target.value)} className="w-full p-3 font-black text-[#4B0082] outline-none bg-transparent" />
                                                </div>
                                            </div>
                                        </div>

                                    </div>

                                </motion.div>
                            )}

                            {/* ========================================================
                                ABA 2: AGRUPAMENTO INTELIGENTE (BATCHING)
                            ======================================================== */}
                            {abaAtiva === 'AGRUPAMENTO' && (
                                <motion.div key="agrupamento" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                                    <div className="flex items-start gap-5 bg-[#4B0082]/5 p-8 rounded-[3rem] border border-[#4B0082]/10 mb-8 shadow-inner">
                                        <div className="w-16 h-16 bg-[#4B0082] text-[#82C91E] rounded-3xl flex items-center justify-center shrink-0 shadow-lg">
                                            <Lucide.Brain size={32}/>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-[1000] text-[#4B0082] uppercase italic tracking-tighter mb-1">Cérebro Logístico (Batching)</h2>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                                                Estas regras definem se o sistema pode agrupar múltiplos pedidos para o mesmo piloto. O objetivo é economizar taxas sem atrasar o cliente.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <InputNumero label="Espera Máxima na Loja" icon={Lucide.Hourglass} valor={config.esperaMaximaLoja} onChange={(v) => handleInputChange('esperaMaximaLoja', v)} sufixo="minutos" />
                                        <InputNumero label="Desvio de Rota Máximo" icon={Lucide.ArrowRightLeft} valor={config.desvioRotaMaximo} onChange={(v) => handleInputChange('desvioRotaMaximo', v)} step="0.5" sufixo="KM" />
                                        <InputNumero label="Margem de Segurança (Folga)" icon={Lucide.ShieldCheck} valor={config.margemSegurancaBatch} onChange={(v) => handleInputChange('margemSegurancaBatch', v)} sufixo="minutos" />
                                        <InputNumero label="Capacidade da Mochila" icon={Lucide.Briefcase} valor={config.limiteMochila} onChange={(v) => handleInputChange('limiteMochila', v)} sufixo="pedidos" />
                                    </div>

                                    <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex items-start gap-4 mt-6">
                                        <Lucide.Info size={24} className="text-amber-600 shrink-0 mt-1"/>
                                        <div className="text-[10px] font-black text-amber-900 uppercase tracking-widest leading-relaxed">
                                            Lógica Rodrigues: Um 2º pedido só é oferecido se: <br/>
                                            1. O piloto estiver na loja há menos de <span className="text-[#4B0082] font-[1000] underline">{config.esperaMaximaLoja} min</span>. <br/>
                                            2. A casa do 2º cliente não desviar mais que <span className="text-[#4B0082] font-[1000] underline">{config.desvioRotaMaximo} KM</span> da rota original. <br/>
                                            3. O 1º pedido ainda tiver pelo menos <span className="text-[#4B0082] font-[1000] underline">{config.margemSegurancaBatch} min</span> de folga no prazo.
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* ========================================================
                                ABA 3: FURA FILA (EXPRESS)
                            ======================================================== */}
                            {abaAtiva === 'EXPRESS' && (
                                <motion.div key="express" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-200 p-8 rounded-[3.5rem] shadow-sm flex flex-col gap-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-2xl font-[1000] text-orange-600 uppercase tracking-tighter italic mb-1 flex items-center gap-3">
                                                    <Lucide.Rocket size={28}/> Fura-Fila (Surge Pricing)
                                                </h2>
                                                <p className="text-[10px] font-black text-orange-800/60 uppercase tracking-widest">
                                                    Permite que o cliente pague a mais por urgência?
                                                </p>
                                            </div>
                                            <button onClick={toggleExpress} className={`w-20 h-10 rounded-full border-2 transition-all relative ${config.expressAtivo ? 'bg-orange-500 border-orange-600' : 'bg-slate-200 border-slate-300'}`}>
                                                <div className={`w-8 h-8 bg-white rounded-full shadow-md absolute top-0.5 transition-transform ${config.expressAtivo ? 'translate-x-10' : 'translate-x-1'}`}></div>
                                            </button>
                                        </div>
                                        
                                        <div className={`transition-opacity ${!config.expressAtivo ? 'opacity-30 pointer-events-none' : 'opacity-100'} grid grid-cols-2 gap-6 pt-4 border-t border-orange-200/50`}>
                                            <div className="col-span-2">
                                                <InputNumero label="Taxa Adicional Fixa (Urgência)" icon={Lucide.Flame} valor={config.taxaExpress} onChange={(v) => handleInputChange('taxaExpress', v)} step="0.50" sufixo="Reais (R$)" />
                                            </div>
                                            <InputNumero label="Tempo Mínimo Prometido" icon={Lucide.Timer} valor={config.tempoExpressMin} onChange={(v) => handleInputChange('tempoExpressMin', v)} sufixo="min" />
                                            <InputNumero label="Tempo Máximo Prometido" icon={Lucide.Timer} valor={config.tempoExpressMax} onChange={(v) => handleInputChange('tempoExpressMax', v)} sufixo="min" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* ========================================================
                                ABA 4: INTELIGÊNCIA DE RADAR
                            ======================================================== */}
                            {abaAtiva === 'RADAR' && (
                                <motion.div key="radar" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                                    <div>
                                        <h2 className="text-xl font-[1000] text-[#4B0082] uppercase tracking-tighter italic mb-2 flex items-center gap-2">
                                            <Lucide.Wifi size={24}/> Onda Primária (Raio de Busca)
                                        </h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 max-w-xl leading-relaxed">
                                            O algoritmo de despacho envia primeiro para os motoboys que estão mais perto da loja. Ajuste a distância limite dessa primeira onda.
                                        </p>
                                        <div className="grid grid-cols-2 gap-6">
                                            <InputNumero label="Raio de Busca GPS" icon={Lucide.MapPin} valor={config.raioOnda1} onChange={(v) => handleInputChange('raioOnda1', v)} step="0.5" sufixo="Quilômetros (KM)" />
                                            <InputNumero label="Tempo Limite do Aceite" icon={Lucide.TimerReset} valor={config.tempoOnda1} onChange={(v) => handleInputChange('tempoOnda1', v)} step="5" sufixo="Segundos" />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-[#4B0082]/5 p-8 rounded-[3rem] border border-[#4B0082]/10 flex items-start gap-5 shadow-inner mt-8">
                                        <Lucide.BrainCircuit size={32} className="text-[#82C91E] shrink-0 mt-1"/>
                                        <p className="text-[11px] font-black text-[#4B0082] uppercase tracking-widest leading-relaxed">
                                            Lógica em Execução: Quando um pedido fica pronto, a Torre Logística varre o mapa à procura de pilotos livres num raio de <span className="font-[1000] bg-white px-3 py-1 rounded-lg text-[#82C91E] border border-slate-200">{config.raioOnda1} KM</span>. 
                                            O dispositivo do piloto escolhido tocará o alarme em exclusivo por <span className="font-[1000] bg-white px-3 py-1 rounded-lg text-[#82C91E] border border-slate-200">{config.tempoOnda1} Segundos</span> antes de a inteligência artificial repassar a missão ao próximo da fila.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* ==========================================
                    SIMULADOR EM TEMPO REAL (PAINEL DIREITO)
                ========================================== */}
                <div className="w-[420px] flex flex-col pt-8">
                    <h2 className="text-xs font-[1000] uppercase text-slate-400 tracking-widest mb-6 flex items-center gap-2 ml-4">
                        <Lucide.Smartphone size={16}/> Simulador Cliente
                    </h2>
                    
                    <div className="bg-white flex-1 rounded-[4rem] shadow-2xl border-8 border-slate-800 p-6 flex flex-col relative overflow-hidden ring-4 ring-slate-200">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-3xl z-50"></div>
                        
                        <div className="pt-8 flex-1 space-y-6 overflow-y-auto no-scrollbar">
                            
                            {/* Input do Simulador */}
                            <div className="bg-[#F8FAFC] p-5 rounded-3xl border-2 border-[#82C91E] shadow-inner mb-6">
                                <label className="text-[10px] font-black text-[#4B0082] uppercase tracking-widest block mb-2 text-center">Distância do Pedido</label>
                                <div className="flex items-center gap-3">
                                    <input type="range" min="0.1" max="25" step="0.1" value={kmSimulado} onChange={e => setKmSimulado(parseFloat(e.target.value))} className="flex-1 accent-[#82C91E]" />
                                    <span className="font-[1000] text-lg text-[#4B0082] w-16 text-right">{kmSimulado} <span className="text-[10px]">KM</span></span>
                                </div>
                            </div>

                            {/* Card Previsão Baseada na Tabela */}
                            <div className="text-center bg-slate-50 border border-slate-100 p-6 rounded-[2.5rem]">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Previsão Normal (<span className="text-[#4B0082]">{simulacaoAtual.limite}</span>)</p>
                                <div className="inline-flex items-center gap-2 bg-[#82C91E]/10 px-5 py-2.5 rounded-2xl border border-[#82C91E]/30">
                                    <Lucide.Clock size={14} className="text-[#4B0082]" />
                                    <span className="text-base font-[1000] text-[#4B0082] italic uppercase">
                                        Chega em aprox. {simulacaoAtual.tempo} min
                                    </span>
                                </div>
                            </div>

                            {/* Card Surge Pricing */}
                            <AnimatePresence>
                                {config.expressAtivo && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 p-6 rounded-[2.5rem]">
                                        <h3 className="text-sm font-[1000] text-orange-600 uppercase italic mb-1 flex items-center gap-2">
                                            <Lucide.Rocket size={18}/> Com pressa?
                                        </h3>
                                        <button className="w-full bg-orange-500 text-white py-4 rounded-xl font-[1000] uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 opacity-80 cursor-default mt-3">
                                            Fura-Fila (+ R$ {config.taxaExpress.toFixed(2)}) <Lucide.Zap size={14} fill="currentColor"/>
                                        </button>
                                        <div className="mt-4 pt-4 border-t border-orange-200/50 text-center">
                                            <p className="text-[8px] font-black uppercase text-orange-400 tracking-widest mb-1">Previsão Express:</p>
                                            <p className="text-xs font-[1000] text-orange-600 italic uppercase">{config.tempoExpressMin} - {config.tempoExpressMax} min</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Recibo Simulado da Tabela com Repasse do Motoboy */}
                            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                <h4 className="text-[10px] font-[1000] text-[#4B0082] uppercase tracking-widest mb-4 border-b border-slate-200 pb-2 flex items-center justify-between">
                                    Fatura Final (Exemplo)
                                    <span className="bg-white px-2 py-1 rounded text-[8px] border border-slate-200">{kmSimulado} KM</span>
                                </h4>
                                
                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-3">
                                    <span>Copo Personalizado</span><span>R$ 28,00</span>
                                </div>

                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                                    <span>Taxa de Entrega (Cliente Paga)</span>
                                    <span className="text-[#4B0082]">{formatarMoeda(simulacaoAtual.valor)}</span>
                                </div>
                                
                                <div className="flex justify-between text-[9px] font-black uppercase text-green-600 mb-1 ml-2 border-l-2 border-green-200 pl-2">
                                    <span>Repasse do Piloto</span>
                                    <span>{formatarMoeda(Math.max(0, simulacaoAtual.valor - (config.margemLoja || 0)))}</span>
                                </div>
                                <div className="flex justify-between text-[9px] font-black uppercase text-red-500 mb-4 pb-4 border-b border-slate-200 ml-2 border-l-2 border-red-200 pl-2">
                                    <span>Retido pela Loja</span>
                                    <span>{formatarMoeda(config.margemLoja || 0)}</span>
                                </div>
                                
                                {simulacaoAtual.limite.includes('Excedeu') && (
                                    <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-4 -mt-2 text-right">
                                        *Inclui R$ {config.valorKmAdicional.toFixed(2)} por KM Extra
                                    </p>
                                )}

                                <div className="flex justify-between text-sm font-[1000] uppercase text-[#4B0082]">
                                    <span>Total Final</span>
                                    <span>{formatarMoeda(28 + simulacaoAtual.valor)}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default function ConfiguracoesWrapper() {
    return <ToastProvider><ConfiguracoesContent /></ToastProvider>;
}