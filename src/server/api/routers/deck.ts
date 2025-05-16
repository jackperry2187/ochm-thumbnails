import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const deckRouter = createTRPCRouter({
  autocompleteDeckName: publicProcedure
    .input(z.object({ query: z.string() }))
    .output(z.array(z.object({ name: z.string(), lastUsedAt: z.date() })))
    .query(async ({ ctx, input }) => {
      if (!input.query) {
        return [];
      }
      try {
        const decks = await ctx.db.deck.findMany({
          where: {
            name: {
              contains: input.query,
              mode: "insensitive", // Case-insensitive search
            },
          },
          select: {
            name: true,
            lastUsedAt: true,
          },
          orderBy: {
            lastUsedAt: "desc", // Optional: order by most recently used
          },
          take: 10, // Limit results
        });
        return decks;
      } catch (error) {
        console.error("Failed to autocomplete deck name:", error);
        return []; // Return empty array on error
      }
    }),

  saveOrUpdateDeckName: publicProcedure
    .input(z.object({ 
      name: z.string().min(1).max(100)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const deck = await ctx.db.deck.upsert({
          where: { name: input.name },
          update: {
            lastUsedAt: new Date(),
          },
          create: {
            name: input.name,
          },
        });
        return deck;
      } catch (error) {
        console.error("Failed to save or update deck name:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save or update deck name",
          cause: error,
        });
      }
    }),
}); 