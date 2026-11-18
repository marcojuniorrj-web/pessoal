import promptBruto from './prompt-jose.md';

export interface Prompt {
  base: string;
  sugestoes: string;
  decidir: string;
  boasvindas: string;
  titulo: string;
}

/** Divide o prompt-jose.md nas seções "=== NOME ===" (comentários HTML são ignorados). */
export function lerPrompt(bruto: string = promptBruto): Prompt {
  const semComentarios = bruto.replace(/<!--[\s\S]*?-->/g, '');
  const secoes: Record<string, string> = {};
  const partes = semComentarios.split(/^=== ([A-Z]+) ===\s*$/m);
  for (let i = 1; i < partes.length; i += 2) secoes[partes[i]!] = (partes[i + 1] ?? '').trim();
  for (const nome of ['BASE', 'SUGESTOES', 'DECIDIR', 'BOASVINDAS', 'TITULO']) {
    if (!secoes[nome]) throw new Error(`prompt-jose.md sem a seção ${nome}`);
  }
  return { base: secoes.BASE!, sugestoes: secoes.SUGESTOES!, decidir: secoes.DECIDIR!, boasvindas: secoes.BOASVINDAS!, titulo: secoes.TITULO! };
}

export const prompt: Prompt = lerPrompt();
