import type { PerfilGoogle } from '../../adaptadores/google/oauth';
import { sha256Hex, tokenAleatorio } from '../../compartilhado/cripto';
import { apagarSessao, apagarSessoesDoUsuario, criarSessao, salvarUsuario } from './repositorio';

export const DIAS_SESSAO = 30;
export const MS_SESSAO = DIAS_SESSAO * 24 * 60 * 60 * 1000;

/** Regra 8: só o e-mail do dono, comparado em minúsculas, e verificado pelo Google. */
export function acessoPermitido(perfil: PerfilGoogle, ownerEmail: string): boolean {
  if (!perfil.emailVerificado) return false;
  const email = perfil.email.trim().toLowerCase();
  const dono = ownerEmail.trim().toLowerCase();
  return email !== '' && dono !== '' && email === dono;
}

export type ResultadoLogin = { ok: false } | { ok: true; token: string; usuarioId: string };

/** Conclui o login. Se o acesso for negado, NADA é gravado. */
export async function concluirLogin(db: D1Database, perfil: PerfilGoogle, ownerEmail: string, agora: Date): Promise<ResultadoLogin> {
  if (!acessoPermitido(perfil, ownerEmail)) return { ok: false };
  const email = perfil.email.trim().toLowerCase();
  const usuarioId = await salvarUsuario(db, { email, nome: perfil.nome || email, fotoUrl: perfil.fotoUrl }, agora);
  const token = tokenAleatorio();
  await criarSessao(db, await sha256Hex(token), usuarioId, agora, new Date(agora.getTime() + MS_SESSAO));
  return { ok: true, token, usuarioId };
}

export async function sair(db: D1Database, idSessaoHash: string) {
  await apagarSessao(db, idSessaoHash);
}

export async function sairDeTodos(db: D1Database, usuarioId: string) {
  await apagarSessoesDoUsuario(db, usuarioId);
}
