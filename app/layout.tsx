import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JuaLink — Find trusted local makers",
  description:
    "JuaLink connects customers with Jua Kali artisans making gates, furniture, doors, desks, lockers, repairs, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
