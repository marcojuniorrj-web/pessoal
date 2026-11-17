import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { voltarSeguro } from '@compartilhado/voltar';
import { Botao } from '../componentes/Botao';
import { useSessao } from '../estado/sessao';
import { mensagemDeErro } from './login-mensagens';

export function Login() {
  const [params] = useSearchParams();
  const { estado } = useSessao();
  const [carregando, setCarregando] = useState(false);
  const voltar = params.get('voltar');
  const erro = mensagemDeErro(params.get('erro'));

  // Já logado: sucesso, vai para onde estava indo.
  if (estado.situacao === 'logado' && !estado.offline) return <Navigate to={voltarSeguro(voltar)} replace />;

  const entrar = () => {
    setCarregando(true);
    window.location.href = `/auth/google${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ''}`;
  };

  return (
    <main className="login">
      <div className="login__logo" aria-hidden="true">J</div>
      <h1 className="login__nome">José</h1>
      <p className="login__frase">Seu assistente para o dia a dia</p>
      {erro && (
        <p className="mensagem-erro" role="alert">
          {erro}
        </p>
      )}
      <Botao variante="principal" grande carregando={carregando} onClick={entrar}>
        Entrar com Google
      </Botao>
    </main>
  );
}
