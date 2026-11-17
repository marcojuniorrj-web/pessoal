import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'padrao' | 'principal' | 'perigo' | 'link';
  grande?: boolean;
  carregando?: boolean;
}

export function Botao({ variante = 'padrao', grande, carregando, children, className = '', disabled, ...resto }: Props) {
  const classes = ['botao', variante !== 'padrao' && `botao--${variante}`, grande && 'botao--grande', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      {carregando && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
