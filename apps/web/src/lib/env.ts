import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  AIROUTER_API_KEY: z.string().optional(),
  AIROUTER_BASE_URL: z.string().default('https://api.airouter.in/v1'),
  AIROUTER_PRIMARY_MODEL: z.string().default('deepseek-chat'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_PRIMARY_MODEL: z.string().default('gemini-flash-latest'),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_PRIMARY_MODEL: z.string().default('deepseek-chat'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_PRIMARY_MODEL: z.string().default('gpt-4o'),
  OPENAI_FALLBACK_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EXTRACTION_POLICY_VERSION: z.string().default('engineering-v1'),
  OPENAI_EXTRACTION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.90),

  DEV_AUTH_BYPASS: z.coerce.boolean().default(false),
  DEV_TENANT_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
  DEV_TRAVELER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000002'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('tripcopilot'),
  LOCAL_STORAGE_ROOT: z.string().optional(),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  EMAIL_INGESTION_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_INGESTION_WEBHOOK_SECRET: z.string().optional(),
  NOTIFICATION_WEBHOOK_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

let parsed: Env | undefined;

function getEnv(): Env {
  parsed ??= envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,

    AIROUTER_API_KEY: process.env.AIROUTER_API_KEY,
    AIROUTER_BASE_URL: process.env.AIROUTER_BASE_URL,
    AIROUTER_PRIMARY_MODEL: process.env.AIROUTER_PRIMARY_MODEL,

    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_PRIMARY_MODEL: process.env.GEMINI_PRIMARY_MODEL,

    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_PRIMARY_MODEL: process.env.DEEPSEEK_PRIMARY_MODEL,

    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_PRIMARY_MODEL: process.env.OPENAI_PRIMARY_MODEL,
    OPENAI_FALLBACK_MODEL: process.env.OPENAI_FALLBACK_MODEL,
    OPENAI_EXTRACTION_POLICY_VERSION: process.env.OPENAI_EXTRACTION_POLICY_VERSION,
    OPENAI_EXTRACTION_THRESHOLD: process.env.OPENAI_EXTRACTION_THRESHOLD,

    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
    DEV_TENANT_ID: process.env.DEV_TENANT_ID,
    DEV_TRAVELER_ID: process.env.DEV_TRAVELER_ID,

    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT,

    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    EMAIL_INGESTION_WEBHOOK_SECRET: process.env.EMAIL_INGESTION_WEBHOOK_SECRET,
    WHATSAPP_INGESTION_WEBHOOK_SECRET: process.env.WHATSAPP_INGESTION_WEBHOOK_SECRET,
    NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL,
  });
  return parsed;
}

export const env = new Proxy({} as Env, {
  get: (_target, property) => getEnv()[property as keyof Env],
});