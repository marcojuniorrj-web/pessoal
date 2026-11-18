// Roteamento e criação das boas-vindas (dados.md, regra 7): a flag `boas_vindas_concluida` MANDA. Quem já concluiu nunca é
// levado de volta; quem não concluiu retoma a conversa em aberto (ou cria uma, se não houver).
import type { Usuario } from '@compartilhado/schemas';
import { criarConversaBoasVindas } from '../api/boasvindas';

export type Destino = 'chat' | 'boas-vindas';

/**
 * Para onde a rota inicial ("/") leva. Só as boas-vindas NÃO concluídas desviam, e nunca quando o Marco pediu uma conversa
 * específica (`?c=`, ex.: volta de um login expirado) ou um Chat novo (`?nova=1`): o Chat nunca fica bloqueado.
 */
export function destinoInicial(usuario: Pick<Usuario, 'boas_vindas_concluida'>, params: { c?: string | null; nova?: boolean }): Destino {
  if (usuario.boas_vindas_concluida) return 'chat';
  if (params.c || params.nova) return 'chat';
  return 'boas-vindas';
}

/** Conversa de boas-vindas que a tela abre quando a URL não traz `?c=`: a em aberto (de /api/eu) ou nenhuma (precisa criar). */
export function conversaParaRetomar(usuario: Pick<Usuario, 'boas_vindas_concluida' | 'conversa_boas_vindas_id'>): string | null {
  return usuario.boas_vindas_concluida ? null : (usuario.conversa_boas_vindas_id ?? null);
}

/** Caminho da tela de boas-vindas para uma conversa. */
export const caminhoBoasVindas = (id: string) => `/boas-vindas?c=${encodeURIComponent(id)}`;

let emCriacao: Promise<string> | null = null;
/**
 * Cria a conversa de boas-vindas UMA vez por vez: efeitos repetidos (StrictMode, dois toques) dividem a mesma chamada,
 * então nunca nascem duas conversas.
 */
export function criarBoasVindasUnica(): Promise<string> {
  emCriacao ??= criarConversaBoasVindas()
    .then((r) => r.id)
    .finally(() => {
      emCriacao = null;
    });
  return emCriacao;
}

/**
 * "Refazer boas-vindas" / "Fazer as boas-vindas": reaproveita a conversa em aberto (boas-vindas ainda não concluídas)
 * ou abre uma nova.
 */
export async function abrirBoasVindas(usuario: Pick<Usuario, 'boas_vindas_concluida' | 'conversa_boas_vindas_id'>): Promise<string> {
  return conversaParaRetomar(usuario) ?? criarBoasVindasUnica();
}
