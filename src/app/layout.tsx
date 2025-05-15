import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"; // Fallback for local dev

export const viewport: Viewport = {
  themeColor: "#6A0DAD",
  width: "device-width",
  colorScheme: "dark",
}

export const metadata: Metadata = {
  title: "OCHM Thumbnail Creator",
  description: "Quickly create Magic: The Gathering thumbnails for Ocean County Hive Mind (OCHM) YouTube videos. Features Scryfall card art integration.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  keywords: ["Magic: The Gathering", "MTG", "Thumbnails", "YouTube", "Content Creator", "OCHM", "Ocean County Hive Mind", "Scryfall"],
  authors: [{ name: "Ocean County Hive Mind" }, { name: "jackperry2187", url: "https://jackperry2187.com" }],
  manifest: "/site.webmanifest",
  // Open Graph / Facebook
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "OCHM Thumbnail Creator",
    description: "Quickly create Magic: The Gathering thumbnails for OCHM YouTube videos.",
    images: [
      {
        url: `${siteUrl}/website_ss.png`,
        width: 1200,
        height: 600,
        alt: "OCHM Thumbnail Creator OG Image",
      },
    ],
    siteName: "OCHM Thumbnail Creator",
  },
  // Twitter
  twitter: {
    card: "summary_large_image",
    site: "@HiveMindNJ", // Add your Twitter handle if you have one
    creator: "@DuxMTG",
    title: "OCHM Thumbnail Creator",
    description: "Quickly create Magic: The Gathering thumbnails for OCHM YouTube videos.",
    images: [`${siteUrl}/website_ss.png`],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
