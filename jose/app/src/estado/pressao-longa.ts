// Pressão longa num balão (como no WhatsApp). A lógica é pura e testável: o tempo e o relógio entram por parâmetro.
// Regras (telas.md, tela 3): dispara depois de ~450 ms parado; se o dedo se mover mais de ~10 px (é rolagem),
// soltar ou o sistema cancelar o toque antes do tempo, nada acontece.
export const TEMPO_PRESSAO_MS = 450;
export const TOLERANCIA_MOVIMENTO_PX = 10;
/**
 * Janela depois de abrir a folha em que um novo toque ainda não vale. A pressão longa abre a folha com o dedo ainda apoiado:
 * ao soltar, o navegador pode gerar um clique "fantasma" (e um mousedown de compatibilidade) sobre o que está embaixo do dedo.
 */
export const JANELA_ABERTURA_MS = 600;

export interface OpcoesPressao {
  /** Chamado uma única vez por pressão, quando o tempo passa sem movimento. */
  aoDisparar: () => void;
  /** Chamado quando a pressão começa (ex.: realçar o balão). */
  aoComecar?: () => void;
  /** Chamado quando a pressão termina sem disparar, ou depois de disparar (ex.: tirar o realce). */
  aoTerminar?: () => void;
  tempoMs?: number;
  toleranciaPx?: number;
  agendar?: (fn: () => void, ms: number) => unknown;
  desagendar?: (id: unknown) => void;
}

export function criarPressaoLonga(o: OpcoesPressao) {
  const tempo = o.tempoMs ?? TEMPO_PRESSAO_MS;
  const tolerancia = o.toleranciaPx ?? TOLERANCIA_MOVIMENTO_PX;
  const agendar = o.agendar ?? ((fn, ms) => setTimeout(fn, ms));
  const desagendar = o.desagendar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let timer: unknown = null;
  let origem: { x: number; y: number } | null = null;
  let disparou = false;

  const terminar = () => {
    if (timer !== null) desagendar(timer);
    timer = null;
    const estava = origem !== null;
    origem = null;
    if (estava) o.aoTerminar?.();
  };

  return {
    iniciar(x: number, y: number) {
      terminar();
      disparou = false;
      origem = { x, y };
      o.aoComecar?.();
      timer = agendar(() => {
        timer = null;
        disparou = true;
        o.aoDisparar();
      }, tempo);
    },
    /** Movimento maior que a tolerância cancela (o dedo está rolando a lista). */
    mover(x: number, y: number) {
      if (!origem || disparou) return;
      if (Math.hypot(x - origem.x, y - origem.y) > tolerancia) terminar();
    },
    /** Soltar, cancelar o toque ou sair do balão. */
    terminar,
    /** Já disparou nesta pressão (o clique que vem logo depois deve ser ignorado). */
    get disparou() {
      return disparou;
    },
    get ativa() {
      return origem !== null;
    },
  };
}
