import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import Home from './pages/Home';
import Navigation from './components/Navigation';
import Navbar from './components/Navbar';

// Lazy loading para performance
const Cardapio = lazy(() => import('./pages/Cardapio'));
const MonteSeuAcai = lazy(() => import('./pages/MonteSeuAcai'));
const Bebidas = lazy(() => import('./pages/Bebidas'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Sucesso = lazy(() => import('./pages/Sucesso'));
const Carrinho = lazy(() => import('./pages/Carrinho'));
const Acompanhamento = lazy(() => import('./pages/Acompanhamento'));
const Login = lazy(() => import('./pages/Login'));
const Perfil = lazy(() => import('./pages/Perfil/Perfil'));
const MeusDados = lazy(() => import('./pages/Perfil/MeusDados'));
const MeusPedidos = lazy(() => import('./pages/Perfil/MeusPedidos'));
const MeusEnderecos = lazy(() => import('./pages/Perfil/MeusEnderecos'));

// Loader minimalista com a cor da marca
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0b0e13]">
    <div className="w-12 h-12 border-4 border-white/5 border-t-[#82C91E] rounded-full animate-spin"></div>
  </div>
);

// Proteção de rotas privadas
const PrivateRoute = ({ children }) => {
  const user = localStorage.getItem('@RodriguesAcai:user');
  return user ? children : <Navigate to="/login" replace />;
};

/**
 * COMPONENTE DE LAYOUT ESTRUTURAL
 * Gerencia a visibilidade do Header e Navbar para evitar duplicidade 
 * e focar na experiência do usuário em fluxos críticos.
 */
const Layout = React.memo(({ children }) => {
  const location = useLocation();
  
  // Lista de páginas onde o Navigation (Header Global) e a Navbar NÃO devem aparecer.
  // Nestas páginas, utilizamos o HeaderAcao dentro da própria página.
  const esconderMenus = 
    location.pathname.startsWith('/entregador') || 
    location.pathname === '/login' ||
    location.pathname === '/meus-enderecos' ||
    location.pathname === '/carrinho' ||
    location.pathname === '/monte-seu-acai' ||
    location.pathname === '/checkout';

  return (
    <div className="bg-[#0b0e13] min-h-screen flex flex-col w-full m-0 p-0 overflow-x-hidden">
      
      {/* NAVIGATION GLOBAL (Logo, Endereço, Marquee)
        Só aparece na Home, Cardápio, Bebidas e Perfil.
      */}
      {!esconderMenus && <Navigation />}
      
      {/* CONTEÚDO PRINCIPAL
        Se esconderMenus for true, removemos a margem superior (mt-0) 
        para que o Header de Ação da página cole no topo.
      */}
      <main className={`w-full flex-1 ${!esconderMenus ? 'mt-24 md:mt-24' : 'mt-0'} p-0 m-0`}> 
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>

        {/* Espaçador para o conteúdo não ficar atrás da Navbar fixa no mobile */}
        {!esconderMenus && <div className="h-24 md:hidden w-full" />}
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR
        Essencial para o polegar no mobile. Escondida no Checkout e Monte Seu Açaí
        para evitar que o cliente saia do fluxo de compra sem querer.
      */}
      {!esconderMenus && <Navbar />}
    </div>
  );
});

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Layout>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} /> 
            <Route path="/cardapio" element={<Cardapio />} />
            <Route path="/bebidas" element={<Bebidas />} />
            
            {/* Fluxo de Montagem e Carrinho (Foco Total) */}
            <Route path="/monte-seu-acai" element={<MonteSeuAcai />} />
            <Route path="/carrinho" element={<Carrinho />} />      
            
            {/* Pós-Compra */}
            <Route path="/sucesso" element={<Sucesso />} />
            <Route path="/acompanhamento/:id" element={<Acompanhamento />} />

            {/* Rotas Protegidas (Perfil e Dados) */}
            <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
            <Route path="/perfil/meus-dados" element={<PrivateRoute><MeusDados /></PrivateRoute>} />
            <Route path="/pedidos" element={<PrivateRoute><MeusPedidos /></PrivateRoute>} />
            <Route path="/meus-enderecos" element={<PrivateRoute><MeusEnderecos /></PrivateRoute>} />
            
            {/* Checkout (Finalização) */}
            <Route path="/checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />

            {/* Fallback para rotas inexistentes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </CartProvider>
    </AuthProvider>
  );
}