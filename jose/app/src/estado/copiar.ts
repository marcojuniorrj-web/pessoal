/**
 * Copia o texto para a área de transferência. Devolve se deu certo.
 * Plano B (sem `navigator.clipboard`, ex.: contexto inseguro ou WebView): campo de texto temporário, somente leitura, fora da
 * vista e sem rolar a página, com o texto TODO selecionado (`select()` + `setSelectionRange`, que o iOS exige) e `execCommand('copy')`.
 */
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
  campo.readOnly = true; // não abre o teclado
  campo.contentEditable = 'false';
  campo.setAttribute('aria-hidden', 'true');
  campo.tabIndex = -1;
  // 16px evita o zoom do iOS; fixo no topo/esquerda e transparente para não mexer no layout nem rolar a página.
  campo.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none';
  const ativo = document.activeElement as HTMLElement | null;
  document.body.appendChild(campo);
  try {
    campo.focus({ preventScroll: true });
    campo.select();
    campo.setSelectionRange(0, texto.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    campo.remove();
    ativo?.focus?.({ preventScroll: true });
  }
}
