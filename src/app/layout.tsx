import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand wordmark: geometric display face (rounded square + speaker mark system)
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

// Reader serif: warm, literary body face for long-form reading
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "VoxPDF · Lector con voz y GLM",
  description: "Lee PDF, EPUB, DOCX, CBZ en voz alta. Con GLM AI: traducción, resúmenes, glosario, mapa mental, flashcards Anki, TTS con pausas, ecualizador, control por voz, Pomodoro, teleprompter, heat map, e-ink, lazy rendering, cloud sync, sala grupal, y más.",
  keywords: ["PDF", "TTS", "reader", "e-book", "GLM", "AI", "flashcards", "Anki", "translation", "glossary", "mind map", "Pomodoro"],
  icons: {
    // Geometric brand mark: terracotta rounded square + speaker glyph
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%23e2683d'/><path d='M40 38 L40 62 L54 72 L54 28 Z' fill='%231c0d06'/><path d='M62 40 q9 10 0 20' stroke='%231c0d06' stroke-width='6' fill='none' stroke-linecap='round'/><path d='M72 31 q15 19 0 38' stroke='%231c0d06' stroke-width='6' fill='none' stroke-linecap='round' opacity='0.55'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} ${sourceSerif.variable} antialiased`}
        style={{ margin: 0, padding: 0, overflow: 'hidden' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
