import { describe, expect, it } from 'vitest';
import { criarParserSse } from './sse';

describe('parser SSE do cliente', () => {
  it('junta eventos quebrados em qualquer ponto', () => {
    const p = criarParserSse();
    const texto = 'event: texto\ndata: {"delta":"Bom "}\n\nevent: texto\ndata: {"delta":"dia"}\n\nevent: fim\ndata: {"mensagem_id":"m1"}\n\n';
    const saida = [];
    for (let i = 0; i < texto.length; i += 5) saida.push(...p.alimentar(texto.slice(i, i + 5)));
    expect(saida).toEqual([
      { evento: 'texto', dados: { delta: 'Bom ' } },
      { evento: 'texto', dados: { delta: 'dia' } },
      { evento: 'fim', dados: { mensagem_id: 'm1' } },
    ]);
  });
  it('aceita CRLF e ignora comentários e blocos malformados', () => {
    const p = criarParserSse();
    expect(p.alimentar(': ping\n\nevent: erro\r\ndata: {"codigo":"x"}\r\n\r\nevent: texto\ndata: {quebrado\n\n')).toEqual([{ evento: 'erro', dados: { codigo: 'x' } }]);
  });
});
