import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { CartProvider } from './context/CartContext';

import SidebarAdmin from './components/SidebarAdmin'; 
import Home from './pages/Home';

// --- ROTAS DO CLIENTE ---
const Cardapio = lazy(() => import('./pages/Cardapio'));
const MonteSeuAcai = lazy(() => import('./pages/MonteSeuAcai'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Sucesso = lazy(() => import('./pages/Sucesso'));
const Carrinho = lazy(() => import('./pages/Carrinho'));
const LeilaoCliente = lazy(() => import('./pages/LeilaoCliente'));
const Acompanhamento = lazy(() => import('./pages/Acompanhamento'));
const Login = lazy(() => import('./pages/Login'));
const Perfil = lazy(() => import('./pages/Perfil/Perfil'));
const MeusDados = lazy(() => import('./pages/Perfil/MeusDados'));
const MeusEnderecos = lazy(() => import('./pages/Perfil/MeusEnderecos'));
const MeusPedidos = lazy(() => import('./pages/Perfil/MeusPedidos'));
const DetalhesPedido = lazy(() => import('./pages/Perfil/DetalhesPedido')); 

// --- ROTAS DE GESTÃO E LOGÍSTICA ---
const GestorMobile = lazy(() => import('./pages/GestorMobile'));
const EntregadorMobile = lazy(() => import('./pages/EntregadorMobile'));
const TorreLogistica = lazy(() => import('./pages/TorreDeComando'));
const PainelEntregadores = lazy(() => import('./pages/PainelEntregadores'));
const ModuloLeilaoAdmin = lazy(() => import('./pages/ModuloLeilaoAdmin')); 
const PainelLogistica = lazy(() => import('./pages/PainelLogistica'));

// --- PROTEÇÃO DE ROTAS ---
const PrivateRoute = ({ children }) => {
  const { user, loading } = useUser();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#1F0137]">
      <div className="w-10 h-10 border-4 border-[#82C91E] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const ClientLayout = ({ children }) => {
  return (
    <div className="h-screen w-full bg-gradient-to-b from-[#1F0137] to-[#4B0082] font-montserrat antialiased overflow-hidden flex justify-center">
      <main className="w-full max-w-[450px] h-full bg-transparent relative flex flex-col shadow-2xl">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <Suspense fallback={<div className="h-screen flex items-center justify-center text-lime-400 font-black italic tracking-widest uppercase animate-pulse">Carregando...</div>}>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

const FullScreenLayout = ({ children }) => {
  return (
    <div className="h-screen w-full bg-[#F8FAFC] font-sans antialiased overflow-hidden flex">
      <SidebarAdmin /> 
      <main className="flex-1 h-full overflow-y-auto bg-[#F8FAFC]">
          <Suspense fallback={<div className="h-screen flex flex-col items-center justify-center bg-white gap-4"><div className="w-12 h-12 border-4 border-[#4B0082] border-t-[#82C91E] rounded-full animate-spin" /><span className="text-[#4B0082] font-black uppercase tracking-widest italic text-xs animate-pulse">Sincronizando...</span></div>}>
            {children}
          </Suspense>
      </main>
    </div>
  );
};

export default function App() {
  
  // A CHAVE QUE O GITHUB VAI INJETAR
  const TIPO_APP = import.meta.env.VITE_TIPO_APP;

  // ==================================================================
  // 🏍️ APP EXCLUSIVO DO ENTREGADOR (ISOLADO)
  // ==================================================================
  if (TIPO_APP === 'entregador') {
    return (
      <UserProvider>
        <Routes>
          <Route path="/" element={
            <ClientLayout>
               <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#F4F6F8]"><div className="w-10 h-10 border-4 border-[#4B0082] border-t-transparent rounded-full animate-spin" /></div>}>
                 <EntregadorMobile />
               </Suspense>
            </ClientLayout>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UserProvider>
    );
  }

  // ==================================================================
  // 🍔 APP CLIENTE + DASHBOARD GESTÃO
  // ==================================================================
  return (
    <UserProvider>
      <CartProvider>
        <Routes>
          <Route path="/login" element={<ClientLayout><Login /></ClientLayout>} />
          <Route path="/leilao" element={<PrivateRoute><ClientLayout><LeilaoCliente /></ClientLayout></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><ClientLayout><Home /></ClientLayout></PrivateRoute>} />
          <Route path="/carrinho" element={<PrivateRoute><ClientLayout><Carrinho /></ClientLayout></PrivateRoute>} />
          <Route path="/monte-seu-acai" element={<PrivateRoute><ClientLayout><MonteSeuAcai /></ClientLayout></PrivateRoute>} />
          <Route path="/checkout" element={<PrivateRoute><ClientLayout><Checkout /></ClientLayout></PrivateRoute>} />
          <Route path="/sucesso" element={<PrivateRoute><ClientLayout><Sucesso /></ClientLayout></PrivateRoute>} />
          <Route path="/acompanhamento/:id" element={<PrivateRoute><ClientLayout><Acompanhamento /></ClientLayout></PrivateRoute>} />
          <Route path="/detalhes-pedido/:id" element={<PrivateRoute><ClientLayout><DetalhesPedido /></ClientLayout></PrivateRoute>} />
          <Route path="/perfil" element={<PrivateRoute><ClientLayout><Perfil /></ClientLayout></PrivateRoute>} />
          <Route path="/meus-dados" element={<PrivateRoute><ClientLayout><MeusDados /></ClientLayout></PrivateRoute>} />
          <Route path="/meus-enderecos" element={<PrivateRoute><ClientLayout><MeusEnderecos /></ClientLayout></PrivateRoute>} />
          <Route path="/pedidos" element={<PrivateRoute><ClientLayout><MeusPedidos /></ClientLayout></PrivateRoute>} />
          <Route path="/entregador-mobile" element={<PrivateRoute><ClientLayout><EntregadorMobile /></ClientLayout></PrivateRoute>} />
          <Route path="/leilao-admin" element={<PrivateRoute><FullScreenLayout><ModuloLeilaoAdmin /></FullScreenLayout></PrivateRoute>} />
          <Route path="/cardapio" element={<PrivateRoute><FullScreenLayout><Cardapio /></FullScreenLayout></PrivateRoute>} />
          <Route path="/gestor-mobile" element={<PrivateRoute><FullScreenLayout><GestorMobile /></FullScreenLayout></PrivateRoute>} />
          <Route path="/torre-logistica" element={<PrivateRoute><FullScreenLayout><TorreLogistica /></FullScreenLayout></PrivateRoute>} />
          <Route path="/painel-entregadores" element={<PrivateRoute><FullScreenLayout><PainelEntregadores /></FullScreenLayout></PrivateRoute>} />
          <Route path="/painel-logistica" element={<PrivateRoute><FullScreenLayout><PainelLogistica /></FullScreenLayout></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CartProvider>
    </UserProvider>
  );
}