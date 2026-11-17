import { Link } from 'react-router-dom';
import { Botao } from '../componentes/Botao';
import { EstadoVazio } from '../componentes/EstadoVazio';
import { useToast } from '../componentes/Toast';

export function JoseSabe() {
  const toast = useToast();
  return (
    <section className="tela">
      <header className="tela__topo">
        <h1 className="tela__titulo">José sabe</h1>
        <Link to="/ajustes" className="botao botao--link" aria-label="Ajustes">
          ⚙
        </Link>
      </header>
      <EstadoVazio texto="O José ainda não sabe nada sobre você.">
        <Botao variante="principal" onClick={() => toast('As boas-vindas chegam em breve.')}>
          Fazer as boas-vindas
        </Botao>
      </EstadoVazio>
    </section>
  );
}
