// Prazos na interface. O prazo é uma data local AAAA-MM-DD (sem fuso); "hoje" vem do relógio e do fuso do Marco.
// Toda função recebe o "agora" e o fuso, para os testes poderem fixar o relógio (virada do dia às 23h59/00h01 em São Paulo).
import { FUSO_PADRAO, hoje } from '@compartilhado/datas';

const dias = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Dias de `prazo` em relação a hoje no fuso do Marco: negativo = já passou. */
export function diasAteOPrazo(prazo: string, agora: Date, fuso: string = FUSO_PADRAO): number {
  return dias(prazo) - dias(hoje(agora, fuso));
}

const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** "sex, 20/11" (com o ano, "sex, 14/11/2027", se não for o ano de hoje). Não depende do fuso do aparelho. */
export function formatarDataCurta(prazo: string, agora: Date, fuso: string = FUSO_PADRAO): string {
  const d = new Date(`${prazo}T00:00:00Z`);
  const semana = diaDaSemana.format(d).replace('.', '');
  const ano = prazo.slice(0, 4) !== hoje(agora, fuso).slice(0, 4) ? `/${prazo.slice(0, 4)}` : '';
  return `${semana}, ${diaMes.format(d)}${ano}`;
}

/** "Hoje", "Amanhã", "Ontem" ou a data curta. */
export function rotuloPrazo(prazo: string, agora: Date, fuso: string = FUSO_PADRAO): string {
  const n = diasAteOPrazo(prazo, agora, fuso);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  return formatarDataCurta(prazo, agora, fuso);
}

export interface PrazoDaTarefa {
  texto: string;
  situacao: 'atrasada' | 'hoje' | 'futura';
}

/** Prazo de uma tarefa pendente: "Atrasada · ontem", "Hoje", "Amanhã" ou a data. A situação nunca depende só da cor (o texto diz "Atrasada"). */
export function prazoDaTarefa(prazo: string, agora: Date, fuso: string = FUSO_PADRAO): PrazoDaTarefa {
  const n = diasAteOPrazo(prazo, agora, fuso);
  if (n < 0) return { texto: `Atrasada · ${n === -1 ? 'ontem' : formatarDataCurta(prazo, agora, fuso)}`, situacao: 'atrasada' };
  return { texto: rotuloPrazo(prazo, agora, fuso), situacao: n === 0 ? 'hoje' : 'futura' };
}
