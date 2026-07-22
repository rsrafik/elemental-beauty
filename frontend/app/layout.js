import { Geist, Geist_Mono } from "next/font/google";
import { Cause } from "next/font/google";
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

const bumbel = localFont({
  src: "./fonts/Bumbel.woff2",
  variable: "--font-bumbel",
});

const beachday = localFont({
  src: "./fonts/Beachday.woff2",
  variable: "--font-beachday",
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
        ${bumbel.variable} 
        ${beachday.variable} 
        h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
