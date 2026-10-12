import { Archivo, Atkinson_Hyperlegible_Next, Bricolage_Grotesque, Lexend, Newsreader } from "next/font/google";

// One typeface per audience (globals.css picks which a page uses). Not preloaded: every market
// page shares this module, and a visitor should only download the face their page sets.
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", preload: false });
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", preload: false });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", preload: false });
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", preload: false });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", preload: false });

/** Class names that make every landing typeface available as a CSS variable. */
export const LANDING_FONTS = [newsreader, archivo, lexend, atkinson, bricolage].map((font) => font.variable).join(" ");
