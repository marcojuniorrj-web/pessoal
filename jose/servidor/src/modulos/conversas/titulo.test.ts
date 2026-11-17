import { describe, expect, it } from 'vitest';
import { ErroIA } from '../../adaptadores/ia/tipos';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { criarIaFalsa, lerEventos } from '../../../testes/ia-falsa';
import { gerarTitulo, limparTitulo, tituloFallback } from './titulo';

describe('limparTitulo / tituloFallback', () => {
  it('limpa aspas, markdown, ponto final e corta em 6 palavras', () => {
    expect(limparTitulo('"Plano para o dia de hoje."')).toBe('Plano para o dia de hoje');
    expect(limparTitulo('**Título:** Travado no relatório de vendas do mês\nOutra linha')).toBe('Travado no relatório de vendas do');
    expect(limparTitulo('um dois três quatro cinco seis sete oito')).toBe('um dois três quatro cinco seis');
    expect(limparTitulo('  \n ')).toBe('');
  });
  it('fallback: 40 primeiros caracteres da 1ª mensagem', () => {
    expect(tituloFallback('a'.repeat(100))).toBe('a'.repeat(40));
    expect(tituloFallback('  travei   no\nrelatório  ')).toBe('travei no relatório');
    expect(tituloFallback('')).toBe('Nova conversa');
  });
});

describe('gerarTitulo', () => {
  it('com a IA falhando, usa o fallback', async () => {
    const { ia } = criarIaFalsa([{}], { titulo: new ErroIA('indisponivel', 'x') });
    const t = await gerarTitulo(ia, { modelo: 'm', promptTitulo: 'Você nomeia conversas.', primeiraMensagem: 'travei no relatório de vendas e não consigo começar de jeito nenhum', resposta: 'ok' });
    expect(t).toBe('travei no relatório de vendas e não consigo começar de jeito nenhum'.slice(0, 40).trim());
    expect(t.length).toBeLessThanOrEqual(40);
  });
  it('saída vazia da IA também cai no fallback', async () => {
    const { ia } = criarIaFalsa([{}], { titulo: '   ' });
    expect(await gerarTitulo(ia, { modelo: 'm', promptTitulo: 'Você nomeia conversas.', primeiraMensagem: 'oi José', resposta: 'ok' })).toBe('oi José');
  });
});

describe('título no fluxo da mensagem', () => {
  const cab = (cookie: string) => ({ cookie, origin: URL_TESTE, 'content-type': 'application/json' });
  async function rodar(titulo: string | Error) {
    const falsa = criarIaFalsa([{ partes: ['Resposta.'] }], { titulo });
    const t = criarAppTeste({ ia: falsa.ia });
    const { cookie } = await entrar(t);
    const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: cab(cookie), body: '{"tipo":"normal"}' })).json()) as { id: string };
    const enviar = async (mid: string, texto: string) => lerEventos(await t.chamar(`/api/conversas/${id}/mensagens`, { method: 'POST', headers: cab(cookie), body: JSON.stringify({ id: mid, texto, origem: 'texto' }) }));
    const titulo_ = async () => (await t.env.DB.prepare('SELECT titulo FROM conversas WHERE id = ?').bind(id).first<{ titulo: string | null }>())!.titulo;
    return { falsa, enviar, titulo: titulo_ };
  }

  it('sai no evento fim, é gravado e usa o modelo econômico; a 2ª resposta não gera outro', async () => {
    const x = await rodar('"Plano do dia."');
    const e1 = await x.enviar('a1', 'O que faço hoje?');
    expect(e1.at(-1)).toMatchObject({ evento: 'fim', dados: { titulo: 'Plano do dia' } });
    expect(await x.titulo()).toBe('Plano do dia');
    expect(x.falsa.pedidosTitulo).toHaveLength(1);
    expect(x.falsa.pedidosTitulo[0]).toMatchObject({ modelo: 'claude-haiku-5-5' });
    expect(x.falsa.pedidosTitulo[0]!.mensagens[0]!.texto).toContain('O que faço hoje?');
    const e2 = await x.enviar('a2', 'mais uma');
    expect(e2.at(-1)!.dados).not.toHaveProperty('titulo');
    expect(x.falsa.pedidosTitulo).toHaveLength(1);
  });

  it('com a IA falhando no título, o fim traz os 40 primeiros caracteres da 1ª mensagem', async () => {
    const x = await rodar(new ErroIA('indisponivel', 'x'));
    const msg = 'travei no relatório de vendas e não consigo começar de jeito nenhum';
    const esperado = msg.slice(0, 40).trim();
    const e = await x.enviar('b1', msg);
    expect(e.at(-1)).toMatchObject({ evento: 'fim', dados: { titulo: esperado } });
    expect(await x.titulo()).toBe(esperado);
  });
});
