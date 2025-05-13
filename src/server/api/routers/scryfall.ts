import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

const SCRYFALL_API_BASE = "https://api.scryfall.com";

interface ScryfallAutocompleteResponse {
  object: "catalog";
  total_values: number;
  data: string[];
}

interface ScryfallError {
  object: "error";
  code: string;
  status: number;
  details: string;
}

interface ScryfallCardImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

interface ScryfallCard {
  object: "card";
  id: string;
  name: string;
  set: string;
  image_uris?: ScryfallCardImageUris;
  card_faces?: Array<{
    name?: string;
    image_uris?: ScryfallCardImageUris;
  }>;
  // ... other card properties
}

interface ScryfallSearchResponse {
  object: "list";
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCard[];
}

export const scryfallRouter = createTRPCRouter({
  autocompleteCardName: publicProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      if (!input.query) {
        return [];
      }
      try {
        const response = await fetch(
          `${SCRYFALL_API_BASE}/cards/autocomplete?q=${encodeURIComponent(
            input.query
          )}`
        );
        if (!response.ok) {
          console.error(
            "Scryfall autocomplete API error:",
            response.status,
            await response.text()
          );
          return [];
        }
        const data = (await response.json()) as ScryfallAutocompleteResponse | ScryfallError;

        if (data.object === "error") {
          console.error("Scryfall autocomplete error:", data.details);
          return [];
        }
        
        return data.data;
      } catch (error) {
        console.error("Failed to fetch card autocomplete:", error);
        return [];
      }
    }),

  getCardArts: publicProcedure
    .input(z.object({ cardName: z.string() }))
    .output(z.array(z.object({ 
      artUrl: z.string().url(), 
      set: z.string(),
      scryfallPrintId: z.string()
    })))
    .query(async ({ input }) => {
      if (!input.cardName) {
        return [];
      }
      try {
        const response = await fetch(
          `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(
            `!"${input.cardName}"`
          )}&unique=prints&include_variations=true&include_extras=true`
        );

        if (!response.ok) {
          console.error(
            "Scryfall search API error:",
            response.status,
            await response.text()
          );
          return [];
        }

        const data = (await response.json()) as ScryfallSearchResponse | ScryfallError;

        if (data.object === "error") {
          console.warn(`Scryfall search error for "${input.cardName}": ${data.details}`);
          return [];
        }

        const collectedArts: Array<{ artUrl: string; set: string; scryfallPrintId: string }> = [];
        const seenArtUrls = new Set<string>();

        data.data.forEach((card) => {
          if (card.image_uris?.art_crop) {
            if (!seenArtUrls.has(card.image_uris.art_crop)) {
              collectedArts.push({
                artUrl: card.image_uris.art_crop,
                set: card.set.toUpperCase(),
                scryfallPrintId: card.id,
              });
              seenArtUrls.add(card.image_uris.art_crop);
            }
          }
          if (card.card_faces && Array.isArray(card.card_faces)) {
            card.card_faces.forEach(face => {
              if (face.image_uris?.art_crop) {
                if (!seenArtUrls.has(face.image_uris.art_crop)) {
                  collectedArts.push({
                    artUrl: face.image_uris.art_crop,
                    set: card.set.toUpperCase(),
                    scryfallPrintId: card.id,
                  });
                  seenArtUrls.add(face.image_uris.art_crop);
                }
              }
            });
          }
        });
        return collectedArts;
      } catch (error) {
        console.error("Failed to fetch card arts:", error);
        return [];
      }
    }),

  proxyImage: publicProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(input.imageUrl);
        if (!response.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch image from Scryfall: ${response.statusText}`,
          });
        }
        const imageBuffer = await response.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        const contentType = response.headers.get('content-type') ?? 'image/jpeg';
        return `data:${contentType};base64,${imageBase64}`;
      } catch (error) {
        console.error("Error proxying image:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to proxy image',
          cause: error,
        });
      }
    }),
}); 