import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AREAS_MEMORIA, ROTULO_AREA, type AreaItem, type AreaMemoria } from '@compartilhado/areas';
import type { MemoriaEntrada } from '@compartilhado/schemas';
import { ErroHttp } from '../api/cliente';
import type { MemoriaDto } from '../api/memorias';
import { descartarSugestao, salvarSugestao, type ConteudoSugestao } from '../api/sugestoes';
import { apagarComDesfazer, estaPendente } from '../estado/apagar-com-desfazer';
import type { SugestaoDoChat } from '../estado/chat';
import { lerConteudoItem, validarItem, type ConteudoItem } from '../estado/item-edicao';
import { contadorTexto, LIMITE_MEMORIA, lerConteudoMemoria, validarMemoria } from '../estado/memoria-edicao';
import { rotuloPrazo } from '../estado/prazo';
import { useFusoHorario } from '../estado/sessao';
import { Botao } from './Botao';
import { CamposItem } from './CamposItem';
import { EtiquetaArea } from './EtiquetaArea';
import { useToast } from './Toast';

interface Props {
  sugestao: SugestaoDoChat;
  /** Avisa o Chat quando o cartão é salvo (com o conteúdo final) ou descartado. */
  aoMudar: (id: string, mudanca: Partial<Pick<SugestaoDoChat, 'status' | 'conteudo'>>) => void;
  /** Injetáveis nos testes. */
  salvar?: typeof salvarSugestao;
  descartar?: typeof descartarSugestao;
  /** Relógio injetável nos testes (rótulo do prazo: "Hoje", "Amanhã"...). */
  agora?: () => Date;
}

const chaveDescarte = (id: string) => `sugestao:${id}`;

/** O que muda de um tipo de cartão para outro: ícone, nome, etiquetas e para onde o "✓ Salvo" leva. */
const TIPOS = {
  memoria: { icone: '🧠', nome: 'Memória', sugerida: 'Memória sugerida', salva: 'Memória salva', salvoEm: '✓ Salvo em José sabe', destino: '/jose-sabe' },
  tarefa: { icone: '📌', nome: 'Tarefa', sugerida: 'Tarefa sugerida', salva: 'Tarefa salva', salvoEm: '✓ Salvo em Tarefas', destino: '/tarefas' },
  meta: { icone: '🎯', nome: 'Meta', sugerida: 'Meta sugerida', salva: 'Meta salva', salvoEm: '✓ Salvo em Metas', destino: '/tarefas?aba=metas' },
} as const;

type Lido = { tipo: 'memoria'; conteudo: MemoriaEntrada } | { tipo: 'tarefa' | 'meta'; conteudo: ConteudoItem };

function lerConteudo(sugestao: SugestaoDoChat): Lido | null {
  if (sugestao.tipo === 'memoria') {
    const c = lerConteudoMemoria(sugestao.conteudo);
    return c ? { tipo: 'memoria', conteudo: c } : null;
  }
  const c = lerConteudoItem(sugestao.conteudo);
  return c ? { tipo: sugestao.tipo, conteudo: c } : null;
}

/** O texto do cartão: a memória, ou o título da tarefa/meta com o prazo (se houver). */
function Resumo({ conteudo, agora, fuso }: { conteudo: Lido['conteudo']; agora: Date; fuso: string }) {
  if ('texto' in conteudo) return <p className="cartao-sugestao__texto">{conteudo.texto}</p>;
  return (
    <>
      <p className="cartao-sugestao__texto">{conteudo.titulo}</p>
      {conteudo.prazo && <p className="cartao-sugestao__prazo texto-2">Prazo: {rotuloPrazo(conteudo.prazo, agora, fuso)}</p>}
    </>
  );
}

/**
 * Cartão de sugestão no Chat: 🧠 memória, 📌 tarefa e 🎯 meta (telas.md). Nada é salvo sem o toque em "Salvar":
 * Salvar, Editar (texto ou título, chips de área e, em tarefa/meta, seletor de prazo) e Descartar (com "Desfazer" por 5 s).
 */
export function CartaoSugestao({ sugestao, aoMudar, salvar = salvarSugestao, descartar = descartarSugestao, agora = () => new Date() }: Props) {
  const toast = useToast();
  const fuso = useFusoHorario();
  const lido = lerConteudo(sugestao);
  const [editando, setEditando] = useState(false);
  // `texto` guarda o texto da memória ou o título da tarefa/meta; `prazo` é '' quando não há prazo.
  const [texto, setTexto] = useState(lido ? (lido.tipo === 'memoria' ? lido.conteudo.texto : lido.conteudo.titulo) : '');
  const [area, setArea] = useState<AreaMemoria>(lido?.conteudo.area ?? 'sobre_mim');
  const [prazo, setPrazo] = useState(lido && lido.tipo !== 'memoria' ? (lido.conteudo.prazo ?? '') : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; podeTentar: boolean } | null>(null);
  // Recolhido enquanto o aviso "Descartado. Desfazer" está no ar (também se o Chat foi remontado nesse intervalo).
  const [recolhido, setRecolhido] = useState(() => estaPendente(chaveDescarte(sugestao.id)));
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const cartaoRef = useRef<HTMLElement>(null);
  const editarRef = useRef<HTMLButtonElement>(null);
  const jaEditou = useRef(false);

  // Ao abrir a edição o foco vai para o texto; ao sair dela (Cancelar ou Esc) volta ao botão Editar que a abriu.
  useEffect(() => {
    if (editando) {
      jaEditou.current = true;
      campoRef.current?.focus();
      cartaoRef.current?.scrollIntoView?.({ block: 'nearest' });
    } else if (jaEditou.current) {
      jaEditou.current = false;
      editarRef.current?.focus();
    }
  }, [editando]);

  if (!lido) return null;
  if (sugestao.status === 'descartada' || recolhido) return null;
  const tipo = TIPOS[lido.tipo];
  const ehItem = lido.tipo !== 'memoria';

  if (sugestao.status === 'salva') {
    return (
      <article className="cartao-sugestao cartao-sugestao--salvo" aria-label={tipo.salva}>
        <Resumo conteudo={lido.conteudo} agora={agora()} fuso={fuso} />
        <Link to={tipo.destino} className="cartao-sugestao__salvo">
          {tipo.salvoEm}
        </Link>
      </article>
    );
  }

  /** Conteúdo a enviar quando o Marco editou (ou undefined, sem edição: o servidor usa o conteúdo guardado). */
  const conteudoEditado = (): { ok: true; conteudo?: ConteudoSugestao } | { ok: false; erro: string } => {
    if (!editando) return { ok: true };
    if (!ehItem) {
      const v = validarMemoria(texto, area);
      return v.ok ? { ok: true, conteudo: v.conteudo } : v;
    }
    const v = validarItem(texto, area as AreaItem, prazo);
    return v.ok ? { ok: true, conteudo: v.conteudo } : v;
  };

  const aoSalvar = async () => {
    const edicao = conteudoEditado();
    if (!edicao.ok) {
      setErro({ mensagem: edicao.erro, podeTentar: false });
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const { item } = await salvar(sugestao.id, edicao.conteudo);
      // O conteúdo que fica valendo é o do item criado pelo servidor.
      const final = ehItem
        ? { titulo: (item as { titulo: string }).titulo, area: item.area, prazo: (item as { prazo: string | null }).prazo ?? null }
        : { texto: (item as MemoriaDto).texto, area: item.area };
      aoMudar(sugestao.id, { status: 'salva', conteudo: final });
    } catch (e) {
      if (e instanceof ErroHttp && e.status === 409) setErro({ mensagem: 'Essa sugestão já foi salva ou descartada.', podeTentar: false });
      else setErro({ mensagem: 'Não salvou.', podeTentar: true });
    } finally {
      setSalvando(false);
    }
  };

  const aoDescartar = () => {
    const chave = chaveDescarte(sugestao.id);
    setRecolhido(true);
    setErro(null);
    apagarComDesfazer({
      id: chave,
      mensagem: 'Descartado.',
      mostrar: toast,
      apagar: async () => {
        try {
          await descartar(sugestao.id);
        } catch (e) {
          if (!(e instanceof ErroHttp && e.status === 409)) throw e; // 409: já estava tratada, vale como descartada
        }
        aoMudar(sugestao.id, { status: 'descartada' });
      },
      aoDesfazer: () => setRecolhido(false),
      aoFalhar: () => {
        setRecolhido(false);
        toast('Não foi possível descartar.');
      },
    });
  };

  const comecarEdicao = () => {
    if (lido.tipo === 'memoria') {
      setTexto(lido.conteudo.texto);
    } else {
      setTexto(lido.conteudo.titulo);
      setPrazo(lido.conteudo.prazo ?? '');
    }
    setArea(lido.conteudo.area);
    setErro(null);
    setEditando(true);
  };

  const contador = contadorTexto(texto);
  const areaExibida = lido.conteudo.area;

  return (
    <article
      ref={cartaoRef}
      className="cartao-sugestao"
      aria-label={tipo.sugerida}
      aria-busy={salvando || undefined}
      onKeyDown={(e) => {
        // Esc sai da edição sem salvar (como o Cancelar).
        if (e.key === 'Escape' && editando && !salvando) {
          e.stopPropagation();
          setEditando(false);
        }
      }}
    >
      <header className="cartao-sugestao__topo">
        <span aria-hidden="true">{tipo.icone}</span>
        <span className="cartao-sugestao__tipo">{tipo.nome}</span>
        {!editando && <EtiquetaArea area={areaExibida} />}
      </header>

      {editando && ehItem ? (
        <CamposItem
          idBase={`item-${sugestao.id}`}
          titulo={texto}
          area={area as AreaItem}
          prazo={prazo}
          rotuloTitulo={lido.tipo === 'tarefa' ? 'Título da tarefa' : 'Título da meta'}
          rotuloArea={lido.tipo === 'tarefa' ? 'Área da tarefa' : 'Área da meta'}
          desabilitado={salvando}
          campoRef={campoRef}
          aoMudar={(p) => {
            if (p.titulo !== undefined) setTexto(p.titulo);
            if (p.area !== undefined) setArea(p.area);
            if (p.prazo !== undefined) setPrazo(p.prazo);
          }}
        />
      ) : editando ? (
        <div className="cartao-sugestao__edicao">
          <label className="so-leitor" htmlFor={`memoria-${sugestao.id}`}>
            Texto da memória
          </label>
          <textarea
            id={`memoria-${sugestao.id}`}
            ref={campoRef}
            className="cartao-sugestao__campo"
            rows={3}
            maxLength={LIMITE_MEMORIA}
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
        </div>
      ) : (
        <Resumo conteudo={lido.conteudo} agora={agora()} fuso={fuso} />
      )}

      {erro && (
        <p className="cartao-sugestao__erro mensagem-erro" role="alert">
          {erro.mensagem}
        </p>
      )}

      <div className="cartao-sugestao__acoes">
        <Botao variante="principal" carregando={salvando} onClick={() => void aoSalvar()}>
          {erro?.podeTentar ? 'Tentar de novo' : 'Salvar'}
        </Botao>
        {editando ? (
          <Botao disabled={salvando} onClick={() => setEditando(false)}>
            Cancelar
          </Botao>
        ) : (
          <>
            <Botao ref={editarRef} disabled={salvando} onClick={comecarEdicao}>
              Editar
            </Botao>
            <Botao variante="link" disabled={salvando} onClick={aoDescartar}>
              Descartar
            </Botao>
          </>
        )}
      </div>
    </article>
  );
}
