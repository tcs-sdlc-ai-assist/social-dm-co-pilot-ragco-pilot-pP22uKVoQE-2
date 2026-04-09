import { z } from "zod";

// ─── Environment Schema ──────────────────────────────────────────────────────

const envSchema = z.object({
  // Azure OpenAI
  AZURE_OPENAI_API_KEY: z.string().min(1).default(""),
  AZURE_OPENAI_ENDPOINT: z.string().url().default("https://localhost.openai.azure.com"),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1).default("gpt-4o"),
  AZURE_OPENAI_API_VERSION: z.string().min(1).default("2024-02-15-preview"),

  // JWT
  JWT_SECRET: z.string().min(32).default("default-dev-secret-change-in-production!!"),
  JWT_EXPIRES_IN: z.string().min(1).default("8h"),

  // Salesforce
  SALESFORCE_CLIENT_ID: z.string().default(""),
  SALESFORCE_CLIENT_SECRET: z.string().default(""),
  SALESFORCE_INSTANCE_URL: z.string().default("https://localhost.my.salesforce.com"),
  SALESFORCE_ACCESS_TOKEN: z.string().default(""),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  SLA_BREACH_MINUTES: z
    .string()
    .default("30")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  HIGH_PRIORITY_THRESHOLD: z
    .string()
    .default("80")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0).max(100)),

  // Notifications
  NOTIFICATION_EMAIL_FROM: z.string().default("noreply@example.com"),
});

// ─── Parse & Validate ────────────────────────────────────────────────────────

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(`❌ Invalid environment configuration:\n${formatted}`);

    // In production, throw to prevent startup with bad config
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Invalid environment configuration:\n${formatted}`);
    }

    // In development, use defaults by parsing with defaults applied
    const fallback = envSchema.parse({});
    return fallback;
  }

  return parsed.data;
}

const env = loadConfig();

// ─── Typed Config Object ─────────────────────────────────────────────────────

export const config = {
  azureOpenAI: {
    apiKey: env.AZURE_OPENAI_API_KEY,
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    deployment: env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  salesforce: {
    clientId: env.SALESFORCE_CLIENT_ID,
    clientSecret: env.SALESFORCE_CLIENT_SECRET,
    instanceUrl: env.SALESFORCE_INSTANCE_URL,
    accessToken: env.SALESFORCE_ACCESS_TOKEN,
  },
  app: {
    url: env.NEXT_PUBLIC_APP_URL,
    slaBreachMinutes: env.SLA_BREACH_MINUTES,
    highPriorityThreshold: env.HIGH_PRIORITY_THRESHOLD,
  },
  notification: {
    emailFrom: env.NOTIFICATION_EMAIL_FROM,
  },
} as const;

// ─── Type Export ─────────────────────────────────────────────────────────────

export type AppConfig = typeof config;

export default config;