import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saudacao } from '@compartilhado/datas';
import { LIMITE_MENSAGEM } from '@compartilhado/schemas';
import { Balao } from '../componentes/Balao';
import { Botao } from '../componentes/Botao';
import { CartaoSugestao } from '../componentes/CartaoSugestao';
import { EsqueletoLista } from '../componentes/Esqueleto';
import { GavetaHistorico } from '../componentes/GavetaHistorico';
import { useToast, useToastAtual } from '../componentes/Toast';
import { useChat } from '../estado/chat';
import { useOnline } from '../estado/online';
import { lerRascunho, salvarRascunho } from '../estado/rascunho';
import { useSessao, useUsuario } from '../estado/sessao';
import { useTecladoVirtual } from '../estado/teclado';

const ATALHOS = [
  { icone: '☀️', rotulo: 'O que faço hoje?' },
  { icone: '🧱', rotulo: 'Travei' },
  { icone: '🌙', rotulo: 'Descarregar a cabeça' },
] as const;

export function Chat() {
  const usuario = useUsuario();
  const { estado } = useSessao();
  const online = useOnline();
  const toast = useToast();
  const toastAtual = useToastAtual();
  const ir = useNavigate();
  const [params] = useSearchParams();
  const idUrl = params.get('c');
  const nova = params.get('nova') === '1';
  useTecladoVirtual();

  const { geracao, carga, conversa, bolhas, ocupado, enviar, tentarDeNovo, iniciarDecisao, recarregar, atualizarSugestao } = useChat({
    idUrl,
    nova,
    // A URL passa a apontar para a conversa criada: um 401 volta exatamente para ela.
    aoCriar: (id) => ir(`/?c=${encodeURIComponent(id)}`, { replace: true }),
  });

  const [texto, setTexto] = useState('');
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const rodapeRef = useRef<HTMLFormElement>(null);

  // Publica a altura do rodapé (campo + Enviar) para o toast ficar acima dele, sem cobrir o campo.
  useEffect(() => {
    const el = rodapeRef.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty('--altura-rodape-chat', `${el.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty('--altura-rodape-chat');
    };
  }, []);
  const fimRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const conversaRef = useRef<string | null>(null);
  conversaRef.current = conversa.id;
  const semRede = !online || (estado.situacao === 'logado' && estado.offline);

  // O rascunho da conversa aberta volta para o campo (ex.: depois de um 401 e novo login).
  useEffect(() => {
    if (carga === 'ok') setTexto(lerRascunho(conversaRef.current));
  }, [carga, geracao]);

  // Sempre mostra o fim da conversa quando chega texto novo.
  useLayoutEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [bolhas]);

  // O aviso abre espaço no fim da lista (--reserva-toast): quem estava no fim continua no fim, acima do aviso.
  useEffect(() => {
    const lista = listaRef.current;
    if (toastAtual === null || !lista) return;
    const reserva = parseFloat(document.documentElement.style.getPropertyValue('--reserva-toast')) || 0;
    // "No fim" = até ~120 px do fim (o último item pode ter folga embaixo): então o fim continua à vista, acima do aviso.
    if (lista.scrollHeight - lista.scrollTop - lista.clientHeight - reserva <= 120) lista.scrollTop = lista.scrollHeight;
  }, [toastAtual]);

  const aoDigitar = (v: string) => {
    setTexto(v);
    salvarRascunho(conversa.id, v);
  };

  const enviarTexto = async (conteudo: string) => {
    if (semRede) return;
    setTexto('');
    await enviar(conteudo);
  };

  const aoEnviar = (e?: FormEvent) => {
    e?.preventDefault();
    if (!texto.trim() || ocupado || semRede) return;
    void enviarTexto(texto);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // No computador, Enter envia e Shift+Enter quebra a linha. No celular, Enter quebra a linha.
    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
      e.preventDefault();
      aoEnviar();
    }
  };

  const decidir = async () => {
    if (semRede) return;
    if (!(await iniciarDecisao())) toast('Não foi possível iniciar. Tente de novo.');
  };

  const vazio = carga === 'ok' && bolhas.length === 0;
  const podeEnviar = !!texto.trim() && !ocupado && !semRede;

  return (
    <section className="chat">
      <header className="chat__topo">
        <button type="button" className="chat__icone" aria-label="Histórico" onClick={() => setGavetaAberta(true)}>
          ☰
        </button>
        <h1 className="chat__titulo">{conversa.titulo ?? 'Nova conversa'}</h1>
        {conversa.modo === 'decidir' && <span className="chat__selo">Modo decisão</span>}
        <Botao variante="link" className="chat__nova" onClick={() => ir('/?nova=1')}>
          + Nova
        </Botao>
      </header>

      <div ref={listaRef} className="chat__mensagens" aria-live="polite">
        {carga === 'carregando' && <EsqueletoLista linhas={3} />}
        {carga === 'erro' && (
          <div className="estado-vazio">
            <p className="mensagem-erro">Não foi possível carregar.</p>
            <Botao onClick={recarregar}>Tentar de novo</Botao>
          </div>
        )}
        {vazio && conversa.modo === 'padrao' && (
          <div className="chat-vazio">
            <h2 className="chat-vazio__saudacao">{saudacao(usuario.nome, new Date())}</h2>
            <div className="atalhos">
              {ATALHOS.map((a) => (
                <Botao key={a.rotulo} className="atalho" disabled={ocupado || semRede} onClick={() => void enviarTexto(a.rotulo)}>
                  <span aria-hidden="true">{a.icone}</span> {a.rotulo}
                </Botao>
              ))}
              <Botao className="atalho" disabled={ocupado || semRede} onClick={() => void decidir()}>
                <span aria-hidden="true">⚖️</span> Preciso decidir
              </Botao>
            </div>
          </div>
        )}
        {vazio && conversa.modo === 'decidir' && (
          <div className="chat-vazio">
            <h2 className="chat-vazio__saudacao">Modo decisão</h2>
            <p className="texto-2">Conte qual é a decisão. Vou fazer até 3 perguntas, mostrar prós e contras e dar uma recomendação.</p>
          </div>
        )}
        {bolhas.flatMap((b) => [
          <Balao key={b.id} bolha={b} aoTentarDeNovo={() => void tentarDeNovo()} />,
          // Chave pelo id da sugestão: o cartão não é remontado quando a resposta ganha o id definitivo.
          ...(b.sugestoes ?? []).map((s) => <CartaoSugestao key={s.id} sugestao={s} aoMudar={atualizarSugestao} />),
        ])}
        <div ref={fimRef} />
      </div>

      <form ref={rodapeRef} className="chat__rodape" onSubmit={aoEnviar}>
        <label className="so-leitor" htmlFor="campo-mensagem">
          Mensagem para o José
        </label>
        <textarea
          id="campo-mensagem"
          ref={campoRef}
          className="chat__campo"
          rows={1}
          maxLength={LIMITE_MENSAGEM}
          placeholder={semRede ? 'Sem conexão' : 'Fale com o José…'}
          value={texto}
          disabled={semRede}
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={aoTeclar}
        />
        <Botao variante="principal" type="submit" className="chat__enviar" aria-label="Enviar" disabled={!podeEnviar}>
          ➤
        </Botao>
      </form>

      <GavetaHistorico
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        conversaAtualId={conversa.id}
        aoAbrir={(id) => {
          setGavetaAberta(false);
          ir(`/?c=${encodeURIComponent(id)}`);
        }}
        aoApagarAtual={() => {
          setGavetaAberta(false);
          ir('/?nova=1');
        }}
      />
    </section>
  );
}
