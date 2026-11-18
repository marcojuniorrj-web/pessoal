import { describe, expect, it } from 'vitest';
import type { ConversaCompleta } from '@compartilhado/schemas';
import type { Bolha } from './chat';
import { FOLGA_RECENTE_MS, ID_TEMPORARIO, mesclarComServidor } from './reconciliar';

const AGORA = Date.parse('2026-11-18T12:00:00.000Z');
const iso = (segAtras: number) => new Date(AGORA - segAtras * 1000).toISOString();
const msg = (id: string, autor: 'marco' | 'jose', seg = 600): ConversaCompleta['mensagens'][number] => ({ id, autor, texto: `texto ${id}`, origem: 'texto', modelo: null, criada_em: iso(seg) });
const servidor = (mensagens: ConversaCompleta['mensagens'], sugestoes: ConversaCompleta['sugestoes'] = []): ConversaCompleta => ({
  conversa: { id: 'c', titulo: 'T', tipo: 'normal', modo: 'padrao', criada_em: iso(900), atualizada_em: iso(10) },
  mensagens,
  sugestoes,
});
const local = (id: string, autor: 'marco' | 'jose', extra: Partial<Bolha> = {}): Bolha => ({ id, autor, texto: `texto ${id}`, origem: 'texto', estado: 'ok', criadaEm: iso(600), ...extra });
const ids = (l: Bolha[]) => l.map((b) => b.id);

describe('mesclarComServidor', () => {
  it('sem diferença devolve a MESMA lista (nada de piscar nem rolar)', () => {
    const locais = [local('a', 'marco'), local('b', 'jose')];
    expect(mesclarComServidor(locais, servidor([msg('a', 'marco'), msg('b', 'jose')]), { agora: AGORA })).toBe(locais);
  });

  it('uma mensagem que o servidor não tem mais (apagada em outro aparelho) sai da tela', () => {
    const r = mesclarComServidor([local('a', 'marco'), local('b', 'jose')], servidor([msg('a', 'marco')]), { agora: AGORA });
    expect(ids(r)).toEqual(['a']);
  });

  it('uma mensagem que o servidor ainda tem (o DELETE não valeu) volta à lista', () => {
    const r = mesclarComServidor([local('a', 'marco')], servidor([msg('a', 'marco'), msg('b', 'jose')]), { agora: AGORA });
    expect(ids(r)).toEqual(['a', 'b']);
  });

  it('preserva a resposta em andamento e a mensagem do Marco que espera por ela (ainda não gravada)', () => {
    const locais = [
      local('a', 'marco'), local('b', 'jose'),
      local('nova', 'marco', { criadaEm: iso(1) }),
      local(ID_TEMPORARIO, 'jose', { estado: 'transmitindo', texto: 'Resposta parcial', criadaEm: undefined }),
    ];
    const r = mesclarComServidor(locais, servidor([msg('a', 'marco'), msg('b', 'jose')]), { agora: AGORA, pendenteId: 'nova' });
    expect(ids(r)).toEqual(['a', 'b', 'nova', ID_TEMPORARIO]);
    expect(r.at(-1)!.texto).toBe('Resposta parcial');
  });

  it('preserva a bolha de erro ("Tentar de novo") e a mensagem pendente mesmo antiga', () => {
    const locais = [local('a', 'marco', { criadaEm: iso(3600) }), local(ID_TEMPORARIO, 'jose', { estado: 'erro', erro: { tipo: 'ia', mensagem: 'x' }, criadaEm: undefined })];
    expect(ids(mesclarComServidor(locais, servidor([]), { agora: AGORA, pendenteId: 'a' }))).toEqual(['a', ID_TEMPORARIO]);
  });

  it('o que acabou de chegar e o servidor ainda não devolve fica por ~20 s; depois disso some', () => {
    const recente = local('r', 'jose', { criadaEm: iso(FOLGA_RECENTE_MS / 1000 - 5) });
    const velha = local('v', 'jose', { criadaEm: iso(FOLGA_RECENTE_MS / 1000 + 5) });
    expect(ids(mesclarComServidor([recente], servidor([]), { agora: AGORA }))).toEqual(['r']);
    expect(ids(mesclarComServidor([velha], servidor([]), { agora: AGORA }))).toEqual([]);
  });

  it('cartão salvo ou descartado aqui nunca volta a pendente por uma leitura atrasada', () => {
    const l = local('b', 'jose', { sugestoes: [{ id: 's1', tipo: 'tarefa', conteudo: { titulo: 'Editado' }, status: 'salva', itemId: 't1' }, { id: 's2', tipo: 'meta', conteudo: {}, status: 'descartada' }] });
    const sv = servidor([msg('b', 'jose')], [
      { id: 's1', mensagem_id: 'b', tipo: 'tarefa', conteudo: { titulo: 'Original' }, status: 'pendente', item_id: null },
      { id: 's2', mensagem_id: 'b', tipo: 'meta', conteudo: {}, status: 'pendente', item_id: null },
    ]);
    const r = mesclarComServidor([l], sv, { agora: AGORA });
    expect(r[0]!.sugestoes!.map((s) => s.status)).toEqual(['salva', 'descartada']);
    expect(r[0]!.sugestoes![0]).toMatchObject({ conteudo: { titulo: 'Editado' }, itemId: 't1' });
  });

  it('o status do servidor vale quando é mais novo (salvo em outro aparelho)', () => {
    const l = local('b', 'jose', { sugestoes: [{ id: 's1', tipo: 'memoria', conteudo: {}, status: 'pendente' }] });
    const sv = servidor([msg('b', 'jose')], [{ id: 's1', mensagem_id: 'b', tipo: 'memoria', conteudo: {}, status: 'salva', item_id: 'm1' }]);
    expect(mesclarComServidor([l], sv, { agora: AGORA })[0]!.sugestoes![0]!.status).toBe('salva');
  });
});
