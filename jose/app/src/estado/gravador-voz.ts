// Gravador de voz: liga a máquina de estados (gravacao.ts) ao MediaRecorder do navegador.
// Regras (telas.md, Chat): toque para gravar e toque para parar; o microfone é SEMPRE liberado ao cancelar, enviar,
// sair da tela, trocar de rota e desmontar; nenhum timer fica solto; o áudio só existe em memória.
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ErroHttp, ErroRede } from '../api/cliente';
import { transcreverAudio } from '../api/voz';
import { AVISO_CANCELADA, DURACAO_MAXIMA_MS, duracaoUtil, ehIos, escolherTipoAudio, ESTADO_INICIAL, reduzir, restanteMs, tempoAcabou, tipoDoArquivo, type MotivoErro } from './gravacao';

/** Pontos de injeção (trocados nos testes). Os padrões vêm do navegador. */
export interface PlataformaVoz {
  temSuporte: () => boolean;
  pedirMicrofone: () => Promise<MediaStream>;
  criarGravador: (fluxo: MediaStream, tipo: string) => MediaRecorder;
  tipoSuportado: (tipo: string) => boolean;
  ios: () => boolean;
  agora: () => number;
  visivel: () => boolean;
  transcrever: (audio: Blob, duracaoMs: number, sinal?: AbortSignal) => Promise<string>;
}

export function plataformaDoNavegador(): PlataformaVoz {
  return {
    temSuporte: () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    pedirMicrofone: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    criarGravador: (fluxo, tipo) => new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined),
    tipoSuportado: (tipo) => MediaRecorder.isTypeSupported(tipo),
    ios: () => ehIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    agora: () => Date.now(),
    visivel: () => document.visibilityState !== 'hidden',
    transcrever: transcreverAudio,
  };
}

/** Intervalo do contador. O tempo vem do relógio (Date.now), então um tique atrasado não desvia a contagem. */
const TIQUE_MS = 200;
/** Se o gravador não avisar que parou (bug raro do iOS), a transcrição não fica "carregando" para sempre. */
const ESPERA_PARADA_MS = 5000;

interface Sessao {
  fase: 'preparando' | 'gravando' | 'transcrevendo';
  fluxo?: MediaStream;
  gravador?: MediaRecorder;
  pedacos: Blob[];
  tipo: string;
  inicioMs: number;
  duracaoMs: number;
  descartar: boolean;
  aborto: AbortController;
  vigia?: ReturnType<typeof setTimeout>;
}

const motivoDoErro = (e: unknown): Extract<MotivoErro, 'transcricao' | 'limite' | 'rede' | 'sessao'> => {
  if (e instanceof ErroHttp && e.status === 401) return 'sessao';
  if (e instanceof ErroHttp && e.status === 429) return 'limite';
  if (e instanceof ErroRede) return 'rede';
  return 'transcricao';
};
const foiNegado = (e: unknown) => ['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes((e as { name?: string } | null)?.name ?? '');

/** Para tudo o que a sessão segura: vigia, pedido de rede, gravador e as trilhas do microfone (o ponto laranja do iPhone apaga). */
function encerrar(s: Sessao, opcoes: { descartando: boolean }) {
  clearTimeout(s.vigia);
  if (opcoes.descartando) {
    s.descartar = true;
    s.aborto.abort();
    if (s.gravador) s.gravador.ondataavailable = s.gravador.onstop = s.gravador.onerror = null;
    s.pedacos = [];
  }
  try {
    if (s.gravador && s.gravador.state !== 'inactive') s.gravador.stop();
  } catch {
    /* já parado */
  }
  s.fluxo?.getTracks().forEach((t) => t.stop());
}

export interface OpcoesGravador {
  /** Texto transcrito (já sem espaços nas pontas e nunca vazio): o Chat o envia como mensagem de voz. */
  aoTexto: (texto: string) => void;
  /** Aviso fora do estado (ex.: o Chat foi desmontado com uma gravação em andamento). */
  aoAvisar: (mensagem: string) => void;
  plataforma?: PlataformaVoz;
}

export function useGravadorVoz({ aoTexto, aoAvisar, plataforma }: OpcoesGravador) {
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL);
  const sessaoRef = useRef<Sessao | null>(null);
  const aoTextoRef = useRef(aoTexto);
  aoTextoRef.current = aoTexto;
  const aoAvisarRef = useRef(aoAvisar);
  aoAvisarRef.current = aoAvisar;
  const plataformaRef = useRef(plataforma);
  plataformaRef.current = plataforma;
  const pl = () => plataformaRef.current ?? plataformaDoNavegador();

  const transcrever = useCallback(async (s: Sessao, audio: Blob) => {
    try {
      const texto = (await pl().transcrever(audio, s.duracaoMs, s.aborto.signal)).trim();
      if (sessaoRef.current !== s) return; // cancelada ou desmontada enquanto transcrevia
      sessaoRef.current = null;
      despachar({ tipo: 'transcrito', texto });
      if (texto) aoTextoRef.current(texto);
    } catch (e) {
      if (sessaoRef.current !== s) return;
      sessaoRef.current = null;
      despachar({ tipo: 'transcricao_falhou', motivo: motivoDoErro(e) });
    }
  }, []);

  const iniciar = useCallback(async () => {
    if (sessaoRef.current) return; // já há gravação/transcrição (toque duplo)
    const p = pl();
    if (!p.temSuporte()) {
      despachar({ tipo: 'sem_suporte' });
      return;
    }
    const s: Sessao = { fase: 'preparando', pedacos: [], tipo: '', inicioMs: 0, duracaoMs: 0, descartar: false, aborto: new AbortController() };
    sessaoRef.current = s;
    despachar({ tipo: 'tocou_microfone' });

    let fluxo: MediaStream;
    try {
      fluxo = await p.pedirMicrofone();
    } catch (e) {
      if (sessaoRef.current === s) {
        sessaoRef.current = null;
        despachar(foiNegado(e) ? { tipo: 'microfone_negado' } : { tipo: 'microfone_falhou' });
      }
      return;
    }
    s.fluxo = fluxo;
    if (sessaoRef.current !== s) {
      // Cancelada (ou o Chat saiu) enquanto o aparelho pedia a permissão: solta o microfone na hora.
      encerrar(s, { descartando: true });
      return;
    }
    if (!p.visivel()) {
      // O app foi para o segundo plano enquanto a permissão era pedida: não grava escondido.
      sessaoRef.current = null;
      encerrar(s, { descartando: true });
      despachar({ tipo: 'saiu_da_tela' });
      return;
    }

    try {
      const ios = p.ios();
      s.tipo = escolherTipoAudio(p.tipoSuportado, ios);
      const gravador = p.criarGravador(fluxo, s.tipo);
      s.gravador = gravador;
      gravador.ondataavailable = (e) => {
        if (e.data.size > 0) s.pedacos.push(e.data);
      };
      gravador.onstop = () => {
        clearTimeout(s.vigia);
        encerrar(s, { descartando: false }); // solta o microfone assim que o arquivo está fechado
        if (s.descartar || sessaoRef.current !== s) return;
        const audio = new Blob(s.pedacos, { type: tipoDoArquivo(gravador.mimeType, s.tipo, ios) });
        s.pedacos = [];
        void transcrever(s, audio);
      };
      gravador.onerror = () => {
        if (sessaoRef.current !== s) return;
        sessaoRef.current = null;
        encerrar(s, { descartando: true });
        despachar({ tipo: 'cancelou' });
        aoAvisarRef.current('Não foi possível gravar o áudio.');
      };
      gravador.start();
    } catch {
      sessaoRef.current = null;
      encerrar(s, { descartando: true });
      despachar({ tipo: 'microfone_falhou' });
      return;
    }
    s.fase = 'gravando';
    s.inicioMs = p.agora();
    despachar({ tipo: 'microfone_liberado', agoraMs: s.inicioMs });
  }, [transcrever]);

  /** ■ (ou o fim dos 2:00): para e envia. Menos de 1 s é descartado sem aviso. */
  const parar = useCallback(() => {
    const s = sessaoRef.current;
    if (!s || s.fase !== 'gravando') return;
    const agoraMs = pl().agora();
    s.duracaoMs = Math.min(Math.max(agoraMs - s.inicioMs, 0), DURACAO_MAXIMA_MS);
    despachar({ tipo: 'parou', agoraMs });
    if (!duracaoUtil(s.duracaoMs)) {
      sessaoRef.current = null;
      encerrar(s, { descartando: true });
      return;
    }
    s.fase = 'transcrevendo';
    s.vigia = setTimeout(() => {
      if (sessaoRef.current !== s) return;
      sessaoRef.current = null;
      encerrar(s, { descartando: true });
      despachar({ tipo: 'transcricao_falhou', motivo: 'transcricao' });
    }, ESPERA_PARADA_MS);
    // O microfone é solto no onstop (depois do último pedaço do arquivo); o vigia cobre o caso de ele nunca chegar.
    try {
      s.gravador?.stop();
    } catch {
      /* já parado */
    }
  }, []);

  /** ✕ (ou Esc): descarta o áudio. */
  const cancelar = useCallback(() => {
    const s = sessaoRef.current;
    if (!s || s.fase === 'transcrevendo') return;
    sessaoRef.current = null;
    encerrar(s, { descartando: true });
    despachar({ tipo: 'cancelou' });
  }, []);

  /** O Chat troca de conversa: nada que foi gravado vale para a outra. Cancela gravação e transcrição. */
  const cancelarTudo = useCallback((mensagem?: string) => {
    const s = sessaoRef.current;
    if (!s) return;
    sessaoRef.current = null;
    encerrar(s, { descartando: true });
    despachar({ tipo: 'cancelou' });
    if (mensagem) aoAvisarRef.current(mensagem);
  }, []);

  // O contador: um intervalo só enquanto grava (o efeito o limpa ao sair do estado, ao desmontar e a cada parada).
  const gravando = estado.tipo === 'gravando';
  useEffect(() => {
    if (!gravando) return;
    const id = setInterval(() => despachar({ tipo: 'tique', agoraMs: pl().agora() }), TIQUE_MS);
    return () => clearInterval(id);
  }, [gravando]);

  // Aos 2:00 para sozinho e envia.
  const acabou = tempoAcabou(estado);
  useEffect(() => {
    if (acabou) parar();
  }, [acabou, parar]);

  // O app foi para o segundo plano (trocou de app, bloqueou a tela): cancela a gravação e solta o microfone.
  useEffect(() => {
    const sair = () => {
      const s = sessaoRef.current;
      if (!s || s.fase !== 'gravando') return; // preparando: confere ao liberar o microfone (a permissão do iOS pode esconder a página um instante)
      sessaoRef.current = null;
      encerrar(s, { descartando: true });
      despachar({ tipo: 'saiu_da_tela' });
    };
    const aoMudar = () => {
      if (document.visibilityState === 'hidden') sair();
    };
    document.addEventListener('visibilitychange', aoMudar);
    window.addEventListener('pagehide', sair);
    return () => {
      document.removeEventListener('visibilitychange', aoMudar);
      window.removeEventListener('pagehide', sair);
    };
  }, []);

  // O Chat saiu da tela (trocou de aba/rota): cancela o que estiver em andamento e solta o microfone.
  useEffect(
    () => () => {
      const s = sessaoRef.current;
      if (!s) return;
      sessaoRef.current = null;
      encerrar(s, { descartando: true });
      aoAvisarRef.current(AVISO_CANCELADA);
    },
    [],
  );

  return { estado, restanteMs: restanteMs(estado), iniciar, parar, cancelar, cancelarTudo };
}
