import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelPaws — Pelihara Hewan Retro",
  description:
    "Game web retro buat pelihara kucing, anjing, atau kelinci. Rawat, main, dan lihat mereka berevolusi!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
