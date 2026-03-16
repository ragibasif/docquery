"use client";

import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="luxury" themes={["light", "luxury"]}>
      {children}
    </ThemeProvider>
  );
}
