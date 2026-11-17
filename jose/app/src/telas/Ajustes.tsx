import { Link } from 'react-router-dom';

export function Ajustes() {
  return (
    <section className="tela">
      <header className="tela__topo">
        <Link to="/jose-sabe" className="botao botao--link" aria-label="Voltar">
          ←
        </Link>
        <h1 className="tela__titulo">Ajustes</h1>
      </header>
    </section>
  );
}
