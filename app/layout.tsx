import type { Metadata } from "next";
import "./globals.css";
import "./improvements.css";

export const metadata: Metadata = {
  title: "Aprova Concurso",
  description: "Trilhas de estudo e simulados baseados no edital do concurso de São Miguel do Araguaia.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="antialiased">{children}</body></html>;
}
