import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FUSO_PADRAO, saudacao, separadoresDeDia } from '@compartilhado/datas';
import { LIMITE_MENSAGEM } from '@compartilhado/schemas';
import { Balao } from '../componentes/Balao';
import { BarraGravacao } from '../componentes/BarraGravacao';
import { Botao } from '../componentes/Botao';
import { BotaoAcaoChat, type ModoAcao } from '../componentes/BotaoAcaoChat';
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
import { avisoDoEstado, AVISO_CANCELADA, ehIos, emAndamento } from '../estado/gravacao';
import { useGravadorVoz } from '../estado/gravador-voz';
import { assinarConversasApagadas, conversaApagada, confirmarConversaApagada, consumirAviso, desmarcarPendenteDeApagar, marcarPendenteDeApagar, versaoConversasApagadas } from '../estado/conversas-apagadas';
import { assinarOcultas, mensagemOculta, mostrarMensagens, ocultarMensagens, versaoOcultas } from '../estado/mensagens-ocultas';
import { useOnline } from '../estado/online';
import { limparRascunho, lerRascunho, salvarRascunho } from '../estado/rascunho';
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

  const { geracao, carga, conversa, bolhas, ocupado, enviar, tentarDeNovo, iniciarDecisao, recarregar, atualizarSugestao, removerBolhas, reconciliar } = useChat({
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
  const ocupadoRef = useRef(false);
  ocupadoRef.current = ocupado;
  const cargaRef = useRef(carga);
  cargaRef.current = carga;
  // Ao voltar o app para a frente (o PWA do iPhone reabre sem recarregar), confere a conversa aberta com o servidor.
  // Nunca durante o envio/streaming, e sem mexer no campo de digitação (só a lista de mensagens é trocada).
  useEffect(() => {
    let ultima = 0;
    const aoVisivel = () => {
      if (document.visibilityState !== 'visible' || !conversaRef.current || ocupadoRef.current || cargaRef.current !== 'ok') return;
      if (Date.now() - ultima < 2000) return;
      ultima = Date.now();
      void reconciliar();
    };
    document.addEventListener('visibilitychange', aoVisivel);
    return () => document.removeEventListener('visibilitychange', aoVisivel);
  }, [reconciliar]);
  // A conversa aberta foi apagada (a exclusão da conversa vazia terminou, ou o servidor disse que ela não existe mais):
  // vai ao Chat vazio, levando o que o Marco já tinha digitado. Não faz nada durante um envio em andamento.
  useSyncExternalStore(assinarConversasApagadas, versaoConversasApagadas);
  const idAberta = conversa.id;
  const apagadaAgora = !!idAberta && conversaApagada(idAberta);
  useEffect(() => {
    if (!idAberta || !apagadaAgora || ocupado) return;
    const aviso = consumirAviso(idAberta);
    if (aviso) toast(aviso);
    if (textoRef.current.trim()) salvarRascunho(null, textoRef.current);
    limparRascunho(idAberta);
    ir('/?nova=1', { replace: true });
  }, [idAberta, apagadaAgora, ocupado, ir, toast]);
  const semRedeRef = useRef(false);
  const semRede = !online || (estado.situacao === 'logado' && estado.offline);
  semRedeRef.current = semRede;

  // O rascunho da conversa aberta volta para o campo (ex.: depois de um 401 e novo login), mas nunca por cima
  // do que o Marco digitou enquanto a conversa carregava: nesse caso o texto fica e passa a ser o rascunho dela.
  const textoRef = useRef('');
  textoRef.current = texto;

  // ---- Voz (telas.md, Chat): 🎤 grava, ■ envia; o texto transcrito vai como mensagem com origem = voz. ----
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  const aoTextoVoz = (t: string) => {
    if (semRedeRef.current || ocupadoRef.current) {
      // O José ainda está respondendo (ou a rede caiu): o texto não se perde, vai para o campo para o Marco enviar.
      const atual = textoRef.current;
      const novo = atual.trim() ? `${atual}\n${t}` : t;
      setTexto(novo);
      salvarRascunho(conversaRef.current, novo);
      toast('Texto pronto no campo. Toque em enviar.');
      return;
    }
    void enviarRef.current(t, 'voz');
  };
  const voz = useGravadorVoz({ aoTexto: aoTextoVoz, aoAvisar: toast });
  const gravandoVoz = voz.estado.tipo === 'gravando';
  const transcrevendoVoz = voz.estado.tipo === 'transcrevendo';
  const vozAtiva = emAndamento(voz.estado);
  const ios = ehIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

  // Avisos da voz (toast): falha, vazio, limite, negado, saiu da tela. Se o app está escondido, mostra ao voltar.
  useEffect(() => {
    const aviso = avisoDoEstado(voz.estado, { ios });
    if (!aviso) return;
    const mostrar = () => toast(aviso, undefined, aviso.length > 60 ? 7000 : undefined);
    if (document.visibilityState !== 'hidden') {
      mostrar();
      return;
    }
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', aoVoltar);
      mostrar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [voz.estado, ios, toast]);

  // Trocar de conversa (☰, ✎, apagar) cancela o que foi gravado: não vale para a outra conversa.
  const cancelarVozRef = useRef(voz.cancelarTudo);
  cancelarVozRef.current = voz.cancelarTudo;
  useEffect(() => {
    cancelarVozRef.current(AVISO_CANCELADA);
  }, [geracao]);

  // Esc cancela a gravação (a menos que uma folha, o menu ⋯ ou a gaveta estejam abertos: aí o Esc fecha só eles).
  const sobreposicaoRef = useRef(false);
  sobreposicaoRef.current = !!folha || menuTopo || gavetaAberta;
  const cancelarGravacao = voz.cancelar;
  useEffect(() => {
    if (voz.estado.tipo !== 'gravando' && voz.estado.tipo !== 'preparando') return;
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || sobreposicaoRef.current) return;
      cancelarGravacao();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [voz.estado.tipo, cancelarGravacao]);

  // O ✕ some ao cancelar: o foco volta ao botão de ação (nunca fica no body).
  const eraGravando = useRef(false);
  useEffect(() => {
    if (eraGravando.current && !gravandoVoz) {
      const alvo = document.querySelector<HTMLElement>('.chat__acao');
      if (!document.activeElement || document.activeElement === document.body) alvo?.focus({ preventScroll: true });
    }
    eraGravando.current = gravandoVoz;
  }, [gravandoVoz]);
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
    if (!texto.trim() || ocupado || semRede || vozAtiva) return;
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
    // Se não sobra nenhuma mensagem, a conversa também vai ser apagada: marca no módulo global (vale para o Chat remontado).
    const ficaVazia = visiveis.every((x) => ids.includes(x.id));
    if (ficaVazia && conversaId) marcarPendenteDeApagar(conversaId);
    ocultarMensagens(ids);
    apagarComDesfazer({
      id: b.id,
      mostrar: toast,
      apagar: async () => {
        const apagouAConversa = await apagarMensagem(b.id, !!resposta);
        removerBolhas(ids);
        if (apagouAConversa) {
          // Era a última mensagem: o servidor apagou a conversa vazia junto. Quem estiver com ela aberta (mesmo um Chat
          // remontado depois) vai ao Chat vazio, pelo módulo global (o componente que agendou pode já não existir).
          toast('Conversa vazia apagada.');
          if (conversaId) confirmarConversaApagada(conversaId);
          return;
        }
        if (conversaId) desmarcarPendenteDeApagar(conversaId);
        // Rede de segurança: confere com o servidor. Se a mensagem "apagada" ainda existe lá, não a deixa sumida:
        // o erro cai em aoFalhar ("Não foi possível apagar." + Tentar de novo) e a mensagem volta à tela.
        const noServidor = await reconciliar();
        if (noServidor && ids.some((i) => noServidor.has(i))) throw new Error('A mensagem ainda existe no servidor.');
      },
      aoDesfazer: () => {
        mostrarMensagens(ids);
        if (conversaId) desmarcarPendenteDeApagar(conversaId);
      },
      aoFalhar: () => {
        mostrarMensagens(ids);
        if (conversaId) desmarcarPendenteDeApagar(conversaId);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagarMensagens(b, !!resposta) });
      },
    });
  };

  const apagarConversaPorId = (id: string) => {
    // Nos 5 s do Desfazer a conversa já não pode ser reaberta (nem por um Chat remontado); confirmada, é definitiva.
    marcarPendenteDeApagar(id);
    ir('/?nova=1');
    apagarComDesfazer({
      id,
      mostrar: toast,
      apagar: async () => {
        await apagarConversa(id);
        confirmarConversaApagada(id);
      },
      aoDesfazer: () => {
        desmarcarPendenteDeApagar(id);
        ir(`/?c=${encodeURIComponent(id)}`);
      },
      aoFalhar: () => {
        desmarcarPendenteDeApagar(id);
        ir(`/?c=${encodeURIComponent(id)}`);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagarConversaPorId(id) });
      },
    });
  };

  // Depois de apagar: foco no balão vizinho; sem vizinho, no campo (mouse) ou em "Nova conversa" (celular: focar o campo abriria o teclado).
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
  // Botão único à direita do campo (como no WhatsApp): vazio = 🎤; com texto = Enviar; gravando = ■; transcrevendo = ocupado.
  const modoAcao: ModoAcao = gravandoVoz ? 'parar' : transcrevendoVoz ? 'transcrevendo' : texto.trim() ? 'enviar' : 'microfone';
  const acaoDesabilitada = modoAcao === 'enviar' ? !podeEnviar : semRede || ocupado;

  return (
    <section className="chat">
      <header className="chat__topo">
        <button type="button" className="chat__icone" aria-label="Histórico" onClick={() => setGavetaAberta(true)}>
          ☰
        </button>
        <h1 className="chat__titulo">{conversa.titulo ?? 'Nova conversa'}</h1>
        {conversa.modo === 'decidir' && <span className="chat__selo">Modo decisão</span>}
        <button type="button" className="chat__nova" aria-label="Nova conversa" title="Nova conversa" onClick={() => ir('/?nova=1')}>
          <svg className="chat__nova-icone" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
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
                    // o ⋯ some junto com a conversa: o foco vai para "Nova conversa" (nunca para o body)
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
                <Botao key={a.rotulo} className="atalho" disabled={ocupado || semRede || vozAtiva} onClick={() => void enviarTexto(a.rotulo)}>
                  <span aria-hidden="true">{a.icone}</span> {a.rotulo}
                </Botao>
              ))}
              <Botao className="atalho" disabled={ocupado || semRede || vozAtiva} onClick={() => void decidir()}>
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

      <form ref={rodapeRef} className="chat__rodape" data-voz={gravandoVoz ? 'gravando' : transcrevendoVoz ? 'transcrevendo' : undefined} onSubmit={aoEnviar}>
        {gravandoVoz || transcrevendoVoz ? (
          <>
            <BarraGravacao fase={gravandoVoz ? 'gravando' : 'transcrevendo'} restanteMs={voz.restanteMs} aoCancelar={voz.cancelar} />
            {gravandoVoz && (
              <span className="so-leitor" role="status">
                Gravando áudio. Toque em parar para enviar.
              </span>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
        <BotaoAcaoChat modo={modoAcao} desabilitado={acaoDesabilitada} aoMicrofone={() => void voz.iniciar()} aoEnviar={() => aoEnviar()} aoParar={voz.parar} />
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
