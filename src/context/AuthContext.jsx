import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginComGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error("Erro Google:", error);
      throw error;
    }
  };

  const loginEmailSenha = (email, senha) => signInWithEmailAndPassword(auth, email, senha);
  
  const cadastrarEmailSenha = (email, senha) => createUserWithEmailAndPassword(auth, email, senha);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ 
      user, loading, loginComGoogle, loginEmailSenha, cadastrarEmailSenha, logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);