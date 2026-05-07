"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Toaster
      theme={theme}
      richColors
      position="top-center"
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
