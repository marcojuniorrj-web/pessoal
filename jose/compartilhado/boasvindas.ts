// Boas-vindas (telas.md tela 2, dados.md regra 7): 5 perguntas FIXAS no código, uma por vez, e a etapa calculada
// só pelas mensagens da conversa (assim a retomada não precisa de nenhum estado extra).

export const TOTAL_PERGUNTAS = 5;
/** Máximo de memórias sugeridas pela chamada final (o limite das outras respostas é 3). */
export const MAX_SUGESTOES_BOAS_VINDAS = 8;
/** Título da conversa de boas-vindas (ela não aparece no Histórico). */
export const TITULO_BOAS_VINDAS = 'Boas-vindas';

export interface RespostaRapida {
  rotulo: string;
  /** O que entra no campo ou é enviado (padrão: o próprio rótulo). */
  texto?: string;
  /** `enviar`: tocar envia a resposta; `inserir`: tocar acrescenta ao campo (dá para escolher mais de uma). */
  modo: 'enviar' | 'inserir';
}

export interface PerguntaBoasVindas {
  texto: string;
  respostasRapidas: RespostaRapida[];
}

export const PERGUNTAS_BOAS_VINDAS: readonly PerguntaBoasVindas[] = [
  {
    texto: 'Oi, Marco, eu sou o José. Vou fazer 5 perguntas rápidas para te conhecer. Primeira: como é um dia normal da sua rotina?',
    respostasRapidas: [],
  },
  {
    texto: 'Quais áreas da sua vida você quer organizar comigo? Pode escolher mais de uma.',
    respostasRapidas: [
      { rotulo: 'Trabalho', modo: 'inserir' },
      { rotulo: 'Finanças', modo: 'inserir' },
      { rotulo: 'Saúde e rotina', modo: 'inserir' },
      { rotulo: 'Família e casa', modo: 'inserir' },
    ],
  },
  {
    texto: 'Quais são as suas metas principais para os próximos meses?',
    respostasRapidas: [],
  },
  {
    texto: 'O que mais trava você hoje?',
    respostasRapidas: [
      { rotulo: 'Começar', texto: 'Começar as tarefas', modo: 'enviar' },
      { rotulo: 'Decidir', texto: 'Tomar decisões', modo: 'enviar' },
      { rotulo: 'Me organizar', texto: 'Me organizar', modo: 'enviar' },
      { rotulo: 'Manter o foco', texto: 'Manter o foco', modo: 'enviar' },
    ],
  },
  {
    texto: 'Última: que horas você costuma acordar e dormir?',
    respostasRapidas: [
      { rotulo: 'Acordo 6h, durmo 22h', modo: 'enviar' },
      { rotulo: 'Acordo 7h, durmo 23h', modo: 'enviar' },
      { rotulo: 'Acordo 8h, durmo à meia-noite', modo: 'enviar' },
    ],
  },
];

/** Texto da pergunta de índice `i` (0 a 4); fora disso, undefined. */
export const perguntaDe = (i: number): PerguntaBoasVindas | undefined => PERGUNTAS_BOAS_VINDAS[i];

interface MensagemMinima {
  autor: 'marco' | 'jose';
}

export type EtapaBoasVindas =
  /** Ainda há pergunta a responder: `numero` (1 a 5) é a pergunta atual; `respostas` são as respostas do Marco. */
  | { fase: 'perguntando'; numero: number; respostas: number }
  /** As 5 respostas foram dadas, mas o resumo do José (a lista de memórias) ainda não chegou. */
  | { fase: 'resumindo'; respostas: number }
  /** O resumo do José chegou: o Marco revisa e salva as memórias. */
  | { fase: 'revisando'; respostas: number };

/**
 * Etapa das boas-vindas só pelas mensagens: "Pergunta N de 5" conta as respostas do Marco (N = respostas + 1).
 * `resumoPronto`: a última mensagem é uma resposta do José depois da 5ª resposta do Marco.
 */
export function etapaBoasVindas(mensagens: readonly MensagemMinima[]): EtapaBoasVindas {
  const respostas = mensagens.filter((m) => m.autor === 'marco').length;
  if (respostas < TOTAL_PERGUNTAS) return { fase: 'perguntando', numero: respostas + 1, respostas };
  return mensagens.at(-1)?.autor === 'jose' ? { fase: 'revisando', respostas } : { fase: 'resumindo', respostas };
}

/** "Pergunta 3 de 5" (null fora da fase de perguntas). */
export function rotuloProgresso(e: EtapaBoasVindas): string | null {
  return e.fase === 'perguntando' ? `Pergunta ${e.numero} de ${TOTAL_PERGUNTAS}` : null;
}

/** Qual é o próximo passo do servidor depois de gravar a resposta do Marco (já contada em `respostas`). */
export type ProximoPasso = { tipo: 'pergunta'; indice: number } | { tipo: 'resumo' } | { tipo: 'encerrada' };

export function proximoPasso(respostas: number): ProximoPasso {
  if (respostas < TOTAL_PERGUNTAS) return { tipo: 'pergunta', indice: respostas };
  return respostas === TOTAL_PERGUNTAS ? { tipo: 'resumo' } : { tipo: 'encerrada' };
}

/** Acrescenta uma resposta rápida ao campo (sem repetir o que já está lá), separando por vírgula. */
export function inserirNoCampo(atual: string, rotulo: string): string {
  const itens = atual.split(',').map((t) => t.trim()).filter(Boolean);
  if (itens.some((i) => i.toLowerCase() === rotulo.toLowerCase())) return atual;
  return [...itens, rotulo].join(', ');
}
