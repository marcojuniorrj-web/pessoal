// Leitura de SSE (text/event-stream) no navegador: o fetch entrega pedaços de bytes em qualquer ponto.
export interface EventoSse {
  evento: string;
  dados: unknown;
}

/** Parser incremental: alimente com texto e receba os eventos completos. */
export function criarParserSse() {
  let resto = '';
  return {
    alimentar(pedaco: string): EventoSse[] {
      resto += pedaco;
      const eventos: EventoSse[] = [];
      let i: number;
      while ((i = resto.search(/\r?\n\r?\n/)) >= 0) {
        const bloco = resto.slice(0, i);
        resto = resto.slice(i).replace(/^\r?\n\r?\n/, '');
        let evento = 'message';
        const linhasDados: string[] = [];
        for (const linha of bloco.split(/\r?\n/)) {
          if (linha.startsWith('event:')) evento = linha.slice(6).trim();
          else if (linha.startsWith('data:')) linhasDados.push(linha.slice(5).replace(/^ /, ''));
        }
        if (!linhasDados.length) continue;
        try {
          eventos.push({ evento, dados: JSON.parse(linhasDados.join('\n')) });
        } catch {
          /* evento malformado: ignora */
        }
      }
      return eventos;
    },
  };
}
