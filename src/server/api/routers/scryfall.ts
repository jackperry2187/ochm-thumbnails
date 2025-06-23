import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const USER_AGENT = "OCHMThumbnailsApp/1.0";

const ALLOWED_IMAGE_DOMAINS = [
  "cards.scryfall.io", 
  "c1.scryfall.com",
  "svgs.scryfall.io"
];

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchScryfall(path: string, options?: RequestInit) {
  await delay(100);

  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, */*;q=0.8",
    ...(options?.headers ?? {}),
  };

  return fetch(`${SCRYFALL_API_BASE}${path}`, {
    ...options,
    headers,
  });
}

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
  artist?: string;
  image_uris?: ScryfallCardImageUris;
  card_faces?: Array<{
    name?: string;
    artist?: string;
    image_uris?: ScryfallCardImageUris;
  }>;
}

interface ScryfallSearchResponse {
  object: "list";
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCard[];
}

const handleScryfallResponse = async <T>(response: Response, operation: string): Promise<T | null> => {
  if (!response.ok) {
    console.error(`Scryfall ${operation} API error:`, response.status, await response.text());
    return null;
  }
  return response.json() as Promise<T>;
};

const collectCardArts = (data: ScryfallSearchResponse) => {
  const collectedArts: Array<{ artUrl: string; set: string; scryfallPrintId: string; artist?: string }> = [];
  const seenArtUrls = new Set<string>();

  const addArt = (artUrl: string, set: string, cardId: string, artist?: string) => {
    if (!seenArtUrls.has(artUrl)) {
      collectedArts.push({
        artUrl,
        set: set.toUpperCase(),
        scryfallPrintId: cardId,
        artist,
      });
      seenArtUrls.add(artUrl);
    }
  };

  data.data.forEach((card) => {
    if (card.image_uris?.art_crop) {
      addArt(card.image_uris.art_crop, card.set, card.id, card.artist);
    }
    
    if (card.card_faces?.length) {
      card.card_faces.forEach(face => {
        if (face.image_uris?.art_crop) {
          addArt(face.image_uris.art_crop, card.set, card.id, face.artist ?? card.artist);
        }
      });
    }
  });

  return collectedArts;
};

export const scryfallRouter = createTRPCRouter({
  autocompleteCardName: publicProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      if (!input.query) return [];
      
      try {
        const response = await fetchScryfall(
          `/cards/autocomplete?q=${encodeURIComponent(input.query)}`
        );
        
        const data = await handleScryfallResponse<ScryfallAutocompleteResponse | ScryfallError>(response, "autocomplete");
        if (!data) return [];

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
      scryfallPrintId: z.string(),
      artist: z.string().optional(),
    })))
    .query(async ({ input }) => {
      if (!input.cardName) return [];
      
      try {
        const response = await fetchScryfall(
          `/cards/search?q=${encodeURIComponent(
            `!\"${input.cardName}\"`
          )}&unique=art&include_variations=true&include_extras=true`
        );

        const data = await handleScryfallResponse<ScryfallSearchResponse | ScryfallError>(response, "search");
        if (!data) return [];

        if (data.object === "error") {
          console.warn(`Scryfall search error for "${input.cardName}": ${data.details}`);
          return [];
        }

        return collectCardArts(data);
      } catch (error) {
        console.error("Failed to fetch card arts:", error);
        return [];
      }
    }),

  proxyImage: publicProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .query(async ({ input }) => {
      try {
        const url = new URL(input.imageUrl);
        if (!ALLOWED_IMAGE_DOMAINS.includes(url.hostname)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Image URL from disallowed domain.",
          });
        }

        const headController = new AbortController();
        const headTimeoutId = setTimeout(() => headController.abort(), FETCH_TIMEOUT_MS);

        const headResponse = await fetch(input.imageUrl, { 
          signal: headController.signal, 
          method: 'HEAD' 
        });
        clearTimeout(headTimeoutId);

        if (!headResponse.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch image headers: ${headResponse.statusText}`,
          });
        }

        const contentLength = headResponse.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
          throw new TRPCError({
            code: 'PAYLOAD_TOO_LARGE',
            message: `Image exceeds maximum allowed size of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`,
          });
        }

        const dataController = new AbortController();
        const dataTimeoutId = setTimeout(() => dataController.abort(), FETCH_TIMEOUT_MS);
        
        const response = await fetch(input.imageUrl, { signal: dataController.signal });
        clearTimeout(dataTimeoutId);

        if (!response.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch image from Scryfall: ${response.statusText}`,
          });
        }

        const imageBuffer = await response.arrayBuffer();
        if (imageBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
          throw new TRPCError({
            code: 'PAYLOAD_TOO_LARGE',
            message: `Image payload exceeds maximum allowed size of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB during download.`,
          });
        }

        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        const contentType = response.headers.get('content-type') ?? 'image/jpeg';
        return `data:${contentType};base64,${imageBase64}`;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TRPCError({
            code: 'TIMEOUT',
            message: 'Request to fetch image timed out.',
          });
        }
        console.error("Error proxying image:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to proxy image',
          cause: error,
        });
      }
    }),
}); 