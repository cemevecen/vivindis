"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

/**
 * Clerk anahtarı yoksa (boş .env) uygulama yine ayağa kalksın diye provider atlanır.
 * Oturum 5'te middleware ve tam auth akışı eklenecek.
 */
export function VivindisClerkProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  if (!publishableKey.length) {
    return children;
  }
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}
