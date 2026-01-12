import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { db, auth } from '../services/firebase'; 
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';

export default function Checkout() {
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dados sincronizados do Firestore
  const [perfil, setPerfil] = useState({
    nome: '',
    telefone: '',
    telefoneVerificado: false
  });
  
  const [dadosEndereco, setDadosEndereco] = useState(null);
  const [metodoPrincipal, setMetodoPrincipal] = useState(''); 
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [obsPagamento, setObsPagamento] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return navigate('/login');

      // 1. Carrega Carrinho
      const carrinho = JSON.parse(localStorage.getItem('carrinho_rodrigues'));
      if (!carrinho) return navigate('/');
      setPedido(carrinho);

      // 2. PENTE FINO: Busca dados reais no banco (Segurança contra fakes)
      try {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
          const d = docSnap.data();
          setPerfil({
            nome: d.nome || '',
            telefone: d.telefone || '',
            telefoneVerificado: d.telefoneVerificado || false
          });
        }
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      }

      // 3. Carrega Endereço Ativo selecionado em MeusEnderecos
      const enderecoSalvo = JSON.parse(localStorage.getItem('@RodriguesAcai:endereco'));
      if (enderecoSalvo) {
        setDadosEndereco(enderecoSalvo);
        setTaxaEntrega(Number(enderecoSalvo.taxa) || 0);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const finalizarPedido = async () => {
    // VALIDAÇÕES DO PENTE FINO
    if (!perfil.telefoneVerificado) {
      alert("⚠️ Valide o seu WhatsApp em 'Meus Dados' para continuar.");
      return navigate('/perfil/dados'); // Ajuste o path conforme sua rota
    }
    if (!metodoPrincipal) return alert("Selecione a forma de pagamento");
    if (!dadosEndereco) return alert("Selecione um endereço para entrega");

    try {
      const pedidoFinal = {
        userId: auth.currentUser.uid,
        cliente: {
          nome: perfil.nome.toUpperCase(),
          telefone: perfil.telefone,
        },
        itens: pedido.itens.map(item => ({
          nome: item.nome,
          qtd: Number(item.qtd),
          precoUnitario: Number(item.preco),
          subtotal: Number(item.preco * item.qtd),
          adicionais: item.adicionais || []
        })),
        pagamento: {
          metodo: metodoPrincipal,
          subtotal: Number(pedido.totalGeral),
          taxaEntrega: Number(taxaEntrega),
          total: Number(pedido.totalGeral + taxaEntrega),
          obs: obsPagamento
        },
        endereco: {
          rua: dadosEndereco.rua,
          numero: dadosEndereco.numero,
          bairro: dadosEndereco.bairro,
          referencia: dadosEndereco.referencia || '',
          apelido: dadosEndereco.apelido || 'Casa'
        },
        status: "PENDENTE",
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "pedidos"), pedidoFinal);
      localStorage.removeItem('carrinho_rodrigues');
      navigate(`/acompanhamento/${docRef.id}`);
    } catch (e) {
      console.error(e);
      alert("Erro ao processar pedido.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black italic text-zinc-300">A PROCESSAR...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 p-4 pb-32 font-ifood">
      <div className="max-w-xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full"><Lucide.ChevronLeft /></button>
          <h1 className="text-2xl font-[1000] italic uppercase tracking-tighter">Checkout</h1>
        </header>

        {/* Resumo da Entrega */}
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase italic">Entregar para {perfil.nome.split(' ')[0]}</p>
              <p className="font-bold text-sm uppercase">{dadosEndereco ? `${dadosEndereco.rua}, ${dadosEndereco.numero}` : 'Sem endereço'}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">{dadosEndereco?.bairro}</p>
            </div>
            <button onClick={() => navigate('/perfil/enderecos')} className="text-[#ea1d2c] font-black text-[10px] uppercase italic">Alterar</button>
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-50">
             <Lucide.Phone size={12} className="text-zinc-400" />
             <span className="text-[10px] font-bold text-zinc-600">{perfil.telefone}</span>
             {perfil.telefoneVerificado && <Lucide.ShieldCheck size={12} className="text-green-500" />}
          </div>
        </div>

        {/* Pagamento */}
        <section className="space-y-3 text-center">
          <h3 className="font-black uppercase italic text-[10px] text-zinc-400">Forma de Pagamento</h3>
          <div className="grid grid-cols-3 gap-2">
            {['PIX', 'CARTÃO', 'DINHEIRO'].map(m => (
              <button key={m} onClick={() => setMetodoPrincipal(m)}
                className={`h-14 rounded-2xl font-black italic text-[10px] transition-all border-2 ${metodoPrincipal === m ? 'border-[#82C91E] bg-green-50 text-[#82C91E]' : 'border-zinc-100 bg-white text-zinc-400'}`}>
                {m}
              </button>
            ))}
          </div>
          <input 
            type="text" 
            placeholder="Alguma observação? (ex: troco para 50)" 
            className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-zinc-100 outline-none focus:border-zinc-300"
            onChange={(e) => setObsPagamento(e.target.value)}
          />
        </section>

        {/* Totalizador Rodrigues Açaí */}
        <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] space-y-2 shadow-xl">
          <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 italic">
            <span>Subtotal</span>
            <span>R$ {pedido.totalGeral.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 italic">
            <span>Taxa de Entrega</span>
            <span>R$ {taxaEntrega.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-4 mt-2 border-t border-white/10">
            <span className="font-black italic uppercase text-sm text-zinc-400">Total</span>
            <span className="text-3xl font-[1000] text-[#82C91E] italic">R$ {(pedido.totalGeral + taxaEntrega).toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={finalizarPedido}
          disabled={!perfil.telefoneVerificado}
          className={`w-full py-6 rounded-2xl font-[1000] uppercase italic text-lg shadow-lg active:scale-95 transition-all
            ${perfil.telefoneVerificado ? 'bg-[#82C91E] text-white shadow-green-100' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
        >
          {perfil.telefoneVerificado ? 'Finalizar Pedido' : 'WhatsApp não verificado'}
        </button>
      </div>
    </div>
  );
}