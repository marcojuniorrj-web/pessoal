import { z } from 'zod';
import { AREAS_ITEM, AREAS_MEMORIA } from './areas';

export const LIMITE_TITULO = 120;
export const LIMITE_MEMORIA = 300;
export const LIMITE_MENSAGEM = 4000;

const dataLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD').refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'Data inexistente');

export const areaItemSchema = z.enum(AREAS_ITEM);
export const areaMemoriaSchema = z.enum(AREAS_MEMORIA);
export const prazoSchema = dataLocal;

const titulo = z.string().trim().min(1, 'Título obrigatório').max(LIMITE_TITULO, `Máximo de ${LIMITE_TITULO} caracteres`);
const textoMemoria = z.string().trim().min(1, 'Texto obrigatório').max(LIMITE_MEMORIA, `Máximo de ${LIMITE_MEMORIA} caracteres`);

// Entrada de tarefas e metas (criação manual) e conteúdo das sugestões.
export const tarefaEntradaSchema = z.object({ titulo, area: areaItemSchema, prazo: prazoSchema.nullish() });
export const metaEntradaSchema = z.object({ titulo, area: areaItemSchema, prazo: prazoSchema.nullish() });
export const memoriaEntradaSchema = z.object({ texto: textoMemoria, area: areaMemoriaSchema });

/** Edição parcial de memória (PATCH): ao menos um campo. */
export const memoriaAtualizacaoSchema = memoriaEntradaSchema.partial().refine((v) => v.texto !== undefined || v.area !== undefined, 'Informe texto ou área');

export const conteudoSugestaoSchema = {
  tarefa: tarefaEntradaSchema,
  meta: metaEntradaSchema,
  memoria: memoriaEntradaSchema,
} as const;

export const sugestaoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('tarefa'), conteudo: tarefaEntradaSchema }),
  z.object({ tipo: z.literal('meta'), conteudo: metaEntradaSchema }),
  z.object({ tipo: z.literal('memoria'), conteudo: memoriaEntradaSchema }),
]);

export const mensagemEntradaSchema = z.object({
  id: z.string().min(1),
  texto: z.string().min(1).max(LIMITE_MENSAGEM),
  origem: z.enum(['texto', 'voz']),
});

export const conversaEntradaSchema = z.object({
  tipo: z.enum(['normal', 'boas_vindas']),
  modo: z.enum(['padrao', 'decidir']).optional(),
});

// Entidades (como a API devolve).
export const usuarioSchema = z.object({
  nome: z.string(),
  email: z.string(),
  foto_url: z.string().nullable(),
  boas_vindas_concluida: z.boolean(),
  /** Fuso do usuário (ausente em respostas antigas guardadas no cache do app). */
  fuso_horario: z.string().optional(),
  conversa_boas_vindas_id: z.string().optional(),
});

export const tarefaSchema = tarefaEntradaSchema.extend({
  id: z.string(),
  concluida: z.boolean(),
  concluida_em: z.string().nullable(),
  origem: z.enum(['chat', 'manual', 'boas_vindas']),
  criada_em: z.string(),
});

export const metaSchema = metaEntradaSchema.extend({
  id: z.string(),
  status: z.enum(['ativa', 'concluida']),
  concluida_em: z.string().nullable(),
  origem: z.enum(['chat', 'manual', 'boas_vindas']),
  criada_em: z.string(),
});

export const memoriaSchema = memoriaEntradaSchema.extend({
  id: z.string(),
  origem: z.enum(['boas_vindas', 'chat', 'manual']),
  criada_em: z.string(),
  atualizada_em: z.string().nullable(),
});

export type TarefaEntrada = z.infer<typeof tarefaEntradaSchema>;
export type MetaEntrada = z.infer<typeof metaEntradaSchema>;
export type MemoriaEntrada = z.infer<typeof memoriaEntradaSchema>;
export type Sugestao = z.infer<typeof sugestaoSchema>;
export type Usuario = z.infer<typeof usuarioSchema>;

export type ConversaEntrada = z.infer<typeof conversaEntradaSchema>;
export type ModoConversa = 'padrao' | 'decidir';

/** Conversa como a API devolve (sem dados internos). */
export interface ConversaDto {
  id: string;
  titulo: string | null;
  tipo: 'normal' | 'boas_vindas';
  modo: ModoConversa;
  criada_em: string;
  atualizada_em: string;
}
export interface MensagemDto {
  id: string;
  autor: 'marco' | 'jose';
  texto: string;
  origem: 'texto' | 'voz';
  modelo: string | null;
  criada_em: string;
}
export interface SugestaoDto {
  id: string;
  mensagem_id: string;
  tipo: 'tarefa' | 'meta' | 'memoria';
  conteudo: unknown;
  status: 'pendente' | 'salva' | 'descartada';
  item_id: string | null;
}
export interface ConversaCompleta {
  conversa: ConversaDto;
  mensagens: MensagemDto[];
  sugestoes: SugestaoDto[];
}
export type ConversaResumo = Pick<ConversaDto, 'id' | 'titulo' | 'tipo' | 'modo' | 'atualizada_em'>;
