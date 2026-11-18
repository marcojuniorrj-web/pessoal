// Mensagens que o Marco mandou apagar: somem da tela na hora e a API só é chamada depois de 5 s (regra 13).
// A lista vive fora do componente: trocar de aba e voltar dentro dos 5 s não faz a mensagem reaparecer, e "Desfazer" a traz de volta.
// Depois que a API apagou, o id continua aqui (a mensagem não existe mais; evita reaparecer numa tela montada antes).
const ocultas = new Set<string>();
let versao = 0;
const ouvintes = new Set<() => void>();
const avisar = () => {
  versao += 1;
  ouvintes.forEach((o) => o());
};

export const mensagemOculta = (id: string) => ocultas.has(id);
export function ocultarMensagens(ids: string[]) {
  ids.forEach((i) => ocultas.add(i));
  avisar();
}
export function mostrarMensagens(ids: string[]) {
  ids.forEach((i) => ocultas.delete(i));
  avisar();
}
export const assinarOcultas = (o: () => void) => {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
};
export const versaoOcultas = () => versao;
