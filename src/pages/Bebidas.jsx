import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import * as Lucide from "lucide-react";
import { useCart } from "../context/CartContext";

const Bebidas = () => {
  const [bebidas, setBebidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "produtos"), (snapshot) => {
      const lista = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.categoria === "Bebidas");
      setBebidas(lista);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="p-8 text-center">Carregando bebidas...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <h2 className="text-2xl font-bold mb-6 text-[#4A044E]">Bebidas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bebidas.map((bebida) => (
          <div key={bebida.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">{bebida.nome}</h3>
              <p className="text-gray-500 text-sm">{bebida.descricao}</p>
              <p className="text-[#4A044E] font-bold mt-2">R$ {bebida.preco.toFixed(2)}</p>
            </div>
            <button
              onClick={() => addToCart({ ...bebida, quantidade: 1 })}
              className="bg-[#4A044E] text-white p-3 rounded-xl hover:bg-[#3B033D] transition-colors"
            >
              <Lucide.Plus size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bebidas;