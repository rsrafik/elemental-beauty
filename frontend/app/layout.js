import { Be_Vietnam_Pro } from "next/font/google";
import { Delicious_Handrawn } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const bevietnampro = Be_Vietnam_Pro({
  variable: "--font-vietnam",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const delicioushandrawn = Delicious_Handrawn({
  variable: "--font-handrawn",
  subsets: ["latin"],
  weight: "400",
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

const aalto = localFont({
  src: "./fonts/Aalto.woff2",
  variable: "--font-aalto",
});

const beautifulbg = localFont({
  src: "./fonts/BeautifulBackground.woff2",
  variable: "--font-beautifulbg",
});

const canobis = localFont({
  src: "./fonts/Canobis.woff2",
  variable: "--font-canobis",
});

const reasons = localFont({
  src: "./fonts/CertainReasons.woff2",
  variable: "--font-reasons",
});

export const metadata = {
  title: "Elemental Beauty",
  description: "Purdue's cosmetic science club",
  // The flower in public/ does double duty as the tab icon and the icon iOS
  // uses when the site is saved to a home screen.
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`
        ${bevietnampro.variable}
        ${delicioushandrawn.variable}
        ${bumbel.variable}
        ${beachday.variable}
        ${ettamelody.variable}
        ${starbim.variable}
        ${cupidvibes.variable}
        ${aalto.variable}
        ${beautifulbg.variable}
        ${canobis.variable}
        ${reasons.variable}
        h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
