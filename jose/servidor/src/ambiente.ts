export interface Ambiente {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Bucket R2 dos backups semanais; opcional até o R2 ser ativado na conta. */
  BACKUPS?: R2Bucket;
  AI?: Ai;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  OWNER_EMAIL: string;
  ANTHROPIC_API_KEY?: string;
  URL_BASE?: string;
  MODELO_PADRAO: string;
  MODELO_PROFUNDO: string;
  LIMITE_MENSAGENS_DIA: string;
}
