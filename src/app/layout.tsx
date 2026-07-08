import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "VoxPDF v4 — Lector con Voz + IA",
  description: "Lee PDF, EPUB, DOCX, CBZ en voz alta. 26 features: TTS con pausas, ecualizador, control por voz, traducción, glosario, mapa mental, flashcards Anki, Pomodoro, teleprompter, heat map, e-ink, lazy rendering, cloud sync, sala grupal, y más.",
  keywords: ["PDF", "TTS", "reader", "e-book", "flashcards", "Anki", "translation", "glossary", "mind map", "Pomodoro"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ margin: 0, padding: 0, overflow: 'hidden' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
