// Tudo o que o app guarda no aparelho (localStorage "jose:*": usuário, listas de Tarefas/Metas para ler offline, rascunhos e a
// faixa de instalar; mais o sessionStorage). Usado por "Apagar todos os meus dados": nada do Marco pode sobrar no celular.
// A memória do app (mensagens ocultas, conversas apagadas, filas de apagar) some na recarga completa que vem em seguida.
const PREFIXO = 'jose:';

export function limparDadosLocais(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIXO)) localStorage.removeItem(k);
  } catch {
    /* armazenamento indisponível: nada a limpar */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* idem */
  }
}
