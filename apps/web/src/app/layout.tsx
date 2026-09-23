import './globals.css';
import { PwaRegistrar } from '@/components/PwaRegistrar';
import { AppProviders } from '@/components/providers/AppProviders';

export const metadata = {
  title: 'Trip Copilot',
  description: 'Your journey-aware travel agent.',
};

// Pages render tenant-scoped canonical data and must not be statically built.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AppProviders>
          <PwaRegistrar />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}