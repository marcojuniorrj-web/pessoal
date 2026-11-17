import { Hono } from 'hono';
import type { Ambiente } from './ambiente';

export const app = new Hono<{ Bindings: Ambiente }>();

app.get('/api/saude', (c) => c.json({ ok: true }));

export default app;
