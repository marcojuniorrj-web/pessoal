// Regras do texto de uma memória na interface (mesmos limites do servidor: 1 a 300 caracteres, sem só espaços).
import { LIMITE_MEMORIA, memoriaEntradaSchema, type MemoriaEntrada } from '@compartilhado/schemas';

export { LIMITE_MEMORIA };

export type ResultadoEdicao = { ok: true; conteudo: MemoriaEntrada } | { ok: false; erro: string };

/** Valida o que o Marco digitou antes de enviar ao servidor. */
export function validarMemoria(texto: string, area: MemoriaEntrada['area']): ResultadoEdicao {
  const r = memoriaEntradaSchema.safeParse({ texto, area });
  if (r.success) return { ok: true, conteudo: r.data };
  return { ok: false, erro: r.error.issues[0]?.message ?? 'Texto inválido' };
}

/** "37/300", e vira aviso quando passa de 90% do limite. */
export function contadorTexto(texto: string): { rotulo: string; perto: boolean } {
  return { rotulo: `${texto.length}/${LIMITE_MEMORIA}`, perto: texto.length >= LIMITE_MEMORIA * 0.9 };
}

/** Lê o conteúdo de uma sugestão de memória vindo do servidor (null se estiver fora do formato). */
export function lerConteudoMemoria(conteudo: unknown): MemoriaEntrada | null {
  const r = memoriaEntradaSchema.safeParse(conteudo);
  return r.success ? r.data : null;
}
