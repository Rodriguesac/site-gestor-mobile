import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, collection } from 'firebase/firestore';

// 1. Liga/Desliga a Loja ou Itens
export const alternarStatus = async (colecao, idDoc, statusAtual) => {
  const docRef = doc(db, colecao, idDoc);
  await updateDoc(docRef, { disponivel: !statusAtual });
};

// 2. Atualiza Preços ou Taxas
export const atualizarValor = async (colecao, idDoc, campo, novoValor) => {
  const docRef = doc(db, colecao, idDoc);
  await updateDoc(docRef, { [campo]: Number(novoValor) });
};

// 3. Escutador de Pedidos em Tempo Real (para o Gestor)
export const escutarPedidos = (callback) => {
  return onSnapshot(collection(db, "pedidos"), (snapshot) => {
    const pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(pedidos);
  });
};