import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth, db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// --- MÁSCARAS DE FORMATAÇÃO ---
const maskCPF = (value) => {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto entre o terceiro e o quarto dígitos
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto entre o terceiro e o quarto dígitos de novo
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2') // Coloca um hífen entre o terceiro e o quarto dígitos
    .slice(0, 14); // Limita a 14 caracteres
};

const maskTelefone = (value) => {
  return value
    .replace(/\D/g, '') 
    .replace(/^(\d{2})(\d)/g, '($1) $2') 
    .replace(/(\d{5})(\d)/, '$1-$2') 
    .slice(0, 15); 
};

export default function MeusDados() {
  const navigate = useNavigate();

  // --- ESTADOS DO FORMULÁRIO ---
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');

  // --- ESTADOS DA TELA ---
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // --- BUSCAR DADOS NO FIREBASE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setNome(data.nome || user.displayName || '');
            setEmail(data.email || user.email || '');
            setCpf(data.cpf || '');
            setTelefone(data.telefone || '');
          } else {
            // Se não existir, preenche com os dados básicos de login do Google
            setNome(user.displayName || '');
            setEmail(user.email || '');
          }
        } catch (error) {
          console.error("Erro ao buscar dados: ", error);
        }
      } else {
        // Se não estiver logado, manda pro login ou home
        navigate('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // --- SALVAR DADOS ---
  const handleSalvar = async (e) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });

    // Validações Básicas
    if (!nome || !email || !telefone) {
      setMensagem({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    if (cpf && cpf.length < 14) {
      setMensagem({ tipo: 'erro', texto: 'O CPF digitado está incompleto.' });
      return;
    }

    setSalvando(true);

    try {
      const user = auth.currentUser;
      if (user) {
        const payload = {
          nome,
          email,
          cpf,
          telefone,
          updatedAt: serverTimestamp()
        };

        // Salva no Firestore
        await setDoc(doc(db, 'usuarios', user.uid), payload, { merge: true });

        // Sincroniza com o LocalStorage para navegação rápida
        const currentLocal = JSON.parse(localStorage.getItem('@RodriguesAcai:user')) || {};
        localStorage.setItem('@RodriguesAcai:user', JSON.stringify({ ...currentLocal, ...payload, uid: user.uid }));

        setMensagem({ tipo: 'sucesso', texto: 'Dados atualizados com sucesso!' });
        
        // Remove a mensagem de sucesso após 3 segundos
        setTimeout(() => setMensagem({ tipo: '', texto: '' }), 3000);
      }
    } catch (error) {
      console.error("Erro ao salvar: ", error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao atualizar dados. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  };

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(50); };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#82C91E] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      
      {/* HEADER PREMIUM */}
      <header className="bg-white p-6 pb-8 rounded-b-[3rem] shadow-xl border-b border-slate-100 mb-8 sticky top-0 z-50">
        <div className="max-w-[500px] mx-auto flex items-center gap-4">
          <button 
            onClick={() => { vibrar(); navigate(-1); }} 
            className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#4B0082] shadow-inner active:scale-90 transition-all border border-slate-100"
          >
            <Lucide.ChevronLeft size={28} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-2xl font-[1000] italic uppercase tracking-tighter text-[#4B0082] leading-none">
              Meus <span className="text-[#82C91E]">Dados</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sua identidade na loja</p>
          </div>
        </div>
      </header>

      <main className="px-6 max-w-[500px] mx-auto">
        <form onSubmit={handleSalvar} className="space-y-6">
          
          {/* CARD DE INFORMAÇÕES */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-5 relative overflow-hidden">
            
            {/* Elemento de Design de Fundo */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#4B0082]/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* CAMPO NOME */}
            <div>
              <label className="text-[10px] font-black text-[#4B0082] uppercase ml-2 flex items-center gap-1 mb-1">
                <Lucide.User size={12} className="text-[#82C91E]" /> Nome Completo *
              </label>
              <input 
                type="text" 
                value={nome} 
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-[#4B0082] font-black text-sm outline-none focus:border-[#82C91E] transition-all"
              />
            </div>

            {/* CAMPO CPF */}
            <div>
              <label className="text-[10px] font-black text-[#4B0082] uppercase ml-2 flex items-center gap-1 mb-1">
                <Lucide.FileText size={12} className="text-[#82C91E]" /> CPF (Para Recibos e InfinitePay)
              </label>
              <input 
                type="text" 
                value={cpf} 
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-[#4B0082] font-black text-sm outline-none focus:border-[#82C91E] transition-all"
              />
            </div>

            {/* CAMPO WHATSAPP */}
            <div>
              <label className="text-[10px] font-black text-[#4B0082] uppercase ml-2 flex items-center gap-1 mb-1">
                <Lucide.Smartphone size={12} className="text-[#82C91E]" /> WhatsApp *
              </label>
              <input 
                type="tel" 
                value={telefone} 
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-[#4B0082] font-black text-sm outline-none focus:border-[#82C91E] transition-all"
              />
            </div>

            {/* CAMPO E-MAIL */}
            <div>
              <label className="text-[10px] font-black text-[#4B0082] uppercase ml-2 flex items-center gap-1 mb-1">
                <Lucide.Mail size={12} className="text-[#82C91E]" /> E-mail (Para Comprovantes) *
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-[#4B0082] font-black text-sm outline-none focus:border-[#82C91E] transition-all"
              />
            </div>
          </div>

          {/* MENSAGENS DE ERRO OU SUCESSO */}
          {mensagem.texto && (
            <div className={`p-4 rounded-2xl font-bold text-[11px] uppercase flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${mensagem.tipo === 'erro' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
              {mensagem.tipo === 'erro' ? <Lucide.AlertTriangle size={18} /> : <Lucide.CheckCircle size={18} />}
              {mensagem.texto}
            </div>
          )}

          {/* BOTÃO SALVAR */}
          <button 
            type="submit" 
            disabled={salvando}
            onClick={vibrar}
            className={`w-full py-5 rounded-[2rem] font-[1000] uppercase italic text-lg flex items-center justify-center gap-3 shadow-xl transition-all ${salvando ? 'bg-slate-200 text-slate-400 scale-95' : 'bg-[#82C91E] text-[#4B0082] active:scale-95 hover:bg-[#95df2b]'}`}
          >
            {salvando ? (
              <>
                <Lucide.Loader2 size={24} className="animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Lucide.Save size={24} /> Atualizar Cadastro
              </>
            )}
          </button>
        </form>

        {/* INFORMAÇÃO DE SEGURANÇA */}
        <div className="mt-8 flex flex-col items-center text-center opacity-50">
          <Lucide.ShieldCheck size={24} className="text-slate-400 mb-2" />
          <p className="text-[9px] font-black text-slate-400 uppercase leading-relaxed max-w-[250px]">
            Seus dados estão protegidos com criptografia ponta-a-ponta no Google Cloud.
          </p>
        </div>
      </main>
    </div>
  );
}