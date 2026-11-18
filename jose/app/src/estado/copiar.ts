/** Copia o texto para a área de transferência (com plano B para navegadores sem a API moderna). Devolve se deu certo. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* tenta o plano B */
  }
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(campo);
  const ativo = document.activeElement as HTMLElement | null;
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    campo.remove();
    ativo?.focus?.();
  }
}
