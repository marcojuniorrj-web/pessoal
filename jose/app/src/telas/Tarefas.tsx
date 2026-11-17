import { useNavigate } from 'react-router-dom';
import { Botao } from '../componentes/Botao';
import { EstadoVazio } from '../componentes/EstadoVazio';

export function Tarefas() {
  const ir = useNavigate();
  return (
    <section className="tela">
      <h1 className="tela__titulo">Tarefas</h1>
      <EstadoVazio texto="Nada por aqui. Converse com o José e salve o que importar.">
        <Botao variante="principal" onClick={() => ir('/')}>
          Ir para o Chat
        </Botao>
      </EstadoVazio>
    </section>
  );
}
