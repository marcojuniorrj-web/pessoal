import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FUSO_PADRAO } from '@compartilhado/datas';
import { apagarMemoria, criarMemoria, editarMemoria, type MemoriaDto } from '../api/memorias';
import { Botao } from '../componentes/Botao';
import { EsqueletoLista } from '../componentes/Esqueleto';
import { EstadoVazio } from '../componentes/EstadoVazio';
import { FormMemoria } from '../componentes/FormMemoria';
import { useToast } from '../componentes/Toast';
import { useNavigate } from 'react-router-dom';
import { abrirBoasVindas, caminhoBoasVindas } from '../estado/boas-vindas';
import { apagarComDesfazer } from '../estado/apagar-com-desfazer';
import { agruparMemorias, formatarDataMemoria, useMemorias } from '../estado/memorias';
import { posicionarMenu } from '../estado/menu-posicao';
import { useOnline } from '../estado/online';
import { useSessao, useUsuario } from '../estado/sessao';

/** Aba José sabe (telas.md, tela 6): tudo o que o José sabe, por área; adicionar, editar e apagar com "Desfazer". */
export function JoseSabe() {
  const toast = useToast();
  const usuario = useUsuario();
  const fuso = usuario.fuso_horario ?? FUSO_PADRAO;
  const { estado } = useSessao();
  const online = useOnline();
  const semRede = !online || (estado.situacao === 'logado' && estado.offline);
  const { carga, memorias, recarregar, adicionar, substituir, remover } = useMemorias();
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const ir = useNavigate();
  const [abrindo, setAbrindo] = useState(false);

  // "Fazer as boas-vindas" (vazio): abre as boas-vindas (retoma a conversa em aberto ou cria uma).
  const fazerBoasVindas = async () => {
    setAbrindo(true);
    try {
      ir(caminhoBoasVindas(await abrirBoasVindas(usuario)));
    } catch {
      toast('Não foi possível abrir as boas-vindas. Tente de novo.');
      setAbrindo(false);
    }
  };

  // Quem abriu o formulário ou o menu recebe o foco de volta quando ele fecha por Esc ou Cancelar.
  const voltarFoco = useRef<string | null>(null);
  useEffect(() => {
    if (adicionando || editandoId || !voltarFoco.current) return;
    const alvo = voltarFoco.current;
    voltarFoco.current = null;
    document.querySelector<HTMLElement>(alvo)?.focus();
  }, [adicionando, editandoId]);
  const fecharAdicionar = () => { voltarFoco.current = '.memorias__adicionar'; setAdicionando(false); };
  const fecharEdicao = (id: string) => { voltarFoco.current = `[data-memoria-id="${id}"] .memoria__abrir`; setEditandoId(null); };

  // Menu ⋯: Esc fecha (foco volta ao ⋯) e tocar fora dele também fecha.
  useEffect(() => {
    if (!menuAbertoId) return;
    const id = menuAbertoId;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuAbertoId(null);
      document.querySelector<HTMLElement>(`[data-memoria-id="${id}"] .memoria__mais`)?.focus();
    };
    const aoTocar = (e: PointerEvent) => {
      const alvo = e.target as Element | null;
      if (!alvo?.closest(`[data-memoria-id="${id}"] .memoria__menu, [data-memoria-id="${id}"] .memoria__mais`)) setMenuAbertoId(null);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocar);
    };
  }, [menuAbertoId]);

  const apagar = (m: MemoriaDto) => {
    setMenuAbertoId(null);
    if (editandoId === m.id) setEditandoId(null);
    remover(m.id);
    apagarComDesfazer({
      id: `memoria:${m.id}`,
      mostrar: toast,
      apagar: () => apagarMemoria(m.id),
      aoDesfazer: () => adicionar(m),
      aoFalhar: () => {
        adicionar(m);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagar(m) });
      },
    });
  };

  const grupos = agruparMemorias(memorias);
  const vazio = carga === 'ok' && memorias.length === 0;

  return (
    <section className="tela tela--memorias">
      <header className="tela__topo">
        <h1 className="tela__titulo">José sabe</h1>
        <Link to="/ajustes" className="botao botao--link" aria-label="Ajustes">
          ⚙
        </Link>
      </header>

      {carga === 'ok' && !adicionando && (
        <Botao className="memorias__adicionar" disabled={semRede} onClick={() => { setEditandoId(null); setAdicionando(true); }}>
          + Adicionar memória
        </Botao>
      )}
      {adicionando && (
        <FormMemoria
          titulo="Adicionar memória"
          rotuloSalvar="Salvar"
          aoCancelar={fecharAdicionar}
          aoSalvar={async (conteudo) => {
            adicionar(await criarMemoria(conteudo));
            setAdicionando(false);
            toast('Memória atualizada.');
          }}
        />
      )}

      {carga === 'carregando' && <EsqueletoLista linhas={4} />}
      {carga === 'erro' && (
        <div className="estado-vazio">
          <p className="mensagem-erro">Não foi possível carregar.</p>
          <Botao onClick={recarregar}>Tentar de novo</Botao>
        </div>
      )}
      {vazio && !adicionando && (
        <EstadoVazio texto="O José ainda não sabe nada sobre você.">
          <Botao variante="principal" carregando={abrindo} disabled={semRede} onClick={() => void fazerBoasVindas()}>
            Fazer as boas-vindas
          </Botao>
        </EstadoVazio>
      )}

      {grupos.map((g) => (
        <section key={g.area} className="memorias__grupo" aria-label={g.rotulo}>
          <h2 className="memorias__area">{g.rotulo}</h2>
          <ul className="memorias__lista">
            {g.itens.map((m) => (
              <li key={m.id} className="memoria" data-area={m.area} data-memoria-id={m.id}>
                {editandoId === m.id ? (
                  <FormMemoria
                    titulo="Editar memória"
                    inicial={{ texto: m.texto, area: m.area }}
                    rotuloSalvar="Salvar"
                    aoCancelar={() => fecharEdicao(m.id)}
                    aoSalvar={async (conteudo) => {
                      const atualizada = await editarMemoria(m.id, conteudo);
                      substituir(atualizada);
                      // Mudar a área leva a memória para outro grupo; a ordem dentro do grupo segue a data de criação.
                      setEditandoId(null);
                      toast('Memória atualizada');
                    }}
                  />
                ) : (
                  <>
                    <button type="button" className="memoria__abrir" disabled={semRede} aria-label={`Editar: ${m.texto}`} onClick={() => { setAdicionando(false); setMenuAbertoId(null); setEditandoId(m.id); }}>
                      <span className="memoria__texto">{m.texto}</span>
                      <span className="memoria__data texto-2">Aprendida em {formatarDataMemoria(m.criada_em, fuso)}</span>
                    </button>
                    <button
                      type="button"
                      className="memoria__mais"
                      aria-label={`Mais opções de ${m.texto}`}
                      aria-expanded={menuAbertoId === m.id}
                      onClick={() => setMenuAbertoId(menuAbertoId === m.id ? null : m.id)}
                    >
                      ⋯
                    </button>
                    {menuAbertoId === m.id && (
                      <div className="memoria__menu" role="menu" ref={posicionarMenu}>
                        <button type="button" role="menuitem" className="memoria__menu-item" disabled={semRede} onClick={() => apagar(m)}>
                          Apagar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

