import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import { useToast } from '../componentes/Toast';
import { abrirBoasVindas, caminhoBoasVindas } from '../estado/boas-vindas';
import { useOnline } from '../estado/online';
import { useSessao, useUsuario } from '../estado/sessao';

type Pergunta = null | 'sair' | 'sair-todos';

export function Ajustes() {
  const usuario = useUsuario();
  const { sessaoExpirou } = useSessao();
  const ir = useNavigate();
  const toast = useToast();
  const [confirmar, setConfirmar] = useState<Pergunta>(null);
  const [saindo, setSaindo] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const online = useOnline();

  // Esc fecha a confirmação, como o Cancelar.
  useEffect(() => {
    if (!confirmar) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saindo) setConfirmar(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [confirmar, saindo]);

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

  // Refazer boas-vindas: abre uma nova conversa (ou retoma a em aberto) e mantém as memórias atuais.
  const refazerBoasVindas = async () => {
    setAbrindo(true);
    try {
      ir(caminhoBoasVindas(await abrirBoasVindas(usuario)));
    } catch {
      toast('Não foi possível abrir as boas-vindas. Tente de novo.');
      setAbrindo(false);
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
          <Botao carregando={abrindo} disabled={!online} onClick={() => void refazerBoasVindas()}>
            Refazer boas-vindas
          </Botao>
          <Botao onClick={() => setConfirmar('sair')}>Sair</Botao>
          <Botao onClick={() => setConfirmar('sair-todos')}>Sair de todos os aparelhos</Botao>
        </div>
      )}

      <p className="texto-2 versao">José versão {__VERSAO__}</p>
    </section>
  );
}
