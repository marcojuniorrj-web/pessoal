import { describe, expect, it } from 'vitest';
import { criarFilaPorItem } from './fila-por-item';

const pausa = () => new Promise<void>((r) => setTimeout(r, 5));

describe('criarFilaPorItem', () => {
  it('chamadas do mesmo item rodam na ordem em que entraram, mesmo que a primeira demore mais', async () => {
    const enfileirar = criarFilaPorItem();
    const ordem: string[] = [];
    const a = enfileirar('t1', async () => { await pausa(); await pausa(); ordem.push('concluir'); });
    const b = enfileirar('t1', async () => { ordem.push('desfazer'); });
    await Promise.all([a, b]);
    expect(ordem).toEqual(['concluir', 'desfazer']);
  });
  it('itens diferentes não esperam um pelo outro', async () => {
    const enfileirar = criarFilaPorItem();
    const ordem: string[] = [];
    const a = enfileirar('t1', async () => { await pausa(); await pausa(); ordem.push('t1'); });
    const b = enfileirar('t2', async () => { ordem.push('t2'); });
    await Promise.all([a, b]);
    expect(ordem).toEqual(['t2', 't1']);
  });
  it('uma falha não trava a fila: a próxima roda e o erro chega a quem chamou', async () => {
    const enfileirar = criarFilaPorItem();
    const a = enfileirar('t1', async () => { throw new Error('falhou'); });
    const b = enfileirar('t1', async () => 'ok');
    await expect(a).rejects.toThrow('falhou');
    await expect(b).resolves.toBe('ok');
  });
});
