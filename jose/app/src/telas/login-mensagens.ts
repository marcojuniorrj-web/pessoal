/** Mensagem do Login conforme `?erro=` (telas.md, tela 1). */
export function mensagemDeErro(erro: string | null): string | null {
  if (erro === 'falha') return 'Não foi possível entrar. Tente de novo.';
  if (erro === 'negado') return 'Acesso negado — este app é pessoal.';
  return null;
}
