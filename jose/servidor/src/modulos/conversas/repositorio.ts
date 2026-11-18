import type { ConversaCompleta, ConversaDto, ConversaResumo, MensagemDto, SugestaoDto } from '@compartilhado/schemas';
import { perguntaDe, TITULO_BOAS_VINDAS } from '@compartilhado/boasvindas';
import { uuidv7 } from '../../compartilhado/id';

export interface ConversaLinha extends ConversaDto {
  usuario_id: string;
}
export interface MensagemLinha extends MensagemDto {
  conversa_id: string;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  tokens_cache: number | null;
}
interface SugestaoLinha extends Omit<SugestaoDto, 'conteudo'> {
  conteudo: string;
}

export const paraDto = (c: ConversaLinha): ConversaDto => ({
  id: c.id, titulo: c.titulo, tipo: c.tipo, modo: c.modo, criada_em: c.criada_em, atualizada_em: c.atualizada_em,
});

export async function criarConversa(db: D1Database, usuarioId: string, tipo: ConversaDto['tipo'], modo: ConversaDto['modo'], agora: Date): Promise<string> {
  const id = uuidv7(agora.getTime());
  const iso = agora.toISOString();
  await db
    .prepare('INSERT INTO conversas (id, usuario_id, titulo, tipo, modo, criada_em, atualizada_em) VALUES (?, ?, NULL, ?, ?, ?, ?)')
    .bind(id, usuarioId, tipo, modo, iso, iso)
    .run();
  return id;
}

/**
 * Conversa de boas-vindas: já nasce com a 1ª pergunta fixa como mensagem do José (sem IA, `modelo` nulo), na mesma transação.
 * Sempre no modo padrão; o título é fixo e ela nunca é apagada por ficar vazia.
 */
export async function criarConversaBoasVindas(db: D1Database, usuarioId: string, agora: Date): Promise<string> {
  const id = uuidv7(agora.getTime());
  const iso = agora.toISOString();
  await db.batch([
    db
      .prepare("INSERT INTO conversas (id, usuario_id, titulo, tipo, modo, criada_em, atualizada_em) VALUES (?, ?, ?, 'boas_vindas', 'padrao', ?, ?)")
      .bind(id, usuarioId, TITULO_BOAS_VINDAS, iso, iso),
    db
      .prepare("INSERT INTO mensagens (id, conversa_id, autor, texto, origem, modelo, criada_em) VALUES (?, ?, 'jose', ?, 'texto', NULL, ?)")
      .bind(uuidv7(agora.getTime()), id, perguntaDe(0)!.texto, iso),
  ]);
  return id;
}

/** Grava a próxima pergunta fixa das boas-vindas como resposta do José (sem IA: não conta no limite diário de respostas). */
export async function inserirPerguntaFixa(db: D1Database, conversaId: string, p: { id: string; texto: string }, agora: Date): Promise<void> {
  const iso = agora.toISOString();
  await db.batch([
    db.prepare("INSERT INTO mensagens (id, conversa_id, autor, texto, origem, modelo, criada_em) VALUES (?, ?, 'jose', ?, 'texto', NULL, ?)").bind(p.id, conversaId, p.texto, iso),
    db.prepare('UPDATE conversas SET atualizada_em = ? WHERE id = ?').bind(iso, conversaId),
  ]);
}

/** O Histórico lista só conversas normais: a de boas-vindas não aparece. */
export async function listarConversas(db: D1Database, usuarioId: string): Promise<ConversaResumo[]> {
  const { results } = await db
    .prepare("SELECT id, titulo, tipo, modo, atualizada_em FROM conversas WHERE usuario_id = ? AND tipo = 'normal' ORDER BY atualizada_em DESC, rowid DESC")
    .bind(usuarioId)
    .all<ConversaResumo>();
  return results;
}

/** Última conversa `normal` (a regra 12 compara o dia dela com hoje, no serviço). */
export async function ultimaConversaNormal(db: D1Database, usuarioId: string) {
  return db
    .prepare("SELECT * FROM conversas WHERE usuario_id = ? AND tipo = 'normal' ORDER BY atualizada_em DESC, rowid DESC LIMIT 1")
    .bind(usuarioId)
    .first<ConversaLinha>();
}

export async function mensagensDaConversa(db: D1Database, conversaId: string): Promise<MensagemLinha[]> {
  const { results } = await db
    .prepare('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criada_em ASC, rowid ASC')
    .bind(conversaId)
    .all<MensagemLinha>();
  return results;
}

export async function sugestoesDaConversa(db: D1Database, conversaId: string): Promise<SugestaoDto[]> {
  const { results } = await db
    .prepare(
      'SELECT s.id, s.mensagem_id, s.tipo, s.conteudo, s.status, s.item_id FROM sugestoes s JOIN mensagens m ON m.id = s.mensagem_id WHERE m.conversa_id = ? ORDER BY s.criada_em ASC, s.rowid ASC',
    )
    .bind(conversaId)
    .all<SugestaoLinha>();
  return results.map((s) => ({ ...s, conteudo: JSON.parse(s.conteudo) as unknown }));
}

export const mensagemParaDto = (m: MensagemLinha): MensagemDto => ({
  id: m.id, autor: m.autor, texto: m.texto, origem: m.origem, modelo: m.modelo, criada_em: m.criada_em,
});

export async function conversaCompleta(db: D1Database, conversa: ConversaLinha): Promise<ConversaCompleta> {
  const [mensagens, sugestoes] = await Promise.all([mensagensDaConversa(db, conversa.id), sugestoesDaConversa(db, conversa.id)]);
  return { conversa: paraDto(conversa), mensagens: mensagens.map(mensagemParaDto), sugestoes };
}

/** A cascata apaga mensagens e sugestões; tarefas, metas e memórias já salvas permanecem. */
export async function apagarConversa(db: D1Database, conversaId: string): Promise<void> {
  await db.prepare('DELETE FROM conversas WHERE id = ?').bind(conversaId).run();
}

/** A mensagem logo depois de `m` na mesma conversa (mesma ordem da leitura: criada_em, rowid). */
export async function mensagemSeguinte(db: D1Database, m: MensagemLinha): Promise<MensagemLinha | null> {
  const todas = await mensagensDaConversa(db, m.conversa_id);
  return todas[todas.findIndex((x) => x.id === m.id) + 1] ?? null;
}

/**
 * Apaga as mensagens (a cascata leva as sugestões; tarefas, metas e memórias salvas permanecem) e, na MESMA transação,
 * a conversa quando ela ficou sem nenhuma mensagem e é `normal` (a de boas-vindas nunca é apagada por aqui).
 * Devolve se a conversa foi apagada.
 */
export async function apagarMensagens(db: D1Database, conversaId: string, ids: string[]): Promise<boolean> {
  await db.batch([
    ...ids.map((id) => db.prepare('DELETE FROM mensagens WHERE id = ?').bind(id)),
    db
      .prepare("DELETE FROM conversas WHERE id = ? AND tipo = 'normal' AND NOT EXISTS (SELECT 1 FROM mensagens WHERE conversa_id = ?)")
      .bind(conversaId, conversaId),
  ]);
  const resta = await db.prepare('SELECT 1 AS n FROM conversas WHERE id = ?').bind(conversaId).first();
  return !resta;
}

// ---- leitura para montar o contexto da IA (regra 1) ----

export async function memoriasDoUsuario(db: D1Database, usuarioId: string) {
  const { results } = await db
    .prepare('SELECT texto, area FROM memorias WHERE usuario_id = ? ORDER BY criada_em ASC, rowid ASC')
    .bind(usuarioId)
    .all<{ texto: string; area: 'sobre_mim' | 'trabalho' | 'financas' | 'saude' | 'casa' }>();
  return results;
}

export async function metasAtivas(db: D1Database, usuarioId: string) {
  const { results } = await db
    .prepare("SELECT titulo, area, prazo FROM metas WHERE usuario_id = ? AND status = 'ativa' ORDER BY criada_em ASC, rowid ASC")
    .bind(usuarioId)
    .all<{ titulo: string; area: 'trabalho' | 'financas' | 'saude' | 'casa'; prazo: string | null }>();
  return results;
}

/** Quantas respostas do José o usuário já recebeu no dia local `dia` (regra 9). Lê `uso_diario`: apagar mensagens não diminui. */
export async function respostasDoDia(db: D1Database, usuarioId: string, dia: string): Promise<number> {
  const linha = await db.prepare('SELECT respostas FROM uso_diario WHERE usuario_id = ? AND dia = ?').bind(usuarioId, dia).first<{ respostas: number }>();
  return linha?.respostas ?? 0;
}

export async function buscarMensagem(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM mensagens WHERE id = ?').bind(id).first<MensagemLinha>();
}

export async function inserirMensagemMarco(db: D1Database, conversaId: string, m: { id: string; texto: string; origem: 'texto' | 'voz' }, agora: Date) {
  const iso = agora.toISOString();
  await db.batch([
    db.prepare("INSERT INTO mensagens (id, conversa_id, autor, texto, origem, criada_em) VALUES (?, ?, 'marco', ?, ?, ?)").bind(m.id, conversaId, m.texto, m.origem, iso),
    db.prepare('UPDATE conversas SET atualizada_em = ? WHERE id = ?').bind(iso, conversaId),
  ]);
}

export async function inserirRespostaJose(
  db: D1Database,
  conversaId: string,
  r: { id: string; texto: string; modelo: string; tokensEntrada: number; tokensSaida: number; tokensCache: number },
  agora: Date,
  uso: { usuarioId: string; dia: string },
) {
  const iso = agora.toISOString();
  await db.batch([
    db
      .prepare("INSERT INTO mensagens (id, conversa_id, autor, texto, origem, modelo, tokens_entrada, tokens_saida, tokens_cache, criada_em) VALUES (?, ?, 'jose', ?, 'texto', ?, ?, ?, ?, ?)")
      .bind(r.id, conversaId, r.texto, r.modelo, r.tokensEntrada, r.tokensSaida, r.tokensCache, iso),
    db.prepare('UPDATE conversas SET atualizada_em = ? WHERE id = ?').bind(iso, conversaId),
    // Na mesma transação da resposta: o limite diário conta toda resposta gravada e nunca diminui.
    db
      .prepare('INSERT INTO uso_diario (usuario_id, dia, respostas) VALUES (?, ?, 1) ON CONFLICT (usuario_id, dia) DO UPDATE SET respostas = respostas + 1')
      .bind(uso.usuarioId, uso.dia),
  ]);
}

export async function inserirSugestao(db: D1Database, s: { id: string; mensagemId: string; tipo: string; conteudo: unknown }, agora: Date) {
  await db
    .prepare('INSERT INTO sugestoes (id, mensagem_id, tipo, conteudo, criada_em) VALUES (?, ?, ?, ?, ?)')
    .bind(s.id, s.mensagemId, s.tipo, JSON.stringify(s.conteudo), agora.toISOString())
    .run();
}

export async function definirTitulo(db: D1Database, conversaId: string, titulo: string) {
  await db.prepare('UPDATE conversas SET titulo = ? WHERE id = ?').bind(titulo, conversaId).run();
}
