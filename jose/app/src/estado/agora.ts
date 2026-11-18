// "Agora" da tela que vira o dia sozinha: as etiquetas "Hoje", "Atrasada" e a ordem da lista dependem do dia no fuso do Marco.
import { useEffect, useState } from 'react';
import { FUSO_PADRAO } from '@compartilhado/datas';

/** Milissegundos até a próxima meia-noite no fuso (com 1 s de folga, para cair já no dia novo). */
export function msAteVirarODia(agora: Date, fuso: string = FUSO_PADRAO): number {
  const p: Record<string, string> = {};
  for (const parte of new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(agora)) p[parte.type] = parte.value;
  const segundosDoDia = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
  return (86_400 - segundosDoDia) * 1000 - agora.getMilliseconds() + 1000;
}

const RELOGIO_PADRAO = () => new Date();

/** O instante atual, atualizado quando o dia vira e quando o app volta para a frente (o PWA do iPhone reabre sem recarregar). */
export function useAgora(fuso: string = FUSO_PADRAO, relogio: () => Date = RELOGIO_PADRAO): Date {
  const [agora, setAgora] = useState(relogio);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const atualizar = () => {
      const n = relogio();
      setAgora(n);
      clearTimeout(timer);
      timer = setTimeout(atualizar, msAteVirarODia(n, fuso));
    };
    timer = setTimeout(atualizar, msAteVirarODia(relogio(), fuso));
    const aoVisivel = () => {
      if (document.visibilityState === 'visible') atualizar();
    };
    document.addEventListener('visibilitychange', aoVisivel);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVisivel);
    };
  }, [fuso, relogio]);
  return agora;
}
