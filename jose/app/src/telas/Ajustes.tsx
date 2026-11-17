import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import { useToast } from '../componentes/Toast';
import { useSessao, useUsuario } from '../estado/sessao';

type Pergunta = null | 'sair' | 'sair-todos';

export function Ajustes() {
  const usuario = useUsuario();
  const { sessaoExpirou } = useSessao();
  const ir = useNavigate();
  const toast = useToast();
  const [confirmar, setConfirmar] = useState<Pergunta>(null);
  const [saindo, setSaindo] = useState(false);

  const executar = async (qual: Exclude<Pergunta, null>) => {
    setSaindo(true);
    try {
      await api.post(qual === 'sair' ? '/auth/sair' : '/auth/sair-todos');
      sessaoExpirou();
      ir('/login', { replace: true });
    } catch {
      toast('Não foi possível sair. Tentar de novo');
      setSaindo(false);
    }
  };

  return (
    <section className="tela">
      <header className="tela__topo">
        <Link to="/jose-sabe" className="botao botao--link" aria-label="Voltar">
          ←
        </Link>
        <h1 className="tela__titulo">Ajustes</h1>
        <span style={{ width: 48 }} />
      </header>

      <div className="cartao conta">
        {usuario.foto_url ? <img className="conta__foto" src={usuario.foto_url} alt="" referrerPolicy="no-referrer" /> : <div className="conta__foto conta__foto--inicial" aria-hidden="true">{usuario.nome.slice(0, 1)}</div>}
        <div>
          <p>{usuario.nome}</p>
          <p className="texto-2">{usuario.email}</p>
        </div>
      </div>

      {confirmar ? (
        <div className="cartao confirmacao" role="alertdialog" aria-labelledby="confirmacao-titulo">
          <p id="confirmacao-titulo">{confirmar === 'sair' ? 'Sair deste aparelho?' : 'Sair de todos os aparelhos?'}</p>
          <div className="confirmacao__acoes">
            <Botao onClick={() => setConfirmar(null)} disabled={saindo}>
              Cancelar
            </Botao>
            <Botao variante="principal" carregando={saindo} onClick={() => void executar(confirmar)}>
              Sair
            </Botao>
          </div>
        </div>
      ) : (
        <div className="lista-acoes">
          <Botao onClick={() => setConfirmar('sair')}>Sair</Botao>
          <Botao onClick={() => setConfirmar('sair-todos')}>Sair de todos os aparelhos</Botao>
        </div>
      )}

      <Link to="/teste-voz" className="botao botao--link">
        Teste de voz (temporário)
      </Link>

      <p className="texto-2 versao">José versão {__VERSAO__}</p>
    </section>
  );
}
