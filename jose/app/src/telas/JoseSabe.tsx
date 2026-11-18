import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FUSO_PADRAO } from '@compartilhado/datas';
import { apagarMemoria, criarMemoria, editarMemoria, type MemoriaDto } from '../api/memorias';
import { Botao } from '../componentes/Botao';
import { EsqueletoLista } from '../componentes/Esqueleto';
import { EstadoVazio } from '../componentes/EstadoVazio';
import { FormMemoria } from '../componentes/FormMemoria';
import { useToast } from '../componentes/Toast';
import { apagarComDesfazer } from '../estado/apagar-com-desfazer';
import { agruparMemorias, formatarDataMemoria, useMemorias } from '../estado/memorias';
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
          aoCancelar={() => setAdicionando(false)}
          aoSalvar={async (conteudo) => {
            adicionar(await criarMemoria(conteudo));
            setAdicionando(false);
            toast('Memória adicionada.');
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
          {/* As boas-vindas chegam na Fase 6: até lá o botão fica desabilitado. */}
          <Botao variante="principal" disabled title="Em breve">
            Fazer as boas-vindas
          </Botao>
        </EstadoVazio>
      )}

      {grupos.map((g) => (
        <section key={g.area} className="memorias__grupo" aria-label={g.rotulo}>
          <h2 className="memorias__area">{g.rotulo}</h2>
          <ul className="memorias__lista">
            {g.itens.map((m) => (
              <li key={m.id} className="memoria" data-area={m.area}>
                {editandoId === m.id ? (
                  <FormMemoria
                    titulo="Editar memória"
                    inicial={{ texto: m.texto, area: m.area }}
                    rotuloSalvar="Salvar"
                    aoCancelar={() => setEditandoId(null)}
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
                      <div className="memoria__menu" role="menu">
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

