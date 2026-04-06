import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [enderecoAtivo, setEnderecoAtivo] = useState(null); // Centraliza o endereço
  const [loading, setLoading] = useState(true);

  // 1. ESCUTA AUTENTICAÇÃO E FIRESTORE EM TEMPO REAL
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const userRef = doc(db, 'usuarios', currentUser.uid);
        const unsubscribeSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData({ ...data, uid: currentUser.uid });
          } else {
            setUserData({ uid: currentUser.uid, email: currentUser.email });
          }
          setLoading(false);
        });
        return () => unsubscribeSnap();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. SINCRONIZA O ENDEREÇO ATIVO
  useEffect(() => {
    const carregarEnd = () => {
      const salvo = JSON.parse(localStorage.getItem('endereco_rodrigues'));
      if (salvo) setEnderecoAtivo(salvo);
    };
    carregarEnd();
    window.addEventListener('enderecoAtualizado', carregarEnd);
    return () => window.removeEventListener('enderecoAtualizado', carregarEnd);
  }, []);

  // --- FUNÇÃO CENTRALIZADA PARA ATUALIZAR A FOTO (USADA PELO PERFIL) ---
  const atualizarFotoPerfil = async (novaUrl) => {
    if (!user) return;
    try {
      // Atualiza no Firebase Auth
      await updateProfile(user, { photoURL: novaUrl });
      
      // Atualiza no Firestore (Isso disparará o onSnapshot acima)
      const userRef = doc(db, 'usuarios', user.uid);
      await setDoc(userRef, { 
        photoURL: novaUrl,
        updatedAt: serverTimestamp() 
      }, { merge: true });

    } catch (error) {
      console.error("Erro ao atualizar foto no Context:", error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('endereco_rodrigues');
    localStorage.removeItem('@RodriguesAcai:user');
  };

  const value = {
    user,
    userData,
    fotoPerfil: userData?.photoURL || user?.photoURL || null, // URL Unificada e reativa
    enderecoAtivo,
    atualizarFotoPerfil, // Exporta a função para o Perfil
    loading,
    logout
  };

  return (
    <UserContext.Provider value={value}>
      {!loading && children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser deve ser usado dentro de um UserProvider');
  return context;
};