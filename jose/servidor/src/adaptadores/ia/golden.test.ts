import { describe, expect, it } from 'vitest';
import { avaliarCaso, avaliarResposta, CASOS_GOLDEN } from './golden';
import { secaoSugestoes } from '../../modulos/conversas/contexto';
import { lerPrompt, prompt } from './prompt';

describe('prompt-jose.md (ajuste de coaching)', () => {
  it('tem o tom do Marco, o corte de análise, o foco na solução e a formulação de metas', () => {
    expect(prompt.base).toContain('opções e desafios em vez de ordens');
    expect(prompt.base).toContain('corte a análise');
    expect(prompt.base).toContain('perguntas focadas na solução');
    expect(prompt.base).toContain('formulá-lo bem');
    expect(prompt.base).toContain('sem explicar o método');
  });
  it('a meta sugerida é positiva e concreta', () => {
    expect(prompt.sugestoes).toContain('O título da meta é positivo, concreto e depende do Marco');
  });
  it('não cita o perfil DISC nem teorias no texto do prompt', () => {
    expect(prompt.base).not.toMatch(/DISC|Gallup|GROW/);
  });
});

describe('prompt-jose.md', () => {
  it('tem as quatro seções e as regras de arquitetura.md §4', () => {
    expect(Object.keys(prompt).sort()).toEqual(['base', 'decidir', 'sugestoes', 'titulo']);
    expect(prompt.base).toContain('no máximo 5 linhas');
    expect(prompt.base).toContain('1 próximo passo');
    expect(prompt.base).toMatch(/aconselhamento médico, jurídico nem financeiro/);
    expect(prompt.sugestoes).toContain('No máximo 3 sugestões');
    expect(prompt.sugestoes).toContain('Não sugira uma memória que já está');
    expect(prompt.decidir).toMatch(/até 3 perguntas/);
    expect(prompt.decidir).toMatch(/prós e contras/);
    expect(prompt.decidir).toMatch(/recomendação/);
    expect(prompt.titulo).toContain('6 palavras');
  });
  it('SUGESTOES: com tarefa e meta ligadas descreve ação concreta, objetivo maior, prazo AAAA-MM-DD a partir de hoje e "nem tudo vira cartão"', () => {
    const t = secaoSugestoes(prompt.sugestoes, ['memoria', 'tarefa', 'meta']);
    expect(t).toMatch(/Tarefa é uma ação concreta/);
    expect(t).toMatch(/Meta é um objetivo maior/);
    expect(t).toMatch(/ação vira tarefa, não meta/);
    expect(t).toMatch(/AAAA-MM-DD/);
    expect(t).toMatch(/data de hoje que vem no contexto/);
    expect(t).toMatch(/Nunca invente prazo/);
    expect(t).toMatch(/Nem tudo vira cartão/);
    expect(t).toMatch(/preocupações ficam só no texto/);
    expect(t).toMatch(/No máximo 3 sugestões por resposta, somando todos os tipos/);
  });
  it('SUGESTOES: com só a memória ligada, nada de tarefa nem meta', () => {
    const t = secaoSugestoes(prompt.sugestoes, ['memoria']);
    expect(t).not.toMatch(/Tarefa é|Meta é|prazo|sugerir_tarefa/);
    expect(t).toMatch(/Memória é um fato duradouro/);
  });
  it('falha se uma seção sumir', () => {
    expect(() => lerPrompt('=== BASE ===\nx')).toThrow(/SUGESTOES/);
  });
});

describe('casos golden', () => {
  it('4 por momento do dia (onda 2), 2 de memória (onda 4), 4 de tarefas e metas (onda 5) e 2 de coaching', () => {
    expect(CASOS_GOLDEN.map((c) => c.id)).toEqual(['acordar', 'travado', 'decisao', 'noite', 'memoria-existente', 'memoria-nova', 'tarefa-atrasada', 'tarefa-prazo-relativo', 'meta', 'travado-solucao', 'meta-positiva', 'descarregar']);
  });
});

describe('avaliarCaso (casos de memória, tarefa 4.4)', () => {
  const existente = CASOS_GOLDEN.find((c) => c.id === 'memoria-existente')!;
  const nova = CASOS_GOLDEN.find((c) => c.id === 'memoria-nova')!;
  const memoria = (texto: string) => ({ nome: 'sugerir_memoria', entrada: { texto, area: 'saude' } });

  it('o caso usa a memória "Acorda às 6h." e pergunta "O que faço hoje?"', () => {
    expect(existente.memorias).toEqual([{ texto: 'Acorda às 6h.', area: 'saude' }]);
    expect(existente.mensagem).toBe('O que faço hoje?');
  });
  it('aprova: usa a memória na resposta e não a sugere de novo', () => {
    const r = avaliarCaso(existente, { texto: 'Bom dia, Marco. Você acorda às 6h, então a manhã é sua.\nComece pela proposta do cliente: abra o arquivo agora.', sugestoes: [] });
    expect(r).toEqual({ ok: true, falhas: [], linhas: 2 });
  });
  it('reprova: não usou a memória', () => {
    const r = avaliarCaso(existente, { texto: 'Comece pela proposta do cliente. Abra o arquivo agora.', sugestoes: [] });
    expect(r.falhas).toContain('não usou a memória que já existe na resposta');
  });
  it('reprova: sugeriu de novo a memória que já existe (mesmo com outras palavras)', () => {
    for (const texto of ['Acorda às 6h.', 'Costuma acordar cedo, por volta das 6h', 'Levanta às seis']) {
      const r = avaliarCaso(existente, { texto: 'Você acorda às 6h. Comece pela proposta.', sugestoes: [memoria(texto)] });
      expect(r.ok, texto).toBe(false);
      expect(r.falhas.join()).toContain('sugeriu de novo a memória que já existe');
    }
  });
  it('reprova ferramenta desconhecida e mais de 3 sugestões', () => {
    expect(avaliarCaso(existente, { texto: 'Você acorda às 6h. Comece agora.', sugestoes: [{ nome: 'apagar_tudo', entrada: {} }] }).falhas).toContain('chamou ferramenta que não está ligada');
    const quatro = ['a', 'b', 'c', 'd'].map((t) => memoria(`Fato ${t}`));
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco.', sugestoes: quatro }).falhas).toContain('mais de 3 sugestões (4)');
  });
  it('fato novo: precisa sugerir memória, com texto antes, sem repetir a que existe', () => {
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco. Vou proteger suas manhãs.', sugestoes: [memoria('Rende melhor de manhã.'), memoria('Evita reuniões depois das 17h.')] }).ok).toBe(true);
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco.', sugestoes: [] }).falhas).toContain('não sugeriu nenhuma memória');
    expect(avaliarCaso(nova, { texto: '', sugestoes: [memoria('Rende melhor de manhã.')] }).falhas).toContain('sugeriu memória sem escrever o texto antes');
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco.', sugestoes: [memoria('Acorda às 6h.')] }).falhas.join()).toContain('sugeriu de novo');
  });
  it('casos antigos continuam valendo só pelas regras gerais', () => {
    const acordar = CASOS_GOLDEN[0]!;
    expect(avaliarCaso(acordar, { texto: 'Bom dia, Marco. Comece pela proposta do cliente Alfa.', sugestoes: [] }).ok).toBe(true);
  });
});

describe('avaliarResposta', () => {
  it('aprova resposta curta com 1 próximo passo', () => {
    const r = avaliarResposta('Bom dia, Marco. Hoje o mais importante é a proposta do cliente Alfa.\nComece abrindo o arquivo e escrevendo só o primeiro parágrafo. Leva 5 minutos.');
    expect(r).toEqual({ ok: true, falhas: [], linhas: 2 });
  });
  it('reprova texto longo, lista e muitas perguntas', () => {
    const longo = ['a', 'b', 'c', 'd', 'e', 'f'].join('\n');
    expect(avaliarResposta(longo).falhas.join()).toContain('mais de 5 linhas');
    expect(avaliarResposta('Faça:\n1. um\n2. dois').falhas.join()).toContain('lista com 2 itens');
    expect(avaliarResposta('Quer isso? E aquilo?').falhas.join()).toContain('2 perguntas');
    expect(avaliarResposta('').ok).toBe(false);
  });
  it('reprova conselho médico, financeiro e jurídico', () => {
    expect(avaliarResposta('Tome 10 mg de ritalina.').ok).toBe(false);
    expect(avaliarResposta('Você tem depressão.').falhas.join()).toContain('diagnóstico');
    expect(avaliarResposta('Invista em ações da Petrobras.').falhas.join()).toContain('investimento');
    expect(avaliarResposta('Processe a empresa.').falhas.join()).toContain('jurídico');
  });
});

describe('avaliarCaso (casos de tarefas e metas, tarefas 5.1, 5.4 e 5.7)', () => {
  const caso = (id: string) => CASOS_GOLDEN.find((c) => c.id === id)!;
  const tarefa = (titulo: string, prazo?: string) => ({ nome: 'sugerir_tarefa', entrada: { titulo, area: 'trabalho', ...(prazo ? { prazo } : {}) } });
  const meta = (titulo: string, prazo?: string) => ({ nome: 'sugerir_meta', entrada: { titulo, area: 'saude', ...(prazo ? { prazo } : {}) } });

  describe('tarefa-atrasada: "o que faço hoje?" prioriza a atrasada', () => {
    const c = caso('tarefa-atrasada');
    it('o caso tem 3 tarefas, uma atrasada (prazo antes da data de "agora")', () => {
      expect(c.mensagem).toBe('O que faço hoje?');
      expect(c.tarefas).toHaveLength(3);
      const atrasadas = c.tarefas.filter((t) => typeof t !== 'string' && t.prazo && t.prazo < c.agora.slice(0, 10));
      expect(atrasadas).toHaveLength(1);
    });
    it('aprova: cita a atrasada primeiro e dá o primeiro passo', () => {
      expect(avaliarCaso(c, { texto: 'Bom dia, Marco. A proposta do cliente Alfa já passou do prazo, comece por ela.\nAbra o arquivo e escreva só o primeiro parágrafo.', sugestoes: [] }).ok).toBe(true);
    });
    it('aprova citar só a atrasada; reprova não citar a atrasada ou citar outra antes dela', () => {
      expect(avaliarCaso(c, { texto: 'Comece pelo relatório de vendas, Marco.', sugestoes: [] }).falhas).toContain('não citou a tarefa atrasada');
      const r = avaliarCaso(c, { texto: 'Hoje, o relatório de vendas e depois a proposta do Alfa.', sugestoes: [] });
      expect(r.falhas.join()).toContain('citou outra tarefa antes da atrasada');
    });
    it('reprova sugerir de novo uma tarefa que já está na lista', () => {
      const r = avaliarCaso(c, { texto: 'Comece pela proposta do Alfa, Marco.', sugestoes: [tarefa('Enviar a proposta para o cliente Alfa')] });
      expect(r.falhas.join()).toContain('sugeriu de novo uma tarefa que já está na lista');
    });
  });

  describe('tarefa-prazo-relativo: "até sexta" vira 2026-11-20', () => {
    const c = caso('tarefa-prazo-relativo');
    it('a data do caso é uma terça e a sexta seguinte é 2026-11-20', () => {
      expect(new Date(c.agora).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })).toBe('terça-feira');
      expect(new Date('2026-11-20T12:00:00-03:00').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })).toBe('sexta-feira');
    });
    it('aprova: 1 tarefa com o prazo certo, texto antes e nenhuma meta', () => {
      expect(avaliarCaso(c, { texto: 'Anotado, Marco. Que tal abrir a proposta agora e escrever o primeiro parágrafo?', sugestoes: [tarefa('Enviar a proposta para o cliente Alfa', '2026-11-20')] }).ok).toBe(true);
    });
    it('reprova: data errada, sem tarefa, tarefa demais ou meta no lugar de ação', () => {
      const texto = 'Anotado, Marco. Comece agora.';
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Enviar a proposta', '2026-11-21')] }).falhas).toContain('nenhuma tarefa com o prazo 2026-11-20');
      expect(avaliarCaso(c, { texto, sugestoes: [] }).falhas).toContain('sugeriu 0 tarefa(s), esperava ao menos 1');
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('A', '2026-11-20'), tarefa('B')] }).falhas).toContain('sugeriu 2 tarefa(s), esperava no máximo 1');
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('A', '2026-11-20'), meta('Fechar a venda')] }).falhas).toContain('sugeriu meta (1) para uma ação do dia');
    });
  });

  describe('meta: objetivo maior vira meta', () => {
    const c = caso('meta');
    it('aprova meta com prazo em 2027 ou sem prazo; reprova sem meta ou com prazo em 2026', () => {
      const texto = 'Que objetivo bom, Marco. Vamos começar com um passo pequeno?';
      expect(avaliarCaso(c, { texto, sugestoes: [meta('Correr uma meia-maratona', '2027-11-14')] }).ok).toBe(true);
      expect(avaliarCaso(c, { texto, sugestoes: [meta('Correr uma meia-maratona')] }).ok).toBe(true);
      expect(avaliarCaso(c, { texto, sugestoes: [] }).falhas).toContain('não sugeriu nenhuma meta');
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Correr uma meia-maratona')] }).falhas).toContain('não sugeriu nenhuma meta');
      expect(avaliarCaso(c, { texto, sugestoes: [meta('Correr', '2026-12-31')] }).falhas.join()).toContain('prazo da meta fora do esperado');
    });
  });

  describe('descarregar: jornada "À noite" (tarefa 5.7)', () => {
    const c = caso('descarregar');
    const texto = 'Respira, Marco. Dá para organizar: o banco e a proposta são ações; a meia-maratona fica para outro dia.\nA proposta vence sexta, então comece por ela amanhã cedo.';
    it('aprova: até 3 cartões, tarefa da proposta com prazo de sexta, sem cartão de preocupação', () => {
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Ligar para o banco'), tarefa('Revisar a proposta do cliente', '2026-11-20'), meta('Correr uma meia-maratona', '2027-11-14')] }).ok).toBe(true);
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Revisar a proposta do cliente', '2026-11-20')] }).ok).toBe(true);
    });
    it('reprova: mais de 3 cartões, preocupação virando cartão, tarefa sem o prazo de sexta, sem nenhuma tarefa', () => {
      const quatro = [tarefa('Ligar para o banco'), tarefa('Revisar a proposta do cliente', '2026-11-20'), meta('Correr uma meia-maratona'), tarefa('Organizar a vida')];
      expect(avaliarCaso(c, { texto, sugestoes: quatro }).falhas).toContain('mais de 3 sugestões (4)');
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Revisar a proposta do cliente', '2026-11-20'), tarefa('Resolver a preocupação com o caixa')] }).falhas.join()).toContain('transformou a preocupação em cartão');
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Revisar o fluxo de caixa')] }).falhas.join()).toContain('transformou a preocupação em cartão');
      expect(avaliarCaso(c, { texto, sugestoes: [tarefa('Revisar a proposta do cliente')] }).falhas).toContain('nenhuma tarefa com o prazo 2026-11-20');
      expect(avaliarCaso(c, { texto, sugestoes: [meta('Correr uma meia-maratona')] }).falhas).toContain('sugeriu 0 tarefa(s), esperava ao menos 1');
    });
    it('sugerir cartão sem escrever o texto antes reprova', () => {
      expect(avaliarCaso(c, { texto: '', sugestoes: [tarefa('Revisar a proposta do cliente', '2026-11-20')] }).falhas).toContain('sugeriu sem escrever o texto antes');
    });
  });

  it('o prompt cobre a jornada "À noite": só ação vira cartão', () => {
    const t = secaoSugestoes(prompt.sugestoes, ['memoria', 'tarefa', 'meta']);
    expect(t).toMatch(/Quando o Marco descarregar a cabeça \(à noite ou a qualquer hora\)/);
    expect(t).toMatch(/Ideias e preocupações ficam só no texto: acolha em uma frase, sem cartão/);
    expect(t).toMatch(/Só as ações viram cartão de tarefa, no máximo 3 por resposta/);
    expect(t).toMatch(/sugira as mais importantes para amanhã/);
    expect(t).toMatch(/objetivo maior.*meta, que conta nos 3 cartões/);
    // sem a ferramenta de tarefa ligada, a orientação de cartões da noite não aparece
    expect(secaoSugestoes(prompt.sugestoes, ['memoria'])).not.toMatch(/descarregar a cabeça/);
    // o texto da jornada (acolher, 1 passo para amanhã) continua no prompt base
    expect(prompt.base).toMatch(/descarregando a cabeça, acolha em 1 ou 2 frases/);
  });
});
