import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Pet, SchemaPet } from 'src/backend/lambda/api/lib/models/pet';
import { TrpcInstance } from 'src/backend/lambda/api/server';
import * as db from 'src/backend/lambda/api/lib/db/pets';

export function petGet(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .meta({ openapi: { method: 'GET', path: '/pets/{pet_id}' } })
    .input(z.object({ pet_id: z.number() }))
    .output(SchemaPet)
    .query(async ({ input }) => {
      const pet: Pet | undefined = db.getPets().find((pet) => pet.id === input.pet_id);
      if (!pet) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pet not found' });
      }
      return pet;
    });
}
