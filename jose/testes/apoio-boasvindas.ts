// API de boas-vindas simulada (Playwright): /api/eu com a flag, criação da conversa com a 1ª pergunta, respostas por SSE
// (perguntas fixas e, na 5ª resposta, o resumo com as memórias sugeridas), lote e "concluir". O que não é das boas-vindas cai
// de volta (`fallback`) para os simuladores de apoio.ts.
import type { Page } from '@playwright/test';
import { PERGUNTAS_BOAS_VINDAS } from '../compartilhado/boasvindas';
import type { MemoriasFalsas } from './apoio';

interface Msg { id: string; autor: 'marco' | 'jose'; texto: string; origem: 'texto' | 'voz'; modelo: string | null; criada_em: string }
interface Sug { id: string; mensagem_id: string; tipo: 'memoria'; conteudo: { texto: string; area: string }; status: 'pendente' | 'salva' | 'descartada'; item_id: string | null }
export interface ConversaBV { id: string; mensagens: Msg[]; sugestoes: Sug[] }

export interface BoasVindasFalsas {
  /** Flag `boas_vindas_concluida`. */
  concluida: boolean;
  conversas: ConversaBV[];
  /** O que o "José" sugere na chamada final (5ª resposta). */
  memorias: Array<{ texto: string; area: string }>;
  /** Atraso (ms) das respostas aos envios. */
  atrasoMs: number;
  /** Resultado de cada envio, na ordem (padrão: ok): 'erro-ia' = só o erro do SSE; 'rede' = a conexão cai. */
  planos: Array<'ok' | 'erro-ia' | 'rede'>;
  /** Quantas chamadas do lote devem falhar antes de funcionar ('rede' = conexão cai; 500 = erro do servidor). */
  loteFalhas: Array<'rede' | 500>;
  /** Faz POST /api/eu/boas-vindas responder 500. */
  concluirFalha: boolean;
  criadas: number;
  concluidos: number;
  lotes: Array<{ conversa: string; salvar: Array<{ id: string; conteudo?: { texto: string; area: string } }>; descartar: string[] }>;
  envios: Array<{ conversa: string; id: string; texto: string; origem: string }>;
  /** Leituras de GET /api/eu. */
  leiturasEu: number;
}

const iso = () => new Date().toISOString();
const sse = (eventos: Array<[string, unknown]>) => eventos.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
const NAO_ENCONTRADO = { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } };

/** Cinco respostas para chegar ao resumo (a 1ª pergunta já existe na conversa criada). */
export const RESPOSTAS = ['Acordo às 6h, trabalho até as 19h.', 'Trabalho, Saúde e rotina', 'Bater a meta e correr uma meia-maratona.', 'Começar o que é grande demais', 'Acordo 6h, durmo 22h'];
export const QUATRO_MEMORIAS = [
  { texto: 'Acorda às 6h e dorme às 22h.', area: 'saude' },
  { texto: 'Quer correr uma meia-maratona.', area: 'saude' },
  { texto: 'Tem dificuldade para começar tarefas grandes.', area: 'sobre_mim' },
  { texto: 'Quer bater a meta de vendas do trimestre.', area: 'trabalho' },
];

/** Conversa de boas-vindas já com `respostas` respostas dadas (e a pergunta seguinte feita). */
export function conversaBV(id: string, respostas: number): ConversaBV {
  const mensagens: Msg[] = [{ id: `${id}-p0`, autor: 'jose', texto: PERGUNTAS_BOAS_VINDAS[0]!.texto, origem: 'texto', modelo: null, criada_em: iso() }];
  for (let i = 0; i < Math.min(respostas, 5); i++) {
    mensagens.push({ id: `${id}-r${i}`, autor: 'marco', texto: RESPOSTAS[i]!, origem: 'texto', modelo: null, criada_em: iso() });
    if (i + 1 < 5) mensagens.push({ id: `${id}-p${i + 1}`, autor: 'jose', texto: PERGUNTAS_BOAS_VINDAS[i + 1]!.texto, origem: 'texto', modelo: null, criada_em: iso() });
  }
  return { id, mensagens, sugestoes: [] };
}

export async function simularBoasVindas(page: Page, inicial: Partial<BoasVindasFalsas> = {}, memoriasSalvas?: MemoriasFalsas): Promise<BoasVindasFalsas> {
  const f: BoasVindasFalsas = {
    concluida: false, conversas: [], memorias: QUATRO_MEMORIAS, atrasoMs: 0, planos: [], loteFalhas: [], concluirFalha: false,
    criadas: 0, concluidos: 0, lotes: [], envios: [], leiturasEu: 0, ...inicial,
  };
  let proximo = 1;

  await page.route((url) => url.pathname === '/api/eu', async (rota) => {
    if (rota.request().method() !== 'GET') return rota.fallback();
    f.leiturasEu++;
    const aberta = f.concluida ? undefined : f.conversas.at(-1);
    return rota.fulfill({
      status: 200,
      json: { nome: 'Marco', email: 'marco@gmail.com', foto_url: null, boas_vindas_concluida: f.concluida, fuso_horario: 'America/Sao_Paulo', ...(aberta ? { conversa_boas_vindas_id: aberta.id } : {}) },
    });
  });

  await page.route((url) => url.pathname === '/api/eu/boas-vindas', async (rota) => {
    if (f.concluirFalha) return rota.fulfill({ status: 500, json: { erro: { codigo: 'erro_interno', mensagem: 'x' } } });
    f.concluida = true;
    f.concluidos++;
    return rota.fulfill({ status: 204 });
  });

  await page.route((url) => url.pathname.startsWith('/api/conversas'), async (rota) => {
    const req = rota.request();
    const partes = new URL(req.url()).pathname.split('/').filter(Boolean); // api, conversas, [id], [mensagens|sugestoes], [lote]
    const metodo = req.method();
    const json = (status: number, corpo: unknown) => rota.fulfill({ status, json: corpo });

    if (partes.length === 2 && metodo === 'POST') {
      const corpo = req.postDataJSON() as { tipo: string };
      if (corpo.tipo !== 'boas_vindas') return rota.fallback();
      f.criadas++;
      const c = conversaBV(`bv${proximo++}`, 0);
      f.conversas.push(c);
      return json(201, { id: c.id });
    }
    const conversa = f.conversas.find((x) => x.id === partes[2]);
    if (!conversa) return rota.fallback();

    if (partes.length === 3 && metodo === 'GET') {
      return json(200, { conversa: { id: conversa.id, titulo: 'Boas-vindas', tipo: 'boas_vindas', modo: 'padrao', criada_em: iso(), atualizada_em: iso() }, mensagens: conversa.mensagens, sugestoes: conversa.sugestoes });
    }

    if (partes[3] === 'mensagens') {
      const msg = req.postDataJSON() as { id: string; texto: string; origem: 'texto' | 'voz' };
      f.envios.push({ conversa: conversa.id, id: msg.id, texto: msg.texto, origem: msg.origem });
      if (f.atrasoMs) await new Promise((r) => setTimeout(r, f.atrasoMs));
      const plano = f.planos.shift() ?? 'ok';
      if (plano === 'rede') return rota.abort('connectionfailed');
      const jaTinha = conversa.mensagens.some((m) => m.id === msg.id);
      if (!jaTinha) conversa.mensagens.push({ id: msg.id, autor: 'marco', texto: msg.texto, origem: msg.origem, modelo: null, criada_em: iso() });
      if (plano === 'erro-ia') return rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sse([['erro', { codigo: 'ia_indisponivel', mensagem: 'O José não conseguiu responder agora.' }]]) });
      const respostas = conversa.mensagens.filter((m) => m.autor === 'marco').length;
      const resposta = conversa.mensagens[conversa.mensagens.findIndex((m) => m.id === msg.id) + 1];
      if (resposta?.autor === 'jose') {
        return rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sse([['texto', { delta: resposta.texto }], ['fim', { mensagem_id: resposta.id }]]) });
      }
      if (respostas > 5) return json(409, { erro: { codigo: 'boas_vindas_completa', mensagem: 'As perguntas das boas-vindas já terminaram.' } });
      if (respostas < 5) {
        const p: Msg = { id: `${conversa.id}-p${respostas}`, autor: 'jose', texto: PERGUNTAS_BOAS_VINDAS[respostas]!.texto, origem: 'texto', modelo: null, criada_em: iso() };
        conversa.mensagens.push(p);
        return rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sse([['texto', { delta: p.texto }], ['fim', { mensagem_id: p.id }]]) });
      }
      const final: Msg = { id: `${conversa.id}-final`, autor: 'jose', texto: 'Obrigado, Marco. Vou mostrar o que entendi para você confirmar.', origem: 'texto', modelo: 'claude-haiku-5-5', criada_em: iso() };
      conversa.mensagens.push(final);
      const novas = f.memorias.map((m, i): Sug => ({ id: `${conversa.id}-s${i}`, mensagem_id: final.id, tipo: 'memoria', conteudo: m, status: 'pendente', item_id: null }));
      conversa.sugestoes.push(...novas);
      return rota.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([['texto', { delta: final.texto }], ...novas.map((n): [string, unknown] => ['sugestao', { id: n.id, tipo: 'memoria', conteudo: n.conteudo, status: 'pendente', item_id: null }]), ['fim', { mensagem_id: final.id }]]),
      });
    }

    if (partes[3] === 'sugestoes' && partes[4] === 'lote') {
      const corpo = req.postDataJSON() as { salvar: BoasVindasFalsas['lotes'][number]['salvar']; descartar: string[] };
      f.lotes.push({ conversa: conversa.id, ...corpo });
      const falha = f.loteFalhas.shift();
      if (falha === 'rede') return rota.abort('connectionfailed');
      if (falha === 500) return json(500, { erro: { codigo: 'erro_interno', mensagem: 'x' } });
      const itens: unknown[] = [];
      for (const s of corpo.salvar) {
        const sug = conversa.sugestoes.find((x) => x.id === s.id);
        if (!sug || sug.status !== 'pendente') continue;
        if (s.conteudo) sug.conteudo = s.conteudo;
        sug.status = 'salva';
        sug.item_id = `mem-${sug.id}`;
        const m = { id: sug.item_id, texto: sug.conteudo.texto, area: sug.conteudo.area, origem: 'boas_vindas' as const, criada_em: iso(), atualizada_em: null };
        itens.push(m);
        memoriasSalvas?.memorias.push(m);
      }
      for (const id of corpo.descartar) {
        const sug = conversa.sugestoes.find((x) => x.id === id);
        if (sug && sug.status === 'pendente') sug.status = 'descartada';
      }
      f.concluida = true;
      f.concluidos++;
      return json(200, { itens });
    }
    return json(404, NAO_ENCONTRADO);
  });
  return f;
}
