import { z } from 'zod';

/** Docker Compose passes unset variables as empty strings; treat them as absent. */
const emptyAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const withDefault = <T extends z.ZodType>(schema: T) => z.preprocess(emptyAsUndefined, schema);

const positiveInt = z.coerce.number().int().positive();

export const EnvSchema = z.object({
  NODE_ENV: withDefault(z.enum(['development', 'production', 'test']).default('development')),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgres:// connection string'),
  PORT: withDefault(z.coerce.number().int().min(1).max(65_535).default(3001)),
  LLM_PROVIDER: withDefault(z.enum(['mock', 'anthropic']).default('mock')),
  LLM_MODEL: withDefault(z.string().min(1).default('claude-haiku-4-5')),
  ANTHROPIC_API_KEY: withDefault(z.string().min(1).optional()),
  ADMIN_TOKEN: withDefault(z.string().min(1).default('demo-admin')),
  CORS_ORIGIN: withDefault(z.string().min(1).default('http://localhost:8080')),
  RATE_LIMIT_VERIFY_PER_MINUTE: withDefault(positiveInt.default(60)),
  RATE_LIMIT_MESSAGES_PER_MINUTE: withDefault(positiveInt.default(60)),
  CONTRACTS_PATH: withDefault(z.string().min(1).optional()),
  POLICY_DOC_PATH: withDefault(z.string().min(1).optional()),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parses the environment and throws one readable error listing every problem (fail fast at boot). */
export function parseEnv(source: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}
