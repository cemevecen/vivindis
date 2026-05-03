import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/providers/app-providers";
import { VivindisClerkProvider } from "@/components/providers/clerk-provider";

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
  title: {
    default: "Vivindis",
    template: "%s | Vivindis",
  },
  description:
    "Google Play ve App Store yorumlarını toplu çekip analiz eden SaaS platformu.",
};

/**
 * Kök düzen: `lang` / `dir` varsayılanı; gerçek locale için `LocaleHtmlAttributes` (Oturum 5).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
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
