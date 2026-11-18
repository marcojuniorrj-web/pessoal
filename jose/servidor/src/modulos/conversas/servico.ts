// Regra de negócio do chat: enviar mensagem, montar o contexto, chamar a IA e gravar a resposta.
// Cada evento devolvido aqui vira um evento SSE (`texto`, `sugestao`, `fim`, `erro`) na rota.
import type { MensagemDto } from '@compartilhado/schemas';
import { diaLocal, hoje } from '@compartilhado/datas';
import { prompt } from '../../adaptadores/ia/prompt';
import { ErroIA, type ClienteIA, type EventoIA, type PedidoIA } from '../../adaptadores/ia/tipos';
import type { Ambiente } from '../../ambiente';
import type { Dependencias } from '../../compartilhado/dependencias';
import { ErroApi } from '../../compartilhado/erros';
import { uuidv7 } from '../../compartilhado/id';
import type { UsuarioLinha } from '../auth/repositorio';
import { LIMITE_TAREFAS_CONTEXTO, montarContexto, type MensagemCtx } from './contexto';
import { avaliarSugestao, type Proposta } from './sugestoes-ia';
import { gerarTitulo } from './titulo';
import {
  buscarMensagem, inserirMensagemMarco, inserirRespostaJose, inserirSugestao, definirTitulo, mensagensDaConversa, memoriasDoUsuario, metasAtivas,
  respostasDoDia, sugestoesDaConversa, tarefasPendentes, type ConversaLinha, type MensagemLinha,
} from './repositorio';

const MS_36H = 36 * 60 * 60 * 1000;

export type EventoSaida =
  | { evento: 'texto'; dados: { delta: string } }
  | { evento: 'sugestao'; dados: { id: string; tipo: 'tarefa' | 'meta' | 'memoria'; conteudo: unknown; status: 'pendente' | 'salva' | 'descartada'; item_id: string | null } }
  | { evento: 'fim'; dados: { mensagem_id: string; titulo?: string } }
  | { evento: 'erro'; dados: { codigo: string; mensagem: string } };

export interface EntradaEnvio {
  env: Ambiente;
  deps: Dependencias;
  usuario: UsuarioLinha;
  conversa: ConversaLinha;
  mensagem: { id: string; texto: string; origem: 'texto' | 'voz' };
}

export const MENSAGEM_LIMITE = 'Limite de hoje atingido, volta amanhã.';

/** Texto usado quando o modelo só chamou a ferramenta, sem escrever a resposta (a mensagem nunca fica vazia). */
export const TEXTO_SO_SUGESTOES = 'Separei isto para você decidir se guarda.';

/** Traduz um erro da IA para o evento `erro` (mensagens do telas.md, sem detalhes internos). */
export function erroParaEvento(e: unknown): Extract<EventoSaida, { evento: 'erro' }> {
  const tipo = e instanceof ErroIA ? e.tipo : 'indisponivel';
  const [codigo, mensagem] =
    tipo === 'recusa' ? ['recusa', 'O José não pode ajudar com esse pedido.']
    : tipo === 'limite' ? ['ia_limite', 'O José está muito ocupado agora. Tente de novo em instantes.']
    : tipo === 'rede' || tipo === 'indisponivel' ? ['ia_indisponivel', 'O José não conseguiu responder agora.']
    : ['ia_erro', 'O José não conseguiu responder agora.'];
  return { evento: 'erro', dados: { codigo, mensagem } };
}

function respostaExistente(m: MensagemLinha): MensagemDto {
  return { id: m.id, autor: m.autor, texto: m.texto, origem: m.origem, modelo: m.modelo, criada_em: m.criada_em };
}

/**
 * Valida e grava a mensagem do Marco (antes de chamar a IA). Erros de API (404/409/429/500) saem aqui,
 * antes de abrir o fluxo SSE. Devolve um gerador com os eventos da resposta.
 */
export async function prepararEnvio(e: EntradaEnvio, repetiu = false): Promise<(sinal?: AbortSignal) => AsyncGenerator<EventoSaida>> {
  const { env, deps, usuario, conversa, mensagem } = e;
  const ia = deps.ia(env);
  if (!ia) throw new ErroApi(500, 'ia_indisponivel', 'O José ainda não está configurado neste ambiente.');

  const agora = deps.agora();
  const fuso = usuario.fuso_horario;
  const existente = await buscarMensagem(env.DB, mensagem.id);
  let jaGravada = false;

  if (existente) {
    // Regra 11: id repetido não duplica.
    if (existente.conversa_id !== conversa.id || existente.autor !== 'marco') throw new ErroApi(409, 'id_em_uso', 'Esse id de mensagem já foi usado.');
    const todas = await mensagensDaConversa(env.DB, conversa.id);
    const seguinte = todas[todas.findIndex((m) => m.id === existente.id) + 1];
    if (seguinte?.autor === 'jose') {
      // A resposta já existe: devolve o que está gravado, sem chamar a IA nem gastar o limite diário.
      return async function* () {
        yield { evento: 'texto', dados: { delta: seguinte.texto } };
        yield* sugestoesGravadas(env.DB, conversa.id, seguinte.id);
        yield { evento: 'fim', dados: { mensagem_id: seguinte.id } };
      };
    }
    if (seguinte) throw new ErroApi(409, 'mensagem_antiga', 'Essa mensagem não é a última da conversa.');
    jaGravada = true; // falta só a resposta
  }

  // Limite diário (regra 9): conta as respostas do José no dia local, inclusive as de "Tentar de novo".
  const limite = Number(env.LIMITE_MENSAGENS_DIA) || 200;
  const usadas = await respostasDoDia(env.DB, usuario.id, new Date(agora.getTime() - MS_36H).toISOString(), (iso) => diaLocal(iso, fuso), hoje(agora, fuso));
  if (usadas >= limite) throw new ErroApi(429, 'limite_diario', MENSAGEM_LIMITE);

  if (!jaGravada) {
    try {
      await inserirMensagemMarco(env.DB, conversa.id, mensagem, agora);
    } catch (erro) {
      // Dois envios simultâneos do mesmo id: a chave duplicada vira "já existe" (mesma lógica da idempotência).
      if (!repetiu && /UNIQUE|PRIMARY KEY|constraint/i.test(String((erro as Error)?.message ?? erro))) return prepararEnvio(e, true);
      throw erro;
    }
  }

  return (sinal) => responder(e, ia, sinal);
}

async function* sugestoesGravadas(db: D1Database, conversaId: string, mensagemId: string): AsyncGenerator<EventoSaida> {
  for (const s of await sugestoesDaConversa(db, conversaId)) {
    if (s.mensagem_id === mensagemId) yield { evento: 'sugestao', dados: { id: s.id, tipo: s.tipo, conteudo: s.conteudo, status: s.status, item_id: s.item_id } };
  }
}

async function* responder(e: EntradaEnvio, ia: ClienteIA, sinal?: AbortSignal): AsyncGenerator<EventoSaida> {
  const { env, deps, usuario, conversa } = e;
  const inicio = Date.now();
  const agora = deps.agora();
  const fuso = usuario.fuso_horario;

  const [memorias, metas, tarefas, mensagens, sugestoes] = await Promise.all([
    memoriasDoUsuario(env.DB, usuario.id),
    metasAtivas(env.DB, usuario.id),
    tarefasPendentes(env.DB, usuario.id, hoje(agora, fuso), LIMITE_TAREFAS_CONTEXTO),
    mensagensDaConversa(env.DB, conversa.id),
    sugestoesDaConversa(env.DB, conversa.id),
  ]);
  const historico: MensagemCtx[] = mensagens.map((m) => ({
    autor: m.autor,
    texto: m.texto,
    sugestoes: sugestoes.filter((s) => s.mensagem_id === m.id).map((s) => ({ tipo: s.tipo, conteudo: JSON.stringify(s.conteudo), status: s.status })),
  }));
  const contexto = montarContexto({ prompt, sugestoes: deps.sugestoesAtivas, modo: conversa.modo, memorias, metas, tarefas, agora, fuso, mensagens: historico });

  // Modo decisão → modelo profundo; senão o econômico (dados.md, regra 10).
  const profundo = conversa.modo === 'decidir';
  const pedido: PedidoIA = {
    modelo: profundo ? env.MODELO_PROFUNDO : env.MODELO_PADRAO,
    // Tetos folgados: o raciocínio adaptativo também conta; só o gerado é cobrado (o tamanho da resposta vem do prompt).
    maxTokens: profundo ? 4000 : 1500,
    esforco: 'low',
    ...contexto,
    ferramentas: deps.sugestoesAtivas,
    fallbackRecusa: profundo,
  };

  let texto = '';
  const propostas: Proposta[] = [];
  let fim: Extract<EventoIA, { tipo: 'fim' }> | undefined;

  try {
    for await (const ev of ia.transmitir(pedido, sinal)) {
      if (ev.tipo === 'texto') {
        texto += ev.delta;
        yield { evento: 'texto', dados: { delta: ev.delta } };
      } else if (ev.tipo === 'sugestao') {
        // Validada com Zod; o servidor ignora o que passar de 3 por resposta e a memória que já existe.
        const r = avaliarSugestao(ev.nome, ev.entrada, { ligadas: deps.sugestoesAtivas, memorias, aceitas: propostas });
        if (r.ok) propostas.push(r.proposta);
        // O log leva só ids, o nome da ferramenta e os campos inválidos (nunca o conteúdo).
        else console.warn('ia sugestão descartada', { conversa: conversa.id, ferramenta: ev.nome, motivo: r.motivo, campos: r.campos });
      } else {
        fim = ev;
      }
    }
    if (!fim) throw new ErroIA('indisponivel', 'Resposta vazia.');
    if (!texto.trim()) {
      if (!propostas.length) throw new ErroIA('indisponivel', 'Resposta vazia.');
      texto = TEXTO_SO_SUGESTOES;
      yield { evento: 'texto', dados: { delta: texto } };
    }
  } catch (erro) {
    if (erro instanceof ErroIA && erro.tipo === 'cancelado') return; // o Marco fechou a conexão: nada a gravar
    console.error('ia falhou', { conversa: conversa.id, tipo: erro instanceof ErroIA ? erro.tipo : 'desconhecido', status: erro instanceof ErroIA ? erro.status : undefined, ms: Date.now() - inicio });
    yield erroParaEvento(erro);
    return;
  }

  // Cortada por max_tokens: grava o que veio e marca com reticências para o Marco notar.
  if (fim.truncada) texto += ' …';
  const respostaId = uuidv7();
  await inserirRespostaJose(
    env.DB,
    conversa.id,
    { id: respostaId, texto, modelo: fim.modelo, tokensEntrada: fim.uso.tokensEntrada, tokensSaida: fim.uso.tokensSaida, tokensCache: fim.uso.tokensCache },
    deps.agora(),
  );
  // Só ids, modelo, tempos e tokens (nunca o conteúdo); serve para medir se o cache está pegando.
  if (fim.truncada) console.warn('ia truncada por max_tokens', { conversa: conversa.id, modelo: fim.modelo });
  console.log('ia ok', { conversa: conversa.id, modelo: fim.modelo, ms: Date.now() - inicio, ...fim.uso, truncada: fim.truncada });

  for (const p of propostas) {
    const id = uuidv7();
    await inserirSugestao(env.DB, { id, mensagemId: respostaId, tipo: p.tipo, conteudo: p.conteudo }, deps.agora());
    yield { evento: 'sugestao', dados: { id, tipo: p.tipo, conteudo: p.conteudo, status: 'pendente', item_id: null } };
  }

  // Título automático (regra 4): depois da 1ª resposta, pelo modelo econômico; falhou → 40 primeiros caracteres.
  let titulo: string | undefined;
  if (!conversa.titulo) {
    const primeira = mensagens.find((m) => m.autor === 'marco')?.texto ?? e.mensagem.texto;
    titulo = await gerarTitulo(ia, { modelo: env.MODELO_PADRAO, promptTitulo: prompt.titulo, primeiraMensagem: primeira, resposta: texto, sinal });
    await definirTitulo(env.DB, conversa.id, titulo);
  }

  yield { evento: 'fim', dados: titulo ? { mensagem_id: respostaId, titulo } : { mensagem_id: respostaId } };
}
