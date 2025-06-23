import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const artRouter = createTRPCRouter({
  recordArtUsage: publicProcedure
    .input(
      z.object({
        scryfallCardId: z.string(),
        scryfallArtUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await ctx.db.cardArtUsage.upsert({
          where: { scryfallArtUrl: input.scryfallArtUrl },
          update: {
            scryfallCardId: input.scryfallCardId,
            lastUsedAt: new Date(),
          },
          create: {
            scryfallCardId: input.scryfallCardId,
            scryfallArtUrl: input.scryfallArtUrl,
          },
        });
      } catch (error) {
        console.error("Failed to record art usage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record art usage",
          cause: error,
        });
      }
    }),

  getArtUsage: publicProcedure
    .input(z.object({ artUrls: z.array(z.string().url()) }))
    .query(async ({ input, ctx }) => {
      if (input.artUrls.length === 0) return [];
      
      try {
        return await ctx.db.cardArtUsage.findMany({
          where: {
            scryfallArtUrl: {
              in: input.artUrls,
            },
          },
          select: {
            scryfallArtUrl: true,
            lastUsedAt: true,
          },
        });
      } catch (error) {
        console.error("Failed to get art usage:", error);
        return [];
      }
    }),
}); 