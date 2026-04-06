import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth, db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCart } from '@/context/CartContext'; // Corrigido para "context" no singular!

const BANCOS_POPULARES = [
  'Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Caixa Econômica', 
  'Banco Inter', 'C6 Bank', 'Sicredi', 'Sicoob', 'PagBank', 'Mercado Pago', 'PicPay'
];

// MÁSCARA DE TELEFONE PARA O MODAL
const mTel = (v) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);

export default function Checkout() {
  const navigate = useNavigate();
  const { limparCarrinho } = useCart();
  
  // ================= DADOS DO SISTEMA (VIA LOCALSTORAGE) =================
  const [cartData] = useState(() => JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 });
  const [checkoutData] = useState(() => JSON.parse(localStorage.getItem('checkout_dados')) || { tipoEntrega: 'delivery', valorFrete: 0, subtotal: 0 });
  const [enderecoData] = useState(() => JSON.parse(localStorage.getItem('endereco_rodrigues')) || null);
  const [userData] = useState(() => JSON.parse(localStorage.getItem('@RodriguesAcai:user')) || JSON.parse(localStorage.getItem('user_rodrigues')) || null);

  const cart = cartData.itens || [];
  const tipoPedido = checkoutData.tipoEntrega; 
  const taxaEntrega = Number(checkoutData.valorFrete) || 0;
  const subtotal = Number(checkoutData.subtotal) || Number(cartData.totalGeral) || 0;

  // ================= ESTADOS DO CHECKOUT =================
  const [salvando, setSalvando] = useState(false);
  const [lojaAberta, setLojaAberta] = useState(true);
  const [showModalDados, setShowModalDados] = useState(false); // Modal da InfinitePay
  
  // Dados do Cliente para a InfinitePay
  const [nomeCliente, setNomeCliente] = useState(userData?.nome || '');
  const [emailCliente, setEmailCliente] = useState(userData?.email || '');
  const [telefoneCliente, setTelefoneCliente] = useState(userData?.telefone || '');

  const [metodoPagamento, setMetodoPagamento] = useState(localStorage.getItem('ultimo_pagamento') || ''); 
  const [formaOnline, setFormaOnline] = useState(''); 
  const [formaEntrega, setFormaEntrega] = useState('');
  
  const [trocoPara, setTrocoPara] = useState(''); 
  const [tipoTroco, setTipoTroco] = useState('DINHEIRO'); 
  const [recebedoresTroco, setRecebedoresTroco] = useState([{ id: Date.now(), nome: userData?.nome || '', valor: '', chavePix: '', banco: '' }]);
  
  const [gorjeta, setGorjeta] = useState(0); 
  const [dividirConta, setDividirConta] = useState(1); 
  const [modoSilencioso, setModoSilencioso] = useState(false); 
  const [termosAceitos, setTermosAceitos] = useState(true); 
  
  const [cupom, setCupom] = useState(checkoutData.cupom || '');
  const [statusCupom, setStatusCupom] = useState({ tipo: '', texto: '', desconto: Number(checkoutData.descontoAplicado) || 0 });
  const [isConfetti, setIsConfetti] = useState(false); 
  const [mostrarTodosItens, setMostrarTodosItens] = useState(false); 
  const [shakeErro, setShakeErro] = useState(false); 

  const PEDIDO_MINIMO = 15.00; 
  const INFINITE_USER = "rodriguesac"; // Sua InfiniteTag

  useEffect(() => {
    if (!cart || cart.length === 0) navigate('/carrinho');
  }, [cart, navigate]);

  useEffect(() => {
      if (metodoPagamento) localStorage.setItem('ultimo_pagamento', metodoPagamento);
  }, [metodoPagamento]);

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(50); }; 

  const obterPreco = (item) => {
      let p = item.preco || item.price || item.valor || item.total || 0;
      if (typeof p === 'string') p = p.replace(',', '.'); 
      return Number(p);
  };

  const calcularTotalFinal = () => (subtotal + taxaEntrega + gorjeta - statusCupom.desconto).toFixed(2);

  const aplicarCupom = () => {
    if (cupom.toUpperCase() === 'RODRIGUES10') {
      setStatusCupom({ tipo: 'sucesso', texto: '10% OFF!', desconto: subtotal * 0.10 });
      setIsConfetti(true); setTimeout(() => setIsConfetti(false), 2000); vibrar();
    } else {
      setStatusCupom({ tipo: 'erro', texto: 'INVÁLIDO', desconto: 0 });
    }
  };

  const adicionarRecebedor = () => { vibrar(); setRecebedoresTroco([...recebedoresTroco, { id: Date.now(), nome: '', valor: '', chavePix: '', banco: '' }]); };
  const removerRecebedor = (id) => { vibrar(); setRecebedoresTroco(recebedoresTroco.filter(r => r.id !== id)); };
  const atualizarRecebedor = (id, campo, valor) => setRecebedoresTroco(recebedoresTroco.map(r => r.id === id ? { ...r, [campo]: valor } : r));

  // ================= INTEGRAÇÃO INFINITEPAY & BANCO =================
  const processarCheckout = () => {
      vibrar();
      const semPagamento = !metodoPagamento || (metodoPagamento === 'online' && !formaOnline) || (metodoPagamento === 'entrega' && !formaEntrega);
      if (semPagamento || !termosAceitos) { setShakeErro(true); setTimeout(() => setShakeErro(false), 600); return; }
      
      // InfinitePay exige dados. Se faltar, abre o modal.
      if (metodoPagamento === 'online' && (!nomeCliente || !emailCliente || !telefoneCliente)) {
          setShowModalDados(true);
          return;
      }

      executarFinalizacao();
  };

  const executarFinalizacao = async () => {
    setSalvando(true); 
    setShowModalDados(false);

    let metPagamentoString = metodoPagamento === 'online' ? (formaOnline === 'INFINITEPAY' ? 'Online (Cartão InfinitePay)' : 'Online (PIX)') : `Na Entrega (${formaEntrega})`;
    let obsKDS = modoSilencioso ? '🔕 MODO SILENCIOSO: Não tocar campainha. ' : '';
    
    if (formaEntrega === 'DINHEIRO' && trocoPara) {
        obsKDS += `💰 LEVAR TROCO PARA R$ ${trocoPara}. `;
        if (tipoTroco === 'PIX') {
            obsKDS += `\n🔄 ATENÇÃO: TROCO VIA PIX!\n`;
            recebedoresTroco.forEach((r, i) => { obsKDS += `Rec ${i+1}: ${r.nome} | R$${r.valor} | Chave: ${r.chavePix} | Banco: ${r.banco}\n`; });
        }
    }

    const enderecoFormatadoObj = enderecoData ? {
        rua: enderecoData.rua || 'S/N', numero: enderecoData.numero || 'S/N', bairro: enderecoData.bairro || '', 
        complemento: enderecoData.complemento || '', cep: enderecoData.cep || ''
    } : null;

    const enderecoStringInfinite = enderecoData ? `${enderecoData.rua}, ${enderecoData.numero}` : 'Balcão';

    try {
        // 1. CRIA O PEDIDO NO BANCO
        const docRef = await addDoc(collection(db, "pedidos"), {
            cliente: { uid: auth.currentUser?.uid || 'anonimo', nome: nomeCliente, telefone: telefoneCliente, email: emailCliente },
            itens: cart,
            tipoPedido: tipoPedido === 'delivery' ? 'ENTREGA' : 'RETIRADA',
            endereco: tipoPedido === 'delivery' ? enderecoFormatadoObj : null,
            pagamento: { metodo: metPagamentoString, tipoTroco: tipoTroco, valorTrocoPara: trocoPara, recebedoresPix: tipoTroco === 'PIX' ? recebedoresTroco : [] },
            observacao: obsKDS,
            gorjeta: gorjeta,
            valores: { subtotal, taxa: taxaEntrega, desconto: statusCupom.desconto, total: Number(calcularTotalFinal()) },
            status: metodoPagamento === 'online' ? 'AGUARDANDO_PAGAMENTO' : 'PENDENTE',
            createdAt: serverTimestamp()
        });

        // 2. LÓGICA INFINITEPAY RECICLADA (FRONTEND URL)
        if (metodoPagamento === 'online') {
            const itemsInfinite = cart.map((i, idx) => ({
                name: `#${(idx + 1).toString().padStart(3, '0')} ${i.nome}`,
                price: Math.round(obterPreco(i) * 100),
                quantity: Number(i.quantidade || 1)
            }));
            
            if (taxaEntrega > 0) itemsInfinite.push({ name: "Taxa Logística", price: Math.round(taxaEntrega * 100), quantity: 1 });
            if (gorjeta > 0) itemsInfinite.push({ name: "Caixinha da Equipe", price: Math.round(gorjeta * 100), quantity: 1 });

            // Abate o desconto do primeiro item
            if (statusCupom.desconto > 0) {
                const descCentavos = Math.round(statusCupom.desconto * 100);
                if (itemsInfinite[0].price > descCentavos) {
                    itemsInfinite[0].price -= descCentavos;
                    itemsInfinite[0].name += ' (Desc. Aplicado)';
                }
            }

            const params = new URLSearchParams({
                items: JSON.stringify(itemsInfinite),
                order_nsu: docRef.id,
                customer_name: nomeCliente,
                customer_email: emailCliente,
                customer_cellphone: telefoneCliente.replace(/\D/g, ""),
                address_cep: enderecoData?.cep?.replace(/\D/g, "") || "00000000",
                address_street: enderecoStringInfinite,
                address_district: enderecoData?.bairro || "",
                redirect_url: `${window.location.origin}/sucesso` // InfinitePay manda pra cá!
            }).toString();

            limparCarrinho();
            localStorage.removeItem('checkout_dados');
            window.location.href = `https://checkout.infinitepay.io/${INFINITE_USER}?${params}`;
            return;
        }

        // 3. SE FOR NA ENTREGA: Vai direto para o acompanhamento
        setTimeout(() => {
          limparCarrinho();
          localStorage.removeItem('checkout_dados');
          localStorage.removeItem('endereco_rodrigues');
          navigate(`/acompanhamento/${docRef.id}`); 
        }, 1500);

    } catch (error) { 
        console.error("Erro", error); 
        alert("Erro ao salvar pedido."); 
        setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#3b0060] font-sans flex justify-center selection:bg-[#82C91E] selection:text-black">
      <style>{`
        @keyframes shake { 0%, 100% {transform: translateX(0);} 25% {transform: translateX(-8px);} 75% {transform: translateX(8px);} }
        .shake-animation { animation: shake 0.3s ease-in-out; border-color: #ef4444 !important; }
        .confetti-bg { background-image: radial-gradient(circle, #82C91E 10%, transparent 10%); background-size: 20px 20px; animation: confetti 1s ease-out; }
        @keyframes confetti { 0% { background-position: 0 0; opacity: 1; } 100% { background-position: 100px 100px; opacity: 0; } }
      `}</style>
      
      <datalist id="lista-bancos">{BANCOS_POPULARES.map(banco => <option key={banco} value={banco} />)}</datalist>

      <div className="w-full max-w-md bg-zinc-50 min-h-screen shadow-2xl relative flex flex-col pb-40">
        
        {/* HEADER TUNNEL VISION */}
        <div className="p-5 flex items-center justify-between sticky top-0 z-40 bg-zinc-50/90 backdrop-blur-md border-b border-zinc-200">
            <button onClick={() => { vibrar(); navigate(-1); }} className="p-3 bg-white rounded-xl text-[#3b0060] shadow-sm border border-zinc-200">
              <Lucide.ChevronLeft size={22} strokeWidth={3}/>
            </button>
            <div className="text-center">
               <Lucide.Lock size={12} className="mx-auto mb-1 text-zinc-400"/>
               <span className="text-lg font-black text-[#3b0060] uppercase italic tracking-tighter">CHECKOUT SEGURO</span>
            </div>
            <div className="w-12" />
        </div>

        <div className="p-5 space-y-6 flex-1">
          
          {/* BADGE DE MODALIDADE */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tipoPedido === 'delivery' ? 'bg-[#3b0060] text-[#82C91E]' : 'bg-amber-500 text-white'}`}>
                      {tipoPedido === 'delivery' ? <Lucide.Bike size={20}/> : <Lucide.Store size={20}/>}
                  </div>
                  <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase italic">Modalidade</p>
                      <p className="text-sm font-black text-[#3b0060] uppercase italic">{tipoPedido === 'delivery' ? 'Delivery' : 'Retirada no Balcão'}</p>
                  </div>
              </div>
              <div className="text-right border-l border-zinc-100 pl-4">
                  <p className="text-[10px] font-black text-zinc-500 uppercase italic">Chega entre</p>
                  <p className="text-sm font-black text-zinc-800 uppercase italic">20:10 - 20:25</p>
              </div>
          </div>

          {/* RESUMO DE ITENS (Alto Contraste) */}
          <section className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm relative">
              <div className="flex justify-between items-center mb-4 border-b border-zinc-100 pb-2">
                  <h3 className="text-[11px] font-black text-zinc-500 uppercase italic tracking-wider flex items-center gap-2">
                      <Lucide.ShoppingBag size={14}/> Resumo ({cart.length} itens)
                  </h3>
                  <button onClick={() => navigate('/carrinho')} className="text-[#3b0060] flex items-center gap-1 text-[10px] font-black uppercase italic bg-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-200">
                      Editar <Lucide.Edit3 size={12}/>
                  </button>
              </div>
              <div className={`space-y-4 overflow-hidden transition-all ${mostrarTodosItens ? 'max-h-[800px]' : 'max-h-[160px]'}`}>
                  {cart.map((item, index) => (
                      <div key={index} className="flex gap-3 opacity-90 pointer-events-none">
                          <div className="text-[#3b0060] font-black text-xs bg-zinc-100 px-2 py-1 rounded h-fit border border-zinc-200">{item.quantidade || 1}x</div>
                          <div className="flex-1">
                              <p className="text-xs font-black uppercase italic text-zinc-800">{item.nome}</p>
                              <div className="mt-1 space-y-0.5">
                                  {item.detalhes?.cobertura_detalhes && <p className="text-[10px] font-bold text-pink-600 uppercase">+ Cob: {item.detalhes.cobertura_detalhes}</p>}
                                  {item.detalhes?.acompanhamentos_detalhes?.length > 0 && <p className="text-[10px] font-bold text-zinc-600 uppercase">+ Acomp: {item.detalhes.acompanhamentos_detalhes.join(', ')}</p>}
                                  {item.detalhes?.adicionais_detalhes?.map(add => ( <p key={add.id || add.nome} className="text-[10px] font-bold text-[#3b0060] uppercase">+ Add: {add.nome}</p> ))}
                              </div>
                          </div>
                          <span className="font-black text-zinc-800 text-xs mt-1">R$ {Number(obterPreco(item) * (item.quantidade || 1)).toFixed(2)}</span>
                      </div>
                  ))}
              </div>
              {cart.length > 2 && (
                  <button onClick={() => setMostrarTodosItens(!mostrarTodosItens)} className="w-full mt-3 pt-3 border-t border-zinc-100 text-[10px] font-black text-[#3b0060] uppercase italic flex items-center justify-center gap-1">
                      {mostrarTodosItens ? 'Recolher Lista' : `Ver detalhes completos`} <Lucide.ChevronDown size={14} className={mostrarTodosItens ? 'rotate-180' : ''}/>
                  </button>
              )}
          </section>

          {/* ENDEREÇO & MAPA */}
          {tipoPedido === 'delivery' && enderecoData && (
              <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden relative">
                  <div className="h-20 bg-zinc-800 relative w-full opacity-90 grayscale" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
                      <div className="absolute inset-0 flex items-center justify-center"><Lucide.MapPin size={32} className="text-[#82C91E] drop-shadow-lg -mt-4 animate-bounce"/></div>
                  </div>
                  <div className="p-5 flex justify-between items-center bg-white relative -mt-4 rounded-t-2xl">
                      <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase italic mb-0.5">Entregar em ({enderecoData.tipo}):</p>
                          <p className="text-xs font-black text-zinc-800 uppercase italic truncate max-w-[220px]">{enderecoData.rua}, {enderecoData.numero}</p>
                          <p className="text-[10px] font-bold text-zinc-600 uppercase">{enderecoData.bairro} {enderecoData.complemento && `- Comp: ${enderecoData.complemento}`}</p>
                      </div>
                      <button onClick={() => navigate('/carrinho')} className="p-2.5 bg-zinc-100 rounded-xl text-[#3b0060]"><Lucide.Edit3 size={16}/></button>
                  </div>
              </section>
          )}

          {tipoPedido === 'delivery' && (
             <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm cursor-pointer">
                 <input type="checkbox" checked={modoSilencioso} onChange={(e) => {vibrar(); setModoSilencioso(e.target.checked)}} className="w-5 h-5 accent-[#3b0060]" />
                 <div>
                     <p className="text-xs font-black text-[#3b0060] uppercase italic">Modo Silencioso</p>
                     <p className="text-[9px] font-bold text-zinc-500 uppercase">Não tocar a campainha, ligar ao chegar.</p>
                 </div>
             </label>
          )}

          {/* MOTOR DE PAGAMENTOS */}
          <section className={`bg-white p-5 rounded-3xl border-2 shadow-sm transition-all ${shakeErro ? 'shake-animation' : 'border-zinc-200'}`}>
              <h3 className="text-[11px] font-black text-zinc-500 uppercase italic mb-4 tracking-wider flex items-center gap-2">
                  <Lucide.Wallet size={14}/> Forma de Pagamento
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => {vibrar(); setMetodoPagamento('online'); setFormaEntrega('');}}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${metodoPagamento === 'online' ? 'bg-[#3b0060] border-[#3b0060] text-white shadow-md' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      <Lucide.SmartphoneNfc size={20} />
                      <span className="text-[10px] font-black uppercase italic">Pagar Online</span>
                  </button>
                  <button onClick={() => {vibrar(); setMetodoPagamento('entrega'); setFormaOnline('');}}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${metodoPagamento === 'entrega' ? 'bg-[#3b0060] border-[#3b0060] text-white shadow-md' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                      <Lucide.HandCoins size={20} />
                      <span className="text-[10px] font-black uppercase italic text-center leading-tight">Na Entrega</span>
                  </button>
              </div>

              {/* ONLINE / INFINITEPAY */}
              {metodoPagamento === 'online' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <button onClick={() => setFormaOnline('INFINITEPAY')} className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${formaOnline === 'INFINITEPAY' ? 'border-[#82C91E] bg-green-50 text-green-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}>
                          <Lucide.CreditCard size={20} className={formaOnline === 'INFINITEPAY' ? 'text-[#82C91E]' : 'text-zinc-400'} />
                          <div className="text-left">
                              <p className="text-xs font-black uppercase italic">Cartão de Crédito / PIX</p>
                              <p className="text-[10px] font-bold uppercase opacity-70">App Seguro InfinitePay</p>
                          </div>
                      </button>
                  </div>
              )}

              {/* NA ENTREGA */}
              {metodoPagamento === 'entrega' && (
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 animate-in fade-in slide-in-from-top-2 space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                          {['PIX_ENTREGA', 'CARTAO', 'DINHEIRO'].map(forma => (
                              <button key={forma} onClick={() => {vibrar(); setFormaEntrega(forma);}}
                                  className={`py-3 rounded-lg text-[9px] font-black transition-all border-2 flex flex-col items-center gap-1 ${formaEntrega === forma ? 'bg-[#82C91E] text-[#3b0060] border-[#82C91E]' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100'}`}>
                                  {forma === 'PIX_ENTREGA' && <Lucide.QrCode size={14}/>}
                                  {forma === 'CARTAO' && <Lucide.CreditCard size={14}/>}
                                  {forma === 'DINHEIRO' && <Lucide.Banknote size={14}/>}
                                  {forma === 'PIX_ENTREGA' ? 'PIX' : forma}
                              </button>
                          ))}
                      </div>

                      {formaEntrega === 'DINHEIRO' && (
                          <div className="space-y-4 pt-2 border-t border-zinc-200 animate-in fade-in">
                              <div>
                                  <label className="text-[10px] font-black text-[#3b0060] uppercase italic mb-1 block">Precisa de troco para quanto?</label>
                                  <input type="number" placeholder="Ex: 50 ou 100" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)}
                                      className="w-full p-3 bg-white rounded-xl text-sm font-bold border border-zinc-300 text-zinc-800 outline-none focus:border-[#3b0060]" />
                              </div>

                              {trocoPara && (
                                  <div className="space-y-3">
                                      <label className="text-[10px] font-black text-zinc-600 uppercase italic block text-center">Como quer receber o troco?</label>
                                      <div className="flex gap-2">
                                          <button onClick={() => setTipoTroco('DINHEIRO')} className={`flex-1 p-3 rounded-xl border-2 text-[10px] font-black uppercase italic transition-all ${tipoTroco === 'DINHEIRO' ? 'border-[#3b0060] bg-[#3b0060] text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100'}`}>Dinheiro Físico</button>
                                          <button onClick={() => setTipoTroco('PIX')} className={`flex-1 p-3 rounded-xl border-2 text-[10px] font-black uppercase italic transition-all flex justify-center items-center gap-1 ${tipoTroco === 'PIX' ? 'border-[#82C91E] bg-[#82C91E] text-[#3b0060]' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100'}`}><Lucide.RefreshCcw size={12}/> Troco via PIX</button>
                                      </div>
                                  </div>
                              )}

                              {trocoPara && tipoTroco === 'PIX' && (
                                  <div className="bg-[#3b0060]/5 p-4 rounded-xl border border-[#3b0060]/20 space-y-4 animate-in slide-in-from-top-2">
                                      {recebedoresTroco.map((recebedor, index) => (
                                          <div key={recebedor.id} className="bg-white p-3 rounded-xl border border-zinc-300 shadow-sm relative space-y-3">
                                              <div className="flex justify-between items-center mb-1">
                                                  <span className="text-[10px] font-black text-[#3b0060] uppercase italic bg-zinc-100 px-2 py-1 rounded">Recebedor {index + 1}</span>
                                                  {recebedoresTroco.length > 1 && <button onClick={() => removerRecebedor(recebedor.id)} className="text-red-500 hover:text-red-700"><Lucide.XCircle size={16}/></button>}
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                  <input type="text" placeholder="Nome Completo" value={recebedor.nome} onChange={(e) => atualizarRecebedor(recebedor.id, 'nome', e.target.value)} className="col-span-2 p-3 bg-zinc-50 rounded-lg text-xs font-bold text-zinc-800 border border-zinc-200 outline-none focus:border-[#3b0060]" />
                                                  <div className="col-span-2 space-y-1">
                                                      <input type="text" placeholder="Chave PIX" value={recebedor.chavePix} onChange={(e) => atualizarRecebedor(recebedor.id, 'chavePix', e.target.value)} className="w-full p-3 bg-zinc-50 rounded-lg text-xs font-bold text-zinc-800 border border-zinc-200 outline-none focus:border-[#3b0060]" />
                                                      <div className="flex flex-wrap gap-1 px-1">
                                                          <span className="text-[8px] font-black uppercase text-zinc-500 mt-1 mr-1">Sugestões:</span>
                                                          {userData?.cpf && <button onClick={() => atualizarRecebedor(recebedor.id, 'chavePix', userData.cpf)} className="text-[8px] font-bold bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full">CPF</button>}
                                                          {userData?.telefone && <button onClick={() => atualizarRecebedor(recebedor.id, 'chavePix', userData.telefone)} className="text-[8px] font-bold bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full">Telefone</button>}
                                                      </div>
                                                  </div>
                                                  <input list="lista-bancos" placeholder="Qual Banco?" value={recebedor.banco} onChange={(e) => atualizarRecebedor(recebedor.id, 'banco', e.target.value)} className="p-3 bg-zinc-50 rounded-lg text-xs font-bold text-zinc-800 border border-zinc-200 outline-none focus:border-[#3b0060]" />
                                                  <input type="number" placeholder="R$ Valor" value={recebedor.valor} onChange={(e) => atualizarRecebedor(recebedor.id, 'valor', e.target.value)} className="p-3 bg-zinc-50 rounded-lg text-xs font-bold text-zinc-800 border border-zinc-200 outline-none focus:border-[#3b0060]" />
                                              </div>
                                          </div>
                                      ))}
                                      <button onClick={adicionarRecebedor} className="w-full py-3 border-2 border-dashed border-[#3b0060]/30 rounded-xl text-[10px] font-black text-[#3b0060] uppercase italic flex items-center justify-center gap-2 hover:bg-[#3b0060]/10">
                                          <Lucide.Plus size={14}/> Dividir Troco com Amigo
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              )}
          </section>

          {/* CUPOM */}
          <div className={`flex gap-2 p-1 rounded-2xl transition-all ${isConfetti ? 'confetti-bg bg-green-50' : ''}`}>
              <input type="text" placeholder="CUPOM DE DESCONTO" value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} className="flex-1 p-4 bg-white rounded-2xl font-black italic text-sm text-zinc-800 border border-zinc-200 outline-none focus:border-[#3b0060]" />
              <button onClick={aplicarCupom} className="px-5 bg-zinc-800 rounded-2xl text-[#82C91E] font-black italic uppercase text-[10px] hover:bg-black">Aplicar</button>
          </div>

          {/* GORJETA */}
          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600"><Lucide.Heart size={16}/></div>
                  <div>
                      <p className="text-[11px] font-black text-zinc-800 uppercase italic">Caixinha da Equipe</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase">Apoie quem prepara seu pedido</p>
                  </div>
              </div>
              <div className="flex gap-2">
                  {[0, 2, 5].map(valor => (
                      <button key={valor} onClick={() => {vibrar(); setGorjeta(valor)}} className={`w-10 h-10 rounded-xl font-black text-[10px] border-2 flex items-center justify-center transition-all ${gorjeta === valor ? 'bg-pink-500 border-pink-500 text-white shadow-md' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}>
                          {valor === 0 ? 'R$0' : `+${valor}`}
                      </button>
                  ))}
              </div>
          </div>

          {/* TOTALIZAÇÃO E DIVISÃO */}
          <section className="bg-zinc-100 p-6 rounded-3xl border border-zinc-200">
              <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase italic text-zinc-600">
                      <span>Subtotal</span><span className="text-zinc-800">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-black uppercase italic text-zinc-600">
                      <span>Taxa Logística</span>
                      {taxaEntrega === 0 ? <span className="text-[#82C91E] font-[1000] flex items-center gap-2"><span className="line-through text-zinc-400">R$ 5,00</span> GRÁTIS</span> : <span className="text-zinc-800">R$ {taxaEntrega.toFixed(2)}</span>}
                  </div>
                  {gorjeta > 0 && <div className="flex justify-between items-center text-[11px] font-black uppercase italic text-pink-600"><span>Caixinha</span><span>+ R$ {gorjeta.toFixed(2)}</span></div>}
                  {statusCupom.desconto > 0 && <div className="flex justify-between items-center text-[11px] font-black uppercase italic text-green-600"><span>Cupom</span><span>- R$ {statusCupom.desconto.toFixed(2)}</span></div>}
              </div>
              <div className="h-px w-full bg-zinc-300 border-dashed border-t my-4"></div>
              <div className="flex justify-between items-end mb-4">
                  <div>
                      <span className="text-xs font-black uppercase italic text-zinc-500 block mb-1">Total a Pagar</span>
                      <span className="text-[9px] font-bold text-[#3b0060] uppercase bg-[#3b0060]/10 px-2 py-1 rounded-md">⭐ Ganhe {Math.floor(Number(calcularTotalFinal()) * 1.5)} pts</span>
                  </div>
                  <span className="text-3xl font-[1000] italic text-[#3b0060] leading-none">R$ {calcularTotalFinal()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase italic flex items-center gap-1"><Lucide.Users size={12}/> Dividir Fatura:</span>
                  <div className="flex items-center gap-2">
                      {[1, 2, 3].map(num => (
                          <button key={num} onClick={() => {vibrar(); setDividirConta(num)}} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${dividirConta === num ? 'bg-[#3b0060] text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>{num}</button>
                      ))}
                  </div>
              </div>
              {dividirConta > 1 && <p className="text-right text-[10px] font-black text-[#3b0060] uppercase italic mt-2">Fica <span className="bg-[#82C91E] px-1 rounded text-[#3b0060]">R$ {(calcularTotalFinal() / dividirConta).toFixed(2)}</span> para cada.</p>}
          </section>

          {/* TERMOS */}
          <label className="flex items-start gap-3 p-2 cursor-pointer">
              <input type="checkbox" checked={termosAceitos} onChange={(e) => setTermosAceitos(e.target.checked)} className="mt-0.5 accent-[#3b0060] w-4 h-4" />
              <p className="text-[9px] font-bold text-zinc-500 uppercase leading-relaxed">Confirmo as informações. Aceito os <a href="#" className="text-[#3b0060] underline">termos e política</a>.</p>
          </label>
        </div>

        {/* STICKY FOOTER FINAL */}
        <div className="fixed bottom-0 left-0 w-full p-5 bg-white border-t border-zinc-200 z-40 flex flex-col items-center">
            {!lojaAberta ? (
                <button disabled className="w-full max-w-md p-4 rounded-full font-[1000] uppercase italic text-lg bg-red-100 text-red-500 flex justify-center gap-2"><Lucide.StoreOff size={24}/> LOJA FECHADA</button>
            ) : subtotal < PEDIDO_MINIMO ? (
                <button disabled className="w-full max-w-md p-4 rounded-full font-[1000] uppercase italic text-sm bg-zinc-200 text-zinc-500">Faltam R$ {(PEDIDO_MINIMO - subtotal).toFixed(2)} para o mínimo</button>
            ) : (
                <button onClick={processarCheckout} disabled={salvando} className={`w-full max-w-md p-2 pl-6 pr-2 rounded-[3rem] font-[1000] uppercase italic text-lg shadow-xl transition-all flex items-center justify-between ${salvando ? 'bg-zinc-200 text-zinc-400 scale-95 shadow-none' : 'bg-[#82C91E] text-[#3b0060] active:scale-95 hover:bg-[#95df2b]'}`}>
                    <span className="flex-1 text-center pr-2 tracking-wide">{salvando ? 'PROCESSANDO...' : 'FINALIZAR AGORA'}</span>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${salvando ? 'bg-transparent text-zinc-400 animate-spin' : 'bg-[#3b0060] text-[#82C91E]'}`}>
                        {salvando ? <Lucide.Loader2 size={24} strokeWidth={3}/> : <Lucide.Check size={24} strokeWidth={4}/>}
                    </div>
                </button>
            )}
            <div className="flex items-center gap-2 mt-4 text-zinc-400 opacity-70"><Lucide.ShieldCheck size={12}/><span className="text-[8px] font-black uppercase tracking-widest">100% Seguro & Criptografado</span></div>
        </div>
      </div>

      {/* MODAL DE DADOS OBRIGATÓRIOS (INFINITEPAY) */}
      {showModalDados && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-[2.5rem] p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
             <div className="text-center space-y-1">
                 <Lucide.ShieldAlert size={40} className="mx-auto text-[#3b0060] mb-2"/>
                 <h2 className="text-xl font-[1000] italic uppercase text-[#3b0060]">Identificação</h2>
                 <p className="text-[10px] font-bold uppercase text-zinc-500">A InfinitePay exige esses dados para gerar o link seguro.</p>
             </div>
             
             <div className="space-y-3 pt-2">
                <input type="text" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Nome Completo" className="w-full bg-zinc-50 p-4 rounded-2xl border border-zinc-200 outline-none focus:border-[#3b0060] text-sm font-bold text-zinc-800" />
                <input type="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} placeholder="E-mail" className="w-full bg-zinc-50 p-4 rounded-2xl border border-zinc-200 outline-none focus:border-[#3b0060] text-sm font-bold text-zinc-800" />
                <input type="text" value={telefoneCliente} onChange={e => setTelefoneCliente(mTel(e.target.value))} placeholder="WhatsApp (Apenas Números)" className="w-full bg-zinc-50 p-4 rounded-2xl border border-zinc-200 outline-none focus:border-[#3b0060] text-sm font-bold text-zinc-800" />
             </div>
             
             <div className="flex gap-2 pt-2">
                 <button onClick={() => setShowModalDados(false)} className="flex-1 bg-zinc-100 text-zinc-500 py-4 rounded-2xl font-black uppercase italic text-xs hover:bg-zinc-200">Cancelar</button>
                 <button 
                     onClick={() => { if(nomeCliente && emailCliente && telefoneCliente) { executarFinalizacao(); } else { alert("Preencha todos os campos!"); }}} 
                     className="flex-1 bg-[#82C91E] text-[#3b0060] py-4 rounded-2xl font-black uppercase italic text-xs hover:bg-[#95df2b] shadow-md"
                 >
                     Confirmar
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}