import { Outlet, NavLink } from 'react-router-dom';

export default function PerfilLayout() {
  return (
    <div>
      <nav style={{ padding: 16, borderBottom: '1px solid #ccc' }}>
        <NavLink to="/perfil" end>Perfil</NavLink> |{' '}
        <NavLink to="/perfil/pedidos">Pedidos</NavLink> |{' '}
        <NavLink to="/perfil/enderecos">Endereços</NavLink>
      </nav>

      <div style={{ padding: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}
