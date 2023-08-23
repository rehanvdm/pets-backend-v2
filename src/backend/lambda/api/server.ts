import { initTRPC } from '@trpc/server';
import { OpenApiMeta } from 'trpc-openapi';
import { petCreate, petGetAll } from '@backend/lambda/api/routes/pets';
import { petGet } from '@backend/lambda/api/routes/pets/{petid}';

export type Context = {
  request: {
    ip: string;
    ua: string;
  };
};

const trpcInstance = initTRPC.context<Context>().meta<OpenApiMeta>().create({ isDev: true });

export type TrpcInstance = typeof trpcInstance;

export const appRouter = trpcInstance.router({
  petCreate: petCreate(trpcInstance),
  petGetAll: petGetAll(trpcInstance),
  petGet: petGet(trpcInstance),
});

export type AppRouter = typeof appRouter;
