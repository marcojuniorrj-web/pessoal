import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assinarConversasApagadas, confirmarConversaApagada, consumirAviso, conversaApagada, conversaIndisponivel, conversaPendenteDeApagar,
  desmarcarPendenteDeApagar, limparConversasApagadas, marcarPendenteDeApagar, versaoConversasApagadas,
} from './conversas-apagadas';

beforeEach(limparConversasApagadas);

describe('conversas apagadas (módulo global)', () => {
  it('pendente é indisponível mas pode ser desfeita; confirmada é definitiva', () => {
    marcarPendenteDeApagar('c1');
    expect([conversaPendenteDeApagar('c1'), conversaApagada('c1'), conversaIndisponivel('c1')]).toEqual([true, false, true]);
    desmarcarPendenteDeApagar('c1');
    expect(conversaIndisponivel('c1')).toBe(false);
    marcarPendenteDeApagar('c1');
    confirmarConversaApagada('c1');
    expect([conversaPendenteDeApagar('c1'), conversaApagada('c1'), conversaIndisponivel('c1')]).toEqual([false, true, true]);
    desmarcarPendenteDeApagar('c1'); // depois de confirmada, nada a desfazer
    expect(conversaApagada('c1')).toBe(true);
  });

  it('o aviso é entregue uma vez só', () => {
    confirmarConversaApagada('c2', 'Conversa apagada.');
    expect(consumirAviso('c2')).toBe('Conversa apagada.');
    expect(consumirAviso('c2')).toBeUndefined();
  });

  it('avisa quem assinou a cada mudança', () => {
    const ouvinte = vi.fn();
    const sair = assinarConversasApagadas(ouvinte);
    const v = versaoConversasApagadas();
    marcarPendenteDeApagar('c3');
    confirmarConversaApagada('c3');
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(versaoConversasApagadas()).toBe(v + 2);
    sair();
    marcarPendenteDeApagar('c4');
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });
});
