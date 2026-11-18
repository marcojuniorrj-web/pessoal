import { describe, expect, it } from 'vitest';
import { avaliarCaso, avaliarDecisao, avaliarResposta, CASOS_GOLDEN, TERMOS_PROIBIDOS } from './golden';
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
  it('tem as cinco seções e as regras de arquitetura.md §4', () => {
    expect(Object.keys(prompt).sort()).toEqual(['base', 'boasvindas', 'decidir', 'sugestoes', 'titulo']);
    expect(prompt.base).toContain('no máximo 5 linhas');
    expect(prompt.base).toContain('1 próximo passo');
    expect(prompt.base).toMatch(/aconselhamento médico, jurídico nem financeiro/);
    expect(prompt.sugestoes).toContain('No máximo 3 sugestões');
    expect(prompt.sugestoes).toContain('Não sugira uma memória que já está');
    expect(prompt.decidir).toMatch(/no máximo 3 no total/);
    expect(prompt.decidir).toMatch(/ganhos e as perdas/);
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
  it('4 por momento do dia (onda 2), 2 de memória (onda 4), 4 de tarefas e metas (onda 5), 2 de coaching, as boas-vindas e 3 do modo decisão (onda 6)', () => {
    expect(CASOS_GOLDEN.map((c) => c.id)).toEqual(['acordar', 'travado', 'decisao', 'noite', 'memoria-existente', 'memoria-nova', 'tarefa-atrasada', 'tarefa-prazo-relativo', 'meta', 'travado-solucao', 'meta-positiva', 'descarregar', 'boasvindas-memorias', 'decisao-abertura', 'decisao-coaching', 'decisao-coaching-completa']);
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

describe('avaliarCaso: boasvindas-memorias (tarefa 6.1)', () => {
  const caso = CASOS_GOLDEN.find((c) => c.id === 'boasvindas-memorias')!;
  const mem = (texto: string, area = 'saude') => ({ nome: 'sugerir_memoria', entrada: { texto, area } });
  const intro = 'Obrigado, Marco. Vou te mostrar o que entendi para você confirmar.';
  const boas = [mem('Dorme às 22h30.'), mem('Quer correr uma meia-maratona em 2027.'), mem('Tem dificuldade para começar o que parece grande demais.', 'sobre_mim')];

  it('o caso tem as 5 respostas na conversa e duas memórias que já existem', () => {
    expect(caso.historico).toHaveLength(9);
    expect(caso.historico!.filter((m) => m.autor === 'marco')).toHaveLength(4);
    expect(caso.mensagem).toMatch(/22h30/);
    expect(caso.memorias).toHaveLength(2);
  });
  it('aprova: memórias coerentes com as respostas, sem repetir as existentes', () => {
    expect(avaliarCaso(caso, { texto: intro, sugestoes: boas })).toMatchObject({ ok: true, falhas: [] });
  });
  it('aceita até 8 memórias (o limite de 3 é das outras conversas) e reprova a 9ª', () => {
    const muitas = (n: number) => Array.from({ length: n }, (_, i) => mem(`Fato duradouro número ${i + 10}.`));
    expect(avaliarCaso(caso, { texto: intro, sugestoes: [...boas, ...muitas(5)] }).falhas).toEqual([]);
    expect(avaliarCaso(caso, { texto: intro, sugestoes: [...boas, ...muitas(6)] }).falhas).toContain('mais de 8 sugestões (9)');
  });
  it('reprova: repete uma memória que já existe (mesmo com pontuação e acento diferentes)', () => {
    const r = avaliarCaso(caso, { texto: intro, sugestoes: [...boas, mem('acorda as 6h')] });
    expect(r.falhas).toContain('sugeriu de novo memória que já existe (1)');
  });
  it('reprova: sem cobrir uma resposta (a meia-maratona ficou de fora)', () => {
    const r = avaliarCaso(caso, { texto: intro, sugestoes: [boas[0]!, boas[2]!] });
    expect(r.falhas.some((f) => f.includes('meia'))).toBe(true);
  });
  it('reprova: poucas memórias, repetidas entre si ou grandes demais', () => {
    expect(avaliarCaso(caso, { texto: intro, sugestoes: [boas[0]!] }).falhas).toContain('sugeriu 1 memória(s), esperava ao menos 2');
    expect(avaliarCaso(caso, { texto: intro, sugestoes: [...boas, mem('Dorme às 22h30!')] }).falhas).toContain('memórias repetidas entre si');
    expect(avaliarCaso(caso, { texto: intro, sugestoes: [...boas, mem('x'.repeat(301))] }).falhas).toContain('memória com mais de 300 caracteres');
  });
  it('reprova: tarefa ou meta (só memória fica ligada nas boas-vindas) e sugestão sem texto antes', () => {
    expect(avaliarCaso(caso, { texto: intro, sugestoes: [...boas, { nome: 'sugerir_tarefa', entrada: { titulo: 'Correr', area: 'saude' } }] }).falhas).toContain('chamou ferramenta que não está ligada');
    expect(avaliarCaso(caso, { texto: '', sugestoes: boas }).falhas).toContain('sugeriu sem escrever o texto antes');
  });
});

describe('contexto das boas-vindas (6.1)', () => {
  const base = { prompt, sugestoes: ['memoria'] as const, modo: 'padrao' as const, metas: [], tarefas: [], agora: new Date('2026-11-18T22:30:00Z') };
  it('inclui as memórias atuais e a seção BOASVINDAS (depois do ponto de cache) e só a ferramenta de memória', async () => {
    const { montarContexto } = await import('../../modulos/conversas/contexto');
    const c = montarContexto({
      ...base, sugestoes: ['memoria'], boasVindas: true,
      memorias: [{ texto: 'Acorda às 6h.', area: 'saude' }],
      mensagens: [{ autor: 'jose', texto: 'Pergunta 1' }, { autor: 'marco', texto: 'Resposta 1' }],
    });
    expect(c.sistemaEstavel).toContain('Acorda às 6h.');
    expect(c.sistemaEstavel).toContain('sugerir_memoria');
    expect(c.sistemaEstavel).not.toContain('sugerir_tarefa');
    expect(c.sistemaVolatil).toContain('Fim das boas-vindas');
    expect(c.sistemaVolatil).toContain('limite é de 8 memórias');
    expect(c.sistemaEstavel).not.toContain('Fim das boas-vindas');
    // a conversa começa pela pergunta do José: a API exige "user" primeiro, e a pergunta não se perde
    expect(c.mensagens.map((m) => m.papel)).toEqual(['user', 'assistant', 'user']);
    expect(c.mensagens[1]!.texto).toBe('Pergunta 1');
  });
  it('sem boasVindas a seção não entra', async () => {
    const { montarContexto } = await import('../../modulos/conversas/contexto');
    const c = montarContexto({ ...base, sugestoes: [], memorias: [], mensagens: [{ autor: 'marco', texto: 'oi' }] });
    expect(c.sistemaVolatil).not.toContain('Fim das boas-vindas');
  });
  it('o prompt BOASVINDAS pede só memória, até 8, só o novo e sem repetir', () => {
    expect(prompt.boasvindas).toMatch(/Só memórias: nada de tarefa nem de meta/);
    expect(prompt.boasvindas).toMatch(/8 memórias/);
    expect(prompt.boasvindas).toMatch(/Não sugira o que já está lá/);
    expect(prompt.boasvindas).toMatch(/versão nova/);
    expect(prompt.boasvindas).not.toMatch(/DISC|Gallup|GROW|SLAC/);
  });
});

describe('prompt: nenhuma seção cita GROW, SLAC, DISC nem Gallup (o José não explica teoria nem cita testes)', () => {
  for (const [nome, texto] of Object.entries(prompt)) {
    it(`seção ${nome}`, () => {
      expect(texto).not.toMatch(/GROW|SLAC|DISC|Gallup/i);
      expect(texto).not.toMatch(TERMOS_PROIBIDOS);
    });
  }
  it('o prompt inteiro (arquivo bruto, comentários incluídos) também não cita', async () => {
    const { default: bruto } = await import('./prompt-jose.md');
    expect(bruto).not.toMatch(/GROW|SLAC|DISC|Gallup/i);
  });
});

describe('prompt: seção DECIDIR (coaching do Marco, tarefa 6.5)', () => {
  const d = prompt.decidir;
  it('abre com UMA pergunta curta e faz no máximo 3 perguntas, uma por vez, só as que faltam', () => {
    expect(d).toContain('"Qual é a decisão?"');
    expect(d).toMatch(/UMA pergunta curta/);
    expect(d).toMatch(/no máximo 3 no total/);
    expect(d).toMatch(/uma pergunta por vez/);
    expect(d).toMatch(/pergunte só o que falta/);
  });
  it('as perguntas cobrem resultado, situação real, opções (inclusive não fazer nada) e o que fará e quando', () => {
    expect(d).toMatch(/resultado que ele quer/);
    expect(d).toMatch(/situação está de verdade hoje/);
    expect(d).toMatch(/incluindo não fazer nada/);
    expect(d).toMatch(/o que ele vai fazer e até quando/);
  });
  it('com informação suficiente na 1ª mensagem não pergunta nada e vai à recomendação', () => {
    expect(d).toMatch(/não faça pergunta nenhuma: vá direto aos ganhos e perdas e à recomendação/);
  });
  it('mostra ganhos e perdas (até 3 de cada, uma linha por opção) e tem pergunta de congruência com o que importa', () => {
    expect(d).toMatch(/ganhos e as perdas de cada opção, uma linha por opção/);
    expect(d).toMatch(/no máximo 3 ganhos e 3 perdas/);
    expect(d).toMatch(/congruência com o que importa para ele/);
  });
  it('termina com UMA recomendação e o primeiro passo, oferecido como tarefa com prazo se ele falou de prazo', () => {
    expect(d).toMatch(/UMA recomendação clara/);
    expect(d).toMatch(/primeiro passo concreto/);
    expect(d).toMatch(/como tarefa, com prazo se ele falou de prazo/);
  });
  it('tom: curto, opções e desafios, corta a análise em excesso, sem aconselhamento profissional e sem explicar método', () => {
    expect(d).toMatch(/até 5 linhas/);
    expect(d).toMatch(/opções e desafios em vez de ordens/);
    expect(d).toMatch(/girando em torno do mesmo ponto/);
    expect(d).toMatch(/médico, jurídico nem financeiro profissional/);
    expect(d).toMatch(/não explique método nenhum/);
  });
});

describe('avaliarDecisao (tarefa 6.5)', () => {
  it('abertura: UMA pergunta curta aprova; texto longo, duas perguntas ou matriz reprovam', () => {
    expect(avaliarDecisao('Qual é a decisão?', 'abertura').ok).toBe(true);
    expect(avaliarDecisao('Qual é a decisão? E qual o prazo?', 'abertura').falhas).toContain('2 perguntas (esperado exatamente UMA)');
    expect(avaliarDecisao(`Conte com calma qual é a decisão ${'que você precisa tomar '.repeat(8)}?`, 'abertura').falhas.join()).toMatch(/longa demais/);
    expect(avaliarDecisao('Ficar: ganha segurança. Perde crescimento. Qual é a decisão?', 'abertura').falhas).toContain('mostrou ganhos e perdas antes da hora');
  });
  it('pergunta: uma pergunta curta aprova; recomendar antes da hora ou passar de 3 linhas reprova', () => {
    expect(avaliarDecisao('O que você quer ter daqui a 2 anos nessa carreira?', 'pergunta').ok).toBe(true);
    expect(avaliarDecisao('Entendi. Eu iria de aceitar.\nQual é o prazo?', 'pergunta').falhas).toContain('recomendou antes da hora');
    expect(avaliarDecisao('a\nb\nc\nd?', 'pergunta').falhas).toContain('mais de 3 linhas (4)');
    expect(avaliarDecisao('Sem pergunta nenhuma.', 'pergunta').falhas).toContain('0 perguntas (esperado exatamente UMA)');
  });
  const completa = [
    'Ficar na empresa: ganha autonomia, equipe conhecida. Perde crescimento e salário.',
    'Aceitar a proposta: ganha 30% a mais, equipe maior. Perde tempo com o filho.',
    'Recomendo aceitar, com viagens limitadas por escrito. Topa?',
    'Primeiro passo: pedir a proposta por escrito até sexta.',
  ].join('\n');
  it('recomendacao: ganhos e perdas + recomendação + primeiro passo em até 8 linhas aprova', () => {
    expect(avaliarDecisao(completa, 'recomendacao')).toEqual({ ok: true, falhas: [], linhas: 4 });
  });
  it('recomendacao: reprova sem ganhos/perdas, sem recomendação, sem primeiro passo ou com mais de 8 linhas', () => {
    expect(avaliarDecisao('Recomendo aceitar. Primeiro passo: ligar hoje.', 'recomendacao').falhas).toContain('faltam os ganhos e as perdas das opções');
    expect(avaliarDecisao('Ficar ganha segurança e perde crescimento. Pense bem.', 'recomendacao').falhas).toEqual(expect.arrayContaining(['faltou a recomendação clara', 'faltou o primeiro passo']));
    expect(avaliarDecisao(Array(9).fill('Ganha X. Perde Y. Recomendo aceitar, primeiro passo hoje.').join('\n'), 'recomendacao').falhas).toContain('mais de 8 linhas (9)');
  });
  it('reprova citar GROW, SLAC, DISC ou Gallup em qualquer tipo (e não confunde com palavras comuns)', () => {
    for (const t of ['abertura', 'pergunta', 'recomendacao'] as const) {
      expect(avaliarDecisao('Pelo modelo GROW, qual é a decisão?', t).falhas).toContain('citou técnica, teste ou perfil (GROW, SLAC, DISC ou Gallup)');
      expect(avaliarDecisao('Seu perfil DISC pede ritmo. Qual é a decisão?', t).ok).toBe(false);
    }
    expect(avaliarDecisao('Qual é a decisão? Disciplina não é o ponto.', 'abertura').ok).toBe(true);
  });
  it('avaliarCaso dos 3 casos de decisão: usa as regras do modo e confere o cartão de tarefa com o prazo de sexta', () => {
    const [abertura, pergunta, completaCaso] = ['decisao-abertura', 'decisao-coaching', 'decisao-coaching-completa'].map((id) => CASOS_GOLDEN.find((c) => c.id === id)!);
    expect(CASOS_GOLDEN.filter((c) => c.decisao).every((c) => c.modo === 'decidir')).toBe(true);
    expect(abertura!.mensagem).toBe('Preciso decidir');
    expect(avaliarCaso(abertura!, { texto: 'Qual é a decisão?', sugestoes: [] }).ok).toBe(true);
    expect(avaliarCaso(pergunta!, { texto: 'Ficar ganha segurança, aceitar perde tempo. Qual o prazo?', sugestoes: [] }).ok).toBe(false); // matriz antes da hora
    expect(avaliarCaso(pergunta!, { texto: 'Hoje, como está a sua situação na equipe atual?', sugestoes: [] }).ok).toBe(true);
    const tarefa = { nome: 'sugerir_tarefa', entrada: { titulo: 'Pedir a proposta por escrito', area: 'trabalho', prazo: '2026-11-20' } };
    expect(avaliarCaso(completaCaso!, { texto: completa, sugestoes: [tarefa] })).toMatchObject({ ok: true, falhas: [] });
    expect(avaliarCaso(completaCaso!, { texto: completa, sugestoes: [] }).falhas).toContain('sugeriu 0 tarefa(s), esperava ao menos 1');
    expect(avaliarCaso(completaCaso!, { texto: completa, sugestoes: [{ ...tarefa, entrada: { ...tarefa.entrada, prazo: '2026-11-21' } }] }).falhas).toContain('nenhuma tarefa com o prazo 2026-11-20');
    expect(avaliarCaso(completaCaso!, { texto: `${completa}\nTome 10 mg de algo.`, sugestoes: [tarefa] }).falhas).toContain('conselho profissional: cita dose de remédio');
    expect(avaliarCaso(pergunta!, { texto: 'Hoje, como está a sua situação?', sugestoes: [tarefa] }).falhas.join()).toMatch(/esperava no máximo 0/);
  });
});
