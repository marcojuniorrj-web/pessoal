// Regras do título/área/prazo de uma tarefa ou meta na interface (mesmos limites do servidor: 1 a 120 caracteres, prazo AAAA-MM-DD opcional).
import type { AreaItem } from '@compartilhado/areas';
import { LIMITE_TITULO, tarefaEntradaSchema } from '@compartilhado/schemas';

export { LIMITE_TITULO };

export interface ConteudoItem {
  titulo: string;
  area: AreaItem;
  /** AAAA-MM-DD ou null (sem prazo). */
  prazo: string | null;
}

export type ResultadoItem = { ok: true; conteudo: ConteudoItem } | { ok: false; erro: string };

/** Valida o que o Marco digitou antes de enviar ao servidor. `prazo` vazio (campo de data limpo) significa sem prazo. */
export function validarItem(titulo: string, area: AreaItem, prazo: string): ResultadoItem {
  const r = tarefaEntradaSchema.safeParse({ titulo, area, prazo: prazo.trim() === '' ? null : prazo.trim() });
  if (r.success) return { ok: true, conteudo: { titulo: r.data.titulo, area: r.data.area, prazo: r.data.prazo ?? null } };
  return { ok: false, erro: r.error.issues[0]?.message ?? 'Dados inválidos' };
}

/** "37/120", e vira aviso quando passa de 90% do limite. */
export function contadorTitulo(titulo: string): { rotulo: string; perto: boolean } {
  return { rotulo: `${titulo.length}/${LIMITE_TITULO}`, perto: titulo.length >= LIMITE_TITULO * 0.9 };
}

/** Lê o conteúdo de uma sugestão de tarefa ou meta vindo do servidor (null se estiver fora do formato). */
export function lerConteudoItem(conteudo: unknown): ConteudoItem | null {
  const r = tarefaEntradaSchema.safeParse(conteudo);
  return r.success ? { titulo: r.data.titulo, area: r.data.area, prazo: r.data.prazo ?? null } : null;
}
