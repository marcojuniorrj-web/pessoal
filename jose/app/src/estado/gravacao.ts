// Gravação de voz: lógica PURA (sem React, sem navegador). O hook `useGravadorVoz` liga isto ao MediaRecorder.
// Estados: ocioso, preparando (esperando o microfone/permissão), gravando, transcrevendo, erro e negado.

/** O app para a gravação aos 2:00 (telas.md). */
export const DURACAO_MAXIMA_MS = 120_000;
/** Áudio com menos de 1 s é descartado sem aviso. */
export const DURACAO_MINIMA_MS = 1_000;

export type MotivoErro = 'transcricao' | 'vazio' | 'limite' | 'rede' | 'sessao' | 'microfone' | 'sem_suporte' | 'saiu_da_tela';

export type EstadoGravacao =
  | { tipo: 'ocioso' }
  | { tipo: 'preparando' }
  | { tipo: 'gravando'; inicioMs: number; decorridoMs: number }
  | { tipo: 'transcrevendo'; duracaoMs: number }
  | { tipo: 'erro'; motivo: MotivoErro }
  | { tipo: 'negado' };

export type EventoGravacao =
  | { tipo: 'tocou_microfone' }
  | { tipo: 'microfone_liberado'; agoraMs: number }
  | { tipo: 'microfone_negado' }
  | { tipo: 'microfone_falhou' }
  | { tipo: 'sem_suporte' }
  | { tipo: 'tique'; agoraMs: number }
  /** ■ ou o fim dos 2:00. */
  | { tipo: 'parou'; agoraMs: number }
  | { tipo: 'cancelou' }
  | { tipo: 'saiu_da_tela' }
  | { tipo: 'transcrito'; texto: string }
  | { tipo: 'transcricao_falhou'; motivo: Extract<MotivoErro, 'transcricao' | 'limite' | 'rede' | 'sessao'> };

export const ESTADO_INICIAL: EstadoGravacao = { tipo: 'ocioso' };

const limitar = (ms: number) => Math.min(Math.max(ms, 0), DURACAO_MAXIMA_MS);
/** Segundos inteiros que faltam, arredondando para cima (de 120 a 0). */
const segundosQueFaltam = (decorridoMs: number) => Math.ceil((DURACAO_MAXIMA_MS - decorridoMs) / 1000);

/** O áudio é longo o bastante para ser enviado? */
export const duracaoUtil = (ms: number) => ms >= DURACAO_MINIMA_MS;

/** Transições. Evento que não faz sentido no estado atual é ignorado (devolve o mesmo estado). */
export function reduzir(estado: EstadoGravacao, ev: EventoGravacao): EstadoGravacao {
  const livre = estado.tipo === 'ocioso' || estado.tipo === 'erro' || estado.tipo === 'negado';
  switch (ev.tipo) {
    case 'tocou_microfone':
      return livre ? { tipo: 'preparando' } : estado;
    case 'sem_suporte':
      return livre || estado.tipo === 'preparando' ? { tipo: 'erro', motivo: 'sem_suporte' } : estado;
    case 'microfone_liberado':
      return estado.tipo === 'preparando' ? { tipo: 'gravando', inicioMs: ev.agoraMs, decorridoMs: 0 } : estado;
    case 'microfone_negado':
      return estado.tipo === 'preparando' ? { tipo: 'negado' } : estado;
    case 'microfone_falhou':
      return estado.tipo === 'preparando' ? { tipo: 'erro', motivo: 'microfone' } : estado;
    case 'tique': {
      if (estado.tipo !== 'gravando') return estado;
      const decorridoMs = limitar(ev.agoraMs - estado.inicioMs);
      // Só troca o estado quando o contador mostraria outro número (ou o tempo acabou): evita renderizar a cada tique.
      return segundosQueFaltam(decorridoMs) === segundosQueFaltam(estado.decorridoMs) ? estado : { ...estado, decorridoMs };
    }
    case 'parou': {
      if (estado.tipo !== 'gravando') return estado;
      const duracaoMs = limitar(ev.agoraMs - estado.inicioMs);
      return duracaoUtil(duracaoMs) ? { tipo: 'transcrevendo', duracaoMs } : ESTADO_INICIAL;
    }
    case 'cancelou':
      return estado.tipo === 'preparando' || estado.tipo === 'gravando' || estado.tipo === 'transcrevendo' ? ESTADO_INICIAL : estado;
    case 'saiu_da_tela':
      return estado.tipo === 'preparando' || estado.tipo === 'gravando' ? { tipo: 'erro', motivo: 'saiu_da_tela' } : estado;
    case 'transcrito':
      if (estado.tipo !== 'transcrevendo') return estado;
      return ev.texto.trim() ? ESTADO_INICIAL : { tipo: 'erro', motivo: 'vazio' };
    case 'transcricao_falhou':
      return estado.tipo === 'transcrevendo' ? { tipo: 'erro', motivo: ev.motivo } : estado;
  }
}

/** Milissegundos que faltam para os 2:00 (120000 fora da gravação). */
export const restanteMs = (estado: EstadoGravacao) => (estado.tipo === 'gravando' ? DURACAO_MAXIMA_MS - estado.decorridoMs : DURACAO_MAXIMA_MS);

/** `m:ss` arredondando para cima: 120000 → "2:00", 119001 → "2:00", 119000 → "1:59", 0 → "0:00". */
export function formatarContador(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Os 2:00 acabaram: quem observa o estado manda parar e enviar. */
export const tempoAcabou = (estado: EstadoGravacao) => estado.tipo === 'gravando' && estado.decorridoMs >= DURACAO_MAXIMA_MS;

/** Há microfone, gravação ou transcrição em andamento (o 🎤 e os atalhos de envio ficam indisponíveis). */
export const emAndamento = (estado: EstadoGravacao) => estado.tipo === 'preparando' || estado.tipo === 'gravando' || estado.tipo === 'transcrevendo';

export const AVISO_FALHA = 'Não entendi o áudio. Tenta de novo ou digita.';
export const AVISO_VAZIO = 'Não ouvi nada no áudio. Tenta de novo ou digita.';
export const AVISO_LIMITE = 'Limite de voz de hoje atingido. Digite sua mensagem.';
export const AVISO_NEGADO = 'Libere o microfone nas configurações para usar voz.';
export const AVISO_NEGADO_IPHONE = 'No iPhone: Ajustes > Safari (ou José) > Microfone.';
export const AVISO_SAIU_DA_TELA = 'Gravação cancelada (o app saiu da tela)';
export const AVISO_CANCELADA = 'Gravação cancelada.';

/** Aviso (toast) que o estado pede, ou null. 401 não avisa: a sessão leva ao Login. */
export function avisoDoEstado(estado: EstadoGravacao, opcoes: { ios?: boolean } = {}): string | null {
  if (estado.tipo === 'negado') return opcoes.ios ? `${AVISO_NEGADO} ${AVISO_NEGADO_IPHONE}` : AVISO_NEGADO;
  if (estado.tipo !== 'erro') return null;
  switch (estado.motivo) {
    case 'transcricao': return AVISO_FALHA;
    case 'vazio': return AVISO_VAZIO;
    case 'limite': return AVISO_LIMITE;
    case 'rede': return 'Sem conexão. Tenta de novo ou digita.';
    case 'microfone': return 'Não encontrei um microfone para gravar.';
    case 'sem_suporte': return 'Este navegador não consegue gravar áudio. Digite sua mensagem.';
    case 'saiu_da_tela': return AVISO_SAIU_DA_TELA;
    case 'sessao': return null;
  }
}

// ---- formato do áudio ----

/**
 * Formato a gravar, pelo que o navegador suporta. No iPhone vale `audio/mp4` (validado no Whisper na onda 1; as versões novas
 * do Safari também gravam webm, mas esse caminho não foi testado ali); no Android e no computador, `audio/webm;codecs=opus`.
 * Devolve '' quando nenhum é suportado (o navegador escolhe).
 */
export function escolherTipoAudio(suporta: (tipo: string) => boolean, ios: boolean): string {
  const ordem = ios
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return ordem.find((t) => suporta(t)) ?? '';
}

/** iPhone/iPad (inclui o iPad que se apresenta como Mac). */
export function ehIos(ua: string, plataforma = '', pontosDeToque = 0): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (plataforma === 'MacIntel' && pontosDeToque > 1);
}

/** Tipo do arquivo enviado: o que o gravador informou, senão o escolhido, senão um padrão pela plataforma. */
export function tipoDoArquivo(informado: string, escolhido: string, ios: boolean): string {
  return informado || escolhido || (ios ? 'audio/mp4' : 'audio/webm');
}

/** Nome do arquivo no multipart (só para o servidor reconhecer; o áudio não é guardado). */
export function nomeDoArquivo(tipo: string): string {
  const base = tipo.split(';')[0]!.trim().toLowerCase();
  if (base.includes('mp4') || base.includes('m4a')) return 'audio.m4a';
  if (base.includes('ogg')) return 'audio.ogg';
  if (base.includes('mpeg')) return 'audio.mp3';
  if (base.includes('wav')) return 'audio.wav';
  return 'audio.webm';
}
