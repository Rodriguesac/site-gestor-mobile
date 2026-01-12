import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../services/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as Lucide from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); 
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  const logoURL = "https://i.ibb.co/9Ly63D3/Chat-GPT-Image-30-de-dez-de-2025-20-07-39.png";

  const mostrarMensagem = (texto, tipo = 'erro') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 4000);
  };

  const salvarLocalESync = async (user, nomeManual = null) => {
    const nomeFinal = nomeManual || user.displayName || "Cliente Rodrigues";
    
    try {
      // SINCRONIZADO: Agora usa a coleção 'usuarios' para bater com MeusDados.jsx
      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        nome: nomeFinal,
        email: user.email,
        ultimaAtividade: serverTimestamp(),
        role: 'cliente',
        // Campos de controle para permissões de edição
        edicoesNome: 0, 
        edicoesDocumentos: 0,
        cpf: '',
        dataNascimento: '',
        telefone: ''
      }, { merge: true });

      const userData = { 
        nome: nomeFinal, 
        email: user.email, 
        uid: user.uid 
      };
      localStorage.setItem('@RodriguesAcai:user', JSON.stringify(userData));
      window.dispatchEvent(new Event('storage')); 
      navigate('/perfil');
    } catch (err) { 
      console.error(err);
      mostrarMensagem("Erro ao sincronizar dados.");
    }
  };

  const handleRecuperarSenha = async () => {
    if (!email || !email.includes('@')) {
      mostrarMensagem("Digite um e-mail válido.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      mostrarMensagem("Link enviado! Verifique seu e-mail.", 'sucesso');
    } catch (e) {
      mostrarMensagem("Erro ao enviar e-mail de recuperação.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === 'cadastro') {
        const res = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(res.user, { displayName: nome });
        await salvarLocalESync(res.user, nome);
      } else {
        const res = await signInWithEmailAndPassword(auth, email, senha);
        await salvarLocalESync(res.user);
      }
    } catch (e) { 
      if (e.code === 'auth/email-already-in-use') mostrarMensagem("E-mail já cadastrado.");
      else if (e.code === 'auth/weak-password') mostrarMensagem("Senha muito fraca.");
      else mostrarMensagem("Dados incorretos.");
    } finally { setCarregando(false); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12 pb-10 relative">
      <button onClick={() => navigate('/')} className="fixed top-4 right-4 z-[120] bg-zinc-50 p-3 rounded-2xl border border-zinc-100 text-zinc-400 active:scale-90 transition-all shadow-sm">
        <Lucide.X size={24} />
      </button>

      <div className="w-full max-w-sm flex flex-col items-center">
        <img src={logoURL} className="h-28 w-auto mb-8 drop-shadow-2xl" alt="Logo" />

        <div className="w-full flex bg-zinc-100 p-1.5 rounded-[1.8rem] mb-10">
          <button onClick={() => setModo('login')} className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase italic transition-all ${modo === 'login' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-400'}`}>Entrar</button>
          <button onClick={() => setModo('cadastro')} className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase italic transition-all ${modo === 'cadastro' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-400'}`}>Cadastrar</button>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {modo === 'cadastro' && (
            <div className="relative">
              <Lucide.User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
              <input type="text" placeholder="SEU NOME" value={nome} onChange={e => setNome(e.target.value.toUpperCase())} required className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl focus:border-[#ea1d2c] outline-none font-bold text-sm" />
            </div>
          )}
          
          <div className="relative">
            <Lucide.Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
            <input type="email" placeholder="E-MAIL" value={email} onChange={e => setEmail(e.target.value)} required className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl focus:border-[#ea1d2c] outline-none font-bold text-sm" />
          </div>

          <div className="relative">
            <Lucide.Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={18} />
            <input type={verSenha ? "text" : "password"} placeholder="SENHA" value={senha} onChange={e => setSenha(e.target.value)} required className="w-full pl-12 pr-12 py-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl focus:border-[#ea1d2c] outline-none font-bold text-sm" />
            <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
              {verSenha ? <Lucide.EyeOff size={20} /> : <Lucide.Eye size={20} />}
            </button>
          </div>

          {modo === 'login' && (
            <button type="button" onClick={handleRecuperarSenha} className="w-full text-right text-[10px] font-black uppercase text-zinc-400 italic pr-2">Esqueci a senha</button>
          )}

          {mensagem.texto && (
            <div className={`p-4 rounded-2xl text-[11px] font-bold uppercase italic ${mensagem.tipo === 'erro' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
              {mensagem.texto}
            </div>
          )}
          
          <button disabled={carregando} type="submit" className="w-full bg-[#ea1d2c] text-white py-5 rounded-[2rem] font-black uppercase italic shadow-xl active:scale-95 transition-all flex justify-center items-center">
            {carregando ? <Lucide.Loader2 className="animate-spin" /> : modo === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="relative my-10 w-full text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-100"></div></div>
          <span className="relative bg-white px-4 text-[10px] uppercase font-black text-zinc-300 tracking-[0.3em]">ou</span>
        </div>

        <button type="button" onClick={() => signInWithPopup(auth, googleProvider).then(res => salvarLocalESync(res.user))} className="w-full flex items-center justify-center gap-4 p-4 border-2 border-zinc-100 rounded-[2rem] font-bold text-zinc-700 text-sm">
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Google
        </button>
      </div>
    </div>
  );
}