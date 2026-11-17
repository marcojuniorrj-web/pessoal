/** Adaptador de transcrição: trocar o provedor não mexe em modulos/. */
export interface Transcritor {
  /** Devolve o texto em português. O áudio só existe em memória. */
  transcrever(audio: ArrayBuffer): Promise<string>;
}

export const MODELO_WHISPER = '@cf/openai/whisper-large-v3-turbo';

function paraBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) s += String.fromCharCode(...bytes.subarray(i, i + passo));
  return btoa(s);
}

export function criarTranscritorWhisper(ai: Ai): Transcritor {
  return {
    async transcrever(audio) {
      const r = (await ai.run(MODELO_WHISPER as keyof AiModels, { audio: paraBase64(audio), language: 'pt' } as never)) as { text?: string };
      return (r.text ?? '').trim();
    },
  };
}
