import { z } from 'zod';
export const SchemaPet = z.object({
  id: z.number(),
  type: z.string(),
  name: z.string(),
});
export type Pet = z.infer<typeof SchemaPet>;
