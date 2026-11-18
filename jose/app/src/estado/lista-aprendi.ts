// Lista "O que aprendi sobre você" (boas-vindas): memórias sugeridas, cada uma com caixa, texto editável e área.
// Tudo puro (testado em lista-aprendi.test.ts); a tela só liga isto aos componentes.
import type { AreaMemoria } from '@compartilhado/areas';
import { LIMITE_MEMORIA, memoriaEntradaSchema } from '@compartilhado/schemas';
import type { LoteBoasVindas } from '../api/boasvindas';
import type { SugestaoDoChat } from './chat';

export interface ItemAprendi {
  id: string;
  marcado: boolean;
  texto: string;
  area: AreaMemoria;
}

/** O que o Marco mudou em cada item (a caixa, o texto, a área); o resto vem da sugestão. */
export type EdicaoAprendi = Partial<Pick<ItemAprendi, 'marcado' | 'texto' | 'area'>>;

/** Só as memórias que ainda estão pendentes: uma salva ou descartada nunca volta à lista. */
export function sugestoesDaLista(sugestoes: readonly SugestaoDoChat[]): SugestaoDoChat[] {
  return sugestoes.filter((s) => s.tipo === 'memoria' && s.status === 'pendente' && memoriaEntradaSchema.safeParse(s.conteudo).success);
}

/** Itens da lista: tudo marcado no começo, com as edições do Marco por cima. */
export function montarItens(sugestoes: readonly SugestaoDoChat[], edicoes: Readonly<Record<string, EdicaoAprendi>>): ItemAprendi[] {
  return sugestoesDaLista(sugestoes).map((s) => {
    const c = memoriaEntradaSchema.parse(s.conteudo);
    return { id: s.id, marcado: true, texto: c.texto, area: c.area, ...edicoes[s.id] };
  });
}

export const contarMarcados = (itens: readonly ItemAprendi[]) => itens.filter((i) => i.marcado).length;

/** Erro de um item marcado (texto vazio ou maior que 300); itens desmarcados não são conferidos. */
export function erroDoItem(i: ItemAprendi): string | null {
  if (!i.marcado) return null;
  if (!i.texto.trim()) return 'Escreva o texto ou desmarque.';
  if (i.texto.length > LIMITE_MEMORIA) return `Máximo de ${LIMITE_MEMORIA} caracteres.`;
  return null;
}

export type ResultadoLote = { ok: true; lote: LoteBoasVindas } | { ok: false; primeiroComErro: string };

/** Monta o lote: as marcadas vão em `salvar` (com o texto e a área editados); as desmarcadas em `descartar`. */
export function montarLote(itens: readonly ItemAprendi[]): ResultadoLote {
  const ruim = itens.find((i) => erroDoItem(i));
  if (ruim) return { ok: false, primeiroComErro: ruim.id };
  return {
    ok: true,
    lote: {
      salvar: itens.filter((i) => i.marcado).map((i) => ({ id: i.id, conteudo: { texto: i.texto.trim(), area: i.area } })),
      descartar: itens.filter((i) => !i.marcado).map((i) => i.id),
    },
  };
}

/** "2 de 4 marcadas". */
export const rotuloMarcadas = (itens: readonly ItemAprendi[]) => `${contarMarcados(itens)} de ${itens.length} marcadas`;
