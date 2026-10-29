import type { Metadata } from "next";
import { inter } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Panel administracyjny",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
