import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FUSO_PADRAO, saudacao, separadoresDeDia } from '@compartilhado/datas';
import { LIMITE_MENSAGEM } from '@compartilhado/schemas';
import { Balao } from '../componentes/Balao';
import { Botao } from '../componentes/Botao';
import { CartaoSugestao } from '../componentes/CartaoSugestao';
import { EsqueletoLista } from '../componentes/Esqueleto';
import { FolhaAcoes } from '../componentes/FolhaAcoes';
import { GavetaHistorico } from '../componentes/GavetaHistorico';
import { useToast, useToastAtual } from '../componentes/Toast';
import { apagarConversa, apagarMensagem } from '../api/conversas';
import { useAgora } from '../estado/agora';
import { apagarComDesfazer } from '../estado/apagar-com-desfazer';
import { useChat, type Bolha } from '../estado/chat';
import { copiarTexto } from '../estado/copiar';
import { assinarOcultas, mensagemOculta, mostrarMensagens, ocultarMensagens, versaoOcultas } from '../estado/mensagens-ocultas';
import { useOnline } from '../estado/online';
import { lerRascunho, salvarRascunho } from '../estado/rascunho';
import { useSessao, useUsuario } from '../estado/sessao';
import { useTecladoVirtual } from '../estado/teclado';

const ATALHOS = [
  { icone: '☀️', rotulo: 'O que faço hoje?' },
  { icone: '🧱', rotulo: 'Travei' },
  { icone: '🌙', rotulo: 'Descarregar a cabeça' },
] as const;

export function Chat() {
  const usuario = useUsuario();
  const { estado } = useSessao();
  const online = useOnline();
  const toast = useToast();
  const toastAtual = useToastAtual();
  const ir = useNavigate();
  const [params] = useSearchParams();
  const idUrl = params.get('c');
  const nova = params.get('nova') === '1';
  useTecladoVirtual();

  const { geracao, carga, conversa, bolhas, ocupado, enviar, tentarDeNovo, iniciarDecisao, recarregar, atualizarSugestao, removerBolhas } = useChat({
    idUrl,
    nova,
    // A URL passa a apontar para a conversa criada: um 401 volta exatamente para ela.
    aoCriar: (id) => ir(`/?c=${encodeURIComponent(id)}`, { replace: true }),
  });

  const fuso = usuario.fuso_horario ?? FUSO_PADRAO;
  const agora = useAgora(fuso);
  // Mensagens mandadas apagar somem na hora (e seus cartões junto); a API só é chamada depois dos 5 s do Desfazer.
  useSyncExternalStore(assinarOcultas, versaoOcultas);
  const visiveis = bolhas.filter((b) => !mensagemOculta(b.id));
  const separadores = separadoresDeDia(visiveis.map((b) => b.criadaEm), agora, fuso);

  const [texto, setTexto] = useState('');
  const [menuTopo, setMenuTopo] = useState(false);
  const [pedidoFoco, setPedidoFoco] = useState<{ n: number; id: string | null }>({ n: 0, id: null });
  const [folha, setFolha] = useState<{ id: string; origem: HTMLElement } | null>(null);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const rodapeRef = useRef<HTMLFormElement>(null);

  // Publica a altura do rodapé (campo + Enviar) para o toast ficar acima dele, sem cobrir o campo.
  useEffect(() => {
    const el = rodapeRef.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty('--altura-rodape-chat', `${el.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty('--altura-rodape-chat');
    };
  }, []);
  const fimRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const conversaRef = useRef<string | null>(null);
  conversaRef.current = conversa.id;
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  const semRede = !online || (estado.situacao === 'logado' && estado.offline);

  // O rascunho da conversa aberta volta para o campo (ex.: depois de um 401 e novo login), mas nunca por cima
  // do que o Marco digitou enquanto a conversa carregava: nesse caso o texto fica e passa a ser o rascunho dela.
  const textoRef = useRef('');
  textoRef.current = texto;
  const editouNaCargaRef = useRef(false);
  useEffect(() => {
    if (carga === 'carregando') {
      editouNaCargaRef.current = false;
      return;
    }
    if (carga !== 'ok') return;
    if (editouNaCargaRef.current && textoRef.current) {
      salvarRascunho(conversaRef.current, textoRef.current);
      editouNaCargaRef.current = false;
      return;
    }
    setTexto(lerRascunho(conversaRef.current));
  }, [carga, geracao]);

  // Sempre mostra o fim da conversa quando chega texto novo.
  useLayoutEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [bolhas]);

  // O aviso abre espaço no fim da lista (--reserva-toast): quem estava no fim continua no fim, acima do aviso.
  useEffect(() => {
    const lista = listaRef.current;
    if (toastAtual === null || !lista) return;
    const reserva = parseFloat(document.documentElement.style.getPropertyValue('--reserva-toast')) || 0;
    // "No fim" = até ~120 px do fim (o último item pode ter folga embaixo): então o fim continua à vista, acima do aviso.
    if (lista.scrollHeight - lista.scrollTop - lista.clientHeight - reserva <= 120) lista.scrollTop = lista.scrollHeight;
  }, [toastAtual]);

  const aoDigitar = (v: string) => {
    if (carga === 'carregando') editouNaCargaRef.current = true;
    setTexto(v);
    salvarRascunho(conversa.id, v);
  };

  const enviarTexto = async (conteudo: string) => {
    if (semRede) return;
    setTexto('');
    await enviar(conteudo);
  };

  const aoEnviar = (e?: FormEvent) => {
    e?.preventDefault();
    if (!texto.trim() || ocupado || semRede) return;
    void enviarTexto(texto);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // No computador, Enter envia e Shift+Enter quebra a linha. No celular, Enter quebra a linha.
    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
      e.preventDefault();
      aoEnviar();
    }
  };

  const decidir = async () => {
    if (semRede) return;
    if (!(await iniciarDecisao())) toast('Não foi possível iniciar. Tente de novo.');
  };

  /** A resposta do José logo depois (visível e pronta), para "Apagar mensagem e resposta". */
  const respostaDe = (b: Bolha): Bolha | null => {
    const i = visiveis.findIndex((x) => x.id === b.id);
    const prox = i >= 0 ? visiveis[i + 1] : undefined;
    return b.autor === 'marco' && prox?.autor === 'jose' && prox.estado === 'ok' ? prox : null;
  };
  /** Só mensagens prontas abrem a folha; a do Marco que ainda espera resposta (ou "Tentar de novo") também não. */
  const podeAbrirAcoes = (b: Bolha, i: number) => {
    if (b.estado !== 'ok') return false;
    const prox = visiveis[i + 1];
    return !(b.autor === 'marco' && prox && prox.estado !== 'ok');
  };

  const apagarMensagens = (b: Bolha, comResposta: boolean) => {
    const resposta = comResposta ? respostaDe(b) : null;
    const ids = resposta ? [b.id, resposta.id] : [b.id];
    const conversaId = conversa.id; // a conversa de onde a mensagem saiu (o Marco pode trocar de conversa nos 5 s)
    // O foco não pode se perder no body: vai para o balão vizinho que fica (o seguinte, senão o anterior).
    const restantes = visiveis.filter((x) => !ids.includes(x.id) && x.estado === 'ok');
    const posicao = visiveis.findIndex((x) => x.id === b.id);
    const vizinho = restantes.find((x) => visiveis.indexOf(x) > posicao) ?? restantes.filter((x) => visiveis.indexOf(x) < posicao).at(-1);
    setPedidoFoco((n) => ({ n: n.n + 1, id: vizinho?.id ?? null }));
    ocultarMensagens(ids);
    apagarComDesfazer({
      id: b.id,
      mostrar: toast,
      apagar: async () => {
        const conversaApagada = await apagarMensagem(b.id, !!resposta);
        removerBolhas(ids);
        if (conversaApagada) {
          // Era a última mensagem: o servidor apagou a conversa vazia junto. Se ela ainda está aberta, vai ao Chat vazio.
          toast('Conversa vazia apagada.');
          if (montadoRef.current && conversaRef.current === conversaId) ir('/?nova=1');
        }
      },
      aoDesfazer: () => mostrarMensagens(ids),
      aoFalhar: () => {
        mostrarMensagens(ids);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagarMensagens(b, !!resposta) });
      },
    });
  };

  const apagarConversaPorId = (id: string) => {
    ir('/?nova=1');
    apagarComDesfazer({
      id,
      mostrar: toast,
      apagar: () => apagarConversa(id),
      aoDesfazer: () => ir(`/?c=${encodeURIComponent(id)}`),
      aoFalhar: () => {
        ir(`/?c=${encodeURIComponent(id)}`);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagarConversaPorId(id) });
      },
    });
  };

  // Depois de apagar: foco no balão vizinho; sem vizinho, no campo (mouse) ou em "+ Nova" (celular: focar o campo abriria o teclado).
  useEffect(() => {
    if (pedidoFoco.n === 0) return;
    const alvo =
      (pedidoFoco.id && document.querySelector<HTMLElement>(`[data-mensagem-id="${pedidoFoco.id}"] .balao`)) ||
      (window.matchMedia('(pointer: coarse)').matches ? document.querySelector<HTMLElement>('.chat__nova') : campoRef.current);
    alvo?.focus({ preventScroll: true });
  }, [pedidoFoco]);

  const bolhaDaFolha = folha ? visiveis.find((b) => b.id === folha.id) ?? null : null;
  // A folha fecha sozinha se a mensagem sumiu (ex.: Desfazer de outra, ou a conversa mudou).
  useEffect(() => {
    if (folha && !bolhaDaFolha) setFolha(null);
  }, [folha, bolhaDaFolha]);

  const aoCopiar = async (b: Bolha) => {
    setFolha(null);
    toast((await copiarTexto(b.texto)) ? 'Copiado.' : 'Não foi possível copiar.');
  };

  // Menu ⋯ do topo: ao abrir o foco vai ao 1º item (ou ao menu, se estiver desabilitado); setas, Home e End andam entre os itens;
  // Esc fecha (o foco volta ao ⋯) e tocar fora também.
  useEffect(() => {
    if (!menuTopo) return;
    const menu = document.querySelector<HTMLElement>('.chat__menu');
    (menu?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? menu)?.focus();
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuTopo(false);
      document.querySelector<HTMLElement>('.chat__mais')?.focus();
    };
    const aoTocar = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('.chat__menu, .chat__mais')) setMenuTopo(false);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocar);
    };
  }, [menuTopo]);

  const vazio = carga === 'ok' && visiveis.length === 0;
  const podeEnviar = !!texto.trim() && !ocupado && !semRede;

  return (
    <section className="chat">
      <header className="chat__topo">
        <button type="button" className="chat__icone" aria-label="Histórico" onClick={() => setGavetaAberta(true)}>
          ☰
        </button>
        <h1 className="chat__titulo">{conversa.titulo ?? 'Nova conversa'}</h1>
        {conversa.modo === 'decidir' && <span className="chat__selo">Modo decisão</span>}
        <Botao variante="link" className="chat__nova" onClick={() => ir('/?nova=1')}>
          + Nova
        </Botao>
        {conversa.id && carga === 'ok' && (
          <>
            <button type="button" className="chat__mais" aria-label="Mais opções da conversa" aria-haspopup="menu" aria-expanded={menuTopo} onClick={() => setMenuTopo((v) => !v)}>
              ⋯
            </button>
            {menuTopo && (
              <div
                className="chat__menu"
                role="menu"
                tabIndex={-1}
                onKeyDown={(e) => {
                  const itens = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
                  if (!itens.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
                  e.preventDefault();
                  const i = itens.indexOf(document.activeElement as HTMLElement);
                  const n = itens.length;
                  const destino = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
                  itens[destino]!.focus();
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="chat__menu-item"
                  disabled={semRede || ocupado}
                  onClick={() => {
                    setMenuTopo(false);
                    apagarConversaPorId(conversa.id!);
                    // o ⋯ some junto com a conversa: o foco vai para "+ Nova" (nunca para o body)
                    setTimeout(() => document.querySelector<HTMLElement>('.chat__nova')?.focus({ preventScroll: true }), 0);
                  }}
                >
                  Apagar conversa
                </button>
              </div>
            )}
          </>
        )}
      </header>

      <div ref={listaRef} className="chat__mensagens" aria-live="polite">
        {carga === 'carregando' && <EsqueletoLista linhas={3} />}
        {carga === 'erro' && (
          <div className="estado-vazio">
            <p className="mensagem-erro">Não foi possível carregar.</p>
            <Botao onClick={recarregar}>Tentar de novo</Botao>
          </div>
        )}
        {vazio && conversa.modo === 'padrao' && (
          <div className="chat-vazio">
            <h2 className="chat-vazio__saudacao">{saudacao(usuario.nome, new Date())}</h2>
            <div className="atalhos">
              {ATALHOS.map((a) => (
                <Botao key={a.rotulo} className="atalho" disabled={ocupado || semRede} onClick={() => void enviarTexto(a.rotulo)}>
                  <span aria-hidden="true">{a.icone}</span> {a.rotulo}
                </Botao>
              ))}
              <Botao className="atalho" disabled={ocupado || semRede} onClick={() => void decidir()}>
                <span aria-hidden="true">⚖️</span> Preciso decidir
              </Botao>
            </div>
          </div>
        )}
        {vazio && conversa.modo === 'decidir' && (
          <div className="chat-vazio">
            <h2 className="chat-vazio__saudacao">Modo decisão</h2>
            <p className="texto-2">Conte qual é a decisão. Vou fazer até 3 perguntas, mostrar prós e contras e dar uma recomendação.</p>
          </div>
        )}
        {visiveis.flatMap((b, i) => [
          ...(separadores[i] ? [<div key={`dia-${b.id}`} className="separador-dia"><span>{separadores[i]}</span></div>] : []),
          <Balao
            key={b.id}
            bolha={b}
            fuso={fuso}
            aoTentarDeNovo={() => void tentarDeNovo()}
            aoAbrirAcoes={podeAbrirAcoes(b, i) ? (bolha, origem) => setFolha({ id: bolha.id, origem }) : undefined}
          />,
          // Chave pelo id da sugestão: o cartão não é remontado quando a resposta ganha o id definitivo.
          ...(b.sugestoes ?? []).map((s) => <CartaoSugestao key={s.id} sugestao={s} aoMudar={atualizarSugestao} />),
        ])}
        <div ref={fimRef} />
      </div>

      <form ref={rodapeRef} className="chat__rodape" onSubmit={aoEnviar}>
        <label className="so-leitor" htmlFor="campo-mensagem">
          Mensagem para o José
        </label>
        <textarea
          id="campo-mensagem"
          ref={campoRef}
          className="chat__campo"
          rows={1}
          maxLength={LIMITE_MENSAGEM}
          placeholder={semRede ? 'Sem conexão' : 'Fale com o José…'}
          value={texto}
          disabled={semRede}
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={aoTeclar}
        />
        <Botao variante="principal" type="submit" className="chat__enviar" aria-label="Enviar" disabled={!podeEnviar}>
          ➤
        </Botao>
      </form>

      {folha && bolhaDaFolha && (
        <FolhaAcoes
          origem={folha.origem}
          comResposta={!!respostaDe(bolhaDaFolha)}
          semRede={semRede}
          aoFechar={() => setFolha(null)}
          aoCopiar={() => void aoCopiar(bolhaDaFolha)}
          aoApagar={() => {
            setFolha(null);
            apagarMensagens(bolhaDaFolha, false);
          }}
          aoApagarComResposta={() => {
            setFolha(null);
            apagarMensagens(bolhaDaFolha, true);
          }}
        />
      )}

      <GavetaHistorico
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        conversaAtualId={conversa.id}
        aoAbrir={(id) => {
          setGavetaAberta(false);
          ir(`/?c=${encodeURIComponent(id)}`);
        }}
        aoApagarAtual={() => {
          setGavetaAberta(false);
          ir('/?nova=1');
        }}
      />
    </section>
  );
}
