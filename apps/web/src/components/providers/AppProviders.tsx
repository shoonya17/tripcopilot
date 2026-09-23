'use client';

import { useState } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  const content = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );

  return clerkConfigured ? (
    <ClerkProvider dynamic>{content}</ClerkProvider>
  ) : (
    content
  );
}