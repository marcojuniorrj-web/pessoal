import { Outlet } from 'react-router-dom';
import { BarraAbas } from './BarraAbas';
import { FaixaOffline } from './FaixaOffline';

/** Casca das telas protegidas: faixa offline, conteúdo na coluna de 680px e barra de abas. */
export function Casca() {
  return (
    <div className="casca">
      <FaixaOffline />
      <main className="coluna casca__conteudo">
        <Outlet />
      </main>
      <BarraAbas />
    </div>
  );
}
