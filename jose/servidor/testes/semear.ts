// Dados de teste para vários usuários: preenche TODAS as tabelas de um usuário (usado nos testes de apagar tudo,
// isolamento e métricas). Ids ficam prefixados pelo `prefixo` para não colidir entre usuários.
export interface Semeado {
  usuarioId: string;
  conversaId: string;
  conversaBvId: string;
  mensagemId: string;
  mensagemJoseId: string;
  sugestaoId: string;
  tarefaId: string;
  metaId: string;
  memoriaId: string;
}

export async function semearUsuario(db: D1Database, prefixo: string, email: string, agora = '2026-11-18T12:00:00.000Z'): Promise<Semeado> {
  const ids = {
    usuarioId: `${prefixo}-u`,
    conversaId: `${prefixo}-c`,
    conversaBvId: `${prefixo}-cbv`,
    mensagemId: `${prefixo}-m1`,
    mensagemJoseId: `${prefixo}-m2`,
    sugestaoId: `${prefixo}-s1`,
    tarefaId: `${prefixo}-t1`,
    metaId: `${prefixo}-g1`,
    memoriaId: `${prefixo}-mem1`,
  };
  const exec = (sql: string, ...v: unknown[]) => db.prepare(sql).bind(...v).run();
  await exec('INSERT INTO usuarios(id,email,nome,criado_em) VALUES(?,?,?,?)', ids.usuarioId, email, prefixo, agora);
  await exec('INSERT INTO sessoes(id,usuario_id,expira_em,criada_em) VALUES(?,?,?,?)', `${prefixo}-sess`, ids.usuarioId, '2099-01-01T00:00:00.000Z', agora);
  await exec("INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES(?,?,?, 'normal','padrao',?,?)", ids.conversaId, ids.usuarioId, `Conversa ${prefixo}`, agora, agora);
  await exec("INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES(?,?,'Boas-vindas','boas_vindas','padrao',?,?)", ids.conversaBvId, ids.usuarioId, agora, agora);
  await exec("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES(?,?,'marco',?, 'texto',?)", ids.mensagemId, ids.conversaId, `segredo de ${prefixo}`, agora);
  await exec(
    "INSERT INTO mensagens(id,conversa_id,autor,texto,origem,modelo,tokens_entrada,tokens_saida,tokens_cache,criada_em) VALUES(?,?,'jose','ok','texto','claude-haiku-5-5',100,20,50,?)",
    ids.mensagemJoseId,
    ids.conversaId,
    agora,
  );
  await exec("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,criada_em) VALUES(?,?,'tarefa',?, 'pendente',?)", ids.sugestaoId, ids.mensagemJoseId, JSON.stringify({ titulo: 'X', area: 'trabalho' }), agora);
  await exec("INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,'trabalho','manual',?)", ids.tarefaId, ids.usuarioId, `Tarefa ${prefixo}`, agora);
  await exec("INSERT INTO metas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,'trabalho','manual',?)", ids.metaId, ids.usuarioId, `Meta ${prefixo}`, agora);
  await exec("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES(?,?,?,'sobre_mim','manual',?)", ids.memoriaId, ids.usuarioId, `Memória ${prefixo}`, agora);
  await exec('INSERT INTO uso_diario(usuario_id,dia,respostas,transcricoes) VALUES(?,?,3,2)', ids.usuarioId, '2026-11-18');
  return ids;
}

/** Linhas de cada tabela de dados (nome → contagem). Lê a lista de tabelas do próprio banco (sqlite_master). */
export async function contarTabelas(db: D1Database, filtro?: { usuarioId: string }): Promise<Record<string, number>> {
  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name").all<{ name: string }>();
  const saida: Record<string, number> = {};
  for (const { name } of results) {
    let sql = `SELECT COUNT(*) AS n FROM ${name}`;
    if (filtro) {
      const u = filtro.usuarioId;
      const por: Record<string, string> = {
        usuarios: `id = '${u}'`,
        sessoes: `usuario_id = '${u}'`,
        conversas: `usuario_id = '${u}'`,
        tarefas: `usuario_id = '${u}'`,
        metas: `usuario_id = '${u}'`,
        memorias: `usuario_id = '${u}'`,
        uso_diario: `usuario_id = '${u}'`,
        mensagens: `conversa_id IN (SELECT id FROM conversas WHERE usuario_id = '${u}')`,
        sugestoes: `mensagem_id IN (SELECT m.id FROM mensagens m JOIN conversas c ON c.id = m.conversa_id WHERE c.usuario_id = '${u}')`,
      };
      if (!(name in por)) throw new Error(`tabela nova sem filtro de usuário no teste: ${name}`);
      sql += ` WHERE ${por[name]}`;
    }
    saida[name] = (await db.prepare(sql).first<{ n: number }>())!.n;
  }
  return saida;
}
