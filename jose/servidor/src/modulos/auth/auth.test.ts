import { describe, expect, it } from 'vitest';
import { criarAppTeste, cookiesDe, entrar, PERFIL_MARCO } from '../../../testes/ambiente';
import { acessoPermitido } from './servico';

async function contar(t: ReturnType<typeof criarAppTeste>, tabela: string) {
  return (await t.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).first<{ n: number }>())!.n;
}

describe('regra de acesso (regra 8)', () => {
  it('aceita o e-mail do dono, ignorando maiúsculas', () => {
    expect(acessoPermitido({ ...PERFIL_MARCO, email: 'MARCO@Gmail.com' }, 'marco@gmail.com')).toBe(true);
    expect(acessoPermitido(PERFIL_MARCO, 'Marco@GMAIL.com')).toBe(true);
  });
  it('recusa e-mail diferente e e-mail não verificado', () => {
    expect(acessoPermitido({ ...PERFIL_MARCO, email: 'outro@gmail.com' }, 'marco@gmail.com')).toBe(false);
    expect(acessoPermitido({ ...PERFIL_MARCO, emailVerificado: false }, 'marco@gmail.com')).toBe(false);
    expect(acessoPermitido({ ...PERFIL_MARCO, email: '' }, '')).toBe(false);
  });
});

describe('GET /auth/google', () => {
  it('redireciona ao Google com state e guarda o cookie de PKCE', async () => {
    const t = criarAppTeste();
    const r = await t.chamar('/auth/google');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toContain('accounts.google.test');
    const sc = r.headers.getSetCookie().join('\n');
    expect(sc).toMatch(/jose_oauth=/);
    expect(sc).toMatch(/HttpOnly/i);
  });
});

describe('GET /auth/google/callback', () => {
  it('login do dono: cria usuário e sessão e redireciona para /', async () => {
    const t = criarAppTeste();
    const { retorno } = await entrar(t);
    expect(retorno.status).toBe(302);
    expect(retorno.headers.get('location')).toBe('/');
    const sc = retorno.headers.getSetCookie().find((c) => c.startsWith('jose_sessao='))!;
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/Secure/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(sc).toMatch(/Max-Age=2592000/);
    expect(await contar(t, 'usuarios')).toBe(1);
    expect(await contar(t, 'sessoes')).toBe(1);
  });

  it('respeita o parâmetro voltar (só caminhos internos)', async () => {
    const t = criarAppTeste();
    expect((await entrar(t, '/tarefas')).retorno.headers.get('location')).toBe('/tarefas');
    expect((await entrar(t, '//evil.com')).retorno.headers.get('location')).toBe('/');
    expect((await entrar(t, 'https://evil.com')).retorno.headers.get('location')).toBe('/');
  });

  it('e-mail diferente: /?erro=negado e nenhuma linha criada', async () => {
    const t = criarAppTeste({ perfil: { ...PERFIL_MARCO, email: 'outro@gmail.com' } });
    const { retorno } = await entrar(t);
    expect(retorno.headers.get('location')).toBe('/?erro=negado');
    expect(retorno.headers.getSetCookie().some((c) => c.startsWith('jose_sessao='))).toBe(false);
    expect(await contar(t, 'usuarios')).toBe(0);
    expect(await contar(t, 'sessoes')).toBe(0);
  });

  it('e-mail não verificado: negado, nada gravado', async () => {
    const t = criarAppTeste({ perfil: { ...PERFIL_MARCO, emailVerificado: false } });
    const { retorno } = await entrar(t);
    expect(retorno.headers.get('location')).toBe('/?erro=negado');
    expect(await contar(t, 'usuarios')).toBe(0);
  });

  it('e-mail em maiúsculas entra e é gravado em minúsculas', async () => {
    const t = criarAppTeste({ perfil: { ...PERFIL_MARCO, email: 'MARCO@GMAIL.COM' } });
    const { retorno } = await entrar(t);
    expect(retorno.headers.get('location')).toBe('/');
    const u = await t.env.DB.prepare('SELECT email FROM usuarios').first<{ email: string }>();
    expect(u?.email).toBe('marco@gmail.com');
  });

  it('segundo login reaproveita o usuário e atualiza o nome', async () => {
    const t = criarAppTeste();
    await entrar(t);
    const t2 = { ...t, chamar: t.chamar };
    await entrar(t2);
    expect(await contar(t, 'usuarios')).toBe(1);
    expect(await contar(t, 'sessoes')).toBe(2);
  });

  it('state diferente, sem cookie ou cookie adulterado: /?erro=falha', async () => {
    const t = criarAppTeste();
    const inicio = await t.chamar('/auth/google');
    const cookie = cookiesDe(inicio);
    const r1 = await t.chamar('/auth/google/callback?code=abc&state=errado', { headers: { cookie } });
    expect(r1.headers.get('location')).toBe('/?erro=falha');
    const r2 = await t.chamar('/auth/google/callback?code=abc&state=x');
    expect(r2.headers.get('location')).toBe('/?erro=falha');
    const r3 = await t.chamar('/auth/google/callback?code=abc&state=x', { headers: { cookie: cookie.replace('jose_oauth=', 'jose_oauth=X') } });
    expect(r3.headers.get('location')).toBe('/?erro=falha');
    expect(await contar(t, 'usuarios')).toBe(0);
  });

  it('erro do Google ou falha na troca do code: /?erro=falha', async () => {
    const t = criarAppTeste({ perfil: new Error('invalid_grant') });
    const { retorno } = await entrar(t);
    expect(retorno.headers.get('location')).toBe('/?erro=falha');
    const t2 = criarAppTeste();
    const inicio = await t2.chamar('/auth/google');
    const r = await t2.chamar('/auth/google/callback?error=access_denied', { headers: { cookie: cookiesDe(inicio) } });
    expect(r.headers.get('location')).toBe('/?erro=falha');
  });
});
