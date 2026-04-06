import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { auth, db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext'; 

const BANCOS_POPULARES = ['Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Caixa Econômica', 'Banco Inter', 'C6 Bank', 'Sicredi', 'Sicoob', 'PagBank', 'Mercado Pago', 'PicPay'];
const mTel = (v) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);

export default function Checkout() {
  const navigate = useNavigate();
  const { limparCarrinho } = useCart();
  const { userData, enderecoAtivo } = useUser(); 
  
  const [cartData] = useState(() => JSON.parse(localStorage.getItem('carrinho_rodrigues')) || { itens: [], totalGeral: 0 });
  const [checkoutData] = useState(() => JSON.parse(localStorage.getItem('checkout_dados')) || { tipoEntrega: 'delivery', valorFrete: 0, subtotal: 0 });

  const cart = cartData.itens || [];
  const tipoPedido = checkoutData.tipoEntrega; 
  
  // A TAXA PURA VEM DO CARRINHO!
  const taxaEntrega = checkoutData.tipoEntrega === 'delivery' ? (Number(checkoutData.valorFrete) || 0) : 0;
  const subtotal = Number(checkoutData.subtotal) || Number(cartData.totalGeral) || 0;

  // ================= ESTADOS =================
  const [margemLoja, setMargemLoja] = useState(0); // Puxa do Painel Logística!
  const [salvando, setSalvando] = useState(false);
  const [showModalDados, setShowModalDados] = useState(false); 
  
  const [nomeCliente, setNomeCliente] = useState(userData?.nome || '');
  const [emailCliente, setEmailCliente] = useState(userData?.email || '');
  const [telefoneCliente, setTelefoneCliente] = useState(userData?.telefone || '');

  const [metodoPagamento, setMetodoPagamento] = useState(localStorage.getItem('ultimo_pagamento') || ''); 
  const [formaOnline, setFormaOnline] = useState(''); 
  const [formaEntrega, setFormaEntrega] = useState('');
  
  const [trocoPara, setTrocoPara] = useState(''); 
  const [gorjeta, setGorjeta] = useState(0); 
  const [obsEntregador, setObsEntregador] = useState('');
  const [termosAceitos, setTermosAceitos] = useState(true); 
  
  const [statusCupom, setStatusCupom] = useState({ tipo: checkoutData.cupom ? 'sucesso' : '', texto: checkoutData.cupom ? 'APLICADO' : '', desconto: Number(checkoutData.descontoAplicado) || 0 });
  const [shakeErro, setShakeErro] = useState(false); 

  const PEDIDO_MINIMO = 15.00; 
  const INFINITE_USER = "rodriguesac"; 

  // BUSCA A MARGEM DA LOJA DO PAINEL LOGÍSTICA ANTES DE SALVAR!
  useEffect(() => {
      const fetchLogistica = async () => {
          try {
              const docSnap = await getDoc(doc(db, "configuracoes_loja", "logistica"));
              if (docSnap.exists() && docSnap.data().margemLoja) {
                  setMargemLoja(Number(docSnap.data().margemLoja));
              }
          } catch(e) {}
      };
      fetchLogistica();
  }, []);

  useEffect(() => {
    if (!cart || cart.length === 0) navigate('/carrinho');
    if (userData?.nome && !nomeCliente) setNomeCliente(userData.nome);
    if (userData?.telefone && !telefoneCliente) setTelefoneCliente(userData.telefone);
    if (userData?.email && !emailCliente) setEmailCliente(userData.email);
  }, [cart, navigate, userData]);

  useEffect(() => { if (metodoPagamento) localStorage.setItem('ultimo_pagamento', metodoPagamento); }, [metodoPagamento]);

  const vibrar = () => { if (navigator.vibrate) navigator.vibrate(50); }; 

  const getPrevisao = () => {
      const agora = new Date();
      agora.setMinutes(agora.getMinutes() + 45); 
      const inicio = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      agora.setMinutes(agora.getMinutes() + 15); 
      const fim = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${inicio} - ${fim}`;
  };

  const calcularTotalFinal = () => (subtotal + taxaEntrega + gorjeta - statusCupom.desconto).toFixed(2);

  const processarCheckout = () => {
      vibrar();
      const semPagamento = !metodoPagamento || (metodoPagamento === 'online' && !formaOnline) || (metodoPagamento === 'entrega' && !formaEntrega);
      if (semPagamento || !termosAceitos) { setShakeErro(true); setTimeout(() => setShakeErro(false), 600); return; }
      if (metodoPagamento === 'online' && (!nomeCliente || !emailCliente || !telefoneCliente)) { setShowModalDados(true); return; }
      executarFinalizacao();
  };

  const executarFinalizacao = async () => {
    setSalvando(true); setShowModalDados(false);

    let metPagamentoString = metodoPagamento === 'online' ? (formaOnline === 'INFINITEPAY' ? 'Online (Cartão InfinitePay)' : 'Online (PIX)') : `Na Entrega (${formaEntrega})`;
    let obsKDS = obsEntregador ? `🛵 OBS ENTREGADOR: ${obsEntregador}. ` : '';
    if (formaEntrega === 'DINHEIRO' && trocoPara) obsKDS += `💰 LEVAR TROCO PARA R$ ${trocoPara}. `;

    const endSeguro = JSON.parse(localStorage.getItem('endereco_rodrigues')) || enderecoAtivo;
    const enderecoFormatadoObj = endSeguro ? {
        rua: endSeguro.rua || 'S/N', numero: endSeguro.numero || 'S/N', bairro: endSeguro.bairro || '', 
        complemento: endSeguro.complemento || '', cep: endSeguro.cep || userData?.cep || '',
        km: endSeguro.km || 0, lat: endSeguro.lat || endSeguro.latlng?.lat, lng: endSeguro.lng || endSeguro.latlng?.lng
    } : null;

    // CÁLCULO FINAL DE REPASSE (Lê do Painel Logística)
    const repassePiloto = tipoPedido === 'delivery' && taxaEntrega > margemLoja ? taxaEntrega - margemLoja : taxaEntrega;

    try {
        const docRef = await addDoc(collection(db, "pedidos"), {
            cliente: { uid: auth.currentUser?.uid || 'anonimo', nome: nomeCliente, telefone: telefoneCliente, email: emailCliente },
            itens: cart, tipoPedido: tipoPedido === 'delivery' ? 'ENTREGA' : 'RETIRADA',
            endereco: tipoPedido === 'delivery' ? enderecoFormatadoObj : null,
            pagamento: { metodo: metPagamentoString, valorTrocoPara: trocoPara },
            observacao: obsKDS, gorjeta: gorjeta,
            valores: { 
                subtotal: subtotal, 
                taxaCobradaCliente: taxaEntrega, 
                taxaEntrega: repassePiloto, // VALOR EXATO QUE VAI PRO MOTOBOY!
                desconto: statusCupom.desconto, total: Number(calcularTotalFinal()) 
            },
            status: metodoPagamento === 'online' ? 'AGUARDANDO_PAGAMENTO' : 'PENDENTE',
            createdAt: serverTimestamp()
        });

      if (metodoPagamento === 'online') {
            const limparTexto = (txt) => txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '');
            const itemsInfinite = cart.map((i, idx) => ({ name: `#${(idx + 1).toString().padStart(3, '0')} ${limparTexto(i.detalhes?.baseNome || i.baseNome)}`, price: Math.round((i.total || i.preco || 0) * 100), quantity: Number(i.quantidade || 1) }));
            if (taxaEntrega > 0) itemsInfinite.push({ name: "Serviço de Logística", price: Math.round(taxaEntrega * 100), quantity: 1 });
            if (gorjeta > 0) itemsInfinite.push({ name: "Gorjeta Equipe Rodrigues", price: Math.round(gorjeta * 100), quantity: 1 });

            let rawCep = (endSeguro?.cep || userData?.cep || "79000000").replace(/\D/g, "");
            const formattedCep = rawCep.padEnd(8, "0").slice(0, 8);
            const params = new URLSearchParams({
                items: JSON.stringify(itemsInfinite), order_nsu: docRef.id, customer_name: limparTexto(nomeCliente), customer_email: emailCliente,
                customer_cellphone: telefoneCliente.replace(/\D/g, ""), address_cep: formattedCep, address_street: limparTexto(endSeguro?.rua || "Balcao Rodrigues"),
                address_district: limparTexto(endSeguro?.bairro || "Centro"), redirect_url: `${window.location.origin}/sucesso`
            }).toString();

            window.location.href = `https://checkout.infinitepay.io/${INFINITE_USER}?${params}`;
            return;
        }
        
        setTimeout(() => { limparCarrinho(); localStorage.removeItem('checkout_dados'); navigate(`/acompanhamento/${docRef.id}`); }, 1500);
    } catch (error) { alert("Erro ao processar o pedido. Verifique sua conexão."); setSalvando(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-40 relative">
      <style>{`@keyframes shake { 0%, 100% {transform: translateX(0);} 25% {transform: translateX(-5px);} 75% {transform: translateX(5px);} } .shake-animation { animation: shake 0.3s ease-in-out; border-color: #ef4444 !important; }`}</style>
      
      <header className="sticky top-0 z-40 bg-white p-5 flex items-center justify-between shadow-md border-b border-slate-100 rounded-b-[2rem]">
          <button onClick={() => { vibrar(); navigate(-1); }} className="p-2.5 bg-slate-50 rounded-xl text-[#4B0082] hover:bg-slate-100 transition-colors"><Lucide.ChevronLeft size={24} strokeWidth={2.5}/></button>
          <div className="text-center flex flex-col items-center"><Lucide.Lock size={14} className="mb-0.5 text-green-500"/><span className="text-sm font-[1000] text-[#4B0082] uppercase italic tracking-widest">Fechamento</span></div>
          <div className="w-10" />
      </header>

      <main className="p-5 space-y-6 max-w-[550px] mx-auto">
        <div className="flex items-center justify-between bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${tipoPedido === 'delivery' ? 'bg-[#82C91E]/20 text-[#82C91E]' : 'bg-[#4B0082]/10 text-[#4B0082]'}`}>{tipoPedido === 'delivery' ? <Lucide.Bike size={20}/> : <Lucide.Store size={20}/>}</div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modalidade</p><p className="text-sm font-[1000] text-[#4B0082] uppercase italic">{tipoPedido === 'delivery' ? 'Delivery' : 'Balcão (Retirada)'}</p></div>
            </div>
            <div className="text-right border-l border-slate-100 pl-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previsão</p><p className="text-sm font-[1000] text-[#82C91E] uppercase italic">{getPrevisao()}</p></div>
        </div>

        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-3"><h3 className="text-xs font-black text-slate-400 uppercase italic tracking-widest flex items-center gap-2"><Lucide.ShoppingBag size={16} className="text-[#82C91E]"/> Resumo ({cart.length} itens)</h3></div>
            <div className={`space-y-6`}>
                {cart.map((item, index) => {
                    const baseNome = item.detalhes?.baseNome || item.baseNome; const tamanho = item.detalhes?.tamanho || item.tamanho; const valorTotalItem = Number(item.total * (item.quantidade || 1)).toFixed(2);
                    return (
                        <div key={index} className="flex gap-4 border-b border-slate-50 pb-5 last:border-0 last:pb-0">
                            <div className="text-[#4B0082] font-[1000] text-sm bg-slate-50 w-12 h-12 flex items-center justify-center rounded-xl border border-slate-100 shrink-0">{item.quantidade || 1}x</div>
                            <div className="flex-1">
                                <p className="text-sm font-[1000] uppercase italic text-[#4B0082] leading-tight">{baseNome}</p><p className="text-[10px] font-black text-[#82C91E] uppercase tracking-widest">{tamanho}</p>
                                <div className="mt-3 space-y-1.5 border-l-2 border-slate-100 pl-3">
                                    {item.detalhes?.cobertura_detalhes && <p className="text-[10px] font-bold text-slate-500 uppercase">Cobertura: {item.detalhes.cobertura_detalhes}</p>}
                                    {item.detalhes?.acompanhamentos_detalhes?.map((acomp, i) => <p key={`acomp-${i}`} className="text-[10px] font-bold text-slate-500 uppercase">✓ {acomp}</p>)}
                                    {item.detalhes?.adicionais_detalhes?.map((add, i) => <p key={`add-${i}`} className="text-[10px] font-black text-[#4B0082] uppercase">+ {add.qtd}x {add.nome}</p>)}
                                </div>
                            </div>
                            <span className="font-[1000] text-[#4B0082] text-sm italic whitespace-nowrap">R$ {valorTotalItem.replace('.', ',')}</span>
                        </div>
                    );
                })}
            </div>
        </section>

        {tipoPedido === 'delivery' && (
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-6 relative">
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Lucide.MapPin size={12}/> Entregar em:</p>
                        <p className="text-sm font-[1000] text-[#4B0082] uppercase italic truncate max-w-[280px]">{JSON.parse(localStorage.getItem('endereco_rodrigues'))?.rua || enderecoAtivo?.rua}, {JSON.parse(localStorage.getItem('endereco_rodrigues'))?.numero || enderecoAtivo?.numero}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{JSON.parse(localStorage.getItem('endereco_rodrigues'))?.bairro || enderecoAtivo?.bairro}</p>
                    </div>
                </div>
                <div className="mt-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Observação para o Entregador</label><input type="text" value={obsEntregador} onChange={e => setObsEntregador(e.target.value)} placeholder="Ex: Tocar campainha, portão branco..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold text-[#4B0082] outline-none focus:border-[#82C91E]"/></div>
            </section>
        )}

        <section className={`bg-white p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${shakeErro ? 'shake-animation' : 'border-slate-100'}`}>
            <h3 className="text-xs font-black text-slate-400 uppercase italic mb-5 tracking-widest flex items-center gap-2"><Lucide.Wallet size={16} className="text-[#82C91E]"/> Forma de Pagamento</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
                <button onClick={() => {vibrar(); setMetodoPagamento('online'); setFormaEntrega('');}} className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${metodoPagamento === 'online' ? 'bg-[#4B0082] border-[#4B0082] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-[#82C91E]/50'}`}><Lucide.SmartphoneNfc size={24} /><span className="text-[11px] font-black uppercase tracking-widest">Online (Pagar Agora)</span></button>
                <button onClick={() => {vibrar(); setMetodoPagamento('entrega'); setFormaOnline('');}} className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${metodoPagamento === 'entrega' ? 'bg-[#4B0082] border-[#4B0082] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-[#82C91E]/50'}`}><Lucide.HandCoins size={24} /><span className="text-[11px] font-black uppercase tracking-widest">Pagar na Entrega</span></button>
            </div>

            {metodoPagamento === 'online' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => setFormaOnline('INFINITEPAY')} className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${formaOnline === 'INFINITEPAY' ? 'border-[#82C91E] bg-[#82C91E]/10' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formaOnline === 'INFINITEPAY' ? 'bg-[#82C91E] text-white' : 'bg-slate-100 text-slate-400'}`}><Lucide.CreditCard size={20} /></div>
                        <div className="text-left"><p className="text-sm font-[1000] text-[#4B0082] uppercase italic">Cartão ou PIX</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Seguro InfinitePay</p></div>
                    </button>
                </div>
            )}
            {metodoPagamento === 'entrega' && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 space-y-5">
                    <div className="grid grid-cols-3 gap-2">{['PIX', 'CARTÃO', 'DINHEIRO'].map(forma => <button key={forma} onClick={() => {vibrar(); setFormaEntrega(forma);}} className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex flex-col items-center gap-2 ${formaEntrega === forma ? 'bg-[#82C91E] text-[#4B0082] border-[#82C91E] shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{forma}</button>)}</div>
                    {formaEntrega === 'DINHEIRO' && (<div className="pt-4 border-t border-slate-200 animate-in fade-in"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Precisa de troco?</label><input type="number" placeholder="Troco para R quanto?" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} className="w-full p-4 bg-white rounded-xl text-sm font-bold border border-slate-200 text-[#4B0082] outline-none focus:border-[#82C91E]" /></div>)}
                </div>
            )}
        </section>

        <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 shrink-0"><Lucide.Heart size={18}/></div>
                <div><p className="text-[11px] font-black text-[#4B0082] uppercase tracking-widest">Caixinha da Equipe</p><p className="text-[9px] font-bold text-slate-400 uppercase">Apoie os montadores</p></div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                {[0, 2, 5].map(valor => <button key={valor} onClick={() => {vibrar(); setGorjeta(valor)}} className={`flex-1 sm:w-12 h-10 rounded-xl font-black text-[10px] border-2 flex items-center justify-center transition-all ${gorjeta === valor ? 'bg-pink-500 border-pink-500 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-pink-200'}`}>{valor === 0 ? 'R$0' : `+${valor}`}</button>)}
            </div>
        </div>

        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg mb-10 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#82C91E]/5 rounded-full"></div>
            <div className="space-y-3 mb-5 relative z-10">
                <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-400"><span>Subtotal</span><span className="text-slate-800">R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
                <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-400"><span>Logística (Açaí Entregue)</span>{taxaEntrega === 0 ? <span className="text-[#82C91E] font-[1000] italic">GRÁTIS</span> : <span className="text-slate-800">R$ {taxaEntrega.toFixed(2).replace('.', ',')}</span>}</div>
                {statusCupom.desconto > 0 && <div className="flex justify-between items-center text-[11px] font-black uppercase text-[#82C91E]"><span>Cupom</span><span>- R$ {statusCupom.desconto.toFixed(2).replace('.', ',')}</span></div>}
            </div>
            <div className="h-px w-full bg-slate-100 border-dashed border-t my-5 relative z-10"></div>
            <div className="flex justify-between items-end mb-2 relative z-10"><span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Total à Pagar</span><span className="text-3xl font-[1000] italic text-[#4B0082] leading-none">R$ {calcularTotalFinal().replace('.', ',')}</span></div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full p-5 bg-white border-t border-slate-100 z-40 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          {subtotal < PEDIDO_MINIMO ? (
              <button disabled className="w-full max-w-[550px] p-5 rounded-[2rem] font-[1000] uppercase italic text-sm bg-slate-100 text-slate-400">Adicione R$ {(PEDIDO_MINIMO - subtotal).toFixed(2).replace('.', ',')} para o mínimo</button>
          ) : (
              <button onClick={processarCheckout} disabled={salvando} className={`w-full max-w-[550px] p-2 pl-8 pr-2 rounded-[3rem] font-[1000] uppercase italic text-lg shadow-xl transition-all flex items-center justify-between ${salvando ? 'bg-slate-100 text-slate-400 scale-95 shadow-none' : 'bg-[#82C91E] text-[#4B0082] active:scale-95 hover:bg-[#95df2b]'}`}>
                  <span className="flex-1 text-left tracking-wide">{salvando ? 'PROCESSANDO...' : 'FECHAR PEDIDO'}</span>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${salvando ? 'bg-transparent text-slate-400 animate-spin' : 'bg-[#4B0082] text-white shadow-md'}`}>{salvando ? <Lucide.Loader2 size={24} strokeWidth={3}/> : <Lucide.Check size={28} strokeWidth={4}/>}</div>
              </button>
          )}
      </div>

      {showModalDados && (
        <div className="fixed inset-0 bg-[#4B0082]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95">
             <div className="text-center mb-6">
                 <Lucide.ShieldAlert size={40} className="mx-auto text-[#82C91E] mb-3"/>
                 <h2 className="text-xl font-[1000] italic uppercase text-[#4B0082]">Quase lá!</h2>
                 <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">Para garantir sua segurança, a InfinitePay precisa do seu nome e e-mail.</p>
             </div>
             <div className="space-y-3 mb-6">
                <input type="text" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Seu Nome Completo" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-[#82C91E] text-xs font-black text-[#4B0082] uppercase" />
                <input type="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} placeholder="Seu Melhor E-mail" className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:border-[#82C91E] text-xs font-black text-[#4B0082] lowercase" />
             </div>
             <div className="flex gap-3">
                 <button onClick={() => setShowModalDados(false)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors">Cancelar</button>
                 <button onClick={() => { if(nomeCliente && emailCliente) { executarFinalizacao(); } else { alert("Preencha seu nome e e-mail!"); }}} className="flex-1 bg-[#4B0082] text-white py-4 rounded-2xl font-[1000] uppercase italic text-xs hover:bg-[#3a004a] shadow-lg transition-colors">Continuar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}