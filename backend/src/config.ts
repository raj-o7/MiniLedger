import { existsSync } from 'node:fs';
import { z } from 'zod';
import { isValidTimeZone } from './utils/dates';

const DURATION_PATTERN = /^(\d+)([smhd])$/;
const SECONDS_PER_UNIT: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Converts strings like "7d" or "12h" into a number of seconds. */
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  const amount = match?.[1];
  const unit = match?.[2];
  const secondsPerUnit = unit === undefined ? undefined : SECONDS_PER_UNIT[unit];
  if (amount === undefined || secondsPerUnit === undefined) {
    throw new Error(`Invalid duration "${value}". Use a number followed by s, m, h or d (e.g. 7d).`);
  }
  return Number(amount) * secondsPerUnit;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(DURATION_PATTERN, 'JWT_EXPIRES_IN must look like 7d, 12h, 30m or 3600s')
    .default('7d'),
  APP_TIMEZONE: z
    .string()
    .refine(isValidTimeZone, 'APP_TIMEZONE must be a valid timezone such as Asia/Kolkata or UTC')
    .default('UTC'),
});

export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  timeZone: string;
}

/** Reads and validates environment variables. Fails fast with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
  }

  const values = result.data;
  return {
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    jwtSecret: values.JWT_SECRET,
    jwtExpiresInSeconds: parseDurationToSeconds(values.JWT_EXPIRES_IN),
    timeZone: values.APP_TIMEZONE,
  };
}

/** Loads variables from a .env file into process.env if the file exists. */
export function loadEnvFileIfPresent(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
