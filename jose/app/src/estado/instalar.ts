// Faixa "Instalar na tela inicial" (telas.md, Chat): aparece UMA vez, logo depois das boas-vindas, e nunca mais depois de
// fechada nem com o app já instalado (modo standalone). O estado fica no aparelho (cada aparelho instala por conta própria).
export const CHAVE_INSTALAR = 'jose:instalar';
export type EstadoInstalar = 'nunca' | 'pendente' | 'fechada';

type Armazem = Pick<Storage, 'getItem' | 'setItem'>;

function armazem(): Armazem | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // modo privado/bloqueado: a faixa simplesmente não aparece
  }
}

export function lerEstadoInstalar(a: Armazem | null = armazem()): EstadoInstalar {
  const v = a?.getItem(CHAVE_INSTALAR);
  return v === 'pendente' || v === 'fechada' ? v : 'nunca';
}

/** As boas-vindas terminaram (salvou ou pulou): a faixa passa a valer, mas só se nunca foi mostrada nem fechada. */
export function marcarFaixaPendente(a: Armazem | null = armazem()): void {
  if (lerEstadoInstalar(a) === 'nunca') a?.setItem(CHAVE_INSTALAR, 'pendente');
}

/** Fechou (✕) ou instalou: nunca mais aparece. */
export function fecharFaixaInstalar(a: Armazem | null = armazem()): void {
  a?.setItem(CHAVE_INSTALAR, 'fechada');
}

/** O app roda como instalado (tela inicial): iOS pelo `navigator.standalone`, os outros pelo `display-mode`. */
export interface JanelaInstalar {
  matchMedia?: (q: string) => { matches: boolean };
  navigator?: object;
}
export function estaInstalado(w: JanelaInstalar = window): boolean {
  return (w.navigator as { standalone?: boolean } | undefined)?.standalone === true || w.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function deveMostrarFaixa(estado: EstadoInstalar, instalado: boolean): boolean {
  return estado === 'pendente' && !instalado;
}

/** Qual instrução mostrar: o iPhone só instala por Compartilhar → Adicionar à Tela de Início. */
export type ModoInstalar = 'ios' | 'botao' | 'menu';
export function modoInstalar(ios: boolean, temPromptDireto: boolean): ModoInstalar {
  return ios ? 'ios' : temPromptDireto ? 'botao' : 'menu';
}

// ---- Instalação direta (Android/computador): o evento `beforeinstallprompt` é guardado para o botão "Instalar". ----
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let evento: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();

export function capturarPromptInstalacao(alvo: Pick<Window, 'addEventListener'> = window): void {
  alvo.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as EventoInstalar;
    ouvintes.forEach((o) => o());
  });
  alvo.addEventListener('appinstalled', () => {
    evento = null;
    fecharFaixaInstalar();
    ouvintes.forEach((o) => o());
  });
}
export const assinarPromptInstalacao = (o: () => void) => {
  ouvintes.add(o);
  return () => void ouvintes.delete(o);
};
export const temPromptInstalacao = () => evento !== null;
/** Abre o convite do navegador; devolve se o Marco aceitou. */
export async function instalarDireto(): Promise<boolean> {
  if (!evento) return false;
  const e = evento;
  evento = null;
  ouvintes.forEach((o) => o());
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}
