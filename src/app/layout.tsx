import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

/**
 * 700 and 800 are loaded because two places ask for them: the services `bold`
 * variant sets the title to 800, and this home page's display type is 700.
 * Without the real faces the browser synthesises a fake bold, which smears the
 * letterforms — the README has said 400–800 all along; only 400–600 was
 * actually being fetched.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AIODYX — Custom ERP systems built on Odoo",
  description:
    "AIODYX designs and builds ERP systems on Odoo — a real alternative to scattered spreadsheets and disconnected apps, with one system tailored to how you work.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
