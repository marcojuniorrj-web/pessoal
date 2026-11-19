import { useEffect, useRef, useState } from 'react';
import { PALAVRA_APAGAR_TUDO } from '@compartilhado/schemas';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/cliente';
import { Botao } from '../componentes/Botao';
import { InstrucaoInstalar, useInstalar } from '../componentes/InstrucaoInstalar';
import { useToast } from '../componentes/Toast';
import { abrirBoasVindas, caminhoBoasVindas } from '../estado/boas-vindas';
import { limparDadosLocais } from '../estado/dados-locais';
import { useOnline } from '../estado/online';
import { useSessao, useUsuario } from '../estado/sessao';
import { useTecladoVirtual } from '../estado/teclado';

type Pergunta = null | 'sair' | 'sair-todos';
type PassoApagar = null | 'aviso' | 'digitar';

export function Ajustes() {
  const usuario = useUsuario();
  const { sessaoExpirou } = useSessao();
  const ir = useNavigate();
  const toast = useToast();
  const [confirmar, setConfirmar] = useState<Pergunta>(null);
  const [saindo, setSaindo] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const online = useOnline();
  const instalar = useInstalar();
  const [instrucaoAberta, setInstrucaoAberta] = useState(false);
  // Apagar todos os meus dados: 1) aviso, 2) digitar APAGAR; depois "apagando" e, se falhar, o erro na própria tela.
  const [apagar, setApagar] = useState<PassoApagar>(null);
  const [digitado, setDigitado] = useState('');
  const [apagando, setApagando] = useState(false);
  const [erroApagar, setErroApagar] = useState(false);
  const campoApagar = useRef<HTMLInputElement>(null);
  useTecladoVirtual();

  const fecharApagar = () => {
    setApagar(null);
    setDigitado('');
    setErroApagar(false);
  };

  // Esc fecha a confirmação, como o Cancelar (menos enquanto está saindo ou apagando).
  useEffect(() => {
    if (!confirmar && !apagar) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (apagar) {
        if (!apagando) fecharApagar();
      } else if (!saindo) setConfirmar(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [confirmar, saindo, apagar, apagando]);

  // No passo de digitar o foco vai para o campo, que fica à vista mesmo com o teclado aberto.
  useEffect(() => {
    if (apagar !== 'digitar') return;
    campoApagar.current?.focus();
    campoApagar.current?.scrollIntoView?.({ block: 'center' });
  }, [apagar]);

  const apagarTudo = async () => {
    if (apagando || digitado !== PALAVRA_APAGAR_TUDO) return;
    setApagando(true);
    setErroApagar(false);
    try {
      await api.delete('/api/eu', { confirmacao: digitado });
    } catch {
      // Nada foi apagado (o servidor apaga tudo ou nada): o Marco pode tentar de novo.
      setErroApagar(true);
      setApagando(false);
      return;
    }
    // Servidor limpo: limpa também o aparelho e recarrega o app inteiro (a memória do app some junto) no Login.
    limparDadosLocais();
    window.location.replace('/login');
  };

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

      {apagar === 'aviso' ? (
        <div className="cartao confirmacao" role="alertdialog" aria-labelledby="apagar-titulo" aria-describedby="apagar-aviso">
          <p id="apagar-titulo">Apagar todos os meus dados?</p>
          <p id="apagar-aviso" className="texto-2">
            Isso apaga para sempre suas conversas, memórias, tarefas e metas, e tira você de todos os aparelhos. Não dá para desfazer.
          </p>
          <div className="confirmacao__acoes">
            <Botao onClick={fecharApagar}>Cancelar</Botao>
            <Botao variante="perigo" onClick={() => setApagar('digitar')}>
              Continuar
            </Botao>
          </div>
        </div>
      ) : apagar === 'digitar' ? (
        <form
          className="cartao confirmacao"
          role="alertdialog"
          aria-labelledby="apagar-titulo"
          onSubmit={(e) => {
            e.preventDefault();
            void apagarTudo();
          }}
        >
          <p id="apagar-titulo">Para confirmar, digite {PALAVRA_APAGAR_TUDO}</p>
          <label className="so-leitor" htmlFor="apagar-campo">
            Digite {PALAVRA_APAGAR_TUDO} para apagar tudo
          </label>
          <input
            id="apagar-campo"
            ref={campoApagar}
            className="confirmacao__campo"
            type="text"
            value={digitado}
            disabled={apagando}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            placeholder={PALAVRA_APAGAR_TUDO}
            onChange={(e) => {
              setDigitado(e.target.value);
              setErroApagar(false);
            }}
          />
          {!online ? (
            <p className="mensagem-erro" role="alert">
              Sem conexão. Nada foi apagado. Volte a ficar online para apagar.
            </p>
          ) : (
            erroApagar && (
              <p className="mensagem-erro" role="alert">
                Não foi possível apagar agora. Nada foi apagado. Tente de novo.
              </p>
            )
          )}
          <div className="confirmacao__acoes">
            <Botao onClick={fecharApagar} disabled={apagando}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={apagando} disabled={digitado !== PALAVRA_APAGAR_TUDO || !online}>
              {apagando ? 'Apagando…' : 'Apagar tudo'}
            </Botao>
          </div>
        </form>
      ) : confirmar ? (
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
          {instalar.instalado ? (
            <p className="texto-2 instalar-ajustes__ok">Já está na tela inicial.</p>
          ) : (
            <>
              <Botao
                aria-expanded={instalar.modo === 'botao' ? undefined : instrucaoAberta}
                onClick={() => (instalar.modo === 'botao' ? void instalar.instalarDireto() : setInstrucaoAberta((v) => !v))}
              >
                Instalar na tela inicial
              </Botao>
              {instrucaoAberta && instalar.modo !== 'botao' && (
                <div className="cartao">
                  <InstrucaoInstalar modo={instalar.modo} />
                </div>
              )}
            </>
          )}
          <Botao carregando={abrindo} disabled={!online} onClick={() => void refazerBoasVindas()}>
            Refazer boas-vindas
          </Botao>
          <Botao onClick={() => setConfirmar('sair')}>Sair</Botao>
          <Botao onClick={() => setConfirmar('sair-todos')}>Sair de todos os aparelhos</Botao>
          <Botao variante="perigo" disabled={!online} onClick={() => setApagar('aviso')}>
            Apagar todos os meus dados
          </Botao>
        </div>
      )}

      <p className="texto-2 versao">José versão {__VERSAO__}</p>
    </section>
  );
}
