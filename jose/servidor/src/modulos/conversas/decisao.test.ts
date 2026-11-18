import { describe, expect, it } from 'vitest';
import { TEXTO_ATALHO_DECISAO } from '@compartilhado/decisao';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { criarIaFalsa, lerEventos, type Passo } from '../../../testes/ia-falsa';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function preparar(roteiro: Passo[]) {
  const falsa = criarIaFalsa(roteiro, { titulo: 'Decisão sobre nova equipe' });
  const t = criarAppTeste({ ia: falsa.ia, agora: () => new Date('2026-11-18T13:00:00Z'), sugestoesAtivas: ['memoria', 'tarefa', 'meta'] });
  const { cookie } = await entrar(t);
  const cab = { cookie, origin: URL_TESTE, 'content-type': 'application/json' };
  const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: cab, body: '{"tipo":"normal","modo":"decidir"}' })).json()) as { id: string };
  const enviar = (n: number, texto: string) => t.chamar(`/api/conversas/${id}/mensagens`, { method: 'POST', headers: cab, body: JSON.stringify({ id: UUID(n), texto, origem: 'texto' }) });
  const titulo = async () => (await t.env.DB.prepare('SELECT titulo FROM conversas WHERE id = ?').bind(id).first<{ titulo: string | null }>())!.titulo;
  return { t, id, enviar, titulo, ...falsa };
}

describe('modo decisão (6.5): a pergunta inicial vem do José (modelo profundo)', () => {
  it('o atalho envia "Preciso decidir": a resposta é do modelo profundo, com a seção DECIDIR, fallback de recusa e o usage do modelo profundo gravado', async () => {
    const x = await preparar([{ partes: ['Qual é a decisão?'], uso: { tokensEntrada: 400, tokensSaida: 8 } }]);
    const eventos = await lerEventos(await x.enviar(1, TEXTO_ATALHO_DECISAO));
    expect(eventos.map((e) => e.evento)).toEqual(['texto', 'fim']);
    expect(eventos[0]!.dados.delta).toBe('Qual é a decisão?');
    expect(x.pedidos).toHaveLength(1);
    expect(x.pedidos[0]).toMatchObject({ modelo: 'claude-sonnet-5-5', fallbackRecusa: true, maxTokens: 4000 });
    expect(x.pedidos[0]!.sistemaVolatil).toContain('Qual é a decisão?');
    expect(x.pedidos[0]!.sistemaVolatil).toContain('Modo decisão');
    expect(x.pedidos[0]!.mensagens).toEqual([{ papel: 'user', texto: 'Preciso decidir' }]);
    const resposta = await x.t.env.DB.prepare("SELECT modelo, tokens_entrada, tokens_saida FROM mensagens WHERE autor = 'jose'").first();
    expect(resposta).toEqual({ modelo: 'claude-sonnet-5-5', tokens_entrada: 400, tokens_saida: 8 });
  });

  it('o título espera a 1ª mensagem de verdade: o aviso do atalho não vira título', async () => {
    const x = await preparar([{ partes: ['Qual é a decisão?'] }, { partes: ['O que você quer ter lá na frente?'] }]);
    const a = await lerEventos(await x.enviar(1, 'Preciso decidir'));
    expect(a.at(-1)!.dados).not.toHaveProperty('titulo');
    expect(await x.titulo()).toBeNull();
    expect(x.pedidosTitulo).toHaveLength(0);

    const b = await lerEventos(await x.enviar(2, 'Fico na empresa ou aceito gerenciar outra equipe?'));
    expect(b.at(-1)!.dados.titulo).toBe('Decisão sobre nova equipe');
    expect(await x.titulo()).toBe('Decisão sobre nova equipe');
    // o título foi pedido com a decisão (e não com o aviso do atalho)
    expect(x.pedidosTitulo).toHaveLength(1);
    expect(x.pedidosTitulo[0]!.mensagens[0]!.texto).toContain('Fico na empresa ou aceito gerenciar outra equipe?');
    expect(x.pedidosTitulo[0]!.mensagens[0]!.texto).not.toContain('Preciso decidir');
  });

  it('quem já descreve a decisão na 1ª mensagem ganha o título na hora; no chat comum "Preciso decidir" continua valendo como 1ª mensagem', async () => {
    const x = await preparar([{ partes: ['Eu iria de aceitar. Topa?'] }]);
    const a = await lerEventos(await x.enviar(1, 'Fico ou aceito a proposta?'));
    expect(a.at(-1)!.dados.titulo).toBe('Decisão sobre nova equipe');

    const falsa = criarIaFalsa([{}], { titulo: 'Conversa comum' });
    const t = criarAppTeste({ ia: falsa.ia, agora: () => new Date('2026-11-18T13:00:00Z') });
    const { cookie } = await entrar(t);
    const cab = { cookie, origin: URL_TESTE, 'content-type': 'application/json' };
    const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: cab, body: '{"tipo":"normal"}' })).json()) as { id: string };
    const e = await lerEventos(await t.chamar(`/api/conversas/${id}/mensagens`, { method: 'POST', headers: cab, body: JSON.stringify({ id: UUID(9), texto: 'Preciso decidir', origem: 'texto' }) }));
    expect(e.at(-1)!.dados.titulo).toBe('Conversa comum');
  });

  it('a resposta da decisão pode trazer o 1º passo como cartão de tarefa (com prazo), no máximo 3 cartões', async () => {
    const x = await preparar([{ partes: ['Eu iria de aceitar.'], sugestoes: [{ nome: 'sugerir_tarefa', entrada: { titulo: 'Pedir a proposta por escrito', area: 'trabalho', prazo: '2026-11-20' } }] }]);
    const eventos = await lerEventos(await x.enviar(1, 'Fico ou aceito? Respondo até sexta.'));
    const cartao = eventos.find((e) => e.evento === 'sugestao')!;
    expect(cartao.dados).toMatchObject({ tipo: 'tarefa', conteudo: { titulo: 'Pedir a proposta por escrito', prazo: '2026-11-20' }, status: 'pendente' });
  });
});
