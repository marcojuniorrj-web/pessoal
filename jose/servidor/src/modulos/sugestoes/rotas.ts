// Salvar e descartar sugestões (arquitetura.md §5). O José nunca salva nada sozinho: só estas rotas viram item, por toque do Marco.
import { conteudoSugestaoSchema, loteSugestoesSchema, type MemoriaEntrada, type MetaEntrada, type TarefaEntrada } from '@compartilhado/schemas';
import { Hono } from 'hono';
import { ErroApi, naoEncontrado, requisicaoInvalida } from '../../compartilhado/erros';
import type { Dependencias } from '../../compartilhado/dependencias';
import { uuidv7 } from '../../compartilhado/id';
import { buscarDoUsuario, buscarSugestaoDoUsuario } from '../../compartilhado/posse';
import type { AppEnv } from '../auth/sessao';
import { inserirMemoria, paraDto as memoriaParaDto, type MemoriaLinha } from '../memorias/repositorio';
import { inserirMeta, paraDto as metaParaDto } from '../tarefas/metas-repositorio';
import { inserirTarefa, paraDto as tarefaParaDto } from '../tarefas/repositorio';
import { descartarSugestao, liberarSugestao, reservarSugestao, sugestoesDaConversaPorIds, tipoDaConversa, type SugestaoLinha } from './repositorio';

const jaTratada = () => new ErroApi(409, 'sugestao_ja_tratada', 'Essa sugestão já foi salva ou descartada.');

export function rotasSugestoes(deps: Pick<Dependencias, 'agora'>) {
  const rotas = new Hono<AppEnv>();

  rotas.post('/sugestoes/:id/salvar', async (c) => {
    const usuario = c.var.usuario;
    const sugestao = await buscarSugestaoDoUsuario<SugestaoLinha>(c.env.DB, c.req.param('id'), usuario.id);
    if (sugestao.status !== 'pendente') throw jaTratada();

    // Corpo opcional: `{ conteudo }` com o texto editado no cartão (validado com os mesmos limites da entidade).
    const texto = await c.req.text();
    let corpo: { conteudo?: unknown } = {};
    if (texto.trim()) {
      try {
        corpo = JSON.parse(texto) as { conteudo?: unknown };
      } catch {
        throw requisicaoInvalida('Corpo inválido.');
      }
      if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) throw requisicaoInvalida('Corpo inválido.');
    }
    const bruto = corpo.conteudo ?? JSON.parse(sugestao.conteudo);
    const conteudo = conteudoSugestaoSchema[sugestao.tipo].safeParse(bruto);
    if (!conteudo.success) throw requisicaoInvalida(conteudo.error.issues[0]?.message ?? 'Conteúdo inválido.');

    const origem = (await tipoDaConversa(c.env.DB, sugestao.mensagem_id)) === 'boas_vindas' ? 'boas_vindas' : 'chat';
    const agora = deps.agora();
    const itemId = uuidv7(agora.getTime());
    // Reserva primeiro (só uma chamada vence), depois cria o item: salvar duas vezes nunca duplica.
    if (!(await reservarSugestao(c.env.DB, sugestao.id, conteudo.data, itemId))) throw jaTratada();
    try {
      const dados = conteudo.data;
      const item =
        sugestao.tipo === 'tarefa' ? tarefaParaDto(await inserirTarefa(c.env.DB, usuario.id, dados as TarefaEntrada, origem, agora, itemId))
        : sugestao.tipo === 'meta' ? metaParaDto(await inserirMeta(c.env.DB, usuario.id, dados as MetaEntrada, origem, agora, itemId))
        : memoriaParaDto(await inserirMemoria(c.env.DB, usuario.id, dados as MemoriaEntrada, origem, agora, itemId));
      return c.json({ item });
    } catch (e) {
      await liberarSugestao(c.env.DB, sugestao.id, itemId).catch(() => {});
      throw e;
    }
  });

  rotas.post('/sugestoes/:id/descartar', async (c) => {
    const sugestao = await buscarSugestaoDoUsuario<SugestaoLinha>(c.env.DB, c.req.param('id'), c.var.usuario.id);
    if (sugestao.status !== 'pendente' || !(await descartarSugestao(c.env.DB, sugestao.id))) throw jaTratada();
    return c.body(null, 204);
  });

  // "Salvar selecionadas" das boas-vindas: salva as marcadas (texto e área editados), descarta as desmarcadas e conclui as
  // boas-vindas, tudo numa transação só. Sugestão que já não está pendente é ignorada (reenviar o lote não duplica nada).
  rotas.post('/conversas/:id/sugestoes/lote', async (c) => {
    const usuario = c.var.usuario;
    const conversa = await buscarDoUsuario<{ id: string; tipo: string }>(c.env.DB, 'conversas', c.req.param('id'), usuario.id);
    if (conversa.tipo !== 'boas_vindas') throw requisicaoInvalida('Salvar selecionadas só vale para a conversa de boas-vindas.');
    const corpo = loteSugestoesSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Lote inválido.');
    const { salvar, descartar } = corpo.data;

    const ids = [...salvar.map((s) => s.id), ...descartar];
    const linhas = new Map((await sugestoesDaConversaPorIds(c.env.DB, conversa.id, ids)).map((l) => [l.id, l]));
    if (linhas.size !== ids.length) throw naoEncontrado();
    if ([...linhas.values()].some((l) => l.tipo !== 'memoria')) throw requisicaoInvalida('Só memórias entram no lote das boas-vindas.');

    const db = c.env.DB;
    const agora = deps.agora();
    const iso = agora.toISOString();
    const comandos: D1PreparedStatement[] = [];
    const criados: string[] = [];
    for (const item of salvar) {
      const linha = linhas.get(item.id)!;
      if (linha.status !== 'pendente') continue;
      const conteudo = conteudoSugestaoSchema.memoria.safeParse(item.conteudo ?? JSON.parse(linha.conteudo));
      if (!conteudo.success) throw requisicaoInvalida(conteudo.error.issues[0]?.message ?? 'Conteúdo inválido.');
      const itemId = uuidv7(agora.getTime());
      criados.push(itemId);
      comandos.push(
        // A memória só nasce se a sugestão ainda está pendente; a reserva logo depois fecha a porta (nunca duplica).
        db
          .prepare("INSERT INTO memorias (id, usuario_id, texto, area, origem, criada_em, atualizada_em) SELECT ?, ?, ?, ?, 'boas_vindas', ?, NULL WHERE EXISTS (SELECT 1 FROM sugestoes WHERE id = ? AND status = 'pendente')")
          .bind(itemId, usuario.id, conteudo.data.texto, conteudo.data.area, iso, linha.id),
        db
          .prepare("UPDATE sugestoes SET status = 'salva', conteudo = ?, item_id = ? WHERE id = ? AND status = 'pendente'")
          .bind(JSON.stringify(conteudo.data), itemId, linha.id),
      );
    }
    for (const id of descartar) {
      if (linhas.get(id)!.status === 'pendente') comandos.push(db.prepare("UPDATE sugestoes SET status = 'descartada' WHERE id = ? AND status = 'pendente'").bind(id));
    }
    comandos.push(db.prepare('UPDATE usuarios SET boas_vindas_concluida = 1 WHERE id = ?').bind(usuario.id));
    await db.batch(comandos);

    const itens = criados.length
      ? (await db.prepare(`SELECT * FROM memorias WHERE usuario_id = ? AND id IN (${criados.map(() => '?').join(',')}) ORDER BY rowid ASC`).bind(usuario.id, ...criados).all<MemoriaLinha>()).results
      : [];
    return c.json({ itens: itens.map(memoriaParaDto) });
  });

  return rotas;
}
