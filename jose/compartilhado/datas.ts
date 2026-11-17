// Datas e fuso. Instantes são ISO-8601 UTC; prazos são datas locais AAAA-MM-DD (arquitetura.md §4).
// Toda função recebe o "agora" e o fuso, para os testes poderem fixar o relógio.
export const FUSO_PADRAO = 'America/Sao_Paulo';

const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(fuso: string) {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    });
    formatadores.set(fuso, f);
  }
  return f;
}

function partes(instante: Date | string, fuso: string) {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  const p: Record<string, string> = {};
  for (const parte of formatador(fuso).formatToParts(d)) p[parte.type] = parte.value;
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) };
}

/** Dia local (AAAA-MM-DD) de um instante no fuso informado. */
export function diaLocal(instante: Date | string, fuso: string = FUSO_PADRAO): string {
  return partes(instante, fuso).dia;
}

/** Hoje, como data local. */
export function hoje(agora: Date, fuso: string = FUSO_PADRAO): string {
  return diaLocal(agora, fuso);
}

export function horaLocal(instante: Date | string, fuso: string = FUSO_PADRAO): number {
  return partes(instante, fuso).hora;
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Uma tarefa está atrasada quando o prazo (data local) é anterior a hoje. */
export function atrasada(prazo: string | null | undefined, agora: Date, fuso: string = FUSO_PADRAO): boolean {
  return !!prazo && prazo < hoje(agora, fuso);
}

export type GrupoHistorico = 'hoje' | 'ontem' | 'esta_semana' | 'mais_antigas';
export const ROTULO_GRUPO: Record<GrupoHistorico, string> = {
  hoje: 'Hoje', ontem: 'Ontem', esta_semana: 'Esta semana', mais_antigas: 'Mais antigas',
};

/** Hoje, Ontem, Esta semana (de 2 a 6 dias atrás) e Mais antigas. */
export function grupoHistorico(instante: Date | string, agora: Date, fuso: string = FUSO_PADRAO): GrupoHistorico {
  const dias = diasEntre(diaLocal(instante, fuso), hoje(agora, fuso));
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias <= 6) return 'esta_semana';
  return 'mais_antigas';
}

export function agruparPorPeriodo<T>(itens: T[], dataDe: (item: T) => string, agora: Date, fuso: string = FUSO_PADRAO) {
  const ordem: GrupoHistorico[] = ['hoje', 'ontem', 'esta_semana', 'mais_antigas'];
  const mapa = new Map<GrupoHistorico, T[]>(ordem.map((g) => [g, []]));
  for (const item of itens) mapa.get(grupoHistorico(dataDe(item), agora, fuso))!.push(item);
  return ordem.filter((g) => mapa.get(g)!.length > 0).map((g) => ({ grupo: g, rotulo: ROTULO_GRUPO[g], itens: mapa.get(g)! }));
}

/** Saudação do Chat vazio: bom dia (5h–11h59), boa tarde (12h–17h59), boa noite. */
export function saudacao(nome: string, agora: Date, fuso: string = FUSO_PADRAO): string {
  const h = horaLocal(agora, fuso);
  const periodo = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
  return `${periodo}, ${nome}.`;
}
