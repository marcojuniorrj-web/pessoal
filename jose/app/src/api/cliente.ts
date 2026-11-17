// Cliente HTTP mínimo. Erros viram ErroHttp; falha de rede vira ErroRede.
export class ErroHttp extends Error {
  constructor(readonly status: number, readonly codigo: string, mensagem: string) {
    super(mensagem);
  }
}
export class ErroRede extends Error {
  constructor() {
    super('Sem conexão');
  }
}

async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(caminho, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroRede();
  }
  if (!resp.ok) {
    let codigo = 'erro';
    let mensagem = 'Algo deu errado.';
    try {
      const j = (await resp.json()) as { erro?: { codigo: string; mensagem: string } };
      if (j.erro) ({ codigo, mensagem } = j.erro);
    } catch {
      /* corpo vazio */
    }
    throw new ErroHttp(resp.status, codigo, mensagem);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export const api = {
  get: <T>(caminho: string) => pedir<T>('GET', caminho),
  post: <T = void>(caminho: string, corpo?: unknown) => pedir<T>('POST', caminho, corpo),
  patch: <T>(caminho: string, corpo?: unknown) => pedir<T>('PATCH', caminho, corpo),
  delete: <T = void>(caminho: string, corpo?: unknown) => pedir<T>('DELETE', caminho, corpo),
};
