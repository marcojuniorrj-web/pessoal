import { useEffect, useRef, useState } from 'react';
import { AREAS_MEMORIA, ROTULO_AREA, type AreaMemoria } from '@compartilhado/areas';
import type { MemoriaEntrada } from '@compartilhado/schemas';
import { contadorTexto, LIMITE_MEMORIA, validarMemoria } from '../estado/memoria-edicao';
import { Botao } from './Botao';

interface Props {
  /** Nome acessível do formulário ("Adicionar memória", "Editar memória"). */
  titulo: string;
  inicial?: MemoriaEntrada;
  rotuloSalvar: string;
  aoSalvar: (m: MemoriaEntrada) => Promise<void>;
  aoCancelar: () => void;
}

/** Texto + chips de área (José sabe: adicionar e editar). Valida no cliente com os mesmos limites do servidor. */
export function FormMemoria({ titulo, inicial, rotuloSalvar, aoSalvar, aoCancelar }: Props) {
  const [texto, setTexto] = useState(inicial?.texto ?? '');
  const [area, setArea] = useState<AreaMemoria>(inicial?.area ?? 'sobre_mim');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const id = useRef(`memoria-form-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    campoRef.current?.focus();
    formRef.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validarMemoria(texto, area);
    if (!v.ok) {
      setErro(v.erro);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(v.conteudo);
    } catch {
      setErro('Não salvou. Tentar de novo');
      setSalvando(false);
    }
  };

  const contador = contadorTexto(texto);

  return (
    <form ref={formRef} className="form-memoria" aria-label={titulo} onSubmit={(e) => void enviar(e)}
      onKeyDown={(e) => {
        // Esc sai da edição sem salvar (como o Cancelar).
        if (e.key === 'Escape' && !salvando) {
          e.stopPropagation();
          aoCancelar();
        }
      }}
    >
      <label className="so-leitor" htmlFor={id}>
        Texto da memória
      </label>
      <textarea
        id={id}
        ref={campoRef}
        className="form-memoria__campo"
        rows={3}
        maxLength={LIMITE_MEMORIA}
        placeholder="Ex.: Acorda às 6h."
        value={texto}
        disabled={salvando}
        onChange={(e) => setTexto(e.target.value)}
      />
      <p className={`cartao-sugestao__contador texto-2${contador.perto ? ' cartao-sugestao__contador--perto' : ''}`}>{contador.rotulo}</p>
      <div className="chips-area" role="radiogroup" aria-label="Área da memória">
        {AREAS_MEMORIA.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={area === a} className="chip-area" disabled={salvando} onClick={() => setArea(a)}>
            {ROTULO_AREA[a]}
          </button>
        ))}
      </div>
      {erro && (
        <p className="mensagem-erro form-memoria__erro" role="alert">
          {erro}
        </p>
      )}
      <div className="form-memoria__acoes">
        <Botao type="submit" variante="principal" carregando={salvando}>
          {rotuloSalvar}
        </Botao>
        <Botao disabled={salvando} onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
