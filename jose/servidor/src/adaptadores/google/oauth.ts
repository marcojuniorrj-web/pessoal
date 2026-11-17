import { Google, decodeIdToken } from 'arctic';

/** O que o José precisa saber da conta Google. */
export interface PerfilGoogle {
  email: string;
  emailVerificado: boolean;
  nome: string;
  fotoUrl: string | null;
}

/** Adaptador: trocar o provedor de login não mexe em modulos/. */
export interface ProvedorOAuth {
  urlAutorizacao(state: string, codeVerifier: string): URL;
  /** Troca o code pelo perfil. Lança erro se falhar. */
  obterPerfil(code: string, codeVerifier: string): Promise<PerfilGoogle>;
}

export function criarProvedorGoogle(clientId: string, clientSecret: string, urlRetorno: string): ProvedorOAuth {
  const google = new Google(clientId, clientSecret, urlRetorno);
  return {
    urlAutorizacao: (state, verifier) => google.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']),
    async obterPerfil(code, verifier) {
      const tokens = await google.validateAuthorizationCode(code, verifier);
      const c = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
      return {
        email: String(c.email ?? ''),
        emailVerificado: c.email_verified === true,
        nome: String(c.name ?? c.given_name ?? ''),
        fotoUrl: typeof c.picture === 'string' ? c.picture : null,
      };
    },
  };
}
