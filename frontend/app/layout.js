import { Geist, Geist_Mono } from "next/font/google";
import { Cause } from "next/font/google";
import { Combo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cause = Cause({
  variable: "--font-cause",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const combo = Combo({
  variable: "--font-combo",
  subsets: ["latin"],
  weight: "400", // Combo is a static font — only 400 exists, so it must be named
});

const bumbel = localFont({
  src: "./fonts/Bumbel.woff2",
  variable: "--font-bumbel",
});

const beachday = localFont({
  src: "./fonts/Beachday.woff2",
  variable: "--font-beachday",
});

const ettamelody = localFont({
  src: "./fonts/ITEttaMelody.woff2",
  variable: "--font-ettamelody",
});

const starbim = localFont({
  src: "./fonts/Starbim.woff2",
  variable: "--font-starbim",
});

const cupidvibes = localFont({
  src: "./fonts/CupidVibes.woff2",
  variable: "--font-cupidvibes",
});

export const metadata = {
  title: "Elemental Beauty",
  description: "Purdue's cosmetic science club",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`
        ${geistSans.variable} 
        ${geistMono.variable} 
        ${cause.variable}
        ${combo.variable}
        ${bumbel.variable}
        ${beachday.variable}
        ${ettamelody.variable}
        ${starbim.variable}
        ${cupidvibes.variable}
        h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
