import { describe, expect, it } from 'vitest';
import { lerPrompt } from '../../adaptadores/ia/prompt';
import { LIMITE_MENSAGENS_CONTEXTO, LIMITE_TAREFAS_CONTEXTO, montarContexto, normalizarMensagens, type EntradaContexto } from './contexto';

const prompt = lerPrompt('=== BASE ===\nPROMPT-BASE\n=== SUGESTOES ===\nPROMPT-SUGESTOES\n=== DECIDIR ===\nPROMPT-DECIDIR\n=== TITULO ===\nPROMPT-TITULO');
const agora = new Date('2026-11-17T14:20:00-03:00');

const entrada = (extra: Partial<EntradaContexto> = {}): EntradaContexto => ({
  prompt, sugestoes: true, modo: 'padrao', agora,
  memorias: [{ texto: 'Acorda às 7h.', area: 'saude' }, { texto: 'É gerente comercial.', area: 'sobre_mim' }],
  metas: [{ titulo: 'Fechar a meta do trimestre', area: 'trabalho', prazo: '2026-12-20' }],
  tarefas: [{ titulo: 'Enviar proposta', area: 'trabalho', prazo: '2026-11-17' }, { titulo: 'Pagar condomínio', area: 'casa', prazo: null }],
  mensagens: [{ autor: 'marco', texto: 'oi' }],
  ...extra,
});

describe('montarContexto', () => {
  it('snapshot: ordem sistema → memórias → metas → tarefas | data/hora → mensagens', () => {
    const c = montarContexto(entrada());
    expect(c.sistemaEstavel).toMatchInlineSnapshot(`
      "PROMPT-BASE

      PROMPT-SUGESTOES

      O que você sabe sobre o Marco (memórias):
      - [Saúde e rotina] Acorda às 7h.
      - [Sobre mim] É gerente comercial.

      Metas ativas do Marco:
      - [Trabalho] Fechar a meta do trimestre (prazo 2026-12-20)

      Tarefas pendentes do Marco (as mais urgentes primeiro):
      - [Trabalho] Enviar proposta (prazo 2026-11-17)
      - [Família e casa] Pagar condomínio"
    `);
    expect(c.sistemaVolatil).toMatchInlineSnapshot(`"Agora: terça-feira, 17 de novembro de 2026, 14:20 (America/Sao_Paulo). Hoje é 2026-11-17."`);
    expect(c.mensagens).toEqual([{ papel: 'user', texto: 'oi' }]);
  });

  it('data/hora ficam depois do ponto de cache (só no bloco volátil)', () => {
    const c = montarContexto(entrada());
    expect(c.sistemaEstavel).not.toMatch(/Agora:|2026-11-17T|14:20/);
    expect(c.sistemaVolatil).toContain('14:20');
    // O bloco estável não muda quando só a hora muda (condição para o cache funcionar).
    const outra = montarContexto(entrada({ agora: new Date('2026-11-17T15:45:00-03:00') }));
    expect(outra.sistemaEstavel).toBe(c.sistemaEstavel);
    expect(outra.sistemaVolatil).not.toBe(c.sistemaVolatil);
  });

  it('corta as tarefas em 50 e as mensagens em 20 (as mais recentes)', () => {
    const tarefas = Array.from({ length: 60 }, (_, i) => ({ titulo: `T${i}`, area: 'casa' as const, prazo: null }));
    const mensagens = Array.from({ length: 30 }, (_, i) => ({ autor: (i % 2 === 0 ? 'marco' : 'jose') as 'marco' | 'jose', texto: `m${i}` }));
    const c = montarContexto(entrada({ tarefas, mensagens }));
    expect(c.sistemaEstavel).toContain('T49');
    expect(c.sistemaEstavel).not.toContain('T50');
    expect(LIMITE_TAREFAS_CONTEXTO).toBe(50);
    expect(LIMITE_MENSAGENS_CONTEXTO).toBe(20);
    // 30 mensagens → as últimas 20 (m10..m29); m10 é do marco (user), então não sobra assistant inicial.
    expect(c.mensagens.map((m) => m.texto)).toEqual(Array.from({ length: 20 }, (_, i) => `m${i + 10}`));
  });

  it('modo decidir coloca a instrução depois do ponto de cache; sugestões só se ligadas', () => {
    const d = montarContexto(entrada({ modo: 'decidir', sugestoes: false }));
    expect(d.sistemaVolatil).toContain('PROMPT-DECIDIR');
    expect(d.sistemaEstavel).not.toContain('PROMPT-DECIDIR');
    expect(d.sistemaEstavel).not.toContain('PROMPT-SUGESTOES');
  });

  it('mensagens antigas viram texto puro com linha-resumo das sugestões', () => {
    const c = montarContexto(entrada({
      mensagens: [
        { autor: 'marco', texto: 'preciso ligar para o João' },
        { autor: 'jose', texto: 'Anotado.', sugestoes: [{ tipo: 'tarefa', conteudo: '{"titulo":"Ligar para o João","area":"trabalho"}', status: 'salva' }] },
        { autor: 'marco', texto: 'valeu' },
      ],
    }));
    expect(c.mensagens[1]!.texto).toBe('Anotado.\n[sugeriu tarefa "Ligar para o João" — salva]');
    expect(JSON.stringify(c.mensagens)).not.toContain('tool_use');
  });

  it('sem memórias, metas e tarefas, diz isso explicitamente', () => {
    const c = montarContexto(entrada({ memorias: [], metas: [], tarefas: [] }));
    expect(c.sistemaEstavel).toContain('memórias): nada ainda.');
    expect(c.sistemaEstavel).toContain('Metas ativas do Marco: nenhuma.');
    expect(c.sistemaEstavel).toContain('Tarefas pendentes do Marco: nenhuma.');
  });
});

describe('normalizarMensagens', () => {
  it('junta papéis repetidos (mensagem do Marco sem resposta) e começa em user', () => {
    expect(normalizarMensagens([
      { papel: 'assistant', texto: 'a0' },
      { papel: 'user', texto: 'u1' },
      { papel: 'user', texto: 'u2' },
      { papel: 'assistant', texto: 'a1' },
      { papel: 'user', texto: 'u3' },
    ])).toEqual([
      { papel: 'user', texto: 'u1\n\nu2' },
      { papel: 'assistant', texto: 'a1' },
      { papel: 'user', texto: 'u3' },
    ]);
  });
});
