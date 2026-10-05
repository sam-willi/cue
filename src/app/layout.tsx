import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// DESIGN.md §8: Geist Sans for product UI and headlines; Geist Mono only for technical readouts.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cue — speak with intention",
  description: "Real-time filler-word and pace cues.",
  // Symbol on a bone field for light browser chrome, on an ink field for dark (DESIGN.md §3).
  icons: {
    icon: [
      { url: "/brand/cue-logo-symbol-fullcolor-light-64.png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/cue-logo-symbol-fullcolor-dark-64.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
