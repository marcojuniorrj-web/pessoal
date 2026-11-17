import type { ReactNode } from 'react';

export function EstadoVazio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="estado-vazio">
      <p>{texto}</p>
      {children}
    </div>
  );
}
