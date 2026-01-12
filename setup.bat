@echo off
setlocal enabledelayedexpansion

echo [1/5] Criando estrutura de pastas...
if not exist "src\pages\Perfil" mkdir "src\pages\Perfil"

echo [2/5] Criando PerfilLayout.jsx...
(
echo import React from 'react';
echo import { useNavigate } from 'react-router-dom';
echo import * as Lucide from 'lucide-react';
echo.
echo export default function PerfilLayout({ children, titulo }) {
echo   const navigate = useNavigate();
echo   return (
echo     ^<div className="min-h-screen bg-white pt-24 md:pt-32 px-6"^>
echo       ^<div className="max-w-2xl mx-auto"^>
echo         ^<div className="flex items-center gap-4 mb-8"^>
echo           ^<button onClick={() =^> navigate('/perfil')} className="p-2.5 bg-zinc-50 rounded-2xl border border-zinc-100 text-zinc-900 active:scale-90 transition-all"^>
echo             ^<Lucide.ChevronLeft size={24} /^>
echo           ^</button^>
echo           ^<h1 className="text-2xl font-ifood italic font-black uppercase tracking-tighter text-zinc-900"^>{titulo}^</h1^>
echo         ^</div^>
echo         {children}
echo       ^</div^>
echo     ^</div^>
echo   ^);
echo }
) > src\pages\Perfil\PerfilLayout.jsx

echo [3/5] Criando MeusPedidos.jsx...
(
echo import React from 'react';
echo import PerfilLayout from './PerfilLayout';
echo import * as Lucide from 'lucide-react';
echo.
echo export default function MeusPedidos() {
echo   return (
echo     ^<PerfilLayout titulo="Meus Pedidos"^>
echo       ^<div className="flex flex-col items-center justify-center py-20 text-center"^>
echo         ^<div className="bg-zinc-50 p-8 rounded-[3rem] mb-6 text-zinc-200"^>^<Lucide.ShoppingBag size={60} /^>^</div^>
echo         ^<p className="text-zinc-400 font-bold text-sm mb-8"^>Você ainda não fez nenhum pedido.^</p^>
echo         ^<button onClick={() =^> window.location.href='/cardapio'} className="bg-[#ea1d2c] text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest shadow-lg active:scale-95 transition-all"^>Ir para o Cardápio^</button^>
echo       ^</div^>
echo     ^</PerfilLayout^>
echo   ^);
echo }
) > src\pages\Perfil\MeusPedidos.jsx

echo [4/5] Criando MeusEnderecos.jsx...
(
echo import React from 'react';
echo import PerfilLayout from './PerfilLayout';
echo import * as Lucide from 'lucide-react';
echo.
echo export default function MeusEnderecos() {
echo   return (
echo     ^<PerfilLayout titulo="Meus Endereços"^>
echo       ^<div className="flex flex-col items-center justify-center py-20 text-center"^>
echo         ^<div className="bg-zinc-50 p-8 rounded-[3rem] mb-6 text-zinc-200"^>^<Lucide.MapPin size={60} /^>^</div^>
echo         ^<p className="text-zinc-400 font-bold text-sm mb-8"^>Nenhum endereço salvo.^</p^>
echo         ^<button className="bg-zinc-900 text-white w-full py-5 rounded-[2rem] font-black uppercase italic text-xs tracking-widest shadow-xl active:scale-95 transition-all"^>Adicionar Endereço^</button^>
echo       ^</div^>
echo     ^</PerfilLayout^>
echo   ^);
echo }
) > src\pages\Perfil\MeusEnderecos.jsx

echo [5/5] ATENÇÃO: Atualize seu App.jsx manualmente!
echo Adicione estas linhas no topo do App.jsx:
echo import MeusPedidos from './pages/Perfil/MeusPedidos';
echo import MeusEnderecos from './pages/Perfil/MeusEnderecos';
echo.
echo E estas dentro do ^<Routes^>:
echo ^<Route path="/pedidos" element={^<MeusPedidos /^>} /^>
echo ^<Route path="/enderecos" element={^<MeusEnderecos /^>} /^>
echo.
echo Concluído! Pastas e arquivos criados com sucesso.
pause