import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Lucide from "lucide-react";
import { db } from "../../services/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function NovoEndereco() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    rua: "",
    numero: "",
    bairro: "",
    complemento: "",
    apelido: "Casa" // Ex: Casa, Trabalho
  });

  const user = JSON.parse(localStorage.getItem('@RodriguesAcai:user'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "usuarios", user.uid, "enderecos"), {
        ...formData,
        createdAt: serverTimestamp()
      });
      navigate("/meus-enderecos");
    } catch (error) {
      console.error("Erro ao salvar endereço:", error);
      alert("Erro ao salvar endereço. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-zinc-100 rounded-full">
          <Lucide.ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black italic uppercase">Novo Endereço</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">Rua / Logradouro</label>
            <input
              required
              type="text"
              className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl outline-none focus:border-[#4A044E] font-bold"
              value={formData.rua}
              onChange={(e) => setFormData({...formData, rua: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">Número</label>
              <input
                required
                type="text"
                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl outline-none focus:border-[#4A044E] font-bold"
                value={formData.numero}
                onChange={(e) => setFormData({...formData, numero: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">Bairro</label>
              <input
                required
                type="text"
                className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl outline-none focus:border-[#4A044E] font-bold"
                value={formData.bairro}
                onChange={(e) => setFormData({...formData, bairro: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">Complemento / Referência</label>
            <input
              type="text"
              className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl outline-none focus:border-[#4A044E] font-bold"
              value={formData.complemento}
              onChange={(e) => setFormData({...formData, complemento: e.target.value})}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">Apelido (Ex: Casa, Trabalho)</label>
            <input
              type="text"
              className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl outline-none focus:border-[#4A044E] font-bold"
              value={formData.apelido}
              onChange={(e) => setFormData({...formData, apelido: e.target.value})}
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-[#4A044E] text-white py-5 rounded-[2rem] font-black uppercase italic tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar Endereço"}
        </button>
      </form>
    </div>
  );
}