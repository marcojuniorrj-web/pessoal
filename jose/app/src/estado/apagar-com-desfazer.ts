// Apagar com "Desfazer" (dados.md, regra 13): a interface espera 5 s antes de chamar a API.
// O agendamento vive fora dos componentes: trocar de aba não cancela nem antecipa o apagamento.
export const ESPERA_APAGAR_MS = 5000;

const pendentes = new Map<string, ReturnType<typeof setTimeout>>();

export const estaPendente = (id: string) => pendentes.has(id);

type Mostrar = (mensagem: string, acao?: { rotulo: string; aoTocar: () => void }, duracaoMs?: number) => void;

export interface OpcoesApagar {
  id: string;
  /** Texto do aviso (padrão: "Apagado."). Ex.: "Descartado." nos cartões de sugestão. */
  mensagem?: string;
  mostrar: Mostrar;
  /** Chamada só depois dos 5 s sem "Desfazer". */
  apagar: () => Promise<void>;
  aoDesfazer: () => void;
  aoFalhar: () => void;
}

export function apagarComDesfazer(o: OpcoesApagar): void {
  if (pendentes.has(o.id)) return;
  const timer = setTimeout(async () => {
    try {
      await o.apagar();
    } catch {
      o.aoFalhar();
    } finally {
      pendentes.delete(o.id);
    }
  }, ESPERA_APAGAR_MS);
  pendentes.set(o.id, timer);
  o.mostrar(
    o.mensagem ?? 'Apagado.',
    {
      rotulo: 'Desfazer',
      aoTocar: () => {
        clearTimeout(pendentes.get(o.id));
        pendentes.delete(o.id);
        o.aoDesfazer();
      },
    },
    ESPERA_APAGAR_MS,
  );
}
