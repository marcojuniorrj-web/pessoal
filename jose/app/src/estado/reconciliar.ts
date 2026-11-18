// Reconciliação do Chat com o servidor: depois de apagar (e quando o app volta para a frente), as mensagens mostradas passam
// a ser as do servidor, SEM perder o que só existe aqui: a resposta em andamento, a mensagem enviada que ainda não foi
// gravada (ou que falhou e espera "Tentar de novo") e o que acabou de chegar. A função é pura (testada em reconciliar.test.ts).
import type { ConversaCompleta } from '@compartilhado/schemas';
import type { Bolha } from './chat';

/** Id da bolha da resposta do José enquanto ela não tem o id definitivo (em andamento ou com erro). */
export const ID_TEMPORARIO = 'resposta-em-andamento';
/** Uma mensagem local que o servidor ainda não devolve só é descartada depois disto (folga para o servidor gravar). */
export const FOLGA_RECENTE_MS = 20_000;

export const bolhaDe = (m: ConversaCompleta['mensagens'][number], sugestoes: ConversaCompleta['sugestoes'] = []): Bolha => {
  const proprias = sugestoes.filter((s) => s.mensagem_id === m.id).map((s) => ({ id: s.id, tipo: s.tipo, conteudo: s.conteudo, status: s.status }));
  return { id: m.id, autor: m.autor, texto: m.texto, origem: m.origem, estado: 'ok', criadaEm: m.criada_em, ...(proprias.length ? { sugestoes: proprias } : {}) };
};

const assinatura = (b: Bolha) =>
  JSON.stringify([b.id, b.autor, b.texto, b.origem, b.estado, b.erro?.mensagem, b.criadaEm, b.sugestoes?.map((s) => [s.id, s.status, s.itemId ?? null, s.conteudo])]);

export interface OpcoesMesclar {
  /** Id da mensagem do Marco que ainda espera resposta / "Tentar de novo". */
  pendenteId?: string | null;
  agora?: number;
}

/**
 * Mensagens do servidor + o que só existe localmente. Devolve a MESMA lista (mesma referência) quando nada mudou,
 * para a tela não piscar nem rolar.
 */
export function mesclarComServidor(locais: Bolha[], servidor: ConversaCompleta, opcoes: OpcoesMesclar = {}): Bolha[] {
  const agora = opcoes.agora ?? Date.now();
  const locaisPorId = new Map(locais.map((b) => [b.id, b]));
  const doServidor = servidor.mensagens.map((m) => {
    const b = bolhaDe(m, servidor.sugestoes);
    const local = locaisPorId.get(b.id);
    // Um cartão que aqui já está salvo/descartado nunca volta a "pendente" por causa de uma leitura atrasada.
    if (local?.sugestoes && b.sugestoes) {
      b.sugestoes = b.sugestoes.map((s) => {
        const l = local.sugestoes!.find((x) => x.id === s.id);
        return l && s.status === 'pendente' && l.status !== 'pendente' ? { ...s, status: l.status, conteudo: l.conteudo, itemId: l.itemId } : s;
      });
    }
    return b;
  });
  const noServidor = new Set(doServidor.map((b) => b.id));
  const soAqui = locais.filter((b) => {
    if (noServidor.has(b.id)) return false;
    if (b.id === ID_TEMPORARIO || b.estado !== 'ok' || b.id === opcoes.pendenteId) return true;
    const quando = b.criadaEm ? Date.parse(b.criadaEm) : NaN;
    return Number.isFinite(quando) && agora - quando < FOLGA_RECENTE_MS;
  });
  const resultado = [...doServidor, ...soAqui];
  if (resultado.length === locais.length && resultado.every((b, i) => assinatura(b) === assinatura(locais[i]!))) return locais;
  return resultado;
}
