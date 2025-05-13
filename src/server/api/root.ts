import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { scryfallRouter } from "~/server/api/routers/scryfall";
import { artRouter } from "~/server/api/routers/art";
import { deckRouter } from "~/server/api/routers/deck";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  scryfall: scryfallRouter,
  art: artRouter,
  deck: deckRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
