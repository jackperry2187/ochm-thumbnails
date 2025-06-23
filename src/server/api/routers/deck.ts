import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const deckRouter = createTRPCRouter({
  autocompleteDeckName: publicProcedure
    .input(z.object({ query: z.string() }))
    .output(z.array(z.object({ name: z.string(), lastUsedAt: z.date() })))
    .query(async ({ ctx, input }) => {
      if (!input.query) return [];
      
      try {
        return await ctx.db.deck.findMany({
          where: {
            name: {
              contains: input.query,
              mode: "insensitive",
            },
          },
          select: {
            name: true,
            lastUsedAt: true,
          },
          orderBy: {
            lastUsedAt: "desc",
          },
          take: 10,
        });
      } catch (error) {
        console.error("Failed to autocomplete deck name:", error);
        return [];
      }
    }),

  saveOrUpdateDeckName: publicProcedure
    .input(z.object({ 
      name: z.string().min(1).max(100)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await ctx.db.deck.upsert({
          where: { name: input.name },
          update: {
            lastUsedAt: new Date(),
          },
          create: {
            name: input.name,
          },
        });
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