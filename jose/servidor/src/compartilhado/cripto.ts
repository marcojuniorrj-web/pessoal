const codificador = new TextEncoder();

function paraHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function tokenAleatorio(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(texto: string): Promise<string> {
  return paraHex(await crypto.subtle.digest('SHA-256', codificador.encode(texto)));
}

async function chaveHmac(segredo: string) {
  return crypto.subtle.importKey('raw', codificador.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/** Assina um texto: devolve `texto.assinatura`. */
export async function assinar(texto: string, segredo: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await chaveHmac(segredo), codificador.encode(texto));
  return `${texto}.${base64Url(new Uint8Array(sig))}`;
}

/** Devolve o texto original se a assinatura confere, senão null. */
export async function verificar(assinado: string, segredo: string): Promise<string | null> {
  const i = assinado.lastIndexOf('.');
  if (i < 0) return null;
  const texto = assinado.slice(0, i);
  const esperado = await assinar(texto, segredo);
  if (esperado.length !== assinado.length) return null;
  let diff = 0;
  for (let k = 0; k < esperado.length; k++) diff |= esperado.charCodeAt(k) ^ assinado.charCodeAt(k);
  return diff === 0 ? texto : null;
}
