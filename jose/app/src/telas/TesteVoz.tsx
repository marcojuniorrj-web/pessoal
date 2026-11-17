import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Botao } from '../componentes/Botao';

const MAX_SEGUNDOS = 120;

/** Prefere mp4/AAC (Safari do iPhone); cai para webm (Chrome/Android). */
function escolherTipo(): string {
  for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

type Estado = 'parado' | 'gravando' | 'transcrevendo';

/** Página temporária da onda 1: prova de risco da voz (gravar → transcrever). */
export function TesteVoz() {
  const [estado, setEstado] = useState<Estado>('parado');
  const [segundos, setSegundos] = useState(MAX_SEGUNDOS);
  const [texto, setTexto] = useState<string | null>(null);
  const [info, setInfo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const relogio = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(relogio.current), []);

  const parar = () => {
    clearInterval(relogio.current);
    gravador.current?.stop();
  };

  const iniciar = async () => {
    setErro(null);
    setTexto(null);
    let fluxo: MediaStream;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErro('Libere o microfone nas configurações para usar voz.');
      return;
    }
    const tipo = escolherTipo();
    const rec = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
    pedacos.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && pedacos.current.push(e.data);
    rec.onstop = () => {
      fluxo.getTracks().forEach((t) => t.stop());
      void enviar(new Blob(pedacos.current, { type: rec.mimeType || tipo }));
    };
    gravador.current = rec;
    rec.start();
    setSegundos(MAX_SEGUNDOS);
    setEstado('gravando');
    relogio.current = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          parar();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const enviar = async (audio: Blob) => {
    setEstado('transcrevendo');
    setInfo(`${audio.type || 'tipo desconhecido'} · ${(audio.size / 1024).toFixed(0)} KB`);
    try {
      const f = new FormData();
      f.set('audio', audio, audio.type.includes('mp4') ? 'audio.m4a' : 'audio.webm');
      const r = await fetch('/api/voz', { method: 'POST', body: f, credentials: 'same-origin' });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { erro?: { mensagem: string } } | null;
        setErro(j?.erro?.mensagem ?? `Erro ${r.status}`);
      } else {
        setTexto(((await r.json()) as { texto: string }).texto);
      }
    } catch {
      setErro('Sem conexão. Tentar de novo');
    }
    setEstado('parado');
  };

  const mm = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

  return (
    <section className="tela">
      <header className="tela__topo">
        <Link to="/ajustes" className="botao botao--link" aria-label="Voltar">
          ←
        </Link>
        <h1 className="tela__titulo">Teste de voz</h1>
        <span style={{ width: 48 }} />
      </header>
      <p className="texto-2">Página temporária. Toque para gravar, toque de novo para parar e transcrever.</p>
      {estado === 'gravando' ? (
        <Botao variante="principal" grande onClick={parar}>
          ⏹ Parar ({mm})
        </Botao>
      ) : (
        <Botao variante="principal" grande carregando={estado === 'transcrevendo'} onClick={() => void iniciar()}>
          🎤 {estado === 'transcrevendo' ? 'Transcrevendo áudio…' : 'Gravar'}
        </Botao>
      )}
      {info && <p className="texto-2">Formato gravado: {info}</p>}
      {erro && (
        <p className="mensagem-erro" role="alert">
          {erro}
        </p>
      )}
      {texto !== null && (
        <div className="cartao" aria-label="Texto transcrito">
          <p>{texto || '(nenhum texto reconhecido)'}</p>
        </div>
      )}
    </section>
  );
}
