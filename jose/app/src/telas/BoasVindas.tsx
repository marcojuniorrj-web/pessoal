import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Botao } from '../componentes/Botao';
import { EsqueletoLista } from '../componentes/Esqueleto';
import { caminhoBoasVindas, conversaParaRetomar, criarBoasVindasUnica } from '../estado/boas-vindas';
import { marcarFaixaPendente } from '../estado/instalar';
import { useSessao, useUsuario } from '../estado/sessao';
import { Chat } from './Chat';

/**
 * Boas-vindas (telas.md, tela 2): a interface do Chat, sem barra de abas. Sem `?c=` na URL, retoma a conversa em aberto
 * (que `/api/eu` informa) ou cria uma; com as boas-vindas concluídas e sem `?c=`, vai ao Chat (a flag manda).
 */
export function BoasVindas() {
  const usuario = useUsuario();
  const { atualizarUsuario } = useSessao();
  const ir = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('c');
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const retomar = conversaParaRetomar(usuario);
  const concluidas = usuario.boas_vindas_concluida;

  // Sem conversa na URL: retoma a em aberto ou cria uma (uma só, mesmo com efeitos repetidos).
  useEffect(() => {
    if (id || concluidas) return;
    if (retomar) {
      ir(caminhoBoasVindas(retomar), { replace: true });
      return;
    }
    let cancelado = false;
    setFalhou(false);
    criarBoasVindasUnica()
      .then((novo) => !cancelado && ir(caminhoBoasVindas(novo), { replace: true }))
      .catch(() => !cancelado && setFalhou(true));
    return () => {
      cancelado = true;
    };
  }, [id, concluidas, retomar, ir, tentativa]);

  // Salvou ou pulou: a flag vale na hora (sem esperar o /api/eu), a faixa de instalar fica pendente e o app abre o Chat.
  const aoConcluir = useCallback(() => {
    atualizarUsuario({ boas_vindas_concluida: true, conversa_boas_vindas_id: undefined });
    marcarFaixaPendente();
    ir('/', { replace: true });
  }, [atualizarUsuario, ir]);

  // A conversa da URL não existe mais (404): cria outra se as boas-vindas ainda não foram concluídas; senão, Chat.
  const aoNaoEncontrada = useCallback(() => ir(concluidas ? '/' : '/boas-vindas', { replace: true }), [concluidas, ir]);

  if (!id && concluidas) return <Navigate to="/" replace />;
  if (!id) {
    return falhou ? (
      <div className="estado-vazio bv__preparando">
        <p className="mensagem-erro">Não foi possível abrir as boas-vindas.</p>
        <Botao variante="principal" onClick={() => setTentativa((n) => n + 1)}>
          Tentar de novo
        </Botao>
        <Botao variante="link" onClick={() => ir('/?nova=1', { replace: true })}>
          Ir para o Chat
        </Botao>
      </div>
    ) : (
      <div className="bv__preparando">
        <EsqueletoLista linhas={3} />
      </div>
    );
  }
  return <Chat key={id} boasVindas={{ conversaId: id, aoConcluir, aoNaoEncontrada }} />;
}
