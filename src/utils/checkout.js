export const gerarLinkPagamento = (carrinho, usuario, enderecoAtivo) => {
  const INFINITEPAY_USER = "rodriguesac";
  
  // 1. Validação: Se não tiver dados, avisa o erro
  if (!usuario.nome || !usuario.telefone) {
    alert("Por favor, preencha seu nome e telefone no perfil antes de pagar.");
    return null;
  }

  // 2. Formata itens para centavos
  const itensFormatados = carrinho.map(item => ({
    name: item.tamanho || item.nome,
    price: Math.round(item.total * 100),
    quantity: 1
  }));

  // 3. Soma a taxa de entrega como item
  if (enderecoAtivo?.taxa > 0) {
    itensFormatados.push({
      name: "Taxa de Entrega",
      price: Math.round(enderecoAtivo.taxa * 100),
      quantity: 1
    });
  }

  // 4. Parâmetros dinâmicos capturados do site
  const params = new URLSearchParams({
    "items": JSON.stringify(itensFormatados),
    "customer_name": usuario.nome,
    "customer_email": usuario.email,
    "customer_cellphone": usuario.telefone,
    "address_cep": enderecoAtivo?.cep || "79000000", // CEP do endereço selecionado
    "order_nsu": "ROD-" + Date.now(),
    "redirect_url": `${window.location.origin}/sucesso`
  });

  return `https://checkout.infinitepay.io/${INFINITEPAY_USER}?${params.toString()}`;
};