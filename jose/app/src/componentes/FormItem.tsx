import { useEffect, useRef, useState } from 'react';
import type { ConteudoItem } from '../estado/item-edicao';
import { validarItem } from '../estado/item-edicao';
import { Botao } from './Botao';
import { CamposItem, type ValoresItem } from './CamposItem';

interface Props {
  /** Nome acessível do formulário ("Adicionar tarefa", "Editar meta"). */
  titulo: string;
  tipo: 'tarefa' | 'meta';
  inicial?: ConteudoItem;
  rotuloSalvar: string;
  aoSalvar: (c: ConteudoItem) => Promise<void>;
  aoCancelar: () => void;
}

/** Formulário de tarefa/meta (abas Tarefas e Metas): título, chips de área e prazo opcional. Valida no cliente com os limites do servidor. */
export function FormItem({ titulo, tipo, inicial, rotuloSalvar, aoSalvar, aoCancelar }: Props) {
  const [valores, setValores] = useState<ValoresItem>({ titulo: inicial?.titulo ?? '', area: inicial?.area ?? 'trabalho', prazo: inicial?.prazo ?? '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const id = useRef(`form-item-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    campoRef.current?.focus();
    // No centro da janela: nem a barra de abas nem o aviso (que fica acima dela) cobrem o formulário.
    formRef.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (salvando) return;
    const v = validarItem(valores.titulo, valores.area, valores.prazo);
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

  return (
    <form
      ref={formRef}
      className="form-memoria form-item"
      aria-label={titulo}
      onSubmit={(e) => void enviar(e)}
      onKeyDown={(e) => {
        // Esc sai sem salvar (como o Cancelar); Enter no título salva (o título é uma linha só).
        if (e.key === 'Escape' && !salvando) {
          e.stopPropagation();
          aoCancelar();
        } else if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName === 'TEXTAREA') {
          e.preventDefault();
          void enviar();
        }
      }}
    >
      <CamposItem
        idBase={id}
        titulo={valores.titulo}
        area={valores.area}
        prazo={valores.prazo}
        rotuloTitulo={tipo === 'tarefa' ? 'Título da tarefa' : 'Título da meta'}
        rotuloArea={tipo === 'tarefa' ? 'Área da tarefa' : 'Área da meta'}
        placeholder={tipo === 'tarefa' ? 'Ex.: Ligar para o banco' : 'Ex.: Correr uma meia-maratona'}
        desabilitado={salvando}
        campoRef={campoRef}
        aoMudar={(p) => setValores((v) => ({ ...v, ...p }))}
      />
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
