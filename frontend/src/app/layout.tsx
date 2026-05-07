import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/providers/app-providers";
import { VivindisClerkProvider } from "@/components/providers/clerk-provider";
import { getSiteUrl } from "@/lib/site-url";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Vivindis",
    template: "%s | Vivindis",
  },
  description:
    "Google Play ve App Store yorumlarını toplu çekip analiz eden SaaS platformu.",
};

/**
 * Kök düzen: `lang` / `dir` istek başlıklarından (middleware); yoksa TR.
 * `LocaleHtmlAttributes` istemci geçişlerinde eşitler.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = headers();
  const locale = h.get("x-vivindis-locale") ?? "tr";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-screen bg-background font-sans text-foreground antialiased",
        )}
      >
        <VivindisClerkProvider>
          <AppProviders>{children}</AppProviders>
        </VivindisClerkProvider>
      </body>
    </html>
  );
}
