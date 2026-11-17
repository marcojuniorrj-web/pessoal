export function Esqueleto({ largura = '100%', altura = '1em' }: { largura?: string; altura?: string }) {
  return <span className="esqueleto" style={{ width: largura, height: altura }} aria-hidden="true" />;
}

/** Lista de linhas em esqueleto (carregando). */
export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div role="status" aria-label="Carregando" style={{ display: 'grid', gap: 16, padding: 16 }}>
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} altura="48px" />
      ))}
    </div>
  );
}
