// Rascunho do que o Marco está digitando, por conversa (localStorage). Sobrevive a um 401: depois do
// Login o app volta à mesma conversa e o texto continua no campo (telas.md, "Sessão expirada").
const PREFIXO = 'jose:rascunho:';

const chave = (conversaId: string | null) => PREFIXO + (conversaId ?? 'nova');

export function lerRascunho(conversaId: string | null): string {
  try {
    return localStorage.getItem(chave(conversaId)) ?? '';
  } catch {
    return '';
  }
}

export function salvarRascunho(conversaId: string | null, texto: string): void {
  try {
    if (texto) localStorage.setItem(chave(conversaId), texto);
    else localStorage.removeItem(chave(conversaId));
  } catch {
    /* armazenamento indisponível: segue sem rascunho */
  }
}

export const limparRascunho = (conversaId: string | null) => salvarRascunho(conversaId, '');
