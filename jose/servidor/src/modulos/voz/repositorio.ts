/**
 * Conta uma transcrição no dia local do usuário, de forma atômica, e diz se ainda cabia no limite.
 * Um único UPSERT: cria a linha do dia (ou soma 1) só enquanto `transcricoes < limite`. Sem linha devolvida,
 * o limite já tinha sido atingido (nada é incrementado). Dois pedidos simultâneos não passam do limite.
 */
export async function consumirTranscricao(db: D1Database, usuarioId: string, dia: string, limite: number): Promise<boolean> {
  const linha = await db
    .prepare(
      `INSERT INTO uso_diario (usuario_id, dia, respostas, transcricoes) VALUES (?, ?, 0, 1)
       ON CONFLICT (usuario_id, dia) DO UPDATE SET transcricoes = transcricoes + 1 WHERE transcricoes < ?
       RETURNING transcricoes`,
    )
    .bind(usuarioId, dia, limite)
    .first<{ transcricoes: number }>();
  return linha !== null;
}
