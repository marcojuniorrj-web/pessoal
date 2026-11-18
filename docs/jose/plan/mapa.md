# Mapa de dependências

```
Fase 1 (esqueleto + login + prova da voz)
   │
   ▼
Fase 2 (chat por texto)
   ├──────────────► Fase 3 (voz)            ← pode andar em paralelo com a Fase 4
   ▼
Fase 4 (memórias + cartões de sugestão)
   ├──────────────► Fase 6 (boas-vindas + modo decisão)   ← depende só da 4; a 5 ajuda, mas não bloqueia
   ▼
Fase 5 (tarefas e metas)
   │
   ▼
Fase 7 (privacidade, métricas, e2e, fechamento)  ← depende de todas
```

- **Caminho crítico:** 1 → 2 → 4 → 5 → 7.
- **Em paralelo:** a Fase 3 (voz) pode ser feita a qualquer momento depois da 2. A Fase 6 pode começar logo depois da 4.
- **Riscos antecipados na Fase 1:** o login no PWA do iPhone (1.5–1.11) e o formato de áudio do iPhone no Whisper (1.12). Se algum falhar, decidir o plano B antes da Fase 2.
- **Ordem recomendada** (uma onda por vez): 1, 2, 3, 4, 5, 6, 7.
- **Ordem de construção combinada (2026-11-18):** 1, 2, 4, 5, 3, 6, 7. A voz (3) vem logo depois das tarefas e metas (5), para estar pronta antes dos 7 dias de uso real.
- **Fase 2b (melhorias do Chat, pedido do Marco em 2026-11-18)** depende das Fases 2 e 4 e vem antes da 3, porque mexe nos mesmos arquivos do Chat. Ordem atual: 1, 2, 4, 5, 2b, 3, 6, 7.
