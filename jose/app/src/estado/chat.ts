// Estado do Chat: carrega a conversa, envia mensagens em streaming e cuida de erros e "Tentar de novo".
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversaCompleta, ModoConversa } from '@compartilhado/schemas';
import { ErroHttp, ErroRede } from '../api/cliente';
import {
  abrirConversa, conversaDeHoje, criarConversa, enviarMensagem, ErroInterrompido, type EventoChat, type MensagemParaEnviar,
} from '../api/conversas';
import { estaPendente } from './apagar-com-desfazer';
import { limparRascunho, salvarRascunho } from './rascunho';
import { bolhaDe, ID_TEMPORARIO, mesclarComServidor } from './reconciliar';

export type TipoErroBolha = 'ia' | 'rede' | 'interrompida' | 'limite' | 'sessao';
/** Cartão de sugestão ligado a uma resposta do José. */
export interface SugestaoDoChat {
  id: string;
  tipo: 'tarefa' | 'meta' | 'memoria';
  conteudo: unknown;
  status: 'pendente' | 'salva' | 'descartada';
  /** Memória criada quando a sugestão foi salva (se já foi). */
  itemId?: string | null;
}
export interface Bolha {
  id: string;
  autor: 'marco' | 'jose';
  texto: string;
  origem: 'texto' | 'voz';
  estado: 'ok' | 'transmitindo' | 'erro';
  erro?: { tipo: TipoErroBolha; mensagem: string };
  /** Cartões de sugestão desta resposta (no máximo 3). */
  sugestoes?: SugestaoDoChat[];
  /** Instante (ISO) em que a mensagem foi enviada/recebida; a resposta em andamento ainda não tem. */
  criadaEm?: string;
}
export interface ConversaAberta {
  id: string | null;
  titulo: string | null;
  modo: ModoConversa;
}
export type Carga = 'carregando' | 'ok' | 'erro';

export const MENSAGEM_LIMITE_DIARIO = 'Limite de hoje atingido, volta amanhã.';

function erroDeExcecao(e: unknown): NonNullable<Bolha['erro']> {
  if (e instanceof ErroHttp && e.status === 401) return { tipo: 'sessao', mensagem: 'Sua sessão expirou.' };
  if (e instanceof ErroHttp && e.status === 429 && e.codigo === 'limite_diario') return { tipo: 'limite', mensagem: MENSAGEM_LIMITE_DIARIO };
  if (e instanceof ErroRede) return { tipo: 'rede', mensagem: 'Sem conexão.' };
  if (e instanceof ErroInterrompido) return { tipo: 'interrompida', mensagem: 'A resposta foi interrompida.' };
  return { tipo: 'ia', mensagem: 'O José não conseguiu responder agora.' };
}

interface Opcoes {
  /** `?c=` da URL, ou null. */
  idUrl: string | null;
  /** `?nova=1`: abre o Chat vazio. */
  nova: boolean;
  /** Chamado quando uma conversa é criada aqui (a URL passa a apontar para ela). */
  aoCriar: (id: string) => void;
}

export function useChat({ idUrl, nova, aoCriar }: Opcoes) {
  const [carga, setCarga] = useState<Carga>('carregando');
  const [tentativaCarga, setTentativaCarga] = useState(0);
  const [conversa, setConversa] = useState<ConversaAberta>({ id: null, titulo: null, modo: 'padrao' });
  const [bolhas, setBolhas] = useState<Bolha[]>([]);
  const [ocupado, setOcupado] = useState(false);
  /** Sobe a cada conversa carregada/aberta (não quando uma conversa nova é criada ao enviar). */
  const [geracao, setGeracao] = useState(0);

  const conversaRef = useRef(conversa);
  const pendenteRef = useRef<MensagemParaEnviar | null>(null);
  const abortoRef = useRef<AbortController | null>(null);
  const aoCriarRef = useRef(aoCriar);
  aoCriarRef.current = aoCriar;

  const definirConversa = useCallback((c: ConversaAberta) => {
    conversaRef.current = c;
    setConversa(c);
  }, []);

  const reiniciar = useCallback(
    (c: ConversaAberta) => {
      abortoRef.current?.abort();
      pendenteRef.current = null;
      definirConversa(c);
      setBolhas([]);
      setOcupado(false);
      setGeracao((g) => g + 1);
    },
    [definirConversa],
  );

  // Carrega: ?nova=1 → vazio; ?c=ID → essa conversa; senão a "conversa de hoje" (regra 12).
  useEffect(() => {
    if (nova) {
      reiniciar({ id: null, titulo: null, modo: 'padrao' });
      setCarga('ok');
      return;
    }
    if (idUrl && idUrl === conversaRef.current.id) return; // acabou de ser criada aqui
    let cancelado = false;
    setCarga('carregando');
    (idUrl ? abrirConversa(idUrl) : conversaDeHoje())
      .then((dados) => {
        if (cancelado) return;
        // Uma conversa que o Marco acabou de apagar (ainda nos 5 s do Desfazer) não volta como "conversa de hoje".
        if (!dados || estaPendente(dados.conversa.id)) {
          reiniciar({ id: null, titulo: null, modo: 'padrao' });
        } else {
          reiniciar({ id: dados.conversa.id, titulo: dados.conversa.titulo, modo: dados.conversa.modo });
          const lista = dados.mensagens.map((m) => bolhaDe(m, dados.sugestoes));
          const ultima = dados.mensagens.at(-1);
          // A última mensagem é do Marco, sem resposta (falhou antes): oferece "Tentar de novo" com o mesmo id.
          if (ultima?.autor === 'marco') {
            pendenteRef.current = { id: ultima.id, texto: ultima.texto, origem: ultima.origem };
            lista.push({ id: ID_TEMPORARIO, autor: 'jose', texto: '', origem: 'texto', estado: 'erro', erro: { tipo: 'ia', mensagem: 'O José não conseguiu responder agora.' } });
          }
          setBolhas(lista);
        }
        setCarga('ok');
      })
      .catch(() => {
        if (!cancelado) setCarga('erro');
      });
    return () => {
      cancelado = true;
    };
  }, [idUrl, nova, tentativaCarga, reiniciar]);

  useEffect(() => () => abortoRef.current?.abort(), []);

  const atualizarResposta = useCallback((mudar: (b: Bolha) => Bolha) => {
    setBolhas((lista) => lista.map((b) => (b.id === ID_TEMPORARIO ? mudar(b) : b)));
  }, []);

  const executar = useCallback(
    async (msg: MensagemParaEnviar) => {
      setOcupado(true);
      const ctl = new AbortController();
      abortoRef.current = ctl;
      let rascunhoLimpo = false;
      const aoEvento = (ev: EventoChat) => {
        // O servidor já recebeu a mensagem: o rascunho cumpriu o papel (em 401 ele continua guardado).
        if (!rascunhoLimpo) {
          rascunhoLimpo = true;
          limparRascunho(conversaRef.current.id);
        }
        if (ev.tipo === 'texto') atualizarResposta((b) => ({ ...b, texto: b.texto + ev.delta }));
        else if (ev.tipo === 'sugestao') {
          // O servidor manda no máximo 3; o app também limita (um repetido por reenvio não duplica o cartão).
          atualizarResposta((b) => {
            const atuais = b.sugestoes ?? [];
            if (atuais.length >= 3 || atuais.some((x) => x.id === ev.id)) return b;
            return { ...b, sugestoes: [...atuais, { id: ev.id, tipo: ev.sugestaoTipo, conteudo: ev.conteudo, status: ev.status, itemId: ev.itemId }] };
          });
        } else if (ev.tipo === 'fim') {
          pendenteRef.current = null;
          atualizarResposta((b) => ({ ...b, id: ev.mensagemId, estado: 'ok', criadaEm: new Date().toISOString() }));
          if (ev.titulo) definirConversa({ ...conversaRef.current, titulo: ev.titulo });
        } else if (ev.tipo === 'erro') {
          atualizarResposta((b) => ({ ...b, estado: 'erro', erro: { tipo: 'ia', mensagem: ev.mensagem } }));
        }
      };
      try {
        if (!conversaRef.current.id) {
          const { id } = await criarConversa(conversaRef.current.modo);
          // O rascunho da conversa nova passa para a conversa criada (vale também se vier um 401 em seguida).
          salvarRascunho(id, msg.texto);
          limparRascunho(null);
          definirConversa({ ...conversaRef.current, id });
          aoCriarRef.current(id);
        }
        await enviarMensagem(conversaRef.current.id!, msg, aoEvento, ctl.signal);
      } catch (e) {
        if (ctl.signal.aborted) return;
        const erro = erroDeExcecao(e);
        atualizarResposta((b) => ({ ...b, estado: 'erro', erro }));
      } finally {
        if (abortoRef.current === ctl) setOcupado(false);
      }
    },
    [atualizarResposta, definirConversa],
  );

  const enviar = useCallback(
    async (texto: string, origem: 'texto' | 'voz' = 'texto') => {
      const t = texto.trim();
      if (!t || ocupado) return false;
      const msg: MensagemParaEnviar = { id: crypto.randomUUID(), texto: t, origem };
      pendenteRef.current = msg;
      // Guarda como rascunho até o servidor confirmar: um 401 não pode perder o que foi escrito.
      salvarRascunho(conversaRef.current.id, t);
      setBolhas((l) => [
        ...l.filter((b) => b.id !== ID_TEMPORARIO),
        { id: msg.id, autor: 'marco', texto: t, origem, estado: 'ok', criadaEm: new Date().toISOString() },
        { id: ID_TEMPORARIO, autor: 'jose', texto: '', origem: 'texto', estado: 'transmitindo' },
      ]);
      await executar(msg);
      return true;
    },
    [executar, ocupado],
  );

  const tentarDeNovo = useCallback(async () => {
    const msg = pendenteRef.current;
    if (!msg || ocupado) return;
    setBolhas((l) => {
      const semErro = l.filter((b) => b.id !== ID_TEMPORARIO);
      return [...semErro, { id: ID_TEMPORARIO, autor: 'jose', texto: '', origem: 'texto', estado: 'transmitindo' }];
    });
    await executar(msg); // mesmo id: o servidor não duplica a mensagem do Marco
  }, [executar, ocupado]);

  /** "⚖️ Preciso decidir": cria a conversa em modo decisão (respondida pelo modelo profundo). */
  const iniciarDecisao = useCallback(async (): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(true);
    try {
      const { id } = await criarConversa('decidir');
      definirConversa({ id, titulo: null, modo: 'decidir' });
      aoCriarRef.current(id);
      return true;
    } catch {
      return false;
    } finally {
      setOcupado(false);
    }
  }, [definirConversa, ocupado]);

  const recarregar = useCallback(() => setTentativaCarga((n) => n + 1), []);

  /** Atualiza o status de um cartão (salvo/descartado) e, ao salvar, o conteúdo que ficou valendo. */
  const atualizarSugestao = useCallback((id: string, mudanca: Partial<Pick<SugestaoDoChat, 'status' | 'conteudo'>>) => {
    setBolhas((lista) => lista.map((b) => (b.sugestoes?.some((s) => s.id === id) ? { ...b, sugestoes: b.sugestoes.map((s) => (s.id === id ? { ...s, ...mudanca } : s)) } : b)));
  }, []);

  /**
   * Lê a conversa no servidor e troca as mensagens mostradas pelas dele (sem perder a resposta em andamento, a mensagem
   * ainda não gravada nem o que acabou de chegar). Devolve os ids que o servidor tem, ou null se não deu para ler.
   */
  const reconciliar = useCallback(async (): Promise<Set<string> | null> => {
    const id = conversaRef.current.id;
    if (!id) return null;
    try {
      const dados = await abrirConversa(id);
      if (conversaRef.current.id !== id) return null; // o Marco já abriu outra conversa
      setBolhas((atual) => mesclarComServidor(atual, dados, { pendenteId: pendenteRef.current?.id }));
      return new Set(dados.mensagens.map((m) => m.id));
    } catch {
      return null;
    }
  }, []);

  /** Tira da lista as mensagens que a API já apagou. */
  const removerBolhas = useCallback((ids: string[]) => setBolhas((l) => l.filter((b) => !ids.includes(b.id))), []);

  return { geracao, carga, conversa, bolhas, ocupado, enviar, tentarDeNovo, iniciarDecisao, recarregar, atualizarSugestao, removerBolhas, reconciliar };
}
