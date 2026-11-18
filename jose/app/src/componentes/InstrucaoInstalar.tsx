import { useSyncExternalStore } from 'react';
import { ehIos } from '../estado/gravacao';
import { assinarPromptInstalacao, estaInstalado, instalarDireto, modoInstalar, temPromptInstalacao, type ModoInstalar } from '../estado/instalar';

/** Como instalar neste aparelho: iPhone (instrução), outros com convite do navegador (botão) ou sem ele (menu). */
export function useInstalar() {
  const temPrompt = useSyncExternalStore(assinarPromptInstalacao, temPromptInstalacao);
  const ios = ehIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  return { modo: modoInstalar(ios, temPrompt) satisfies ModoInstalar, instalado: estaInstalado(), instalarDireto };
}

function IconeCompartilhar() {
  return (
    <svg className="instrucao-instalar__icone" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}

/** A instrução da instalação (o iPhone só instala por Compartilhar → Adicionar à Tela de Início). */
export function InstrucaoInstalar({ modo }: { modo: ModoInstalar }) {
  if (modo === 'ios') {
    return (
      <p className="instrucao-instalar">
        Toque em <strong>Compartilhar</strong> <IconeCompartilhar /> e depois em <strong>Adicionar à Tela de Início</strong>.
      </p>
    );
  }
  if (modo === 'botao') return <p className="instrucao-instalar">Instale o José para abrir como um app, direto da tela inicial.</p>;
  return (
    <p className="instrucao-instalar">
      No menu do navegador, escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
    </p>
  );
}
