// Estado do Chat: carrega a conversa, envia mensagens em streaming e cuida de erros e "Tentar de novo".
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversaCompleta, ModoConversa } from '@compartilhado/schemas';
import { ErroHttp, ErroRede } from '../api/cliente';
import {
  abrirConversa, conversaDeHoje, criarConversa, enviarMensagem, ErroInterrompido, type EventoChat, type MensagemParaEnviar,
} from '../api/conversas';
import { limparRascunho, salvarRascunho } from './rascunho';

export type TipoErroBolha = 'ia' | 'rede' | 'interrompida' | 'limite' | 'sessao';
export interface Bolha {
  id: string;
  autor: 'marco' | 'jose';
  texto: string;
  origem: 'texto' | 'voz';
  estado: 'ok' | 'transmitindo' | 'erro';
  erro?: { tipo: TipoErroBolha; mensagem: string };
}
export interface ConversaAberta {
  id: string | null;
  titulo: string | null;
  modo: ModoConversa;
}
export type Carga = 'carregando' | 'ok' | 'erro';

export const MENSAGEM_LIMITE_DIARIO = 'Limite de hoje atingido, volta amanhã.';
const ID_TEMPORARIO = 'resposta-em-andamento';

const bolhaDe = (m: ConversaCompleta['mensagens'][number]): Bolha => ({ id: m.id, autor: m.autor, texto: m.texto, origem: m.origem, estado: 'ok' });

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
        if (!dados) {
          reiniciar({ id: null, titulo: null, modo: 'padrao' });
        } else {
          reiniciar({ id: dados.conversa.id, titulo: dados.conversa.titulo, modo: dados.conversa.modo });
          const lista = dados.mensagens.map(bolhaDe);
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
        else if (ev.tipo === 'fim') {
          pendenteRef.current = null;
          atualizarResposta((b) => ({ ...b, id: ev.mensagemId, estado: 'ok' }));
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
        { id: msg.id, autor: 'marco', texto: t, origem, estado: 'ok' },
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

  return { geracao, carga, conversa, bolhas, ocupado, enviar, tentarDeNovo, iniciarDecisao, recarregar };
}
