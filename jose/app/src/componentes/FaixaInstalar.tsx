import { fecharFaixaInstalar } from '../estado/instalar';
import { Botao } from './Botao';
import { InstrucaoInstalar, useInstalar } from './InstrucaoInstalar';

/**
 * Faixa "Instalar na tela inicial" (telas.md, Chat): mostrada uma única vez depois das boas-vindas. Quem decide se aparece é o
 * Chat (`deveMostrarFaixa`): nunca com o app já instalado nem depois de fechada.
 */
export function FaixaInstalar({ aoFechar }: { aoFechar: () => void }) {
  const { modo, instalarDireto } = useInstalar();
  const fechar = () => {
    fecharFaixaInstalar();
    aoFechar();
  };
  return (
    <aside className="faixa-instalar" aria-label="Instalar na tela inicial">
      <div className="faixa-instalar__texto">
        <strong>Instalar na tela inicial</strong>
        <InstrucaoInstalar modo={modo} />
        {modo === 'botao' && (
          <Botao
            variante="principal"
            onClick={() =>
              void instalarDireto().then((aceitou) => {
                if (aceitou) fechar();
              })
            }
          >
            Instalar
          </Botao>
        )}
      </div>
      <button type="button" className="faixa-instalar__fechar" aria-label="Fechar aviso de instalação" onClick={fechar}>
        ✕
      </button>
    </aside>
  );
}
