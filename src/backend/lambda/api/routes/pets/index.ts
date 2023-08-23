import { z } from 'zod';
import { Pet, SchemaPet } from '@backend/lambda/api/lib/models/pet';
import { TrpcInstance } from '@backend/lambda/api/server';
import * as db from '@backend/lambda/api/lib/db/pets';

const NewPetSchema = SchemaPet.pick({
  type: true,
  name: true,
});
export type NewPet = z.infer<typeof NewPetSchema>;

export function petCreate(trpcInstance: TrpcInstance) {
  return (
    trpcInstance.procedure
      .meta({ openapi: { method: 'POST', path: '/pets' } })
      .input(NewPetSchema)
      .output(SchemaPet.array())
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mutation(async ({ input, ctx }) => {
        // /* Example access to context constructed in root index.ts */
        // console.log(ctx.request.ua)

        const newPet: Pet = {
          id: Math.ceil(Math.random() * 10000000),
          type: input.type,
          name: input.name,
        };
        db.addPet(newPet);

        return db.getPets();
      })
  );
}

export function petGetAll(trpcInstance: TrpcInstance) {
  return (
    trpcInstance.procedure
      .meta({ openapi: { method: 'GET', path: '/pets' } })
      .input(z.void())
      .output(SchemaPet.array())
      // .query(async ({ input, ctx }) => {
      .query(async () => {
        const pets = db.getPets();
        return pets;
      })
  );
}
