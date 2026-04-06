import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Lucide from "lucide-react";
import { db, auth } from "../../services/firebase"; // Importação do auth adicionada
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function NovoEndereco() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    rua: "",
    numero: "",
    bairro: "",
    complemento: "",
    apelido: "Casa"
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // CORREÇÃO: Usar o utilizador logado no Firebase em vez do localStorage
    const user = auth.currentUser;

    if (!user) {
      alert("Sessão expirada. Por favor, faça login novamente.");
      navigate('/login');
      return;
    }

    if (!formData.rua || !formData.numero || !formData.bairro) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      // Salva na subcoleção de endereços do utilizador específico
      await addDoc(collection(db, "usuarios", user.uid, "enderecos"), {
        ...formData,
        uid: user.uid,
        createdAt: serverTimestamp()
      });
      
      alert("Endereço guardado com sucesso!");
      navigate("/perfil/enderecos"); 
    } catch (error) {
      console.error("Erro ao salvar endereço:", error);
      alert("Erro técnico ao guardar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 bg-black min-h-screen text-white">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-3 bg-white/5 rounded-2xl">
          <Lucide.ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Novo Endereço</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Rua / Logradouro</label>
            <input
              required
              className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#82C91E] font-bold text-sm"
              value={formData.rua}
              onChange={(e) => setFormData({...formData, rua: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Nº</label>
              <input
                required
                className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#82C91E] font-bold text-sm"
                value={formData.numero}
                onChange={(e) => setFormData({...formData, numero: e.target.value})}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Bairro</label>
              <input
                required
                className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#82C91E] font-bold text-sm"
                value={formData.bairro}
                onChange={(e) => setFormData({...formData, bairro: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Complemento / Referência</label>
            <input
              className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-[#82C91E] font-bold text-sm"
              value={formData.complemento}
              onChange={(e) => setFormData({...formData, complemento: e.target.value})}
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-[#82C91E] text-black py-5 rounded-[2rem] font-[1000] uppercase italic shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? "A guardar..." : "Confirmar Endereço"}
        </button>
      </form>
    </div>
  );
}