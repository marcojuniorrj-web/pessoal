import { useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FUSO_PADRAO } from '@compartilhado/datas';
import { apagarMeta, criarMeta, editarMeta, listarMetas, type MetaDto } from '../api/metas';
import { apagarTarefa, criarTarefa, editarTarefa, listarTarefas, type TarefaDto } from '../api/tarefas';
import { Botao } from '../componentes/Botao';
import { EsqueletoLista } from '../componentes/Esqueleto';
import { EstadoVazio } from '../componentes/EstadoVazio';
import { ListaItens } from '../componentes/ListaItens';
import { useToast } from '../componentes/Toast';
import { useAgora } from '../estado/agora';
import { apagarComDesfazer, ESPERA_APAGAR_MS } from '../estado/apagar-com-desfazer';
import { criarFilaPorItem } from '../estado/fila-por-item';
import { separarMetas, separarTarefas } from '../estado/itens-lista';
import { useListaRemota } from '../estado/lista-remota';
import { useOnline } from '../estado/online';
import { useSessao, useUsuario } from '../estado/sessao';

type Aba = 'tarefas' | 'metas';
const ABAS: Array<{ id: Aba; rotulo: string }> = [
  { id: 'tarefas', rotulo: 'Tarefas' },
  { id: 'metas', rotulo: 'Metas' },
];

/** Estado de carga comum às duas listas: esqueleto, erro com "Tentar de novo". */
function CargaDaLista({ carga, recarregar }: { carga: 'carregando' | 'erro'; recarregar: () => void }) {
  if (carga === 'carregando') return <EsqueletoLista linhas={4} />;
  return (
    <div className="estado-vazio">
      <p className="mensagem-erro">Não foi possível carregar.</p>
      <Botao onClick={recarregar}>Tentar de novo</Botao>
    </div>
  );
}

/** Aba Tarefas (telas.md, tela 5): sub-abas Tarefas e Metas; concluir com "Feito! Desfazer", editar, apagar com "Desfazer" e adicionar. */
export function Tarefas() {
  const [params, setParams] = useSearchParams();
  const aba: Aba = params.get('aba') === 'metas' ? 'metas' : 'tarefas';
  const abrirAba = (a: Aba) => {
    setParams(a === 'metas' ? { aba: 'metas' } : {}, { replace: true });
  };

  return (
    <section className="tela tela--tarefas">
      <h1 className="tela__titulo">Tarefas</h1>
      <div
        className="subabas"
        role="tablist"
        aria-label="Tarefas e metas"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const proxima: Aba = aba === 'tarefas' ? 'metas' : 'tarefas';
          abrirAba(proxima);
          requestAnimationFrame(() => document.getElementById(`aba-${proxima}`)?.focus());
        }}
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            id={`aba-${a.id}`}
            type="button"
            role="tab"
            className="subabas__item"
            aria-selected={aba === a.id}
            aria-controls="painel-lista"
            tabIndex={aba === a.id ? 0 : -1}
            onClick={() => abrirAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div id="painel-lista" role="tabpanel" aria-labelledby={`aba-${aba}`} className="tela__painel">
        {aba === 'tarefas' ? <PainelTarefas /> : <PainelMetas />}
      </div>
    </section>
  );
}

const chaveTarefa = (id: string) => `tarefa:${id}`;
const chaveMeta = (id: string) => `meta:${id}`;

function useSemRede() {
  const online = useOnline();
  const { estado } = useSessao();
  return !online || (estado.situacao === 'logado' && estado.offline);
}

function PainelTarefas() {
  const toast = useToast();
  const ir = useNavigate();
  const fuso = useUsuario().fuso_horario ?? FUSO_PADRAO;
  const agora = useAgora(fuso);
  const semRede = useSemRede();
  const { carga, itens, recarregar, adicionar, substituir, remover } = useListaRemota(listarTarefas, chaveTarefa, 'tarefas');
  const fila = useRef(criarFilaPorItem()).current;
  const { pendentes, concluidas } = useMemo(() => separarTarefas(itens, agora, fuso), [itens, agora, fuso]);

  /** Reabre uma tarefa concluída. `viaDesfazer`: veio do "Feito! Desfazer", que já é o aviso. */
  const reabrir = (feita: TarefaDto, viaDesfazer = false) => {
    substituir({ ...feita, concluida: false, concluida_em: null });
    if (!viaDesfazer) toast('Tarefa reaberta.');
    fila(feita.id, () => editarTarefa(feita.id, { concluida: false })).catch(() => {
      substituir(feita);
      toast('Não salvou.', { rotulo: 'Tentar de novo', aoTocar: () => reabrir(feita, viaDesfazer) });
    });
  };

  const concluir = (t: TarefaDto) => {
    const feita: TarefaDto = { ...t, concluida: true, concluida_em: new Date().toISOString() };
    substituir(feita);
    toast('Feito!', { rotulo: 'Desfazer', aoTocar: () => reabrir(feita, true) }, ESPERA_APAGAR_MS);
    fila(t.id, () => editarTarefa(t.id, { concluida: true })).catch(() => {
      substituir(t);
      toast('Não salvou.', { rotulo: 'Tentar de novo', aoTocar: () => concluir(t) });
    });
  };

  const apagar = (t: TarefaDto) => {
    remover(t.id);
    apagarComDesfazer({
      id: chaveTarefa(t.id),
      mostrar: toast,
      apagar: () => apagarTarefa(t.id),
      aoDesfazer: () => adicionar(t),
      aoFalhar: () => {
        adicionar(t);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagar(t) });
      },
    });
  };

  if (carga !== 'ok') return <CargaDaLista carga={carga} recarregar={recarregar} />;
  return (
    <ListaItens
      tipo="tarefa"
      pendentes={pendentes}
      concluidas={concluidas}
      agora={agora}
      fuso={fuso}
      semRede={semRede}
      aoConcluir={concluir}
      aoReabrir={(t) => reabrir(t)}
      aoEditar={async (t, novo) => substituir(await editarTarefa(t.id, novo))}
      aoCriar={async (novo) => adicionar(await criarTarefa(novo))}
      aoApagar={apagar}
      vazio={
        <EstadoVazio texto="Nada por aqui. Converse com o José e salve o que importar.">
          <Botao variante="principal" onClick={() => ir('/')}>
            Ir para o Chat
          </Botao>
        </EstadoVazio>
      }
    />
  );
}

function PainelMetas() {
  const toast = useToast();
  const fuso = useUsuario().fuso_horario ?? FUSO_PADRAO;
  const agora = useAgora(fuso);
  const semRede = useSemRede();
  const { carga, itens, recarregar, adicionar, substituir, remover } = useListaRemota(listarMetas, chaveMeta, 'metas');
  const fila = useRef(criarFilaPorItem()).current;
  const { pendentes, concluidas } = useMemo(() => separarMetas(itens), [itens]);

  const reativar = (feita: MetaDto, viaDesfazer = false) => {
    substituir({ ...feita, status: 'ativa', concluida_em: null });
    if (!viaDesfazer) toast('Meta reaberta.');
    fila(feita.id, () => editarMeta(feita.id, { status: 'ativa' })).catch(() => {
      substituir(feita);
      toast('Não salvou.', { rotulo: 'Tentar de novo', aoTocar: () => reativar(feita, viaDesfazer) });
    });
  };

  const concluir = (m: MetaDto) => {
    const feita: MetaDto = { ...m, status: 'concluida', concluida_em: new Date().toISOString() };
    substituir(feita);
    toast('Feito!', { rotulo: 'Desfazer', aoTocar: () => reativar(feita, true) }, ESPERA_APAGAR_MS);
    fila(m.id, () => editarMeta(m.id, { status: 'concluida' })).catch(() => {
      substituir(m);
      toast('Não salvou.', { rotulo: 'Tentar de novo', aoTocar: () => concluir(m) });
    });
  };

  const apagar = (m: MetaDto) => {
    remover(m.id);
    apagarComDesfazer({
      id: chaveMeta(m.id),
      mostrar: toast,
      apagar: () => apagarMeta(m.id),
      aoDesfazer: () => adicionar(m),
      aoFalhar: () => {
        adicionar(m);
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagar(m) });
      },
    });
  };

  if (carga !== 'ok') return <CargaDaLista carga={carga} recarregar={recarregar} />;
  return (
    <ListaItens
      tipo="meta"
      pendentes={pendentes}
      concluidas={concluidas}
      agora={agora}
      fuso={fuso}
      semRede={semRede}
      aoConcluir={concluir}
      aoReabrir={(m) => reativar(m)}
      aoEditar={async (m, novo) => substituir(await editarMeta(m.id, novo))}
      aoCriar={async (novo) => adicionar(await criarMeta(novo))}
      aoApagar={apagar}
      vazio={<EstadoVazio texto="Nenhuma meta ainda. Conte ao José o que você quer alcançar." />}
    />
  );
}
