// Modo decisão (telas.md, Chat): o atalho "⚖️ Preciso decidir" cria a conversa em modo `decidir` e envia este texto como 1ª mensagem.
// A pergunta inicial ("Qual é a decisão?") é a resposta real do modelo profundo, não um texto fixo do app.
export const TEXTO_ATALHO_DECISAO = 'Preciso decidir';

/** Texto fixo (só como alternativa: conversa em modo decisão ainda vazia, ex.: sem rede na criação). */
export const PERGUNTA_FIXA_DECISAO = 'Qual é a decisão?';

/** A mensagem é só o aviso do atalho (ainda não diz qual é a decisão). */
export const ehAtalhoDecisao = (texto: string) => texto.trim().toLowerCase() === TEXTO_ATALHO_DECISAO.toLowerCase();
