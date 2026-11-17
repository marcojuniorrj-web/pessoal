import { NavLink, useLocation } from 'react-router-dom';

const ABAS = [
  { para: '/', rotulo: 'Chat', icone: '💬', ativaEm: (p: string) => p === '/' },
  { para: '/tarefas', rotulo: 'Tarefas', icone: '✓', ativaEm: (p: string) => p.startsWith('/tarefas') },
  { para: '/jose-sabe', rotulo: 'José sabe', icone: '🧠', ativaEm: (p: string) => p.startsWith('/jose-sabe') || p.startsWith('/ajustes') },
];

export function BarraAbas() {
  const { pathname } = useLocation();
  return (
    <nav className="barra-abas" aria-label="Navegação principal">
      <div className="coluna barra-abas__interna">
        {ABAS.map((a) => (
          <NavLink key={a.para} to={a.para} className="barra-abas__item" aria-current={a.ativaEm(pathname) ? 'page' : undefined} data-ativa={a.ativaEm(pathname)}>
            <span aria-hidden="true">{a.icone}</span>
            <span>{a.rotulo}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
