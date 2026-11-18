// Apagar com "Desfazer" (dados.md, regra 13): a interface espera 5 s antes de chamar a API.
// O agendamento vive fora dos componentes: trocar de aba não cancela nem antecipa o apagamento.
//
// Vários apagamentos seguidos (com o mesmo aviso) formam UM grupo: um só aviso "Apagado (2). Desfazer" que restaura TODOS os
// pendentes do grupo (o aviso é de um só por vez, então um grupo evita perder o Desfazer do primeiro). Cada novo apagamento
// reinicia os 5 s do grupo; ao expirar, as chamadas à API saem em ordem, uma de cada vez.
export const ESPERA_APAGAR_MS = 5000;

/** Ids esperando os 5 s ou com a chamada à API em andamento. */
const pendentes = new Set<string>();

export const estaPendente = (id: string) => pendentes.has(id);

type Mostrar = (mensagem: string, acao?: { rotulo: string; aoTocar: () => void }, duracaoMs?: number) => void;

export interface OpcoesApagar {
  id: string;
  /** Texto do aviso (padrão: "Apagado."). Ex.: "Descartado." nos cartões de sugestão. Só se agrupam avisos iguais. */
  mensagem?: string;
  mostrar: Mostrar;
  /** Chamada só depois dos 5 s sem "Desfazer". */
  apagar: () => Promise<void>;
  aoDesfazer: () => void;
  aoFalhar: () => void;
}

interface Grupo {
  itens: OpcoesApagar[];
  timer?: ReturnType<typeof setTimeout>;
}
const grupos = new Map<string, Grupo>();

/** "Apagado." → "Apagado (2)." */
export const rotuloDoGrupo = (mensagem: string, quantos: number) => (quantos > 1 ? `${mensagem.replace(/\.$/, '')} (${quantos}).` : mensagem);

async function executar(chave: string) {
  const grupo = grupos.get(chave);
  if (!grupo) return;
  grupos.delete(chave);
  for (const item of grupo.itens) {
    try {
      await item.apagar();
    } catch {
      item.aoFalhar();
    } finally {
      pendentes.delete(item.id);
    }
  }
}

export function apagarComDesfazer(o: OpcoesApagar): void {
  if (pendentes.has(o.id)) return;
  pendentes.add(o.id);
  const chave = o.mensagem ?? 'Apagado.';
  const grupo = grupos.get(chave) ?? { itens: [] };
  grupos.set(chave, grupo);
  grupo.itens.push(o);
  clearTimeout(grupo.timer);
  grupo.timer = setTimeout(() => void executar(chave), ESPERA_APAGAR_MS);
  o.mostrar(
    rotuloDoGrupo(chave, grupo.itens.length),
    {
      rotulo: 'Desfazer',
      aoTocar: () => {
        // Restaura todos os pendentes do grupo (inclusive os apagados depois deste aviso).
        if (grupos.get(chave) !== grupo) return;
        clearTimeout(grupo.timer);
        grupos.delete(chave);
        for (const item of grupo.itens) {
          pendentes.delete(item.id);
          item.aoDesfazer();
        }
      },
    },
    ESPERA_APAGAR_MS,
  );
}
