// Salvar e descartar sugestões (arquitetura.md §5). O José nunca salva nada sozinho: só estas rotas viram item, por toque do Marco.
import { conteudoSugestaoSchema, type MemoriaEntrada } from '@compartilhado/schemas';
import { Hono } from 'hono';
import { ErroApi, requisicaoInvalida } from '../../compartilhado/erros';
import type { Dependencias } from '../../compartilhado/dependencias';
import { uuidv7 } from '../../compartilhado/id';
import { buscarSugestaoDoUsuario } from '../../compartilhado/posse';
import type { AppEnv } from '../auth/sessao';
import { inserirMemoria, paraDto as memoriaParaDto } from '../memorias/repositorio';
import { descartarSugestao, liberarSugestao, reservarSugestao, tipoDaConversa, type SugestaoLinha } from './repositorio';

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

    // Tarefas e metas viram item na onda 5; por ora só memórias podem ser salvas.
    if (sugestao.tipo !== 'memoria') throw requisicaoInvalida('Esse tipo de sugestão ainda não pode ser salvo.');

    const origem = (await tipoDaConversa(c.env.DB, sugestao.mensagem_id)) === 'boas_vindas' ? 'boas_vindas' : 'chat';
    const agora = deps.agora();
    const itemId = uuidv7(agora.getTime());
    // Reserva primeiro (só uma chamada vence), depois cria o item: salvar duas vezes nunca duplica.
    if (!(await reservarSugestao(c.env.DB, sugestao.id, conteudo.data, itemId))) throw jaTratada();
    try {
      const item = await inserirMemoria(c.env.DB, usuario.id, conteudo.data as MemoriaEntrada, origem, agora, itemId);
      return c.json({ item: memoriaParaDto(item) });
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

  return rotas;
}
