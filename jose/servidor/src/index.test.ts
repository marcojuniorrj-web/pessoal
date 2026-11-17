import { describe, expect, it } from 'vitest';
import { app } from './index';

describe('servidor', () => {
  it('responde ao teste de saúde', async () => {
    const r = await app.request('/api/saude');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
