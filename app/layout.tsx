import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono, Petit_Formal_Script, Sarina, Praise, Italianno, Imperial_Script, Abril_Fatface } from 'next/font/google';
import { AnimatePresence } from 'motion/react';
import './globals.css';
import GlobalBrandLink from './global-brand-link';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-header',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const petitFormalScript = Petit_Formal_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-script',
});

const sarina = Sarina({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-sarina',
});

const praise = Praise({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-praise',
});

const italianno = Italianno({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-italianno',
});

const imperialScript = Imperial_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-imperial',
});

const abrilFatface = Abril_Fatface({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-abril',
});

export const metadata: Metadata = {
  title: 'Elemental Beauty | Where Science Meets Skincare',
  description: 'University cosmetic chemistry club management portal and public site.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} ${petitFormalScript.variable} ${sarina.variable} ${praise.variable} ${italianno.variable} ${imperialScript.variable} ${abrilFatface.variable}`}>
      <body suppressHydrationWarning className="bg-aesthetic-white text-rich-black antialiased">
        <GlobalBrandLink />
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </body>
    </html>
  );
}
