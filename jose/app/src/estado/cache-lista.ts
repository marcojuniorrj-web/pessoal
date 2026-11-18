// Última lista carregada (Tarefas e Metas), guardada no aparelho para abrir offline, só para leitura (telas.md, "Offline").
// Sai junto com a sessão: quem não está logado não deixa tarefas para trás no localStorage.
const PREFIXO = 'jose:lista:';

export function lerCacheLista<T>(chave: string): T[] | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    const lista = bruto ? (JSON.parse(bruto) as unknown) : null;
    return Array.isArray(lista) ? (lista as T[]) : null;
  } catch {
    return null;
  }
}

export function salvarCacheLista<T>(chave: string, lista: T[]): void {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(lista));
  } catch {
    /* sem espaço ou modo privado: segue sem cache */
  }
}

export function limparCachesDeListas(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIXO)) localStorage.removeItem(k);
  } catch {
    /* ignora */
  }
}
