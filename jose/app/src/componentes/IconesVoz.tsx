// Ícones SVG da voz (herdam a cor do texto; nunca emoji nos botões).
interface Props {
  tamanho?: number;
  className?: string;
}

export function IconeMicrofone({ tamanho = 24, className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}

export function IconeParar({ tamanho = 24, className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

export function IconeFechar({ tamanho = 24, className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
