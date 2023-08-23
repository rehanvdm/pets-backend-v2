import { z } from 'zod';

const ApiEnvSchema = z.object({
  ENVIRONMENT: z.enum(['dev', 'prod']),
  // Example of doing some more complex validation, passing in an JSON array as a string
  // ALLOWED_ORIGINS: z.string().transform((val) => JSON.parse(val) as string[]),
});
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

let env: ApiEnv;
export function getEnv() {
  /* Do not cache env if testing */
  if (!env || process.env.TEST) {
    env = ApiEnvSchema.parse(process.env);
  }

  return ApiEnvSchema.parse(process.env);
}

export function envToObject(env: ApiEnv) {
  return {
    ENVIRONMENT: env.ENVIRONMENT,
    // ALLOWED_ORIGINS: JSON.stringify(env.ALLOWED_ORIGINS),
  };
}
