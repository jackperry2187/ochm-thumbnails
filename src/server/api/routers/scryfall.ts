import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const USER_AGENT = "OCHMThumbnailsApp/1.0"; // Define your app's User-Agent

// Allowed domains for the image proxy
const ALLOWED_IMAGE_DOMAINS = [
  "cards.scryfall.io", 
  "c1.scryfall.com", // Older image domain, still sometimes seen
  "svgs.scryfall.io"
  // Add other Scryfall image subdomains if necessary
];

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit for proxied images
const FETCH_TIMEOUT_MS = 5000; // 5 seconds timeout for fetching image headers/data

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper for fetch calls to Scryfall API
async function fetchScryfall(path: string, options?: RequestInit) {
  await delay(100); // Introduce a 100ms delay

  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, */*;q=0.8", // Standard Accept header
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
        const response = await fetchScryfall(
          `/cards/autocomplete?q=${encodeURIComponent(input.query)}`
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
      scryfallPrintId: z.string(),
      artist: z.string().optional(),
    })))
    .query(async ({ input }) => {
      if (!input.cardName) {
        return [];
      }
      try {
        const response = await fetchScryfall(
          `/cards/search?q=${encodeURIComponent(
            `!\"${input.cardName}\"`
          )}&unique=art&include_variations=true&include_extras=true`
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

        const collectedArts: Array<{ artUrl: string; set: string; scryfallPrintId: string; artist?: string }> = [];
        const seenArtUrls = new Set<string>();

        data.data.forEach((card) => {
          if (card.image_uris?.art_crop) {
            if (!seenArtUrls.has(card.image_uris.art_crop)) {
              collectedArts.push({
                artUrl: card.image_uris.art_crop,
                set: card.set.toUpperCase(),
                scryfallPrintId: card.id,
                artist: card.artist,
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
                    artist: face.artist ?? card.artist,
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
        const url = new URL(input.imageUrl);
        if (!ALLOWED_IMAGE_DOMAINS.includes(url.hostname)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Image URL from disallowed domain.",
          });
        }

        // Step 1: Fetch headers to check content length
        const headController = new AbortController();
        const headTimeoutId = setTimeout(() => headController.abort(), FETCH_TIMEOUT_MS);

        const headResponse = await fetch(input.imageUrl, { signal: headController.signal, method: 'HEAD' });
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

        // Step 2: Fetch the actual image data with timeout
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
        
        // Double check content length if the HEAD request didn't provide it (less common)
        // This is a progressive download, so can be harder to limit strictly here if no Content-Length initially
        // but Vercel memory/timeout will be the ultimate backstop.

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