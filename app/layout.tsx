// app/layout.tsx
import type { Metadata } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-editorial",
});

export const metadata: Metadata = {
  title: "JuaLink — Find trusted local makers",
  description:
    "JuaLink connects customers with Jua Kali artisans making gates, furniture, doors, desks, lockers, repairs, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${workSans.variable} ${plexMono.variable} ${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}