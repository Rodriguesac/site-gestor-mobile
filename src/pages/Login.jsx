import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, googleProvider, db } from '../services/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as Lucide from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MÁSCARA DE TELEFONE ---
const maskTelefone = (value) => {
  return value
    .replace(/\D/g, '') 
    .replace(/^(\d{2})(\d)/g, '($1) $2') 
    .replace(/(\d{5})(\d)/, '$1-$2') 
    .slice(0, 15); 
};

// --- CALCULADORA DE FORÇA DE SENHA ---
const checkPasswordStrength = (pass) => {
  let score = 0;
  if (!pass) return 0;
  if (pass.length > 5) score += 1;
  if (pass.length > 8) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;
  return score; // Vai de 0 a 5
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [modo, setModo] = useState('login'); 
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  const [forcaSenha, setForcaSenha] = useState(0);

  const logoURL = "https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png";

  useEffect(() => {
    setForcaSenha(checkPasswordStrength(senha));
  }, [senha]);

  // Limpa as mensagens ao trocar de modo
  useEffect(() => {
    setMensagem({ texto: '', tipo: '' });
    setSenha('');
    setConfirmaSenha('');
  }, [modo]);

  const salvarSessaoUsuario = async (user, telefoneCadastrado = '') => {
    const userData = {
      uid: user.uid,
      nome: user.displayName || nome || 'Cliente',
      email: user.email,
      foto: user.photoURL || '',
      telefone: telefoneCadastrado,
      ultimoLogin: new Date().toISOString()
    };
    localStorage.setItem('@RodriguesAcai:user', JSON.stringify(userData));
    await setDoc(doc(db, "usuarios", user.uid), {
      ...userData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const redirecionar = () => {
    // Se o usuário veio do Checkout, volta pra lá. Senão, vai pra Home.
    const destino = location.state?.from?.pathname || '/';
    navigate(destino, { replace: true });
  };

  const handleGoogleLogin = async () => {
    setCarregando(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await salvarSessaoUsuario(result.user);
      redirecionar();
    } catch (error) {
      setMensagem({ texto: 'Erro ao conectar com Google. Tente novamente.', tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  const handleRecuperarSenha = async () => {
    if (!email) return setMensagem({ texto: 'Digite seu e-mail acima primeiro.', tipo: 'erro' });
    try {
      await sendPasswordResetEmail(auth, email);
      setMensagem({ texto: 'Instruções de recuperação enviadas para o seu e-mail!', tipo: 'sucesso' });
    } catch (error) {
      let msg = 'Erro ao enviar e-mail.';
      if (error.code === 'auth/invalid-email') msg = 'Formato de e-mail inválido.';
      if (error.code === 'auth/user-not-found') msg = 'E-mail não cadastrado no sistema.';
      setMensagem({ texto: msg, tipo: 'erro' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem({ texto: '', tipo: '' });

    if (modo === 'cadastro') {
      if (senha.length < 6) return setMensagem({ texto: 'A senha deve ter pelo menos 6 caracteres.', tipo: 'erro' });
      if (senha !== confirmaSenha) return setMensagem({ texto: 'As senhas não coincidem.', tipo: 'erro' });
      if (telefone.length < 14) return setMensagem({ texto: 'Preencha o WhatsApp corretamente.', tipo: 'erro' });
    }

    setCarregando(true);
    try {
      if (modo === 'cadastro') {
        const res = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(res.user, { displayName: nome });
        await sendEmailVerification(res.user);
        await salvarSessaoUsuario(res.user, telefone);
      } else {
        const res = await signInWithEmailAndPassword(auth, email, senha);
        await salvarSessaoUsuario(res.user);
      }
      redirecionar();
    } catch (error) {
      let msg = 'Ocorreu um erro inesperado.';
      if (error.code === 'auth/user-not-found') msg = 'E-mail não cadastrado.';
      if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
      if (error.code === 'auth/email-already-in-use') msg = 'Este e-mail já possui uma conta.';
      if (error.code === 'auth/invalid-email') msg = 'E-mail em formato inválido.';
      if (error.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Tente novamente mais tarde.';
      setMensagem({ texto: msg, tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  // Cores do medidor de força da senha
  const coresForca = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'];

  return (
    <div className="min-h-screen bg-[#0b0e13] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden selection:bg-[#82C91E] selection:text-black">
      
      {/* BACKGROUND PREMIUM BLUR */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-[#4B0082]/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#82C91E]/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* BOTÃO VOLTAR À LOJA */}
      <button onClick={() => navigate('/')} className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors z-50">
        <div className="p-2 bg-white/5 rounded-xl backdrop-blur-md border border-white/5"><Lucide.ArrowLeft size={18} /></div>
        <span className="text-[10px] font-black uppercase italic tracking-widest hidden md:block">Voltar à loja</span>
      </button>

      <div className="w-full max-w-md z-10 flex flex-col items-center mt-12 md:mt-0">
        {/* LOGO */}
        <img src={logoURL} alt="Rodrigues Açaí" className="w-32 mb-8 drop-shadow-[0_10px_30px_rgba(130,201,30,0.3)] animate-in zoom-in duration-500" />

        <div className="w-full bg-white/5 p-8 md:p-10 rounded-[3rem] border border-white/10 backdrop-blur-xl shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div 
              key={modo}
              initial={{ opacity: 0, x: modo === 'login' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: modo === 'login' ? 20 : -20 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-2">
                {modo === 'login' ? 'Acessar a' : 'Criar'} <br/>
                <span className="text-[#82C91E]">Sua Conta</span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-8">
                {modo === 'login' ? 'Bem-vindo de volta ao Rodrigues!' : 'Junte-se à nossa família!'}
              </p>

              {/* MENSAGENS DE FEEDBACK */}
              {mensagem.texto && (
                <div className={`p-4 rounded-2xl mb-6 text-[10px] font-black uppercase flex items-center gap-3 animate-in slide-in-from-top-2 ${mensagem.tipo === 'erro' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[#82C91E]/10 text-[#82C91E] border border-[#82C91E]/20'}`}>
                  {mensagem.tipo === 'erro' ? <Lucide.AlertCircle size={16} /> : <Lucide.CheckCircle size={16} />}
                  {mensagem.texto}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* CAMPOS DE CADASTRO */}
                {modo === 'cadastro' && (
                  <>
                    <div className="relative group">
                      <Lucide.User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#82C91E] transition-colors" size={18} />
                      <input required type="text" placeholder="Nome Completo" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name"
                        className="w-full bg-black/40 border border-white/5 p-5 pl-14 rounded-2xl outline-none focus:border-[#82C91E] focus:ring-1 focus:ring-[#82C91E] font-bold text-sm transition-all" />
                    </div>
                    
                    <div className="relative group">
                      <Lucide.Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#82C91E] transition-colors" size={18} />
                      <input required type="tel" placeholder="WhatsApp" value={telefone} onChange={e => setTelefone(maskTelefone(e.target.value))} autoComplete="tel"
                        className="w-full bg-black/40 border border-white/5 p-5 pl-14 rounded-2xl outline-none focus:border-[#82C91E] focus:ring-1 focus:ring-[#82C91E] font-bold text-sm transition-all" />
                    </div>
                  </>
                )}

                {/* E-MAIL (AMBOS) */}
                <div className="relative group">
                  <Lucide.Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#82C91E] transition-colors" size={18} />
                  <input required type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                    className="w-full bg-black/40 border border-white/5 p-5 pl-14 rounded-2xl outline-none focus:border-[#82C91E] focus:ring-1 focus:ring-[#82C91E] font-bold text-sm transition-all" />
                </div>

                {/* SENHA (AMBOS) */}
                <div className="relative group">
                  <Lucide.Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#82C91E] transition-colors" size={18} />
                  <input required type={verSenha ? 'text' : 'password'} placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                    className="w-full bg-black/40 border border-white/5 p-5 pl-14 rounded-2xl outline-none focus:border-[#82C91E] focus:ring-1 focus:ring-[#82C91E] font-bold text-sm transition-all" />
                  <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                    {verSenha ? <Lucide.EyeOff size={18} /> : <Lucide.Eye size={18} />}
                  </button>
                </div>

                {/* MEDIDOR DE FORÇA (SÓ NO CADASTRO) */}
                {modo === 'cadastro' && senha.length > 0 && (
                  <div className="px-2 pb-2">
                    <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-black/50">
                      {[1, 2, 3, 4, 5].map((nivel) => (
                        <div key={nivel} className={`flex-1 transition-colors duration-300 ${forcaSenha >= nivel ? coresForca[forcaSenha - 1] : 'bg-transparent'}`} />
                      ))}
                    </div>
                    <p className="text-[9px] font-black uppercase text-zinc-500 mt-2 text-right">
                      {forcaSenha < 2 ? 'Fraca' : forcaSenha < 4 ? 'Média' : 'Forte'}
                    </p>
                  </div>
                )}

                {/* CONFIRMAR SENHA (SÓ NO CADASTRO) */}
                {modo === 'cadastro' && (
                  <div className="relative group">
                    <Lucide.ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#82C91E] transition-colors" size={18} />
                    <input required type={verSenha ? 'text' : 'password'} placeholder="Repita a Senha" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} autoComplete="new-password"
                      className="w-full bg-black/40 border border-white/5 p-5 pl-14 rounded-2xl outline-none focus:border-[#82C91E] focus:ring-1 focus:ring-[#82C91E] font-bold text-sm transition-all" />
                  </div>
                )}

                {/* RECUPERAR SENHA (SÓ NO LOGIN) */}
                {modo === 'login' && (
                  <div className="flex justify-end pt-1">
                    <button type="button" onClick={handleRecuperarSenha} className="text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-[#82C91E] transition-colors">
                      Esqueci a minha senha
                    </button>
                  </div>
                )}

                {/* BOTÃO SUBMIT */}
                <button disabled={carregando} className="w-full bg-[#82C91E] text-[#4B0082] py-5 mt-4 rounded-[2rem] font-[1000] uppercase italic text-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_10px_30px_rgba(130,201,30,0.2)] flex justify-center items-center">
                  {carregando ? <Lucide.Loader2 className="animate-spin" /> : modo === 'login' ? 'Entrar na Loja' : 'Confirmar Cadastro'}
                </button>
              </form>

              {/* DIVISOR */}
              <div className="relative my-8 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <span className="relative bg-[#12151b] px-4 text-[10px] uppercase font-black text-zinc-500 tracking-widest rounded-full">ou acesso rápido</span>
              </div>

              {/* GOOGLE LOGIN */}
              <button type="button" onClick={handleGoogleLogin} className="w-full bg-white text-black py-4 rounded-[2rem] font-black uppercase italic flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-slate-100">
                <img src="https://cdn-icons-png.flaticon.com/512/300/300221.png" className="w-5" alt="Google" />
                Continuar com Google
              </button>

              {/* FOOTER SWITCH */}
              <p className="mt-8 text-center text-zinc-400 font-bold text-[10px] uppercase tracking-wider">
                {modo === 'login' ? 'Ainda não é cliente?' : 'Já possui uma conta?'}
                <button onClick={() => setModo(modo === 'login' ? 'cadastro' : 'login')} className="ml-2 text-white hover:text-[#82C91E] font-[1000] underline italic transition-colors">
                  {modo === 'login' ? 'Cadastre-se agora' : 'Faça seu Login'}
                </button>
              </p>

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}