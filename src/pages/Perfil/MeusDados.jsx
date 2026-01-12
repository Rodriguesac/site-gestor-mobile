import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth, db } from '../../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// MÁSCARAS
const mCPF = (v) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14);
const mData = (v) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1').slice(0, 10);
const mTel = (v) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);

export default function MeusDados() {
  const navigate = useNavigate();
  const recaptchaRef = useRef(null); // Referência para não perder o mapa
  
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState({ tipo: '', texto: '' });
  const [bloqueado, setBloqueado] = useState(false);
  
  const [confirmacao, setConfirmacao] = useState(null);
  const [codigoSms, setCodigoSms] = useState('');
  const [etapaSms, setEtapaSms] = useState(false);
  const [telVerificado, setTelVerificado] = useState(false);
  const [formData, setFormData] = useState({ nome: '', cpf: '', dataNascimento: '', telefone: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
          const d = docSnap.data();
          if (d.cpf) setBloqueado(true);
          if (d.telefoneVerificado) setTelVerificado(true);
          setFormData({
            nome: d.nome || '',
            cpf: d.cpf ? mCPF(d.cpf) : '',
            dataNascimento: d.dataNascimento ? mData(d.dataNascimento) : '',
            telefone: d.telefone ? mTel(d.telefone) : '',
          });
        }
      } else { navigate('/login'); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const enviarCodigoSms = async () => {
    setStatus({ tipo: '', texto: '' });
    
    // Limpeza segura sem destruir a div principal
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
        if (recaptchaRef.current) recaptchaRef.current.innerHTML = '';
      } catch (e) { console.error("Erro ao limpar:", e); }
    }

    const telLimpo = "+55" + formData.telefone.replace(/\D/g, '');
    
    try {
      // Inicializa o verificado usando a Ref
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
        'size': 'invisible',
        'callback': () => { /* reCAPTCHA resolvido */ }
      });

      const result = await signInWithPhoneNumber(auth, telLimpo, window.recaptchaVerifier);
      setConfirmacao(result);
      setEtapaSms(true);
      setStatus({ tipo: 'sucesso', texto: 'CÓDIGO ENVIADO!' });
    } catch (error) {
      console.error("Erro SMS:", error);
      setStatus({ tipo: 'erro', texto: 'ERRO AO ENVIAR. USE NÚMEROS DE TESTE.' });
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
    }
  };

  const validarCodigoSms = async () => {
    try {
      await confirmacao.confirm(codigoSms);
      setTelVerificado(true);
      setEtapaSms(false);
      setStatus({ tipo: 'sucesso', texto: 'WHATSAPP VALIDADO!' });
    } catch (error) {
      setStatus({ tipo: 'erro', texto: 'CÓDIGO INVÁLIDO.' });
    }
  };

  const salvarFinal = async (e) => {
    e.preventDefault();
    if (!telVerificado) return setStatus({ tipo: 'erro', texto: 'VALIDE O WHATSAPP PRIMEIRO.' });
    setSalvando(true);
    try {
      const updates = {
        nome: formData.nome.toUpperCase(),
        telefone: formData.telefone,
        telefoneVerificado: true,
        cpf: formData.cpf.replace(/\D/g, ''),
        dataNascimento: formData.dataNascimento,
        updatedAt: new Date()
      };
      await updateDoc(doc(db, "usuarios", auth.currentUser.uid), updates);
      setStatus({ tipo: 'sucesso', texto: 'DADOS ATUALIZADOS!' });
      setBloqueado(true);
      if(localStorage.getItem('carrinho_rodrigues')) navigate('/checkout');
    } catch (error) { setStatus({ tipo: 'erro', texto: 'FALHA AO SALVAR.' }); }
    setSalvando(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black italic text-zinc-300 uppercase">Carregando...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 pb-10 font-ifood">
      {/* DIV DO MAPA/RECAPTCHA - CRÍTICA PARA FUNCIONAR */}
      <div ref={recaptchaRef} id="recaptcha-container"></div>

      <div className="bg-white p-4 md:p-6 border-b border-zinc-100 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-zinc-50 rounded-full text-[#ea1d2c]"><Lucide.ChevronLeft /></button>
          <h1 className="text-xl md:text-2xl font-[1000] uppercase italic tracking-tighter">Meus <span className="text-[#ea1d2c]">Dados</span></h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4 mt-2">
        {status.texto && (
          <div className={`p-4 rounded-2xl font-black text-center text-[10px] uppercase italic animate-bounce ${status.tipo === 'sucesso' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {status.texto}
          </div>
        )}

        {/* BOX INFORMAÇÕES PESSOAIS */}
        <div className="bg-white p-5 md:p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase italic ml-2">Nome Completo</label>
              <input readOnly={bloqueado} type="text" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})}
              className="w-full p-4 bg-zinc-50 rounded-2xl font-bold border-2 border-transparent focus:border-zinc-900 outline-none transition-all" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase italic ml-2">CPF</label>
                <input readOnly={bloqueado} type="text" value={formData.cpf} onChange={(e) => setFormData({...formData, cpf: mCPF(e.target.value)})}
                className="w-full p-4 bg-zinc-50 rounded-2xl font-bold border-2 border-transparent outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase italic ml-2">Nascimento</label>
                <input readOnly={bloqueado} type="text" value={formData.dataNascimento} onChange={(e) => setFormData({...formData, dataNascimento: mData(e.target.value)})}
                className="w-full p-4 bg-zinc-50 rounded-2xl font-bold border-2 border-transparent outline-none" />
              </div>
            </div>
        </div>

        {/* BOX WHATSAPP */}
        <div className="bg-white p-5 md:p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-4">
          <p className="text-[10px] font-black text-zinc-400 uppercase italic mb-2">Validação de Segurança</p>
          {!telVerificado ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-2">
                <input type="text" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: mTel(e.target.value)})} 
                className="flex-1 bg-zinc-50 p-4 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-[#82C91E]" placeholder="(00) 00000-0000" />
                {!etapaSms && (
                  <button onClick={enviarCodigoSms} className="bg-zinc-900 text-white py-4 md:py-0 md:px-8 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all">Enviar SMS</button>
                )}
              </div>
              
              {etapaSms && (
                <div className="flex gap-2 animate-in slide-in-from-top-2">
                  <input type="text" value={codigoSms} onChange={(e) => setCodigoSms(e.target.value)} placeholder="000000"
                  className="flex-1 bg-green-50 border-2 border-[#82C91E] p-4 rounded-2xl font-black text-center text-xl tracking-[0.3em] outline-none" maxLength={6} />
                  <button onClick={validarCodigoSms} className="bg-[#82C91E] text-white px-8 rounded-2xl font-black uppercase text-xs">Validar</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-green-50 p-5 rounded-2xl border border-green-100">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-green-600 uppercase italic">WhatsApp Verificado</span>
                <span className="font-black text-xl text-zinc-800">{formData.telefone}</span>
              </div>
              <Lucide.ShieldCheck size={32} className="text-green-500" />
            </div>
          )}
        </div>

        <button onClick={salvarFinal} disabled={!telVerificado || salvando} 
        className="w-full bg-[#82C91E] text-white p-6 rounded-[2.5rem] font-[1000] uppercase italic text-lg shadow-xl shadow-green-100 disabled:grayscale disabled:opacity-50 active:scale-95 transition-all">
          {salvando ? 'A GUARDAR...' : 'SALVAR E FINALIZAR'}
        </button>
      </div>
    </div>
  );
}