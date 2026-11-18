import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BarraAbas } from './BarraAbas';
import { FaixaOffline } from './FaixaOffline';

/** Casca das telas protegidas: faixa offline, conteúdo na coluna de 680px e barra de abas (menos nas Boas-vindas). */
export function Casca({ semAbas = false }: { semAbas?: boolean }) {
  // O aviso (toast), fora da casca, lê isto para descer até o rodapé quando não há barra de abas (--altura-barra: 0).
  useEffect(() => {
    if (!semAbas) return;
    document.documentElement.dataset.semAbas = '';
    return () => {
      delete document.documentElement.dataset.semAbas;
    };
  }, [semAbas]);
  return (
    <div className="casca" data-sem-abas={semAbas || undefined}>
      {/* Tampa opaca sob a barra de status translúcida do iPhone: o conteúdo rolado não passa por baixo do relógio e da bateria. */}
      <div className="tampa-status" aria-hidden="true" />
      <FaixaOffline />
      <main className="coluna casca__conteudo">
        <Outlet />
      </main>
      {!semAbas && <BarraAbas />}
    </div>
  );
}
