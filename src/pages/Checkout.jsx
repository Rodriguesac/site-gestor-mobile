import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth, db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext'; // Puxando o Cérebro do App

const BANCOS_POPULARES = [
  'Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Caixa Econômica', 
  'Banco Inter', 'C6 Bank', 'Sicredi', 'Sicoob', 'PagBank', 'Mercado Pago', 'PicPay'
];

const mTel = (v) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);

export default function Checkout() {
  const navigate = useNavigate();
  const { limparCarrinho } = useCart();
  const { userData, enderecoAtivo } = useUser(); // Usando Contexto Real
  
  // ================= DADOS DO SISTEMA =================
  const [cartData] = useState(() => JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 });
  const [checkoutData] = useState(() => JSON.parse(localStorage.getItem('checkout_dados')) || { tipoEntrega: 'delivery', valorFrete: 0, subtotal: 0 });

  const cart = cartData.itens || [];
  const tipoPedido = checkoutData.tipoEntrega; 
  // Usa a taxa do contexto se for delivery, senão pega do checkoutData
  const taxaEntrega = tipoPedido === 'delivery' ? (Number(enderecoAtivo?.taxa?.replace(',', '.')) || Number(checkoutData.valorFrete) || 0) : 0;
  const subtotal = Number(checkoutData.subtotal) || Number(cartData.totalGeral) || 0;

  // ================= ESTADOS DO CHECKOUT =================
  const [salvando, setSalvando] = useState(false);
  const [lojaAberta, setLojaAberta] = useState(true);
  const [showModalDados, setShowModalDados] = useState(false); 
  
  // Dados do Cliente
  const [nomeCliente, setNomeCliente] = useState(userData?.nome || '');
  const [emailCliente, setEmailCliente] = useState(userData?.email || '');
  const [telefoneCliente, setTelefoneCliente] = useState(userData?.telefone || '');

  // Pagamento
  const [metodoPagamento, setMetodoPagamento] = useState(localStorage.getItem('ultimo_pagamento') || ''); 
  const [formaOnline, setFormaOnline] = useState(''); 
  const [formaEntrega, setFormaEntrega] = useState('');
  
  // Troco
  const [trocoPara, setTrocoPara] = useState(''); 
  const [tipoTroco, setTipoTroco] = useState('DINHEIRO'); 
  const [recebedoresTroco, setRecebedoresTroco] = useState([{ id: Date.now(), nome: userData?.nome || '', valor: '', chavePix: '', banco: '' }]);
  
  // Extras
  const [gorjeta, setGorjeta] = useState(0); 
  const [obsEntregador, setObsEntregador] = useState('');
  const [dividirConta, setDividirConta] = useState(1); 
  const [termosAceitos, setTermosAceitos] = useState(true); 
  
  // Cupons & UI
  const [cupom, setCupom] = useState(checkoutData.cupom?.codigo || '');
  const [statusCupom, setStatusCupom] = useState({ tipo: checkoutData.cupom ? 'sucesso' : '', texto: checkoutData.cupom ? 'APLICADO' : '', desconto: Number(checkoutData.descontoAplicado) || 0 });
  const [isConfetti, setIsConfetti] = useState(false); 
  const [mostrarTodosItens, setMostrarTodosItens] = useState(false); 
  const [shakeErro, setShakeErro] = useState(false); 

  const PEDIDO_MINIMO = 15.00; 
  const INFINITE_USER = "rodriguesac"; // Sua InfiniteTag

  useEffect(() => {
    if (!cart || cart.length === 0) navigate('/carrinho');
    // Preenche os dados se o contexto demorar a carregar
    if (userData?.nome && !nomeCliente) setNomeCliente(userData.nome);
    if (userData?.telefone && !telefoneCliente) setTelefoneCliente(userData.telefone);
    if (userData?.email && !emailCliente) setEmailCliente(userData.email);
  }, [cart, navigate, userData]);

  useEffect(() => {
      if (metodoPagamento) localStorage.setItem('ultimo_pagamento', metodoPagamento);
  }, [metodoPagamento]);

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(50); }; 

  // Calcula Previsão de Entrega (Dinâmico Simulado)
  const getPrevisao = () => {
      const agora = new Date();
      agora.setMinutes(agora.getMinutes() + 45); // 45 min
      const inicio = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      agora.setMinutes(agora.getMinutes() + 15); // + 15 min
      const fim = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${inicio} - ${fim}`;
  };

  const calcularTotalFinal = () => (subtotal + taxaEntrega + gorjeta - statusCupom.desconto).toFixed(2);

  const aplicarCupom = () => {
    // Exemplo Simples (Depois você liga com o Firestore de novo)
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
      
      // InfinitePay exige dados
      if (metodoPagamento === 'online' && (!nomeCliente || !emailCliente || !telefoneCliente)) {
          setShowModalDados(true);
          return;
      }

      executarFinalizacao();
  };

const executarFinalizacao = async () => {
    setSalvando(true); 
    setShowModalDados(false);

    // 1. FORMATAÇÃO DO PAGAMENTO E OBSERVAÇÕES
    let metPagamentoString = metodoPagamento === 'online' ? (formaOnline === 'INFINITEPAY' ? 'Online (Cartão InfinitePay)' : 'Online (PIX)') : `Na Entrega (${formaEntrega})`;
    let obsKDS = obsEntregador ? `🛵 OBS ENTREGADOR: ${obsEntregador}. ` : '';
    
    if (formaEntrega === 'DINHEIRO' && trocoPara) {
        obsKDS += `💰 LEVAR TROCO PARA R$ ${trocoPara}. `;
    }

// SUBSTITUA ESTE BLOCO NO Checkout.jsx:
const enderecoFormatadoObj = enderecoAtivo ? {
    rua: enderecoAtivo.rua || 'S/N', 
    numero: enderecoAtivo.numero || 'S/N', 
    bairro: enderecoAtivo.bairro || '', 
    complemento: enderecoAtivo.complemento || '', 
    cep: enderecoAtivo.cep || userData?.cep || '',
    // 👇 ADICIONE ESTAS DUAS LINHAS 👇
    lat: enderecoAtivo.lat || enderecoAtivo.latlng?.lat, 
    lng: enderecoAtivo.lng || enderecoAtivo.latlng?.lng
} : null;

    try {
        // 2. CRIA O PEDIDO NO FIREBASE
        const docRef = await addDoc(collection(db, "pedidos"), {
            cliente: { uid: auth.currentUser?.uid || 'anonimo', nome: nomeCliente, telefone: telefoneCliente, email: emailCliente },
            itens: cart,
            tipoPedido: tipoPedido === 'delivery' ? 'ENTREGA' : 'RETIRADA',
            endereco: tipoPedido === 'delivery' ? enderecoFormatadoObj : null,
            pagamento: { metodo: metPagamentoString, valorTrocoPara: trocoPara },
            observacao: obsKDS,
            gorjeta: gorjeta,
            valores: { subtotal, taxa: taxaEntrega, desconto: statusCupom.desconto, total: Number(calcularTotalFinal()) },
            status: metodoPagamento === 'online' ? 'AGUARDANDO_PAGAMENTO' : 'PENDENTE',
            createdAt: serverTimestamp()
        });

        // 3. LOGICA INFINITEPAY (PROTEGIDA)
      if (metodoPagamento === 'online') {
    // FUNÇÃO PARA LIMPAR TEXTO MANTIDA (Aumenta compatibilidade com URL)
    const limparTexto = (txt) => txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '');

    const itemsInfinite = cart.map((i, idx) => ({
        name: `#${(idx + 1).toString().padStart(3, '0')} ${limparTexto(i.detalhes?.baseNome || i.baseNome)}`,
        price: Math.round((i.total || i.preco || 0) * 100),
        quantity: Number(i.quantidade || 1)
    }));
    
    // Adição de taxas e gorjetas
    if (taxaEntrega > 0) itemsInfinite.push({ name: "Taxa Logistica", price: Math.round(taxaEntrega * 100), quantity: 1 });
    if (gorjeta > 0) itemsInfinite.push({ name: "Gorjeta Equipe", price: Math.round(gorjeta * 100), quantity: 1 });

    // Correção de CEP (8 dígitos obrigatórios)
    let rawCep = (enderecoAtivo?.cep || userData?.cep || "79000000").replace(/\D/g, "");
    const formattedCep = rawCep.padEnd(8, "0").slice(0, 8);

    const params = new URLSearchParams({
        items: JSON.stringify(itemsInfinite),
        order_nsu: docRef.id,
        customer_name: limparTexto(nomeCliente),
        customer_email: emailCliente,
        customer_cellphone: telefoneCliente.replace(/\D/g, ""),
        address_cep: formattedCep,
        address_street: limparTexto(enderecoAtivo?.rua || "Balcao"),
        address_district: limparTexto(enderecoAtivo?.bairro || "Centro"),
        redirect_url: `${window.location.origin}/sucesso`
    }).toString();

    // REMOVIDO: limparCarrinho() e localStorage.removeItem() daqui!
    // A sacola continua viva até que a página /sucesso confirme o pagamento.
    
    window.location.href = `https://checkout.infinitepay.io/${INFINITE_USER}?${params}`;
    return;
}
        // SE FOR NA ENTREGA
        setTimeout(() => {
          limparCarrinho();
          localStorage.removeItem('checkout_dados');
          navigate(`/acompanhamento/${docRef.id}`); 
        }, 1500);

    } catch (error) { 
        console.error("Erro no Checkout:", error); 
        alert("Erro ao processar. Verifique sua conexão."); 
        setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-40">
      <style>{`
        @keyframes shake { 0%, 100% {transform: translateX(0);} 25% {transform: translateX(-5px);} 75% {transform: translateX(5px);} }
        .shake-animation { animation: shake 0.3s ease-in-out; border-color: #ef4444 !important; }
        .confetti-bg { background-image: radial-gradient(circle, #82C91E 10%, transparent 10%); background-size: 20px 20px; animation: confetti 1s ease-out; }
        @keyframes confetti { 0% { background-position: 0 0; opacity: 1; } 100% { background-position: 100px 100px; opacity: 0; } }
      `}</style>
      
      <datalist id="lista-bancos">{BANCOS_POPULARES.map(banco => <option key={banco} value={banco} />)}</datalist>

      {/* HEADER LIMPO E CLARO */}
      <header className="sticky top-0 z-40 bg-white p-5 flex items-center justify-between shadow-md border-b border-slate-100 rounded-b-[2rem]">
          <button onClick={() => { vibrar(); navigate(-1); }} className="p-2.5 bg-slate-50 rounded-xl text-[#4B0082] hover:bg-slate-100 transition-colors">
            <Lucide.ChevronLeft size={24} strokeWidth={2.5}/>
          </button>
          <div className="text-center flex flex-col items-center">
             <Lucide.Lock size={14} className="mb-0.5 text-green-500"/>
             <span className="text-sm font-[1000] text-[#4B0082] uppercase italic tracking-widest">Pagamento</span>
          </div>
          <div className="w-10" />
      </header>

      <main className="p-5 space-y-6 max-w-[550px] mx-auto">
        
        {/* PREVISÃO DE ENTREGA */}
        <div className="flex items-center justify-between bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${tipoPedido === 'delivery' ? 'bg-[#82C91E]/20 text-[#82C91E]' : 'bg-[#4B0082]/10 text-[#4B0082]'}`}>
                    {tipoPedido === 'delivery' ? <Lucide.Bike size={20}/> : <Lucide.Store size={20}/>}
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modalidade</p>
                    <p className="text-sm font-[1000] text-[#4B0082] uppercase italic">{tipoPedido === 'delivery' ? 'Delivery' : 'Retirada no Balcão'}</p>
                </div>
            </div>
            <div className="text-right border-l border-slate-100 pl-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previsão</p>
                <p className="text-sm font-[1000] text-[#82C91E] uppercase italic">{getPrevisao()}</p>
            </div>
        </div>

        {/* RESUMO DE ITENS (DISCRIMINADO) */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-3">
                <h3 className="text-xs font-black text-slate-400 uppercase italic tracking-widest flex items-center gap-2">
                    <Lucide.ShoppingBag size={16} className="text-[#82C91E]"/> Resumo ({cart.length} itens)
                </h3>
                <button onClick={() => navigate('/carrinho')} className="text-[#4B0082] flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-[#4B0082]/5 px-3 py-1.5 rounded-lg hover:bg-[#4B0082]/10">
                    Editar <Lucide.Edit3 size={12}/>
                </button>
            </div>

            <div className={`space-y-6 overflow-hidden transition-all ${mostrarTodosItens ? 'max-h-[2000px]' : 'max-h-[250px]'}`}>
                {cart.map((item, index) => {
                    const baseNome = item.detalhes?.baseNome || item.baseNome;
                    const tamanho = item.detalhes?.tamanho || item.tamanho;
                    const valorTotalItem = Number(item.total * (item.quantidade || 1)).toFixed(2);
                    
                    return (
                        <div key={index} className="flex gap-4">
                            <div className="text-[#4B0082] font-[1000] text-sm bg-slate-50 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 shrink-0">
                                {item.quantidade || 1}x
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-[1000] uppercase italic text-[#4B0082] leading-tight">{baseNome}</p>
                                <p className="text-[10px] font-black text-[#82C91E] uppercase tracking-widest">{tamanho}</p>
                                
                                {/* Acompanhamentos e Adicionais Discriminados */}
                                <div className="mt-3 space-y-1.5 border-l-2 border-slate-100 pl-3">
                                    {item.detalhes?.cobertura_detalhes && (
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                            <span>Cobertura: {item.detalhes.cobertura_detalhes}</span>
                                            <span>R$ 0,00</span>
                                        </div>
                                    )}
                                    {item.detalhes?.acompanhamentos_detalhes?.map((acomp, i) => (
                                        <div key={`acomp-${i}`} className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                            <span className="truncate pr-2">{acomp}</span>
                                            <span>R$ 0,00</span>
                                        </div>
                                    ))}
                                    {item.detalhes?.adicionais_detalhes?.map((add, i) => (
                                        <div key={`add-${i}`} className="flex justify-between text-[10px] font-black text-[#4B0082] uppercase">
                                            <span className="truncate pr-2">+ {add.qtd}x {add.nome}</span>
                                            <span>R$ {Number(add.preco * add.qtd).toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <span className="font-[1000] text-[#4B0082] text-sm italic whitespace-nowrap">R$ {valorTotalItem.replace('.', ',')}</span>
                        </div>
                    );
                })}
            </div>

            {cart.length > 2 && (
                <button onClick={() => setMostrarTodosItens(!mostrarTodosItens)} className="w-full mt-4 pt-4 border-t border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1 hover:text-[#4B0082]">
                    {mostrarTodosItens ? 'Recolher Lista' : `Ver lista completa`} <Lucide.ChevronDown size={14} className={mostrarTodosItens ? 'rotate-180' : ''}/>
                </button>
            )}
        </section>

        {/* ENDEREÇO & OBSERVAÇÃO */}
        {tipoPedido === 'delivery' && enderecoAtivo && (
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-6 relative">
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Lucide.MapPin size={12}/> Entregar em ({enderecoAtivo.tipo}):</p>
                        <p className="text-sm font-[1000] text-[#4B0082] uppercase italic truncate max-w-[250px]">{enderecoAtivo.rua}, {enderecoAtivo.numero}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{enderecoAtivo.bairro} {enderecoAtivo.complemento && `• ${enderecoAtivo.complemento}`}</p>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Observação para o Entregador</label>
                    <input 
                        type="text" 
                        value={obsEntregador} 
                        onChange={e => setObsEntregador(e.target.value)} 
                        placeholder="Ex: Tocar interfone 104, portão preto..." 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold text-[#4B0082] outline-none focus:border-[#82C91E]"
                    />
                </div>
            </section>
        )}

        {/* FORMAS DE PAGAMENTO */}
        <section className={`bg-white p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${shakeErro ? 'shake-animation' : 'border-slate-100'}`}>
            <h3 className="text-xs font-black text-slate-400 uppercase italic mb-5 tracking-widest flex items-center gap-2">
                <Lucide.Wallet size={16} className="text-[#82C91E]"/> Forma de Pagamento
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-5">
                <button onClick={() => {vibrar(); setMetodoPagamento('online'); setFormaEntrega('');}}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${metodoPagamento === 'online' ? 'bg-[#4B0082] border-[#4B0082] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-[#82C91E]/50'}`}>
                    <Lucide.SmartphoneNfc size={24} />
                    <span className="text-[11px] font-black uppercase tracking-widest">Online (App)</span>
                </button>
                <button onClick={() => {vibrar(); setMetodoPagamento('entrega'); setFormaOnline('');}}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${metodoPagamento === 'entrega' ? 'bg-[#4B0082] border-[#4B0082] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-[#82C91E]/50'}`}>
                    <Lucide.HandCoins size={24} />
                    <span className="text-[11px] font-black uppercase tracking-widest">Na Entrega</span>
                </button>
            </div>

            {metodoPagamento === 'online' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => setFormaOnline('INFINITEPAY')} className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${formaOnline === 'INFINITEPAY' ? 'border-[#82C91E] bg-[#82C91E]/10' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formaOnline === 'INFINITEPAY' ? 'bg-[#82C91E] text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <Lucide.CreditCard size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-[1000] text-[#4B0082] uppercase italic">Cartão ou PIX</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Seguro InfinitePay</p>
                        </div>
                    </button>
                </div>
            )}

            {metodoPagamento === 'entrega' && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 space-y-5">
                    <div className="grid grid-cols-3 gap-2">
                        {['PIX', 'CARTÃO', 'DINHEIRO'].map(forma => (
                            <button key={forma} onClick={() => {vibrar(); setFormaEntrega(forma);}}
                                className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex flex-col items-center gap-2 ${formaEntrega === forma ? 'bg-[#82C91E] text-[#4B0082] border-[#82C91E] shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                                {forma === 'PIX' && <Lucide.QrCode size={18}/>}
                                {forma === 'CARTÃO' && <Lucide.CreditCard size={18}/>}
                                {forma === 'DINHEIRO' && <Lucide.Banknote size={18}/>}
                                {forma}
                            </button>
                        ))}
                    </div>

                    {formaEntrega === 'DINHEIRO' && (
                        <div className="pt-4 border-t border-slate-200 animate-in fade-in">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Precisa de troco para quanto?</label>
                            <input type="number" placeholder="Ex: 50 ou 100" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)}
                                className="w-full p-4 bg-white rounded-xl text-sm font-bold border border-slate-200 text-[#4B0082] outline-none focus:border-[#82C91E]" />
                        </div>
                    )}
                </div>
            )}
        </section>

        {/* CAIXINHA / GORJETA SUTIL */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 shrink-0"><Lucide.Heart size={18}/></div>
                <div>
                    <p className="text-[11px] font-black text-[#4B0082] uppercase tracking-widest">Caixinha da Equipe</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Apoie os montadores</p>
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                {[0, 2, 5].map(valor => (
                    <button key={valor} onClick={() => {vibrar(); setGorjeta(valor)}} className={`flex-1 sm:w-12 h-10 rounded-xl font-black text-[10px] border-2 flex items-center justify-center transition-all ${gorjeta === valor ? 'bg-pink-500 border-pink-500 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-pink-200'}`}>
                        {valor === 0 ? 'R$0' : `+${valor}`}
                    </button>
                ))}
            </div>
        </div>

        {/* TOTALIZAÇÃO */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg mb-10">
            <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-400">
                    <span>Subtotal</span><span className="text-slate-800">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-400">
                    <span>Logística</span>
                    {taxaEntrega === 0 ? <span className="text-[#82C91E] font-[1000] italic">GRÁTIS</span> : <span className="text-slate-800">R$ {taxaEntrega.toFixed(2).replace('.', ',')}</span>}
                </div>
                {gorjeta > 0 && <div className="flex justify-between items-center text-[11px] font-black uppercase text-pink-500"><span>Caixinha</span><span>+ R$ {gorjeta.toFixed(2).replace('.', ',')}</span></div>}
                {statusCupom.desconto > 0 && <div className="flex justify-between items-center text-[11px] font-black uppercase text-[#82C91E]"><span>Cupom</span><span>- R$ {statusCupom.desconto.toFixed(2).replace('.', ',')}</span></div>}
            </div>
            <div className="h-px w-full bg-slate-100 border-dashed border-t my-5"></div>
            <div className="flex justify-between items-end mb-2">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Total</span>
                <span className="text-3xl font-[1000] italic text-[#4B0082] leading-none">R$ {calcularTotalFinal().replace('.', ',')}</span>
            </div>
        </section>

      </main>

      {/* FOOTER FIXO */}
      <div className="fixed bottom-0 left-0 w-full p-5 bg-white border-t border-slate-100 z-40 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          {subtotal < PEDIDO_MINIMO ? (
              <button disabled className="w-full max-w-[550px] p-5 rounded-[2rem] font-[1000] uppercase italic text-sm bg-slate-100 text-slate-400">
                  Faltam R$ {(PEDIDO_MINIMO - subtotal).toFixed(2).replace('.', ',')} para o mínimo
              </button>
          ) : (
              <button onClick={processarCheckout} disabled={salvando} className={`w-full max-w-[550px] p-2 pl-8 pr-2 rounded-[3rem] font-[1000] uppercase italic text-lg shadow-xl transition-all flex items-center justify-between ${salvando ? 'bg-slate-100 text-slate-400 scale-95 shadow-none' : 'bg-[#82C91E] text-[#4B0082] active:scale-95 hover:bg-[#95df2b]'}`}>
                  <span className="flex-1 text-left tracking-wide">{salvando ? 'PROCESSANDO...' : 'FINALIZAR AGORA'}</span>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${salvando ? 'bg-transparent text-slate-400 animate-spin' : 'bg-[#4B0082] text-white shadow-md'}`}>
                      {salvando ? <Lucide.Loader2 size={24} strokeWidth={3}/> : <Lucide.Check size={28} strokeWidth={4}/>}
                  </div>
              </button>
          )}
          <div className="flex items-center gap-2 mt-4 text-slate-400"><Lucide.ShieldCheck size={14}/><span className="text-[9px] font-black uppercase tracking-widest">Pagamento Seguro</span></div>
      </div>

      {/* MODAL DA INFINITEPAY (DADOS OBRIGATÓRIOS) */}
      {showModalDados && (
        <div className="fixed inset-0 bg-[#4B0082]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95">
             <div className="text-center mb-6">
                 <Lucide.ShieldAlert size={40} className="mx-auto text-[#82C91E] mb-3"/>
                 <h2 className="text-xl font-[1000] italic uppercase text-[#4B0082]">Identificação</h2>
                 <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">A InfinitePay exige os dados abaixo para gerar o seu link de pagamento seguro.</p>
             </div>
             
             <div className="space-y-3 mb-6">
                <input type="text" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Seu Nome Completo" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-[#82C91E] text-xs font-black text-[#4B0082] uppercase" />
                <input type="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} placeholder="Seu Melhor E-mail" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-[#82C91E] text-xs font-black text-[#4B0082] lowercase" />
                <input type="text" value={telefoneCliente} onChange={e => setTelefoneCliente(mTel(e.target.value))} placeholder="WhatsApp" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-[#82C91E] text-xs font-black text-[#4B0082]" />
             </div>
             
             <div className="flex gap-3">
                 <button onClick={() => setShowModalDados(false)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors">Cancelar</button>
                 <button onClick={() => { if(nomeCliente && emailCliente && telefoneCliente) { executarFinalizacao(); } else { alert("Preencha todos os campos!"); }}} className="flex-1 bg-[#4B0082] text-white py-4 rounded-2xl font-[1000] uppercase italic text-xs hover:bg-[#3a004a] shadow-lg transition-colors">Confirmar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}