import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AREAS_MEMORIA, ROTULO_AREA, type AreaMemoria } from '@compartilhado/areas';
import type { MemoriaEntrada } from '@compartilhado/schemas';
import { ErroHttp } from '../api/cliente';
import { descartarSugestao, salvarSugestao } from '../api/sugestoes';
import { apagarComDesfazer, estaPendente } from '../estado/apagar-com-desfazer';
import { contadorTexto, LIMITE_MEMORIA, lerConteudoMemoria, validarMemoria } from '../estado/memoria-edicao';
import type { SugestaoDoChat } from '../estado/chat';
import { Botao } from './Botao';
import { EtiquetaArea } from './EtiquetaArea';
import { useToast } from './Toast';

interface Props {
  sugestao: SugestaoDoChat;
  /** Avisa o Chat quando o cartão é salvo (com o conteúdo final) ou descartado. */
  aoMudar: (id: string, mudanca: Partial<Pick<SugestaoDoChat, 'status' | 'conteudo'>>) => void;
  /** Injetáveis nos testes. */
  salvar?: typeof salvarSugestao;
  descartar?: typeof descartarSugestao;
}

const chaveDescarte = (id: string) => `sugestao:${id}`;

/**
 * Cartão 🧠 de memória sugerida (telas.md, Chat). Nada é salvo sem o toque em "Salvar":
 * Salvar, Editar (texto + chips de área) e Descartar (com "Desfazer" por 5 s).
 */
export function CartaoSugestao({ sugestao, aoMudar, salvar = salvarSugestao, descartar = descartarSugestao }: Props) {
  const toast = useToast();
  const conteudo = lerConteudoMemoria(sugestao.conteudo);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(conteudo?.texto ?? '');
  const [area, setArea] = useState<AreaMemoria>(conteudo?.area ?? 'sobre_mim');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; podeTentar: boolean } | null>(null);
  // Recolhido enquanto o aviso "Descartado. Desfazer" está no ar (também se o Chat foi remontado nesse intervalo).
  const [recolhido, setRecolhido] = useState(() => estaPendente(chaveDescarte(sugestao.id)));
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const cartaoRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!editando) return;
    campoRef.current?.focus();
    cartaoRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [editando]);

  if (!conteudo || sugestao.tipo !== 'memoria') return null; // tarefas e metas chegam na onda 5
  if (sugestao.status === 'descartada' || recolhido) return null;

  if (sugestao.status === 'salva') {
    return (
      <article className="cartao-sugestao cartao-sugestao--salvo" aria-label="Memória salva">
        <p className="cartao-sugestao__texto">{conteudo.texto}</p>
        <Link to="/jose-sabe" className="cartao-sugestao__salvo">
          ✓ Salvo em José sabe
        </Link>
      </article>
    );
  }

  const aoSalvar = async () => {
    let enviar: MemoriaEntrada | undefined;
    if (editando) {
      const v = validarMemoria(texto, area);
      if (!v.ok) {
        setErro({ mensagem: v.erro, podeTentar: false });
        return;
      }
      enviar = v.conteudo;
    }
    setSalvando(true);
    setErro(null);
    try {
      const { item } = await salvar(sugestao.id, enviar);
      aoMudar(sugestao.id, { status: 'salva', conteudo: { texto: item.texto, area: item.area } });
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
    setTexto(conteudo.texto);
    setArea(conteudo.area);
    setErro(null);
    setEditando(true);
  };

  const contador = contadorTexto(texto);

  return (
    <article ref={cartaoRef} className="cartao-sugestao" aria-label="Memória sugerida" aria-busy={salvando || undefined}>
      <header className="cartao-sugestao__topo">
        <span aria-hidden="true">🧠</span>
        <span className="cartao-sugestao__tipo">Memória</span>
        {!editando && <EtiquetaArea area={conteudo.area} />}
      </header>

      {editando ? (
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
        <p className="cartao-sugestao__texto">{conteudo.texto}</p>
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
            <Botao disabled={salvando} onClick={comecarEdicao}>
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
