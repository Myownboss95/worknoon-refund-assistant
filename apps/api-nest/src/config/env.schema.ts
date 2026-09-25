import { isIP } from 'node:net';
import { z } from 'zod';

export const DEMO_ADMIN_TOKEN = 'demo-admin';
export const MIN_ADMIN_TOKEN_LENGTH = 32;

/** Docker Compose passes unset variables as empty strings; treat them as absent. */
const emptyAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const withDefault = <T extends z.ZodType>(schema: T) => z.preprocess(emptyAsUndefined, schema);

const positiveInt = z.coerce.number().int().positive();

/** An IPv4/IPv6 address, optionally with a CIDR prefix length. */
function isIpOrCidr(entry: string): boolean {
  const [address = '', prefix, ...rest] = entry.split('/');
  const version = isIP(address);
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  const bits = Number(prefix);
  return /^\d{1,3}$/.test(prefix) && bits <= (version === 4 ? 32 : 128);
}

/** `a, b ,c` → `['a', 'b', 'c']`; empty or unset → `[]` (trust no proxy). */
const TrustedProxiesSchema = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
  )
  .refine((entries) => entries.every(isIpOrCidr), {
    message: 'TRUSTED_PROXIES must be a comma-separated list of IP addresses or CIDR ranges',
  });

/** Missing, the well-known demo token, or too short to resist guessing. */
export function isWeakAdminToken(token: string | undefined): boolean {
  return token === undefined || token === DEMO_ADMIN_TOKEN || token.length < MIN_ADMIN_TOKEN_LENGTH;
}

export const EnvSchema = z
  .object({
    NODE_ENV: withDefault(z.enum(['development', 'production', 'test']).default('development')),
    DEMO_MODE: withDefault(z.stringbool().default(false)),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL is required' })
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgres:// connection string'),
    PORT: withDefault(z.coerce.number().int().min(1).max(65_535).default(3001)),
    LLM_PROVIDER: withDefault(z.enum(['mock', 'anthropic']).default('mock')),
    LLM_MODEL: withDefault(z.string().min(1).default('claude-haiku-4-5')),
    ANTHROPIC_API_KEY: withDefault(z.string().min(1).optional()),
    ADMIN_TOKEN: withDefault(z.string().min(1).default(DEMO_ADMIN_TOKEN)),
    CORS_ORIGIN: withDefault(z.string().min(1).default('http://localhost:8080')),
    RATE_LIMIT_VERIFY_PER_MINUTE: withDefault(positiveInt.default(60)),
    RATE_LIMIT_MESSAGES_PER_MINUTE: withDefault(positiveInt.default(60)),
    RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE: withDefault(positiveInt.default(20)),
    MAX_CONVERSATIONS_PER_ORDER_PER_DAY: withDefault(positiveInt.default(20)),
    LLM_MAX_CALLS_PER_HOUR: withDefault(positiveInt.default(1000)),
    TRUSTED_PROXIES: withDefault(TrustedProxiesSchema),
    CONTRACTS_PATH: withDefault(z.string().min(1).optional()),
    POLICY_DOC_PATH: withDefault(z.string().min(1).optional()),
  })
  // Fail fast in production unless a real admin secret is configured. Never echo the value.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.DEMO_MODE && isWeakAdminToken(env.ADMIN_TOKEN)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_TOKEN'],
        message: `ADMIN_TOKEN must be set to a secret of at least ${MIN_ADMIN_TOKEN_LENGTH} characters other than the demo token when DEMO_MODE is false in production`,
      });
    }
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
