// Conversas que o Marco apagou (ou que estão nos 5 s do Desfazer porque ele apagou a última mensagem delas).
// Vive fora dos componentes: o Chat pode ser desmontado (troca de aba) e remontado antes de a exclusão terminar, e o componente
// que agendou a exclusão pode já não existir quando ela conclui. Quem monta o Chat nunca abre uma conversa que está aqui.
const pendentes = new Set<string>();
const apagadas = new Set<string>();
/** Aviso a mostrar quando a tela abandona a conversa (ex.: "Conversa apagada."); só para as apagadas em outro lugar. */
const avisos = new Map<string, string>();
let versao = 0;
const ouvintes = new Set<() => void>();
const avisar = () => {
  versao += 1;
  ouvintes.forEach((o) => o());
};

/** A exclusão está nos 5 s do Desfazer (ainda pode ser desfeita). */
export const conversaPendenteDeApagar = (id: string) => pendentes.has(id);
/** A exclusão foi confirmada (pelo servidor ou porque ele disse que a conversa não existe mais). */
export const conversaApagada = (id: string) => apagadas.has(id);
/** Não pode ser aberta nem continuada. */
export const conversaIndisponivel = (id: string) => pendentes.has(id) || apagadas.has(id);

export function marcarPendenteDeApagar(id: string) {
  pendentes.add(id);
  avisar();
}
/** Desfazer, falha ao apagar, ou nova mensagem enviada nela (voltou a ter conteúdo). */
export function desmarcarPendenteDeApagar(id: string) {
  if (pendentes.delete(id)) avisar();
}
export function confirmarConversaApagada(id: string, aviso?: string) {
  pendentes.delete(id);
  apagadas.add(id);
  if (aviso) avisos.set(id, aviso);
  avisar();
}
/** Lê e consome o aviso guardado para a conversa. */
export function consumirAviso(id: string): string | undefined {
  const a = avisos.get(id);
  avisos.delete(id);
  return a;
}
export const assinarConversasApagadas = (o: () => void) => {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
};
export const versaoConversasApagadas = () => versao;

/** Só para testes. */
export function limparConversasApagadas() {
  pendentes.clear();
  apagadas.clear();
  avisos.clear();
  avisar();
}
